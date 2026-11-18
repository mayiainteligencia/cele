"""Orquestador multi-plataforma: Facebook (flujo existente) + X, TikTok e Instagram (conectores x.py, tiktok.py, instagram.py).
Cada plataforma devuelve posts en el esquema común de Facebook (postId, text, time, url, likesCount, commentsCount, sharesCount, user)
más: plataforma, seguidores y metricas {reacciones, comentarios, compartidos, vistas} (None = sin dato)."""
from datetime import datetime, timedelta, timezone
import importlib
import json
import os
from pathlib import Path
import re
from typing import Any, Callable, Dict, List, Optional

from social import facebook as fb
from social import periodo as periodo_mod

BASE = Path(__file__).resolve().parents[1]
PLATAFORMAS = ("facebook", "x", "tiktok", "instagram")
# actor y costo de referencia (USD por 1,000 resultados, nivel gratuito de Apify) por plataforma; todo sobreescribible por .env
CONF = {
    "x": {"actor": "APIFY_ACTOR_X", "actor_def": "apidojo/tweet-scraper", "max": "APIFY_MAX_X", "costo": "APIFY_COSTO_X_1000", "costo_def": 0.4},
    "tiktok": {"actor": "APIFY_ACTOR_TIKTOK", "actor_def": "clockworks/tiktok-scraper", "max": "APIFY_MAX_TIKTOK", "costo": "APIFY_COSTO_TIKTOK_1000", "costo_def": 3.7},
    "instagram": {"actor": "APIFY_ACTOR_INSTAGRAM", "actor_def": "apify/instagram-scraper", "max": "APIFY_MAX_INSTAGRAM", "costo": "APIFY_COSTO_INSTAGRAM_1000", "costo_def": 2.7},
}


def normalizar(lista: Any) -> List[str]:
    """Plataformas válidas, sin repetir; Facebook por defecto."""
    out = [p for p in dict.fromkeys(str(x).strip().lower() for x in (lista or [])) if p in PLATAFORMAS]
    return out or ["facebook"]


def tope(p: str, modo: str = "tema") -> int:
    if p == "facebook":
        if modo == "persona":   # menciones de terceros: tope bajo
            return max(1, int(os.getenv("APIFY_MAX_PERSONA_FB", "15") or 15))
        return max(1, int(os.getenv("APIFY_MAX_POSTS", "20") or 20))
    return max(1, int(os.getenv(CONF[p]["max"], "30") or 30))


def costo_1000(p: str) -> float:
    if p == "facebook":
        return float(os.getenv("APIFY_COSTO_POR_RESULTADO_USD", "0.005") or 0.005) * 1000
    return float(os.getenv(CONF[p]["costo"], str(CONF[p]["costo_def"])) or CONF[p]["costo_def"])


