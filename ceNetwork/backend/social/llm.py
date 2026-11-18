"""Capa única de Gemini: lista ordenada de modelos con respaldo por cuota, reintento de JSON roto y log por llamada.

Todo el backend llama a `generar()` / `generar_json()`; nadie más importa google.genai.
"""
import contextvars
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
import threading
import json
import os
import re
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

MODELOS_POR_DEFECTO = "gemini-2.5-flash"
_agotados: Dict[str, float] = {}   # modelo -> epoch hasta el que se evita
_info: Dict[str, Dict[str, Any]] = {}   # modelo -> ultimo_error, tipo (minuto|diario|no_disponible|saturado|error), codigo HTTP, latencia media (s), penal_hasta, hasta
_descubiertos: List[str] = []
_descubierto_en = 0.0
PROVEEDORES_ALTERNOS: Dict[str, Any] = {}   # punto de extensión: nombre -> fn(prompt, json_mode) -> str; se usa con LLM_FALLBACK_PROVIDER
_ESTADO = Path(os.getenv("LLM_ESTADO_ARCHIVO") or Path(__file__).resolve().parents[1] / ".cache" / "llm_estado.json")


def _cargar_estado() -> None:
    try:
        d = json.loads(_ESTADO.read_text(encoding="utf-8"))
        for m, v in d.items():
            if float(v.get("disponible_desde", 0)) > time.time():
                _agotados[m] = float(v["disponible_desde"])
            _info[m] = {k: x for k, x in v.items() if k != "disponible_desde"}
    except Exception:
        pass


