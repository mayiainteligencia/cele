"""Referentes del territorio (creadores populares del lugar, hablen o no de la persona) y análisis de qué contenido funciona.
Todo lo calculable se calcula en código; Gemini solo clasifica temas en una petición por lotes y redacta borradores."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import statistics
import time
from typing import Any, Callable, Dict, List, Optional
from zoneinfo import ZoneInfo

import requests

from social import coincidencia, facebook as fb, llm, periodo as periodo_mod
from social.plataformas import slug, usuario as _usuario

BASE = Path(__file__).resolve().parents[1]
CACHE = BASE / ".cache" / "radar" / "fuentes"
NOTA_CONTENIDO = "Mide qué contenido genera interacción en cuentas de la zona; no mide dónde vive su audiencia"
TEMAS = ("humor", "noticias locales", "comunidad", "deportes", "gastronomia", "musica", "politica")
TONOS = ("humor", "informativo", "emotivo", "critico", "promocional")


def cfg() -> Dict[str, Any]:
    return json.loads((BASE / "config" / "radar.json").read_text(encoding="utf-8"))


def _norm(t: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", fb.normalize_text_no_accents(t or "").lower()).strip()


# ───────── caché por fuente (se guarda al terminar cada una) ─────────
def _cache_get(clave: str, horas: Optional[float] = None) -> Optional[Dict[str, Any]]:
    horas = horas if horas is not None else float(os.getenv("RADAR_CACHE_FUENTES_H", "24") or 24)
    f = CACHE / f"{hashlib.sha1(clave.encode()).hexdigest()[:16]}.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
        if datetime.fromisoformat(d["guardado"]) > datetime.now(timezone.utc) - timedelta(hours=horas):
            return d["datos"]
    except Exception:
        pass
    return None


def _cache_put(clave: str, datos: Dict[str, Any]) -> None:
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        (CACHE / f"{hashlib.sha1(clave.encode()).hexdigest()[:16]}.json").write_text(
            json.dumps({"guardado": datetime.now(timezone.utc).isoformat(), "datos": datos}, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        print(f"[referentes] No se pudo guardar el caché: {exc}")


# ───────── lugar ─────────
def hashtags_lugar(lugar: Dict[str, Any], maximo: int = 5) -> List[str]:
    """Hashtags del territorio: los de config/radar.json y los derivados del nombre del lugar."""
    conf = cfg().get("hashtags_lugar", {})
    out: List[str] = []
    for nivel in ("municipio", "estado"):
        for t in lugar.get(nivel, []):
            out += conf.get(_norm(t), [])
            if " " not in t or nivel == "municipio":
                out.append(slug(t))
    return [h for h in dict.fromkeys(x for x in out if x)][:maximo]


def _consulta_lugar(lugar: Dict[str, Any]) -> str:
    nombres = [t for t in [*lugar.get("municipio", []), *lugar.get("estado", [])] if t]
    return (nombres[0] if nombres else lugar.get("texto", "")).strip()


# ───────── YouTube: videos populares del lugar ─────────
def _dur_s(iso: str) -> Optional[int]:
    m = re.fullmatch(r"P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0) if m else None


def youtube_populares(lugar: Dict[str, Any], periodo: Dict[str, Any], unidades_max: int, refrescar: bool = False) -> Dict[str, Any]:
    """Videos más vistos del periodo con palabras del lugar (regionCode=MX: filtro por país, no por ciudad). La búsqueda cuesta ~100 unidades."""
    key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not key:
        return {"estado": "sin_clave", "motivo": "YouTube sin medir (falta YOUTUBE_API_KEY)", "posts": [], "unidades": 0}
    if unidades_max < 105:
        return {"estado": "sin_unidades", "motivo": f"YouTube sin medir (YOUTUBE_RADAR_MAX_UNIDADES={unidades_max}; la búsqueda cuesta ~105)", "posts": [], "unidades": 0}
    d0, _ = periodo_mod.fechas_consulta(periodo)
    ccaa = _consulta_lugar(lugar)
    clave = f"yt|{_norm(ccaa)}|{d0}"
    if not refrescar and (c := _cache_get(clave)) is not None:
        return {**c, "de_cache": True}
    api = "https://www.googleapis.com/youtube/v3"
    try:
        q = {"part": "snippet", "type": "video", "q": ccaa, "regionCode": "MX", "relevanceLanguage": "es", "order": "viewCount",
             "maxResults": int(cfg()["referentes"]["youtube_max_resultados"]), "key": key}
        if d0:
            q["publishedAfter"] = datetime.combine(d0, datetime.min.time(), tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        ids = [i["id"]["videoId"] for i in requests.get(f"{api}/search", params=q, timeout=15).json().get("items", []) if i.get("id", {}).get("videoId")]
        vids = requests.get(f"{api}/videos", params={"part": "snippet,statistics,contentDetails", "id": ",".join(ids), "key": key}, timeout=15).json().get("items", []) if ids else []
        cids = list(dict.fromkeys(v["snippet"]["channelId"] for v in vids))
        canales = {c["id"]: c for c in requests.get(f"{api}/channels", params={"part": "snippet,statistics", "id": ",".join(cids), "key": key}, timeout=15).json().get("items", [])} if cids else {}
    except Exception as exc:
        return {"estado": "error", "motivo": f"YouTube falló: {exc}", "posts": [], "unidades": 0}
    posts = []
    for v in vids:
        ch = canales.get(v["snippet"]["channelId"], {})
        subs = None if ch.get("statistics", {}).get("hiddenSubscriberCount") else int(ch.get("statistics", {}).get("subscriberCount") or 0) or None
        handle = str(ch.get("snippet", {}).get("customUrl") or "").lstrip("@")
        st = v.get("statistics", {})
        titulo = v["snippet"].get("title", "")
        posts.append({"plataforma": "youtube", "postId": v["id"], "text": titulo, "time": v["snippet"].get("publishedAt"), "url": f"https://www.youtube.com/watch?v={v['id']}",
                      "likesCount": int(st.get("likeCount") or 0), "commentsCount": int(st.get("commentCount") or 0), "sharesCount": 0,
                      "user": {"id": v["snippet"]["channelId"], "name": ch.get("snippet", {}).get("title") or v["snippet"].get("channelTitle", ""), "usuario": handle or v["snippet"]["channelId"]},
                      "seguidores": subs, "metricas": {"reacciones": int(st.get("likeCount") or 0), "comentarios": int(st.get("commentCount") or 0), "compartidos": None, "vistas": int(st.get("viewCount") or 0)},
                      "hashtags": [h.lower() for h in (v["snippet"].get("tags") or [])[:10]] + [h.lower() for h in re.findall(r"#(\w{2,40})", titulo)],
                      "duracion": _dur_s(v.get("contentDetails", {}).get("duration", "")), "bio": ch.get("snippet", {}).get("description", "") + " " + ch.get("snippet", {}).get("country", "")})
        posts[-1]["formato"] = "video corto" if (posts[-1]["duracion"] or 999) <= 60 else "video largo"
    res = {"estado": "ok", "motivo": None, "posts": posts, "unidades": 100 + 1 + (1 if cids else 0), "fecha": datetime.now(timezone.utc).isoformat()}
    _cache_put(clave, res)
    return res


# ───────── TikTok, Instagram y X con los actores ya configurados ─────────
def apify_populares(plataforma: str, lugar: Dict[str, Any], periodo: Dict[str, Any], before_call: Optional[Callable], refrescar: bool = False) -> Dict[str, Any]:
    """Posts populares del territorio: hashtags del lugar en TikTok e Instagram; búsqueda con el lugar, lang:es y mínimo de interacciones en X."""
    from social import plataformas as pl
    mod = pl._modulo(plataforma)
    tope_ = max(1, int(os.getenv("APIFY_RADAR_REF_MAX", str(cfg()["referentes"]["max_posts_por_fuente"])) or 30))
    tags = hashtags_lugar(lugar)
    if fb.get_configured_fuente() == "fixture":   # datos de ejemplo del fixture de cada plataforma
        items = [m for m in (mod.mapear(r) for r in pl._fixture(plataforma) if isinstance(r, dict)) if m]
        return {"estado": "ok", "motivo": None, "posts": items, "origen": "fixture"}
    d0, d1 = periodo_mod.fechas_consulta(periodo)
    if plataforma == "tiktok":
        payload = {"hashtags": tags, "resultsPerPage": max(1, tope_ // max(1, len(tags))), "profileSorting": "latest"}
    elif plataforma == "instagram":
        payload = {"directUrls": [f"https://www.instagram.com/explore/tags/{t}/" for t in tags], "resultsType": "posts", "resultsLimit": max(1, tope_ // max(1, len(tags)))}
        if d0:
            payload["onlyPostsNewerThan"] = d0.isoformat()
    else:
        rango = (f" since:{d0.isoformat()}" if d0 else "") + (f" until:{(d1 + timedelta(days=1)).isoformat()}" if d1 else "")
        payload = {"searchTerms": [f'"{_consulta_lugar(lugar)}" lang:es min_faves:{cfg()["referentes"]["x_min_faves"]}{rango} -filter:retweets'], "sort": "Top", "maxItems": tope_}
    if not tags and plataforma != "x":
        return {"estado": "error", "motivo": "No hay hashtags del lugar (agrégalos en config/radar.json)", "posts": []}
    actor = os.getenv(pl.CONF[plataforma]["actor"], pl.CONF[plataforma]["actor_def"]).strip()
    try:
        items, origen = fb._cached_or_run(fb._persona_cache_key(f"radar-ref-{plataforma}", json.dumps(payload, sort_keys=True)), {"fuente": "referentes", "plataforma": plataforma},
                                          lambda: fb._run_actor(actor, payload, before_call), lambda rs: [m for m in (mod.mapear(r) for r in rs if isinstance(r, dict)) if m], refrescar)
    except Exception as exc:
        return {"estado": "error", "motivo": f"{plataforma} falló: {getattr(exc, 'detail', exc)}", "posts": []}
    return {"estado": "ok" if items else "vacio", "motivo": None if items else "La fuente no devolvió publicaciones", "posts": items, "origen": origen}


def autores(posts: List[Dict[str, Any]], maximo: int) -> List[Dict[str, Any]]:
    """Autores con más interacción en los posts de una fuente; llevan sus posts para medirlos."""
    por: Dict[str, Dict[str, Any]] = {}
    for p in posts:
        u = p.get("user") or {}
        k = str(u.get("usuario") or u.get("id") or "").lower()
        if not k:
            continue
        a = por.setdefault(k, {"usuario": u.get("usuario") or u.get("id"), "nombre": u.get("name") or k, "plataforma": p.get("plataforma"), "seguidores": None, "posts": [], "bio": "", "total": 0})
        if isinstance(p.get("seguidores"), int):
            a["seguidores"] = max(a["seguidores"] or 0, p["seguidores"])
        a["bio"] = a["bio"] or p.get("bio", "")
        inter = int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)
        a["total"] += inter
        a["posts"].append({"fecha": p.get("time"), "texto": p.get("text") or "", "interacciones": inter})
    return sorted(por.values(), key=lambda a: -a["total"])[:maximo]


def habla_de_la_persona(posts: List[Dict[str, Any]], nombre: str, ficha: Optional[Dict[str, Any]]) -> str:
    """sí | no | sin dato: si algún post medido de la cuenta menciona a la persona (nombre o variantes)."""
    if not nombre or not posts:
        return "sin dato"
    return "sí" if any(coincidencia.pasa(coincidencia.puntuar({"text": p.get("texto") or p.get("text") or ""}, nombre, "persona", ficha)) for p in posts) else "no"


# ───────── contenido que funciona ─────────
def _tema_codigo(texto: str, hashtags: List[str]) -> str:
    t = f" {_norm(texto)} {' '.join(_norm(h) for h in hashtags)} "
    mejor, n = "otro", 0
    for tema, palabras in cfg()["temas_palabras"].items():
        c = sum(1 for w in palabras if f" {_norm(w)} " in t or _norm(w) in " ".join(_norm(h) for h in hashtags))
        if c > n:
            mejor, n = tema, c
    return mejor


def _inter(p: Dict[str, Any]) -> int:
    return int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)


def contenidos(posts: List[Dict[str, Any]], seguidores_por_cuenta: Dict[str, int]) -> List[Dict[str, Any]]:
    """Posts y videos de los referentes como filas de contenido, con tasa de interacción = interacciones / seguidores de su cuenta."""
    out = []
    for p in posts:
        u = p.get("user") or {}
        seg = p.get("seguidores") if isinstance(p.get("seguidores"), int) else seguidores_por_cuenta.get(f"{p.get('plataforma')}|{str(u.get('usuario') or '').lower()}")
        i = _inter(p)
        out.append({"plataforma": p.get("plataforma"), "autor": u.get("name"), "usuario": u.get("usuario"), "seguidores": seg, "formato": p.get("formato") or "texto", "duracion": p.get("duracion"),
                    "fecha": p.get("time") or "", "texto": (p.get("text") or "")[:200], "hashtags": p.get("hashtags") or [], "interacciones": i,
                    "vistas": (p.get("metricas") or {}).get("vistas"), "url": p.get("url") or "", "tasa": round(100 * i / seg, 3) if seg else None})
    return out


def analizar_contenido(items: List[Dict[str, Any]], clasificar: bool = True) -> Dict[str, Any]:
    """Patrones medidos en código; la clasificación de temas/tono usa Gemini en una sola petición y, sin cuota, hashtags y palabras clave."""
    tz = ZoneInfo("America/Mexico_City")
    base = {"base": len(items), "con_seguidores": sum(1 for c in items if c["tasa"] is not None), "fecha": datetime.now(timezone.utc).isoformat(), "nota": NOTA_CONTENIDO}
    if not items:
        return {**base, "vacio": True}
    clasificacion, aviso = "basica", "Clasificación básica (hashtags y palabras clave)"
    for c in items:
        c["tema"], c["tono"] = _tema_codigo(c["texto"], c["hashtags"]), None
    if clasificar and llm.hay_clave():
        top = sorted(items, key=lambda c: -c["interacciones"])[:40]
        prompt = (f'Clasifica cada contenido. Responde SOLO un arreglo JSON: {{"id": n, "tema": {"|".join(TEMAS)}|otro, "tono": {"|".join(TONOS)}}}.\n'
                  f'Contenidos: {json.dumps([{"id": i, "texto": c["texto"], "hashtags": c["hashtags"][:5]} for i, c in enumerate(top)], ensure_ascii=False)}')
        try:
            r = llm.generar_json(prompt, analisis=True, tag="contenido-temas")
            if r and isinstance(r[0], list):
                for it in r[0]:
                    try:
                        c = top[int(it.get("id"))]
                    except Exception:
                        continue
                    c["tema"] = it.get("tema") if it.get("tema") in (*TEMAS, "otro") else c["tema"]
                    c["tono"] = it.get("tono") if it.get("tono") in TONOS else None
                clasificacion, aviso = "gemini", None
        except llm.CuotaAgotada:
            aviso = f"Clasificación básica (hashtags y palabras clave): {llm.mensaje_cuota(True)}"

    def mediana(vals):
        return round(statistics.median(vals), 3) if vals else None
    por_formato = []
    for f in sorted({c["formato"] for c in items}):
        g = [c for c in items if c["formato"] == f]
        por_formato.append({"formato": f, "n": len(g), "tasa_mediana": mediana([c["tasa"] for c in g if c["tasa"] is not None]), "interaccion_media": round(sum(c["interacciones"] for c in g) / len(g), 1)})
    por_formato.sort(key=lambda r: (r["tasa_mediana"] is None, -(r["tasa_mediana"] or 0), -r["interaccion_media"]))
    tags: Dict[str, int] = {}
    for c in items:
        for h in set(c["hashtags"]):
            tags[h] = tags.get(h, 0) + 1
    por_tema: Dict[str, List[Dict[str, Any]]] = {}
    for c in items:
        por_tema.setdefault(c["tema"], []).append(c)
    temas = sorted(({"tema": t, "n": len(g), "tasa_mediana": mediana([c["tasa"] for c in g if c["tasa"] is not None])} for t, g in por_tema.items()), key=lambda r: (-(r["tasa_mediana"] or 0), -r["n"]))
    durs = [c["duracion"] for c in items if c["duracion"]]
    dias, horas = {}, {}
    DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    for c in items:
        v = c["tasa"] if c["tasa"] is not None else None
        try:
            dt = datetime.fromisoformat((c["fecha"] or "").replace("Z", "+00:00")).astimezone(tz)
        except Exception:
            continue
        if v is not None:
            dias.setdefault(DIAS[dt.weekday()], []).append(v)
            horas.setdefault(dt.hour, []).append(v)
    ranking = lambda d, fmt: sorted(({"clave": fmt(k), "tasa_media": round(sum(v) / len(v), 3), "n": len(v)} for k, v in d.items()), key=lambda r: -r["tasa_media"])[:3]
    ejemplos = sorted([c for c in items if c["tasa"] is not None], key=lambda c: -c["tasa"])[:5] or sorted(items, key=lambda c: -c["interacciones"])[:5]
    return {**base, "vacio": False, "por_formato": por_formato, "hashtags": sorted(tags.items(), key=lambda kv: -kv[1])[:10], "temas": temas,
            "duracion": {"mediana_s": int(statistics.median(durs)) if durs else None, "n": len(durs)},
            "mejores_dias": ranking(dias, str), "mejores_horas": ranking(horas, lambda h: f"{h:02d}:00"),
            "ejemplos": [{k: c[k] for k in ("plataforma", "autor", "formato", "texto", "url", "interacciones", "seguidores", "tasa", "tema")} for c in ejemplos],
            "clasificacion": clasificacion, "aviso_clasificacion": aviso}


def borrador_formatos(contenido: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Borradores de formatos para la persona basados SOLO en los patrones medidos. No copia creadores, ni contrata influencers, ni difusión simulada."""
    if contenido.get("vacio"):
        return {"estado": "sin_base", "mensaje": "No hay contenido medido de referentes: no hay patrones para sugerir formatos"}
    patrones = {k: contenido.get(k) for k in ("por_formato", "hashtags", "temas", "duracion", "mejores_dias", "mejores_horas")}
    prompt = ("Con SOLO estos patrones medidos de contenido de cuentas de la zona, propón hasta 5 formatos de publicación para una persona pública. Responde SOLO JSON "
              '{"formatos": [{"formato": str, "tema": str, "horario": str, "idea": str, "patron_base": str}]}. '
              "Reglas: cada idea cita el patrón medido que la respalda (patron_base); no inventes cifras ni citas; donde falte un dato escribe [DATO A VALIDAR]; "
              "PROHIBIDO sugerir copiar a un creador, contratar influencers, difusión simulada, bots o cuentas falsas.\n"
              f"Base: {contenido['base']} contenidos, {contenido['con_seguidores']} con tasa de interacción.\nPersona: {(ficha or {}).get('nombre') or 'sin ficha'}\n"
              f"Patrones: {json.dumps(patrones, ensure_ascii=False)}")
    try:
        r = llm.generar_json(prompt, analisis=True, tag="formatos")
    except llm.CuotaAgotada:
        return {"estado": "cuota_agotada", "mensaje": llm.mensaje_cuota(True)}
    if r is None or not isinstance(r[0], dict):
        return {"estado": "sin_respuesta", "mensaje": "Gemini no devolvió borradores válidos; reintenta."}
    fs = [{k: str(x.get(k) or "") for k in ("formato", "tema", "horario", "idea", "patron_base")} for x in r[0].get("formatos") or [] if isinstance(x, dict)][:5]
    return {"estado": "ok", "etiqueta": "Borrador: validar antes de publicar", "formatos": fs, "modelo": r[1], "base": contenido["base"], "fecha": datetime.now(timezone.utc).isoformat()}