def estimado(plataformas: List[str], modo: str = "tema", periodo: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Costo MÁXIMO por plataforma (tope de resultados x costo por 1,000) y total. Persona en Facebook consulta página y menciones: x2."""
    fb.load_env_file()
    live = fb.get_configured_fuente() == "apify"
    filas = {}
    for p in normalizar(plataformas):
        n = tope(p, modo)
        filas[p] = {"max_resultados": n, "costo_usd": round(n * costo_1000(p) / 1000, 3) if live else 0.0, "costo_1000_usd": costo_1000(p)}
    largo = bool(periodo) and (periodo["tipo"] == "todo" or periodo["tipo"] == "rango" or (periodo["dias"] or 0) > 14)
    aviso = ("Un periodo largo trae más publicaciones, pero el tope por plataforma sigue siendo el mismo: " + ", ".join(f"{p} {f['max_resultados']}" for p, f in filas.items())
             + ". La muestra puede quedar limitada.") if largo else None
    return {"en_vivo": live, "plataformas": filas, "total_usd": round(sum(f["costo_usd"] for f in filas.values()), 3), "aviso_periodo": aviso,
            "nota_todo": "Incluye contenido antiguo; las cifras pueden no reflejar la conversación actual" if periodo and periodo["tipo"] == "todo" else None}


# ───────── utilidades de los conectores ─────────
def slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", fb.normalize_text_no_accents(texto or ""))


def usuario(v: Any) -> str:
    """Handle limpio (sin @ ni URL); '' si no es válido. Se usa para armar consultas a servicios externos."""
    t = str(v or "").strip().rstrip("/").split("?")[0].split("/")[-1].lstrip("@")
    return t if re.match(r"^[A-Za-z0-9._]{1,40}$", t) else ""


def lugar_terminos(alcance: Optional[Dict[str, Any]]) -> List[str]:
    """Nombre del estado/municipio y sus alias (config/plataformas.json); sin depender de geotags."""
    nombre = fb.resolve_scope_place_name(alcance)
    if not nombre:
        return []
    try:
        alias = json.loads((BASE / "config" / "plataformas.json").read_text(encoding="utf-8")).get("alias_lugar", {})
    except Exception:
        alias = {}
    return list(dict.fromkeys([nombre, *alias.get(fb.normalize_text_no_accents(nombre), [])]))


HASHTAG = re.compile(r"#(\w{2,40})", re.UNICODE)


def nuevo_post(plataforma: str, id: Any, texto: Any, autor: Any, autor_id: Any, handle: str, seguidores: Any, ts: str, url: str,
               reacciones: Any, comentarios: Any, compartidos: Any, vistas: Any) -> Dict[str, Any]:
    num = lambda v: int(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None   # None = sin dato
    m = {"reacciones": num(reacciones), "comentarios": num(comentarios), "compartidos": num(compartidos), "vistas": num(vistas)}
    return {
        "postId": str(id or url or ""), "plataforma": plataforma, "text": str(texto or "").strip(), "time": ts or "", "url": url or "",
        "likesCount": m["reacciones"] or 0, "commentsCount": m["comentarios"] or 0, "sharesCount": m["compartidos"] or 0,
        "user": {"id": str(autor_id or ""), "name": str(autor or handle or "Usuario"), "usuario": handle or "", "profilePic": ""},
        "seguidores": num(seguidores), "metricas": m, "hasOwnText": bool(texto), "texto_origen": "propio", "media": [], "link": None,
        "hashtags": [h.lower() for h in HASHTAG.findall(str(texto or ""))][:15], "formato": "texto", "duracion": None,
    }


def _modulo(p: str):
    return importlib.import_module(f"social.{p}")


def _fixture(p: str) -> List[Dict[str, Any]]:
    f = BASE / "fixtures" / f"{p}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def marcar_origen(items: List[Dict[str, Any]], p: str, modo: str, ficha: Optional[Dict[str, Any]]) -> None:
    """En modo Persona: lo escrito desde la cuenta de la ficha es 'publicado_por_persona'; lo demás, 'mencion'."""
    if modo != "persona":
        return
    mia = usuario((ficha or {}).get(f"usuario_{p}")).lower()
    for it in items:
        it["origen_post"] = "publicado_por_persona" if mia and it["user"].get("usuario", "").lower() == mia else "mencion"


def buscar_una(p: str, tema: str, modo: str, alcance: Optional[Dict[str, Any]], ficha: Optional[Dict[str, Any]],
               refrescar: bool, before_call: Optional[Callable], periodo: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Una plataforma distinta de Facebook. Devuelve {items, crudos, origen, consultas}; lanza si falla (el orquestador lo registra)."""
    fb.load_env_file()
    mod = _modulo(p)
    periodo = periodo or periodo_mod.resolver()
    if fb.get_configured_fuente() == "fixture":
        raws, origen, consultas = _fixture(p), "fixture", []
    else:
        payload, consultas = mod.entradas(tema, modo, lugar_terminos(alcance), ficha, periodo, tope(p))
        if not consultas:
            raise RuntimeError("No hay consultas posibles: faltan datos en la ficha o el tema")
        actor = os.getenv(CONF[p]["actor"], CONF[p]["actor_def"]).strip() or CONF[p]["actor_def"]
        mapper = lambda rs: [m for m in (mod.mapear(r) for r in rs if isinstance(r, dict)) if m]
        items, origenes = [], []
        for pl_ in (payload if isinstance(payload, list) else [payload]):   # una corrida por payload (p. ej. Instagram: hashtags y etiquetados)
            clave = fb._persona_cache_key(f"plat-{p}", json.dumps(pl_, sort_keys=True, ensure_ascii=False), tope(p))
            got, o = fb._cached_or_run(clave, {"plataforma": p, "consultas": consultas}, lambda pl_=pl_: fb._run_actor(actor, pl_, before_call), mapper, refrescar)
            items += got
            origenes.append(o)
        origen = "apify" if "apify" in origenes else "cache"
        marcar_origen(items, p, modo, ficha)
        return {"items": items, "crudos": len(items), "origen": origen, "consultas": consultas}
    items = [m for m in (mod.mapear(r) for r in raws if isinstance(r, dict)) if m]
    marcar_origen(items, p, modo, ficha)
    return {"items": items, "crudos": len(items), "origen": origen, "consultas": consultas}


def etiquetar_facebook(it: Dict[str, Any]) -> None:
    """Posts de Facebook (flujo existente): agrega plataforma y metricas con el mismo formato que las demás."""
    it.setdefault("plataforma", "facebook")
    it.setdefault("metricas", {"reacciones": it.get("likesCount"), "comentarios": it.get("commentsCount"), "compartidos": it.get("sharesCount"), "vistas": None})


def estado_inicial(p: str) -> Dict[str, Any]:
    return {"estado": "ok", "motivo": None, "crudos": 0, "con_texto": 0, "relevantes": 0, "origen": None, "costo_usd": 0.0, "tope": tope(p), "limitada": False}


def ejecutar(tema: str, modo: str, alcance: Optional[Dict[str, Any]], plataformas: List[str], ficha: Optional[Dict[str, Any]] = None,
             refrescar: bool = False, before_call: Optional[Callable] = None, incluir_facebook: bool = True,
             periodo: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Corre cada plataforma por separado: si una falla o viene vacía se registra el motivo y el resto continúa."""
    items: List[Dict[str, Any]] = []
    estados: Dict[str, Dict[str, Any]] = {}
    extra: Dict[str, Any] = {}
    origenes = []
    for p in normalizar(plataformas):
        if p == "facebook" and not incluir_facebook:
            continue
        est = estado_inicial(p)
        estados[p] = est
        try:
            if p == "facebook" and modo == "persona":
                from social import persona   # menciones de terceros por variantes del nombre (tope bajo)
                r = persona.facebook_menciones(tema, ficha, alcance, refrescar, before_call)
                got, origen = r["items"], r["origen"]
                for it in got:
                    etiquetar_facebook(it)
                if origen == "apify" and before_call:
                    before_call()
            elif p == "facebook":
                fetched = fb.fetch_facebook_posts(tema=tema, modo=modo, alcance=alcance, refresh=refrescar)
                got = fetched.get("items") or []
                for it in got:
                    etiquetar_facebook(it)
                origen = fetched.get("origen") or fetched.get("source") or ""
                if origen == "apify" and before_call:
                    before_call()   # cuenta la búsqueda real en el límite por hora
                extra = {"fetched": fetched}
                if fetched.get("error"):
                    est["motivo"] = fetched["error"]
            else:
                r = buscar_una(p, tema, modo, alcance, ficha, refrescar, before_call, periodo)
                got, origen = r["items"], r["origen"]
            items += got
            est.update(origen=origen, crudos=len(got), tope=tope(p, modo), limitada=len(got) >= tope(p, modo))   # alcanzó el tope: la muestra puede ser parcial
            if origen == "apify":
                est["costo_usd"] = round(len(got) * costo_1000(p) / 1000, 4)
            origenes.append(origen)
            if not got:
                est.update(estado="vacío", motivo=est["motivo"] or "La fuente no devolvió publicaciones para esta consulta")
        except Exception as exc:
            detalle = getattr(exc, "detail", None) or str(exc)
            est.update(estado="error", motivo=str(detalle)[:240])
            print(f"[plataformas] {p} falló: {detalle}")
    for it in items:
        est = estados.get(it.get("plataforma", "facebook"))
        if est is not None and (it.get("text") or "").strip():
            est["con_texto"] += 1
    return {"items": items, "estados": estados, "origen": "apify" if any(o in ("apify", "cache") for o in origenes) else "fixture", **extra}


def completar_estados(estados: Dict[str, Dict[str, Any]], resumen: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Agrega los relevantes por plataforma (después del pipeline)."""
    for p, est in estados.items():
        est["relevantes"] = sum(1 for x in resumen.get("posts_recientes", []) if x.get("plataforma", "facebook") == p)
    return estados