def _guardar_estado() -> None:
    try:
        _ESTADO.parent.mkdir(parents=True, exist_ok=True)
        _ESTADO.write_text(json.dumps({m: {**_info.get(m, {}), "disponible_desde": _agotados.get(m, 0)} for m in set(_info) | set(_agotados)},
                                      ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


_peticiones: Dict[str, List[float]] = {}   # modelo -> instantes de las llamadas del último minuto
_cerrojo = threading.Lock()


def _rpm() -> int:
    return max(1, int(os.getenv("LLM_RPM", "5") or 5))


def peticiones_ultimo_minuto(modelo: str) -> int:
    corte = time.time() - 60
    return len([t for t in _peticiones.get(modelo, []) if t > corte])


def _reservar(modelo: str) -> bool:
    """Toma un lugar del cupo por minuto del modelo; False si ya lo consumió (se pasa al siguiente antes de pedir)."""
    with _cerrojo:
        corte = time.time() - 60
        v = [t for t in _peticiones.get(modelo, []) if t > corte]
        _peticiones[modelo] = v
        if len(v) >= _rpm():
            return False
        v.append(time.time())
        return True


def _espera_cupo(modelos: List[str]) -> float:
    """Segundos hasta que alguno de los modelos recupera un lugar."""
    with _cerrojo:
        return min((v[0] + 60 - time.time() for m in modelos if (v := _peticiones.get(m)) and len(v) >= _rpm()), default=0.0)


def _marcar(modelo: str, hasta: float, tipo: str, error: str, codigo: Optional[int] = None) -> None:
    _agotados[modelo] = hasta
    _info[modelo] = {**_info.get(modelo, {}), "ultimo_error": error[:200], "tipo": tipo, "codigo": codigo, "hasta": hasta}
    if tipo in ("saturado", "timeout", "error"):   # los que fallan por saturación o tardan pasan al final unos minutos
        _info[modelo]["penal_hasta"] = time.time() + _penal_s()
    _guardar_estado()


def _penal_s() -> float:
    return float(os.getenv("LLM_PENAL_S", "300") or 300)


def _exito(modelo: str, latencia: float) -> None:
    i = _info.setdefault(modelo, {})
    i["codigo"] = 200
    i["latencia"] = round(latencia if not i.get("latencia") else 0.7 * i["latencia"] + 0.3 * latencia, 2)   # media móvil
    if latencia > float(os.getenv("LLM_LENTO_S", "10") or 10):
        i["penal_hasta"] = time.time() + _penal_s()
    _guardar_estado()


def _ordenar(modelos: List[str]) -> List[str]:
    """Orden configurado, salvo los penalizados (503 o lentos hace poco), que pasan al final."""
    ahora = time.time()
    return sorted(modelos, key=lambda m: _info.get(m, {}).get("penal_hasta", 0) > ahora)   # sorted es estable


def reintentar_ahora() -> None:
    """Ignora todas las esperas: la siguiente petición prueba cada modelo una vez."""
    _agotados.clear()
    _guardar_estado()


def estado_modelos() -> List[Dict[str, Any]]:
    ahora = time.time()
    return [{"modelo": m, "estado": "en_espera" if _agotados.get(m, 0) > ahora else "disponible",
             "tipo": _info.get(m, {}).get("tipo") or None, "codigo": _info.get(m, {}).get("codigo"), "latencia_media": _info.get(m, {}).get("latencia"),
             "disponible_desde": _hhmm(_info[m]["hasta"]) if _info.get(m, {}).get("hasta") and _agotados.get(m, 0) <= ahora else None,
             "penalizado": _info.get(m, {}).get("penal_hasta", 0) > ahora, "ultimo_error": _info.get(m, {}).get("ultimo_error") or None,
             "vuelve": _hhmm(_agotados[m]) if _agotados.get(m, 0) > ahora else None, "ultimo_minuto": peticiones_ultimo_minuto(m), "rpm": _rpm(), "descubierto": m in _descubiertos}
            for m in _ordenar(_modelos(False))]


class CuotaAgotada(Exception):
    """Ningún modelo pudo responder. es_cuota=False cuando fue por otro error (p. ej. búsqueda web no disponible en el plan)."""
    def __init__(self, mensaje: str, es_cuota: bool = True) -> None:
        super().__init__(mensaje)
        self.es_cuota = es_cuota


def _hhmm(epoch: float) -> str:
    return datetime.fromtimestamp(epoch).astimezone().strftime("%H:%M")


def disponible_en(analisis: bool = False) -> Optional[float]:
    """Momento (epoch) en que volverá a haber un modelo disponible; None si alguno ya lo está."""
    espera = [_agotados.get(m, 0) for m in _modelos(analisis)]
    return None if not espera or min(espera) <= time.time() else min(espera)


def todos_agotados(analisis: bool = False) -> bool:
    return hay_clave() and disponible_en(analisis) is not None


def mensaje_cuota(analisis: bool = False) -> str:
    """«Cuota de IA agotada hasta las HH:MM» (hora local), en lugar de un mensaje genérico."""
    t = disponible_en(analisis)
    en_espera = [m for m in _modelos(analisis) if _agotados.get(m, 0) > time.time()]
    tipos = [_info.get(m, {}).get("tipo") for m in en_espera]
    if en_espera and all(x == "saturado" for x in tipos):
        return "Modelos de IA saturados, reintenta en unos segundos"
    if en_espera and not any(x in ("minuto", "diario") for x in tipos):   # sin cuota ni 503: se muestra el error exacto
        return f"IA no disponible: {_info.get(en_espera[0], {}).get('ultimo_error') or 'error'}"
    return f"Cuota de IA agotada hasta las {_hhmm(t)}" if t else "Cuota de IA agotada: reintenta en unos minutos"


class _Sesion:
    """Lo ocurrido en la petición HTTP en curso (un contexto asyncio por petición)."""
    def __init__(self) -> None:
        self.modelos: List[str] = []
        self.cambio_por_cuota = False
        self.agotado = False
        self.llamadas = 0


_sesion: contextvars.ContextVar[Optional[_Sesion]] = contextvars.ContextVar("llm_sesion", default=None)


def sesion() -> _Sesion:
    s = _sesion.get()
    if s is None:
        s = _Sesion()
        _sesion.set(s)
    return s


def info_sesion() -> Dict[str, Any]:
    s = sesion()
    t = disponible_en() if s.agotado else None
    return {"modelos_usados": list(dict.fromkeys(s.modelos)), "cambio_por_cuota": s.cambio_por_cuota, "cuota_agotada": s.agotado,
            "cuota_hasta": _hhmm(t) if t else None, "aviso": mensaje_cuota() if s.agotado else None}


def hay_clave() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def _modelos(analisis: bool) -> List[str]:
    raw = (os.getenv("GEMINI_MODELS_ANALISIS", "").strip() if analisis else "") or os.getenv("GEMINI_MODELS", "").strip() \
        or os.getenv("GEMINI_MODEL", "").strip() or MODELOS_POR_DEFECTO
    lista = list(dict.fromkeys(m.strip() for m in raw.split(",") if m.strip()))   # el orden configurado manda siempre
    if os.getenv("GEMINI_DESCUBRIR_MODELOS", "").strip() == "1":
        _descubrir()
        lista += [m for m in _descubiertos if m not in lista][:max(0, MAX_MODELOS - len(lista))]
    return lista


_EXCLUIR = ("image", "tts", "audio", "live", "embedding", "nano-banana", "omni", "robotics", "computer-use", "antigravity",
            "deep-research", "transcribe", "aqa", "lyria", "customtools")
MAX_MODELOS = 8


def _listar_api() -> List[Tuple[str, List[str]]]:
    """(nombre, acciones) de models.list del SDK. Punto que las pruebas sustituyen."""
    from google import genai  # type: ignore
    c = genai.Client(api_key=os.getenv("GEMINI_API_KEY", "").strip())
    return [((m.name or "").replace("models/", ""), list(getattr(m, "supported_actions", None) or [])) for m in c.models.list()]


def _descubrir() -> None:
    """Al primer uso y cada 6 h: añade al final los modelos con generateContent que no sean de imagen, audio, embeddings ni preview."""
    global _descubierto_en, _descubiertos
    if not hay_clave() or time.time() - _descubierto_en < 6 * 3600:
        return
    _descubierto_en = time.time()   # también tras un fallo: no reintenta en cada petición
    try:
        base = [m.strip() for m in os.getenv("GEMINI_MODELS", "").split(",") if m.strip()]
        sitio = max(0, MAX_MODELOS - len(base))
        _descubiertos = []
        for n, acc in _listar_api():
            if len(_descubiertos) >= sitio:
                break
            if n in base or not n.startswith("gemini") or "generateContent" not in acc or any(k in n for k in _EXCLUIR):
                continue
            try:   # llamada de prueba: los que dan 404 se descartan
                _llamar(n, "ok", False, False)
            except Exception as exc:
                if _es_no_disponible(str(exc)):
                    continue
            _descubiertos.append(n)
        print(f"[llm] modelos descubiertos: {_descubiertos}")
    except Exception as exc:
        print(f"[llm] no se pudo listar modelos: {str(exc)[:100]}")


def _hasta_medianoche_pacifico() -> float:
    ahora = datetime.now(ZoneInfo("America/Los_Angeles"))
    return (ahora + timedelta(days=1)).replace(hour=0, minute=0, second=5, microsecond=0).timestamp()


def _es_cuota(msg: str) -> bool:
    return any(k in msg for k in ("429", "RESOURCE_EXHAUSTED", "quota", "Quota"))


def _es_diaria(msg: str) -> bool:
    return any(k in msg for k in ("PerDay", "per day", "daily", "Daily"))


def _es_transitorio(msg: str) -> bool:   # saturación real: lleva código 503
    return any(k in msg for k in ("503", "UNAVAILABLE", "overloaded"))


def _es_timeout(msg: str) -> bool:
    return any(k in msg for k in ("timed out", "Timeout", "timeout", "DEADLINE_EXCEEDED"))


def _es_no_disponible(msg: str) -> bool:
    return any(k in msg for k in ("404", "NOT_FOUND", "is not found", "not supported for generateContent"))


def _retry_delay(msg: str) -> Optional[float]:
    m = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", msg) or re.search(r"retry in (\d+(?:\.\d+)?)s", msg)
    return float(m.group(1)) + 1 if m else None


_cliente_unico: Any = None
_cerrojo_cliente = threading.Lock()


def _crear_cliente() -> Any:
    from google import genai  # type: ignore
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY", "").strip(),
                        http_options={"timeout": int(float(os.getenv("LLM_TIMEOUT_S", "20") or 20) * 1000)})


def _cliente(nuevo: bool = False) -> Any:
    """Un solo cliente por proceso, guardado a nivel de módulo y nunca cerrado.
    Causa del bug: `genai.Client(...).models.generate_content(...)` dejaba el Client sin referencia; al recolectarlo su __del__ cerraba
    el transporte HTTP compartido y las llamadas siguientes (o las paralelas) fallaban con «client has been closed»."""
    global _cliente_unico
    with _cerrojo_cliente:
        if _cliente_unico is None or nuevo:
            _cliente_unico = _crear_cliente()
        return _cliente_unico


def _cliente_cerrado(msg: str) -> bool:
    return "client has been closed" in msg


def _llamar(modelo: str, prompt: str, json_mode: bool, web: bool) -> str:
    """Una sola llamada al SDK. Punto único que las pruebas sustituyen. Si el cliente apareciera cerrado, lo recrea y reintenta una vez."""
    cfg: Dict[str, Any] = {"temperature": 0}
    if web:   # la búsqueda web no admite salida JSON forzada; el llamador parsea el texto
        from google.genai import types  # type: ignore
        cfg["tools"] = [types.Tool(google_search=types.GoogleSearch())]
    elif json_mode:
        cfg["response_mime_type"] = "application/json"
    try:
        resp = _cliente().models.generate_content(model=modelo, contents=prompt, config=cfg)
    except Exception as exc:
        if not _cliente_cerrado(str(exc)):
            raise
        resp = _cliente(nuevo=True).models.generate_content(model=modelo, contents=prompt, config=cfg)
    return resp.text or ""


def diagnostico() -> List[Dict[str, Any]]:
    """Una llamada real mínima por modelo; devuelve el resultado o el error exacto. No toca esperas ni penalizaciones."""
    def uno(m: str) -> Dict[str, Any]:
        t0 = time.time()
        try:
            texto = _llamar(m, "Responde solo: ok", False, False)
            return {"modelo": m, "ok": True, "latencia": round(time.time() - t0, 2), "respuesta": texto.strip()[:60], "error": None, "codigo": None}
        except Exception as exc:
            return {"modelo": m, "ok": False, "latencia": round(time.time() - t0, 2), "respuesta": None, "error": str(exc), "codigo": _codigo(exc)}
    with ThreadPoolExecutor(max_workers=4) as ex:
        return list(ex.map(uno, _modelos(False)))


def _codigo(exc: Exception) -> Optional[int]:
    c = getattr(exc, "code", None)
    if isinstance(c, int):
        return c
    m = re.search(r"\b([45]\d\d)\b", str(exc))
    return int(m.group(1)) if m else None


def _una(modelo: str, prompt: str, json_mode: bool, web: bool, simula: bool) -> str:
    """Una llamada medida (corre en hilo): registra latencia y código al terminar bien."""
    t0 = time.time()
    if simula:
        raise RuntimeError("429 RESOURCE_EXHAUSTED (simulado con LLM_SIMULAR_429=1) retryDelay: 20s")
    texto = _llamar(modelo, prompt, json_mode, web)
    _exito(modelo, time.time() - t0)
    return texto


def generar(prompt: str, *, json_mode: bool = False, analisis: bool = False, web: bool = False,
            tag: str = "") -> Optional[Tuple[str, str]]:
    """(texto, modelo) o None si no hay GEMINI_API_KEY. Lanza CuotaAgotada si ningún modelo puede responder.
    Recorre los modelos por salud; si el actual tarda más de LLM_PARALELO_S lanza el siguiente en paralelo (máx. 2) y gana la primera respuesta."""
    if not hay_clave():
        return None
    s = sesion()
    cooldown = int(os.getenv("LLM_COOLDOWN_SECONDS", "60") or 60)
    cooldown_503 = float(os.getenv("LLM_COOLDOWN_503_S", "20") or 20)
    simular = os.getenv("LLM_SIMULAR_429", "").strip() == "1"
    n_sim = int(os.getenv("LLM_SIMULAR_429_MODELOS", "1") or 1)
    modelos = _modelos(analisis)
    if disponible_en(analisis) is not None:   # todos en espera: responde de inmediato (la hora se recalcula en cada petición)
        s.agotado = True
        s.cambio_por_cuota = True
        r = _alterno(prompt, json_mode)
        if r:
            return r
        raise CuotaAgotada(mensaje_cuota(analisis), es_cuota=any(_info.get(m, {}).get("tipo") in ("minuto", "diario") for m in modelos))
    hubo_cuota, hubo_saturado, ultimo, lleno = False, False, "", []
    pendientes: Dict[Any, Tuple[str, float]] = {}
    cola = iter(_ordenar(modelos))
    ex = ThreadPoolExecutor(max_workers=2)

    def lanzar() -> bool:
        nonlocal hubo_cuota
        for modelo in cola:
            if _agotados.get(modelo, 0) > time.time():
                s.cambio_por_cuota = True
                hubo_cuota = hubo_cuota or _info.get(modelo, {}).get("tipo") in ("minuto", "diario")
                continue
            if not _reservar(modelo):   # cupo del minuto consumido: no se intenta, sin esperar al 429
                lleno.append(modelo)
                s.cambio_por_cuota = True
                continue
            pendientes[ex.submit(contextvars.copy_context().run, _una, modelo, prompt, json_mode, web, simular and modelos.index(modelo) < n_sim)] = (modelo, time.time())
            return True
        return False

    try:
        lanzar()
        paralelo = float(os.getenv("LLM_PARALELO_S", "8") or 8)
        cubierto = False   # ya se intentó el refuerzo en paralelo
        while pendientes:
            hechos, _ = wait(pendientes, timeout=None if cubierto or len(pendientes) > 1 else paralelo, return_when=FIRST_COMPLETED)
            if not hechos:   # el primero tarda: segundo modelo en paralelo
                cubierto = True
                if lanzar():
                    s.cambio_por_cuota = True
                continue
            for f in hechos:
                modelo, t0 = pendientes.pop(f)
                try:
                    texto = f.result()
                    s.llamadas += 1
                    s.modelos.append(modelo)
                    print(f"[llm] {tag or 'llamada'} modelo={modelo} cambio_cuota={s.cambio_por_cuota} "
                          f"tokens~{(len(prompt) + len(texto)) // 4} {time.time() - t0:.1f}s")
                    return texto, modelo
                except Exception as exc:   # 429, 503, timeout, 404: pasa al siguiente sin esperar
                    msg = str(exc)
                    ahora = time.time()
                    if _es_cuota(msg):
                        hubo_cuota = True
                        if _es_diaria(msg):
                            tipo, hasta = "diario", _hasta_medianoche_pacifico()
                        else:
                            tipo, hasta = "minuto", ahora + (_retry_delay(msg) or cooldown)
                    elif _es_no_disponible(msg):
                        tipo, hasta = "no_disponible", ahora + 24 * 3600
                    elif _es_transitorio(msg):   # solo el 503 es saturación
                        hubo_saturado = True
                        tipo, hasta = "saturado", ahora + cooldown_503
                    elif _cliente_cerrado(msg):   # fallo nuestro, no del modelo: sin espera ni penalización
                        tipo, hasta = "error_cliente", 0.0
                    elif _es_timeout(msg):
                        tipo, hasta = "timeout", ahora + cooldown_503
                    else:
                        tipo, hasta = "error", ahora + cooldown
                    ultimo = msg
                    if tipo == "error_cliente":
                        _info[modelo] = {**_info.get(modelo, {}), "ultimo_error": msg[:200], "tipo": tipo, "codigo": None}
                    elif not web or _es_cuota(msg):   # una búsqueda web no disponible en el plan no debe bloquear al modelo para lo demás
                        _marcar(modelo, hasta, tipo, msg, _codigo(exc))
                    s.cambio_por_cuota = True
                    print(f"[llm] {tag or 'llamada'} modelo={modelo} falló ({tipo}: {msg[:100]}){f'; disponible de nuevo a las {_hhmm(hasta)}' if hasta else ''}; pasa al siguiente")
                    if not pendientes:
                        lanzar()
    finally:
        ex.shutdown(wait=False)   # el hilo perdedor termina solo (acotado por LLM_TIMEOUT_S)
    if lleno:   # cola: si el cupo se libera pronto, espera y reintenta; si no, avisa
        espera = _espera_cupo(lleno)
        if 0 < espera <= float(os.getenv("LLM_COLA_MAX_S", "20") or 20):
            time.sleep(espera + 0.05)
            return generar(prompt, json_mode=json_mode, analisis=analisis, web=web, tag=tag)
        r = _alterno(prompt, json_mode)
        if r:
            return r
        s.agotado = True
        raise CuotaAgotada(f"Límite de {_rpm()} peticiones por minuto por modelo alcanzado: reintenta en {int(espera) + 1} s")
    r = _alterno(prompt, json_mode)
    if r:
        return r
    s.agotado = hubo_cuota or hubo_saturado
    if hubo_saturado and not hubo_cuota:
        raise CuotaAgotada("Modelos de IA saturados, reintenta en unos segundos")
    if not hubo_cuota:
        raise CuotaAgotada(f"Ningún modelo respondió: {ultimo}", es_cuota=False)
    raise CuotaAgotada(mensaje_cuota(analisis))


def _alterno(prompt: str, json_mode: bool) -> Optional[Tuple[str, str]]:
    """Proveedor alternativo (apagado salvo LLM_FALLBACK_PROVIDER registrado en PROVEEDORES_ALTERNOS)."""
    fn = PROVEEDORES_ALTERNOS.get(os.getenv("LLM_FALLBACK_PROVIDER", "").strip())
    if not fn:
        return None
    try:
        texto = fn(prompt, json_mode)
        sesion().modelos.append(os.getenv("LLM_FALLBACK_PROVIDER", ""))
        return texto, os.getenv("LLM_FALLBACK_PROVIDER", "")
    except Exception:
        return None


def _extraer_json(texto: str) -> Any:
    t = texto.strip()
    t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.M).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"(\{.*\}|\[.*\])", t, flags=re.S)
        if not m:
            raise
        return json.loads(m.group(1))


