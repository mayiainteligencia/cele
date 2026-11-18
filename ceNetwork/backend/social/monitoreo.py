"""Monitoreo por ficha: serie de tiempo, picos, narrativas repetidas y alertas.
Privacidad: solo páginas/cuentas públicas y en agregado; de las cuentas que no son fuentes públicas conocidas
(oficial/político/medio en config/fuentes.json) NO se guarda ni se muestra nombre, enlace ni foto: solo un hash para contar cuentas distintas."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import statistics
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from social import facebook as fb
from social import llm
from social.cache import _get_firestore_client
from social.identidad import puntaje_identidad
from social.pipeline import analyze_post_sentiment, detect_known_source_type, load_fuentes_config, parse_iso_datetime

DIR = Path(__file__).resolve().parents[1] / ".cache" / "monitoreo"
ETIQUETA = "Por verificar por una persona"


class _Store:
    """Firestore (si hay credenciales) con respaldo en JSON local; misma idea que entidades.py."""
    def __init__(self, nombre: str):
        self.nombre = nombre

    def _file(self) -> Path:
        return DIR / f"{self.nombre}.json"

    def _local(self) -> Dict[str, Dict[str, Any]]:
        try:
            return json.loads(self._file().read_text(encoding="utf-8")) if self._file().exists() else {}
        except Exception:
            return {}

    def todos(self) -> List[Dict[str, Any]]:
        cli = _get_firestore_client()
        if cli is not None:
            try:
                return [d.to_dict() for d in cli.collection(f"monitoreo_{self.nombre}").stream()]
            except Exception as exc:
                print(f"[monitoreo] Firestore no disponible ({exc}); usando respaldo local.")
        return list(self._local().values())

    def poner(self, doc: Dict[str, Any]) -> None:
        store = self._local()
        store[doc["id"]] = doc
        DIR.mkdir(parents=True, exist_ok=True)
        self._file().write_text(json.dumps(store, ensure_ascii=False), encoding="utf-8")
        cli = _get_firestore_client()
        if cli is not None:
            try:
                cli.collection(f"monitoreo_{self.nombre}").document(doc["id"]).set(doc)
            except Exception as exc:
                print(f"[monitoreo] No se pudo escribir en Firestore ({exc}); queda en el respaldo local.")


PUNTOS, ALERTAS = _Store("puntos"), _Store("alertas")


def _env_int(k: str, d: int) -> int:
    return int(os.getenv(k, str(d)) or d)


def _env_float(k: str, d: float) -> float:
    return float(os.getenv(k, str(d)) or d)


def _hash(txt: str) -> str:
    return hashlib.sha256(txt.encode("utf-8")).hexdigest()[:12]


# ───────── Narrativas: posts casi idénticos (shingles de 3 palabras + Jaccard) ─────────
def _shingles(texto: str) -> set:
    t = fb.normalize_text_no_accents(re.sub(r"https?://\S+", " ", texto))
    toks = [w for w in re.split(r"[^a-z0-9#]+", t) if w]
    return {" ".join(toks[i:i + 3]) for i in range(max(1, len(toks) - 2))} if toks else set()


def agrupar_narrativas(posts: List[Dict[str, Any]], similitud: float) -> List[List[Dict[str, Any]]]:
    grupos: List[Dict[str, Any]] = []
    for p in posts:
        sh = _shingles(p.get("texto") or "")
        if not sh:
            continue
        for g in grupos:
            if len(sh & g["sh"]) / len(sh | g["sh"]) >= similitud:
                g["posts"].append(p)
                break
        else:
            grupos.append({"sh": sh, "posts": [p]})
    return [g["posts"] for g in grupos]


def _resumen_grupo(g: List[Dict[str, Any]]) -> Dict[str, Any]:
    tiempos = sorted(t for t in (parse_iso_datetime(p.get("time") or "") for p in g) if t)
    tags, links = {}, {}
    for p in g:
        for h in set(re.findall(r"#\w+", p.get("texto", ""))):
            tags[h.lower()] = tags.get(h.lower(), 0) + 1
        for u in set(re.findall(r"https?://\S+", p.get("texto", ""))):
            links[u] = links.get(u, 0) + 1
    return {
        "posts": len(g),
        "cuentas": len({p["cuenta_hash"] for p in g}),
        "primera": tiempos[0].isoformat() if tiempos else None,
        "ultima": tiempos[-1].isoformat() if tiempos else None,
        "hashtags_compartidos": [h for h, n in tags.items() if n >= 2],
        "enlaces_compartidos": [u for u, n in links.items() if n >= 2],
        "cuentas_publicas": sorted({p["cuenta"] for p in g if p.get("cuenta")}),
    }


# ───────── Gemini ─────────
def _gemini(prompt: str, json_mode: bool) -> Optional[str]:
    try:
        r = llm.generar(prompt, json_mode=json_mode, tag="monitoreo")
        return r[0] if r else None
    except Exception as exc:
        print(f"[monitoreo] Gemini falló: {exc}")
        return None


def analizar_grupo(g: List[Dict[str, Any]], ficha: Dict[str, Any]) -> Dict[str, str]:
    """Afirmación verificable, tono y explicación. Nunca dice que algo sea falso: solo describe y marca por verificar."""
    muestra = [p["texto"][:400] for p in g[:3]]
    raw = _gemini(
        'Estos textos casi idénticos mencionan a la persona de la ficha. Responde SOLO JSON {"afirmacion": "la afirmación verificable en UNA frase", '
        '"tono": "ataque"|"critica_legitima"|"neutral", "explicacion": "máx. 30 palabras"}. '
        "Describe, no juzgues: NO digas si es verdadera o falsa.\n"
        f"Ficha: {ficha['nombre']} ({ficha.get('cargo') or 'sin cargo'})\nTextos: {json.dumps(muestra, ensure_ascii=False)}", True)
    try:
        out = json.loads(raw or "{}")
        tono = str(out.get("tono") or "").lower()
        if out.get("afirmacion") and tono in ("ataque", "critica_legitima", "neutral"):
            return {"afirmacion": str(out["afirmacion"])[:300], "tono": tono, "explicacion": str(out.get("explicacion") or "")[:300]}
    except Exception:
        pass
    return {"afirmacion": g[0]["texto"][:200], "tono": "no_determinado", "explicacion": "Sin análisis de Gemini: revisar el texto manualmente."}


def borrador_respuesta(alerta: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> str:
    """Borrador con espacios [DATO A VALIDAR]; Gemini no debe inventar cifras ni citas."""
    datos = {k: alerta.get(k) for k in ("tipo", "afirmacion", "tono", "datos")}
    texto = _gemini(
        "Redacta un BORRADOR breve de respuesta pública en español para la entidad indicada ante la afirmación detectada. "
        "Reglas estrictas: no inventes cifras, fechas, nombres ni citas; donde falte un dato escribe [DATO A VALIDAR]; "
        "no acuses a nadie de coordinación ni de mentir; tono sereno. Termina con la línea 'BORRADOR: validar los [DATO A VALIDAR] antes de publicar.'\n"
        f"Entidad: {ficha['nombre'] if ficha else alerta.get('ficha_nombre')}\nDatos disponibles: {json.dumps(datos, ensure_ascii=False)}", False)
    if texto:
        return texto.strip()
    return ("Sobre lo que se comenta en redes (\"" + str(alerta.get("afirmacion") or "[DATO A VALIDAR]") + "\"): "
            "los datos disponibles son [DATO A VALIDAR]. La información oficial indica [DATO A VALIDAR] (fuente: [DATO A VALIDAR]).\n"
            "BORRADOR: validar los [DATO A VALIDAR] antes de publicar.")


# ───────── Picos ─────────
def evaluar_pico(menciones: int, previos: List[Dict[str, Any]], ahora: datetime) -> Dict[str, Any]:
    ventana = [p for p in previos if (parse_iso_datetime(p["fecha"]) or ahora) >= ahora - timedelta(days=14)]
    dias = len({(parse_iso_datetime(p["fecha"]) or ahora).date() for p in ventana})
    if dias < 7:
        return {"estado": "linea_base", "dias": dias, "mensaje": f"Línea base en construcción ({dias} de 7 días)"}
    vals = [p["menciones"] for p in ventana]
    media, desv = statistics.mean(vals), max(statistics.pstdev(vals), 1.0)
    z = (menciones - media) / desv
    pico = menciones >= _env_int("PICO_MIN_POSTS", 10) and z >= _env_float("PICO_DESVIACIONES", 3.0)
    return {"estado": "pico" if pico else "normal", "dias": dias, "media": round(media, 1), "desviacion": round(desv, 1), "z": round(z, 1)}


def _gravedad(n: int) -> str:
    return "alta" if n >= 20 else "media" if n >= 8 else "baja"


def estado_lineas_base(fichas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ahora = datetime.now(timezone.utc)
    puntos = PUNTOS.todos()
    out = []
    for f in fichas:
        if not f.get("monitoreo"):
            continue
        mios = sorted((p for p in puntos if p["ficha_id"] == f["id"]), key=lambda p: p["fecha"])
        ev = evaluar_pico(mios[-1]["menciones"], mios[:-1], ahora) if mios else {"estado": "linea_base", "dias": 0, "mensaje": "Línea base en construcción (0 de 7 días)"}
        out.append({"ficha_id": f["id"], "ficha": f["nombre"], "puntos": len(mios), **ev, "ultimo": mios[-1]["fecha"] if mios else None})
    return out


# ───────── Corrida ─────────
def _post_agregado(p: Dict[str, Any], fuentes: Dict[str, Any]) -> Dict[str, Any]:
    user = p.get("user") or {}
    tipo = detect_known_source_type(p, fuentes)
    publica = tipo in ("oficial", "politico", "medio")
    return {
        "cuenta_hash": _hash(str(user.get("id") or user.get("name") or "")),
        "cuenta": user.get("name") if publica else None,     # cuentas no públicas: sin nombre
        "tipo_fuente": tipo or "ciudadano",
        "time": p.get("time") or "",
        "url": p.get("url") if publica else None,            # ni enlace: llevaría al perfil
        "texto": (p.get("text") or "")[:400],
    }


def ejecutar(fichas: List[Dict[str, Any]], before_call) -> Dict[str, Any]:
    ahora = datetime.now(timezone.utc)
    max_posts = _env_int("MONITOREO_MAX_POSTS", 10)
    umbral = _env_int("IDENTIDAD_UMBRAL", 40)
    costo_item = _env_float("APIFY_COSTO_POR_RESULTADO_USD", 0.005)
    fuentes = load_fuentes_config()
    corrida: List[Dict[str, Any]] = []
    todos = PUNTOS.todos()
    for f in (x for x in fichas if x.get("monitoreo")):
        res: Dict[str, Any] = {"ficha": f["nombre"], "ficha_id": f["id"]}
        fb.STATS.update(llamadas=0, items=0)
        try:
            r = fb.fetch_persona_posts(f["nombre"], "", "", before_call, f, refresh=True, max_posts=max_posts)
        except HTTPException as exc:                       # límite por hora: se detiene toda la corrida
            res["omitida"] = exc.detail; corrida.append(res); break
        except RuntimeError as exc:
            res["error"] = str(exc); corrida.append(res); continue
        res["llamadas_apify"], res["items_crudos"] = fb.STATS["llamadas"], fb.STATS["items"]
        res["costo_estimado_usd"] = round(fb.STATS["items"] * costo_item, 3)

        aceptadas = [p for p in r["menciones"] if (p.get("text") or "").strip() and puntaje_identidad(p, f)[0] >= umbral]
        agregados = [_post_agregado(p, fuentes) for p in aceptadas]
        etiquetas = [analyze_post_sentiment(p)["label"] for p in aceptadas]
        clas = [e for e in etiquetas if e in ("pos", "neu", "neg")]
        for a, e in zip(agregados, etiquetas):
            a["sentimiento"] = e
        punto = {
            "id": f"{f['id']}_{ahora.strftime('%Y%m%dT%H%M%S')}", "ficha_id": f["id"], "fecha": ahora.isoformat(),
            "menciones": len(aceptadas), "negativas": etiquetas.count("neg"),
            "sentimiento": {k: round(100 * clas.count(k) / len(clas)) if clas else 0 for k in ("pos", "neu", "neg")},
            "posts": agregados,
        }
        previos = [p for p in todos if p["ficha_id"] == f["id"]]
        PUNTOS.poner(punto)
        res["punto"] = {"menciones": punto["menciones"], "negativas": punto["negativas"], "sentimiento": punto["sentimiento"]}
        res["pico"] = ev = evaluar_pico(punto["menciones"], previos, ahora)
        creadas = []
        if ev["estado"] == "pico":
            creadas.append(_crear_alerta(f, "pico", ahora, {
                "gravedad": _gravedad(punto["menciones"]),
                "resumen": f"Volumen atípico de menciones: {punto['menciones']} frente a un promedio de {ev['media']} (±{ev['desviacion']}) en los últimos 14 días. Por sí solo no implica difusión coordinada.",
                "datos": {"menciones": punto["menciones"], **{k: ev[k] for k in ("media", "desviacion", "z")}},
                "linea_tiempo": [], "afirmacion": None, "tono": None, "explicacion": None}, f"pico-{ahora.date()}"))
        for g in agrupar_narrativas(agregados, _env_float("NARRATIVA_SIMILITUD", 0.6)):
            s = _resumen_grupo(g)
            if s["posts"] < _env_int("NARRATIVA_MIN_POSTS", 3) or s["cuentas"] < _env_int("NARRATIVA_MIN_CUENTAS", 3):
                continue
            an = analizar_grupo(g, f)
            creadas.append(_crear_alerta(f, "narrativa", ahora, {
                "gravedad": _gravedad(s["posts"]),
                "resumen": f"Patrón consistente con difusión coordinada: {s['cuentas']} cuentas distintas publicaron textos casi idénticos"
                           f" entre {s['primera']} y {s['ultima']}. Requiere verificación por una persona.",
                "datos": s, **an,
                "linea_tiempo": sorted(({"hora": p["time"], "cuenta": p["cuenta"] or "cuenta ciudadana"} for p in g), key=lambda x: x["hora"]),
            }, "narr-" + _hash(sorted(g, key=lambda p: p["texto"])[0]["texto"][:80]) + f"-{ahora.date()}"))
        res["alertas_creadas"] = [a for a in creadas if a]
        corrida.append(res)
    return {"fecha": ahora.isoformat(), "fichas": corrida,
            "costo_total_estimado_usd": round(sum(c.get("costo_estimado_usd", 0) for c in corrida), 3),
            "nota_costo": "Estimación: items crudos × APIFY_COSTO_POR_RESULTADO_USD; no es la factura de Apify."}


def _crear_alerta(f: Dict[str, Any], tipo: str, ahora: datetime, campos: Dict[str, Any], clave: str) -> Optional[str]:
    aid = _hash(f["id"] + clave)
    if any(a["id"] == aid for a in ALERTAS.todos()):          # misma alerta el mismo día: no se duplica ni se reabre
        return None
    ALERTAS.poner({"id": aid, "fecha": ahora.isoformat(), "ficha_id": f["id"], "ficha_nombre": f["nombre"], "tipo": tipo,
                   "estado": "nueva", "etiqueta": ETIQUETA, **campos})
    return aid


def listar_alertas(estado: Optional[str] = None) -> List[Dict[str, Any]]:
    return sorted((a for a in ALERTAS.todos() if not estado or a["estado"] == estado), key=lambda a: a["fecha"], reverse=True)


def cambiar_estado(aid: str, estado: str) -> Optional[Dict[str, Any]]:
    a = next((x for x in ALERTAS.todos() if x["id"] == aid), None)
    if a and estado in ("nueva", "revisada", "descartada"):
        a["estado"] = estado
        ALERTAS.poner(a)
        return a
    return None


def alertas_contenido_antiguo(resumen: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> List[str]:
    """«Contenido antiguo que reaparece»: un post de más de 90 días con interacción que creció entre dos búsquedas guardadas,
    o un texto antiguo repetido por varias cuentas. Solo describe; no juzga si es verdadero."""
    from social import historial
    ahora = datetime.now(timezone.utc)
    f = ficha or {"id": "busqueda-" + str(resumen.get("id")), "nombre": (resumen.get("query") or {}).get("tema") or "Búsqueda"}
    creadas: List[Optional[str]] = []
    inter = lambda p: int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)
    previos: Dict[str, int] = {}
    for h in historial.listar()[:30]:
        if h["id"] == resumen.get("id"):
            continue
        r = (historial.obtener(h["id"]) or {}).get("resumen") or {}
        for p in (r.get("posts_recientes") or []) + (r.get("por_confirmar") or []):
            if p.get("url"):
                previos[p["url"]] = max(previos.get(p["url"], 0), inter(p))
        for p in r.get("historial_anterior") or []:
            if p.get("url"):
                previos[p["url"]] = max(previos.get(p["url"], 0), int(p.get("interacciones") or 0))
    for p in resumen.get("historial_anterior") or []:
        if p["dias_antiguedad"] <= 90 or not p.get("url") or p["url"] not in previos:
            continue
        antes, ahora_i = previos[p["url"]], int(p.get("interacciones") or 0)
        if ahora_i >= antes * 1.5 and ahora_i - antes >= 20:
            creadas.append(_crear_alerta(f, "contenido_antiguo", ahora, {
                "gravedad": "media", "resumen": f"Publicación de hace {p['dias_antiguedad']} días con interacción en aumento ({antes} a {ahora_i}).",
                "afirmacion": p["fragmento"], "tono": None, "explicacion": "Contenido antiguo que reaparece: su interacción creció entre dos búsquedas guardadas.",
                "datos": {"url": p["url"], "fecha": p["fecha"], "dias_antiguedad": p["dias_antiguedad"], "interacciones": ahora_i, "antes": antes, "plataforma": p["plataforma"]},
                "linea_tiempo": []}, "pico|" + p["url"]))
    for g in resumen.get("antiguo_repetido") or []:
        creadas.append(_crear_alerta(f, "contenido_antiguo", ahora, {
            "gravedad": "media", "resumen": f"Un texto de más de 90 días aparece repetido por {g['cuentas']} cuentas.",
            "afirmacion": g["fragmento"], "tono": None, "explicacion": "Contenido antiguo que reaparece: mismo texto en varias cuentas.",
            "datos": {"url": g.get("url"), "cuentas": g["cuentas"], "plataformas": g.get("plataformas")}, "linea_tiempo": []}, "repetido|" + g["titulo"]))
    return [a for a in creadas if a]