def generar_json(prompt: str, *, analisis: bool = False, tag: str = "") -> Optional[Tuple[Any, str]]:
    """(objeto, modelo). JSON mal formado: reintenta una vez el mismo modelo y luego pasa al siguiente.
    None si no hay clave; CuotaAgotada si se agotan todos. Si ningún modelo da JSON válido devuelve None."""
    if not hay_clave():
        return None
    ya_fallo: List[str] = []
    s = sesion()
    while True:
        r = generar(prompt, json_mode=True, analisis=analisis, tag=tag)   # CuotaAgotada sube al llamador
        if r is None:
            return None
        texto, modelo = r
        try:
            return _extraer_json(texto), modelo
        except Exception:
            pass
        r = generar(prompt, json_mode=True, analisis=analisis, tag=f"{tag}:reintento-json")   # un reintento
        if r is not None:
            try:
                return _extraer_json(r[0]), r[1]
            except Exception:
                modelo = r[1]
        ya_fallo.append(modelo)
        _marcar(modelo, time.time() + int(os.getenv("LLM_COOLDOWN_SECONDS", "60") or 60), "error", "JSON inválido")
        s.cambio_por_cuota = True
        if len(ya_fallo) >= len(_modelos(analisis)):
            return None


extraer_json = _extraer_json
_cargar_estado()
