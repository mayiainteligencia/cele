"""Radar de creadores de contenido por estado/municipio (YouTube, Instagram, TikTok, Facebook).
Gemini (con búsqueda web) solo SUGIERE nombres; cada cuenta debe existir y medirse con datos reales para entrar a la tabla.
Seguidores, interacción y nivel salen siempre de la medición; si falta un dato se muestra 'sin dato'."""
import concurrent.futures as cf
import contextvars
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
import threading
import time
from pathlib import Path
import re
from typing import Any, Callable, Dict, List, Optional

import requests

from social import facebook as fb
from social import historial, llm, periodo as periodo_mod, referentes
from social.lexico import pid
from social.pipeline import parse_iso_datetime

BASE = Path(__file__).resolve().parents[1]
CONFIG = BASE / "config" / "radar.json"
CACHE = BASE / ".cache" / "radar"
AVISO = "El radar cubre Facebook, YouTube, Instagram y TikTok; solo cuentas públicas y en agregado"
NOTA_NORMATIVA = "Verifica la normativa electoral vigente y la divulgación de contenido pagado antes de colaborar con creadores"
TIPOS = ("politico", "medio", "creador", "comunidad", "humor", "deportes", "otro")
RESERVADOS = {"permalink.php", "profile.php", "groups", "people", "watch", "reel", "share", "story.php", "photo", "photo.php"}
USUARIO_OK = re.compile(r"^[A-Za-z0-9._-]{2,50}$")
RELEVANCIA = {"municipio": 1.0, "estado": 0.6, "nacional": 0.1}   # factor de relevancia local


def cfg() -> Dict[str, Any]:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def _tope() -> int:
    return max(0, int(os.getenv("APIFY_RADAR_MAX_CONSULTAS", "8") or 8))


def _tope_yt() -> int:
    return max(0, int(os.getenv("YOUTUBE_RADAR_MAX_UNIDADES", "500") or 500))


def _n(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", fb.normalize_text_no_accents(t or "").lower())).strip()


def _usuario(v: Any) -> str:
    """Normaliza un usuario o URL a su handle; '' si no es válido (se usa en llamadas a APIs externas)."""
    t = str(v or "").strip().rstrip("/").split("?")[0]
    t = t.split("/")[-1].lstrip("@")
    return t if USUARIO_OK.match(t) else ""


# ───────── Lugar ─────────
def terminos_lugar(alcance: Dict[str, Any]) -> Dict[str, Any]:
    texto = alcance.get("texto") or alcance.get("nombre") or ""
    partes = [p.strip() for p in texto.split(",") if p.strip()]
    muni = partes[0] if alcance.get("nivel") == "municipio" and partes else ""
    estado = partes[-1] if partes else ""
    alias = cfg().get("alias_lugar", {})
    ter = lambda nombre: [t for t in {_n(nombre), *alias.get(_n(nombre), [])} if t]
    return {"texto": texto or "el lugar de la búsqueda", "municipio": ter(muni) if muni else [], "estado": ter(estado) if estado else []}


def _hay(termino: str, texto: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(termino)}", texto))


def ubicar(lugar: Dict[str, Any], bio: str, contenido: str, fuente: str) -> Dict[str, Any]:
    """local (municipio|estado) o nacional, con la evidencia que lo justifica."""
    ev, ambito = [], "nacional"
    for fuente_ev, texto in (("biografía", _n(bio)), ("contenido", _n(contenido)), ("fuente web", _n(fuente))):
        for nivel in ("municipio", "estado"):
            hit = next((t for t in lugar[nivel] if _hay(t, texto)), None)
            if hit:
                ev.append(f"{fuente_ev} menciona «{hit}»")
                if ambito == "nacional" or nivel == "municipio":
                    ambito = nivel
                break
    return {"ambito": ambito, "evidencia": ev or ["Sin mención del lugar en biografía, contenido ni fuente"]}


# ───────── Candidatos sugeridos por Gemini (caché 30 días) ─────────
def _clave_cache(lugar: str, categoria: str) -> Path:
    return CACHE / (hashlib.sha1(f"{_n(lugar)}|{_n(categoria)}".encode()).hexdigest()[:16] + ".json")


def _leer_cache(lugar: str, categoria: str) -> Optional[List[Dict[str, Any]]]:
    p = _clave_cache(lugar, categoria)
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        if datetime.fromisoformat(d["guardado"]) > datetime.now(timezone.utc) - timedelta(days=int(cfg()["cache_dias"])):
            return d["items"]
    except Exception:
        pass
    return None


def sugerir(lugar: Dict[str, Any], categoria: str, refrescar: bool = False) -> Dict[str, Any]:
    """Una llamada por lugar y categoría. Devuelve {items, mensaje, de_cache}."""
    cache = None if refrescar else _leer_cache(lugar["texto"], categoria)
    if cache is not None:
        return {"items": cache, "mensaje": None, "de_cache": True}
    prompt = (
        f"Con búsqueda web, lista creadores de contenido y páginas públicas con comunidad en {lugar['texto']}, categoría «{categoria}» "
        f"(hasta {cfg()['max_por_categoria']}). Distingue explícitamente quién es de ese lugar y quién solo es famoso a nivel nacional. "
        'Responde SOLO un arreglo JSON de objetos {"nombre": str, "youtube": "usuario o vacío", "instagram": "usuario o vacío", '
        '"tiktok": "usuario o vacío", "facebook": "usuario o vacío", "razon": "por qué es relevante en ese lugar", '
        '"es_del_lugar": true|false, "nivel_estimado": "mega|macro|micro|local", "fuente_url": "URL donde lo encontraste"}. '
        "Solo cuentas públicas; no incluyas personas privadas. Usuarios solo si estás seguro.")
    try:
        r = llm.generar(prompt, web=True, analisis=True, tag=f"radar-{categoria}")
        data = llm.extraer_json(r[0]) if r else None
    except llm.CuotaAgotada:
        return {"items": [], "mensaje": llm.mensaje_cuota(True), "de_cache": False}
    except Exception as exc:
        print(f"[radar] Sin búsqueda web ({categoria}): {exc}")
        data = None
    if not isinstance(data, list) or not data:
        return {"items": [], "mensaje": "Sin sugerencias externas", "de_cache": False}
    items = [{"categoria": categoria, **{k: str(x.get(k) or "").strip() for k in ("nombre", "razon", "fuente_url", "nivel_estimado")},
              "es_del_lugar": bool(x.get("es_del_lugar")),
              **{p: _usuario(x.get(p)) for p in ("youtube", "instagram", "tiktok", "facebook")}}
             for x in data if isinstance(x, dict) and str(x.get("nombre") or "").strip()][:int(cfg()["max_por_categoria"])]
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        _clave_cache(lugar["texto"], categoria).write_text(
            json.dumps({"guardado": datetime.now(timezone.utc).isoformat(), "lugar": lugar["texto"], "categoria": categoria, "items": items}, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        print(f"[radar] No se pudo guardar el caché: {exc}")
    return {"items": items, "mensaje": None, "de_cache": False}


def sugerir_todas(lugar: Dict[str, Any], refrescar: bool = False) -> Dict[str, Any]:
    """UNA sola llamada a Gemini con búsqueda web que devuelve todas las categorías; cacheada 30 días por lugar."""
    cache = None if refrescar else _leer_cache(lugar["texto"], "todas")
    if cache is not None:
        return {"items": cache, "mensaje": None, "de_cache": True}
    cats = cfg()["categorias"]
    prompt = (
        f"Con búsqueda web, lista creadores de contenido y páginas públicas con comunidad en {lugar['texto']}, en estas categorías: {', '.join(cats)} "
        f"(hasta {cfg()['max_por_categoria']} por categoría). Distingue explícitamente quién es de ese lugar y quién solo es famoso a nivel nacional. "
        'Responde SOLO un arreglo JSON de objetos {"categoria": una de las categorías, "nombre": str, "youtube": "usuario o vacío", "instagram": "usuario o vacío", '
        '"tiktok": "usuario o vacío", "facebook": "usuario o vacío", "razon": "por qué es relevante en ese lugar", '
        '"es_del_lugar": true|false, "nivel_estimado": "mega|macro|micro|local", "fuente_url": "URL donde lo encontraste"}. '
        "Solo cuentas públicas; no incluyas personas privadas. Usuarios solo si estás seguro.")
    try:
        r = llm.generar(prompt, web=True, analisis=True, tag="radar-sugeridos")
        data = llm.extraer_json(r[0]) if r else None
    except llm.CuotaAgotada as exc:
        if exc.es_cuota:
            return {"items": [], "mensaje": llm.mensaje_cuota(True), "de_cache": False, "cuota": True}
        data = None   # sin búsqueda web en el plan u otro error: no es cuota
    except Exception as exc:
        print(f"[radar] Sin búsqueda web: {exc}")
        data = None
    if not isinstance(data, list) or not data:
        return {"items": [], "mensaje": "Sin sugerencias externas (búsqueda web no disponible)", "de_cache": False}
    items = [{"categoria": str(x.get("categoria") or "").strip() or "otra", **{k: str(x.get(k) or "").strip() for k in ("nombre", "razon", "fuente_url", "nivel_estimado")},
              "es_del_lugar": bool(x.get("es_del_lugar")), **{p: _usuario(x.get(p)) for p in ("youtube", "instagram", "tiktok", "facebook")}}
             for x in data if isinstance(x, dict) and str(x.get("nombre") or "").strip()]
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        _clave_cache(lugar["texto"], "todas").write_text(
            json.dumps({"guardado": datetime.now(timezone.utc).isoformat(), "lugar": lugar["texto"], "categoria": "todas", "items": items}, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        print(f"[radar] No se pudo guardar el caché: {exc}")
    return {"items": items, "mensaje": None, "de_cache": False}


def fusionar(todos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Un creador por nombre normalizado; junta categorías y usuarios de todas las plataformas."""
    out: Dict[str, Dict[str, Any]] = {}
    for s in todos:
        c = out.setdefault(_n(s["nombre"]), {**s, "categorias": []})
        if s["categoria"] not in c["categorias"]:
            c["categorias"].append(s["categoria"])
        for p in ("youtube", "instagram", "tiktok", "facebook"):
            c[p] = c.get(p) or s.get(p, "")
        c["es_del_lugar"] = c["es_del_lugar"] or s["es_del_lugar"]
    return list(out.values())


# ───────── Mediciones (cada una devuelve {plataforma, usuario, url, seguidores, verificado, bio, posts[], fecha_medicion}) ─────────
def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def medir_youtube(usuario: str, nombre: str) -> Optional[Dict[str, Any]]:
    key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not key:
        return None
    api = "https://www.googleapis.com/youtube/v3"
    try:
        q = {"part": "snippet,statistics,contentDetails", "key": key}
        if usuario:
            r = requests.get(f"{api}/channels", params={**q, "forHandle": "@" + usuario}, timeout=10).json()
        else:   # búsqueda por nombre: 100 unidades de cuota; se valida el parecido del nombre abajo
            s = requests.get(f"{api}/search", params={"part": "snippet", "type": "channel", "q": nombre, "maxResults": 1, "key": key}, timeout=10).json()
            cid = (s.get("items") or [{}])[0].get("snippet", {}).get("channelId")
            r = requests.get(f"{api}/channels", params={**q, "id": cid}, timeout=10).json() if cid else {}
        ch = (r.get("items") or [None])[0]
        if not ch:
            return None
        titulo = ch["snippet"].get("title", "")
        if not usuario and not (set(_n(nombre).split()) & set(_n(titulo).split())):
            return None   # el canal encontrado no se parece al nombre sugerido
        st = ch.get("statistics", {})
        seg = None if st.get("hiddenSubscriberCount") else int(st.get("subscriberCount") or 0)
        posts = []
        up = ch.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        if up:
            pl = requests.get(f"{api}/playlistItems", params={"part": "contentDetails", "playlistId": up, "maxResults": int(cfg()["videos_medidos"]), "key": key}, timeout=10).json()
            ids = [i["contentDetails"]["videoId"] for i in pl.get("items", [])]
            if ids:
                vs = requests.get(f"{api}/videos", params={"part": "snippet,statistics", "id": ",".join(ids), "key": key}, timeout=10).json()
                for v in vs.get("items", []):
                    stv = v.get("statistics", {})
                    posts.append({"fecha": v["snippet"].get("publishedAt"), "texto": v["snippet"].get("title", ""),
                                  "interacciones": int(stv.get("likeCount") or 0) + int(stv.get("commentCount") or 0), "vistas": int(stv.get("viewCount") or 0)})
        return {"plataforma": "youtube", "usuario": usuario or titulo, "url": f"https://www.youtube.com/channel/{ch['id']}", "seguidores": seg, "verificado": None,
                "bio": f"{ch['snippet'].get('description', '')} {ch['snippet'].get('country', '')}", "posts": posts,
                "vistas_totales": int(st.get("viewCount") or 0), "fecha_medicion": _ahora()}
    except Exception as exc:
        print(f"[radar] YouTube falló ({usuario or nombre}): {exc}")
        return None


def _apify(clave: str, actor: str, payload: Dict[str, Any], mapper: Callable, before_call, refrescar: bool) -> Dict[str, Dict[str, Any]]:
    try:
        items, _ = fb._cached_or_run(clave, {"tipo": "radar"}, lambda: fb._run_actor(actor, payload, before_call=before_call), mapper, refresh=refrescar)
    except Exception as exc:
        print(f"[radar] Apify no disponible ({actor}): {exc}")
        return {}
    return {i["usuario"].lower(): i for i in items}


def _map_instagram(raws: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for r in raws:
        if not isinstance(r, dict) or not r.get("username"):
            continue
        posts = [{"fecha": p.get("timestamp"), "texto": p.get("caption") or "", "interacciones": max(0, int(p.get("likesCount") or 0)) + int(p.get("commentsCount") or 0)}
                 for p in (r.get("latestPosts") or [])[:int(cfg()["videos_medidos"])] if isinstance(p, dict)]
        out.append({"plataforma": "instagram", "usuario": r["username"], "url": f"https://www.instagram.com/{r['username']}/", "seguidores": r.get("followersCount"),
                    "verificado": r.get("verified"), "bio": f"{r.get('biography') or ''} {r.get('businessAddress') or ''}", "posts": posts, "fecha_medicion": _ahora()})
    return out


def _map_tiktok(raws: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    por: Dict[str, Dict[str, Any]] = {}
    for r in raws:
        a = (r or {}).get("authorMeta") or {}
        if not a.get("name"):
            continue
        c = por.setdefault(a["name"], {"plataforma": "tiktok", "usuario": a["name"], "url": f"https://www.tiktok.com/@{a['name']}", "seguidores": a.get("fans"),
                                       "verificado": a.get("verified"), "bio": a.get("signature") or "", "posts": [], "fecha_medicion": _ahora()})
        c["posts"].append({"fecha": r.get("createTimeISO"), "texto": r.get("text") or "",
                           "interacciones": int(r.get("diggCount") or 0) + int(r.get("commentCount") or 0) + int(r.get("shareCount") or 0), "vistas": int(r.get("playCount") or 0)})
    return list(por.values())


def _map_facebook(raws: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for r in raws:
        m = fb_pagina(r)
        if m:
            out.append(m)
    return out


def fb_pagina(r: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    url = str((r or {}).get("pageUrl") or r.get("facebookUrl") or r.get("url") or "").strip()
    if not url:
        return None
    seg = r.get("followers") if r.get("followers") is not None else r.get("followersCount")
    ver = next((r[k] for k in ("verified", "isVerified", "is_verified") if k in r), None)
    bio = " ".join(str(r.get(k) or "") for k in ("address", "intro", "info", "about", "description", "category"))
    return {"plataforma": "facebook", "usuario": _slug(url), "url": url, "seguidores": int(seg) if isinstance(seg, (int, float)) else None,
            "verificado": ver if isinstance(ver, bool) else None, "bio": bio, "posts": [], "fecha_medicion": _ahora(),
            "nombre": str(r.get("title") or r.get("pageName") or r.get("name") or "")}


def _slug(url: str) -> str:
    return re.sub(r"^https?://(www\.|m\.)?facebook\.com/", "", (url or "").lower()).strip("/").split("?")[0]


def _clave(prefijo: str, nombres: List[str]) -> str:
    return fb._persona_cache_key(prefijo, *sorted(nombres))


def medir_lote(plataforma: str, usuarios: List[str], before_call, refrescar: bool) -> Dict[str, Dict[str, Any]]:
    if not usuarios or fb.get_configured_fuente() != "apify":
        return {}
    if plataforma == "instagram":
        return _apify(_clave("radar-ig", usuarios), os.getenv("APIFY_ACTOR_RADAR_INSTAGRAM", "apify/instagram-profile-scraper"),
                      {"usernames": usuarios}, _map_instagram, before_call, refrescar)
    if plataforma == "tiktok":
        return _apify(_clave("radar-tt", usuarios), os.getenv("APIFY_ACTOR_RADAR_TIKTOK", "clockworks/tiktok-profile-scraper"),
                      {"profiles": usuarios, "resultsPerPage": int(cfg()["videos_medidos"]), "profileScrapeSections": ["videos"], "profileSorting": "latest"},
                      _map_tiktok, before_call, refrescar)
    # facebook: el actor de páginas que ya se usa; la clave del resultado es el slug de la URL
    urls = [f"https://www.facebook.com/{u}" if not u.startswith("http") else u for u in usuarios]
    r = _apify(_clave("radar-fb", urls), "apify/facebook-pages-scraper", {"startUrls": [{"url": u} for u in urls]},
               lambda raws: [m for m in (fb_pagina(x) for x in raws if isinstance(x, dict)) if m], before_call, refrescar)
    return {_slug(v["url"]): v for v in r.values()} | r


# ───────── Puntaje, nivel y fusión por creador ─────────
def nivel(seg: Optional[int]) -> Optional[str]:
    if seg is None:
        return None
    n = cfg()["niveles"]
    return "mega" if seg >= n["mega"] else "macro" if seg >= n["macro"] else "micro" if seg >= n["micro"] else "local"


def _resumir(c: Dict[str, Any], cuentas: List[Dict[str, Any]], lugar: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    ventana = datetime.now(timezone.utc) - timedelta(days=int(cfg()["ventana_dias"]))
    segs = [a["seguidores"] for a in cuentas if a.get("seguidores") is not None]
    con_posts = [a for a in cuentas if a["posts"]]
    inter = sum(sum(p["interacciones"] for p in a["posts"]) / len(a["posts"]) for a in con_posts) if con_posts else None
    activ = sum(1 for a in cuentas for p in a["posts"] if (parse_iso_datetime(p.get("fecha") or "") or ventana) >= ventana) if con_posts else None
    bio = " ".join(a.get("bio", "") for a in cuentas)
    contenido = " ".join(p["texto"] for a in cuentas for p in a["posts"])
    ub = ubicar(lugar, bio, contenido, f"{c.get('razon', '')} {c.get('fuente_url', '')}" if c.get("es_del_lugar") else "")
    nombres_ficha = [_n(x) for x in [(ficha or {}).get("nombre", ""), *(ficha or {}).get("variantes", [])] if x]
    return {
        "nombre": c["nombre"], "categorias": c.get("categorias", []), "fuente_url": c.get("fuente_url", ""), "razon_sugerencia": c.get("razon", ""),
        "sugerido": bool(c.get("sugerido", True)), "propia": bool(c.get("propia")),
        "plataformas": [{k: a.get(k) for k in ("plataforma", "usuario", "url", "seguidores", "verificado", "fecha_medicion")} for a in cuentas],
        "seguidores": sum(segs) if segs else None, "interaccion_promedio": round(inter, 1) if inter is not None else None, "actividad": activ,
        "nivel": nivel(sum(segs)) if segs else None, "ambito": ub["ambito"], "evidencia_ubicacion": ub["evidencia"],
        "menciona_ficha": bool(c.get("menciona_ficha")) or any(nf and nf in _n(contenido) for nf in nombres_ficha),
        "tipo": None, "tono": None, "temas": [], "razon": "", "puntaje": None, "desglose": None,
        "fecha_medicion": max((a["fecha_medicion"] for a in cuentas), default=None), "ejemplos": [p["texto"][:200] for a in cuentas for p in a["posts"] if p["texto"]][:3],
        "estado_medicion": "medido", "etiqueta": "", "usuarios": {}, "motivo_sin_medir": "", "es_del_lugar": bool(c.get("es_del_lugar")),
        "origen": c.get("origen", "historial"), "referente_nacional": bool(c.get("referente_nacional")), "habla_de_la_persona": c.get("habla", "sin dato"), "ambito_etiqueta": "",
    }


def puntajes(filas: List[Dict[str, Any]]) -> None:
    """Puntaje = alcance x interacción x actividad x relevancia local; cada factor normalizado 0-1 contra el máximo del grupo."""
    con = [f for f in filas if f.get("estado_medicion") == "medido" and not f.get("referente_nacional") and f["seguidores"] is not None and f["interaccion_promedio"] is not None and f["actividad"] is not None]
    if not con:
        return
    ms, mi, ma = max(f["seguidores"] for f in con), max(f["interaccion_promedio"] for f in con) or 1, max(f["actividad"] for f in con) or 1
    for f in con:
        d = {"alcance": round(math.log10(1 + f["seguidores"]) / math.log10(1 + ms), 3) if ms > 0 else 0.0,
             "interaccion": round(f["interaccion_promedio"] / mi, 3), "actividad": round(f["actividad"] / ma, 3),
             "relevancia_local": RELEVANCIA[f["ambito"]]}
        f["desglose"] = d
        f["puntaje"] = round(100 * d["alcance"] * d["interaccion"] * d["actividad"] * d["relevancia_local"], 1)


def clasificar(filas: List[Dict[str, Any]], persona: str) -> Optional[str]:
    """Una llamada: tipo, tono hacia la persona, temas y razón de una frase. Devuelve un aviso si no hay IA."""
    items = [{"id": i, "nombre": f["nombre"], "categorias": f["categorias"], "posts": f["ejemplos"]} for i, f in enumerate(filas) if f.get("estado_medicion") == "medido"][:30]
    if not items:
        return None
    prompt = (f"Clasifica creadores de contenido respecto a la persona «{persona}». Responde SOLO un arreglo JSON: "
              f'{{"id": n, "tipo": {"|".join(TIPOS)}, "tono": "favorable"|"neutral"|"critico", "temas": [máx. 3 palabras clave], '
              '"razon": "una frase basada SOLO en los posts dados"}. Si los posts no bastan, tono=neutral.\n'
              f"Creadores: {json.dumps(items, ensure_ascii=False)}")
    try:
        r = llm.generar_json(prompt, analisis=True, tag="radar-clasificar")
    except llm.CuotaAgotada:
        return llm.mensaje_cuota(True)
    if r is None or not isinstance(r[0], list):
        return "Sin clasificación de IA"
    for it in r[0]:
        try:
            f = filas[int(it.get("id"))]
        except Exception:
            continue
        f["tipo"] = it.get("tipo") if it.get("tipo") in TIPOS else "otro"
        f["tono"] = it.get("tono") if it.get("tono") in ("favorable", "neutral", "critico") else "neutral"
        f["temas"] = [str(t) for t in (it.get("temas") or [])][:3]
        f["razon"] = str(it.get("razon") or "")[:240]
    return None


# ───────── Candidatos medidos del historial (Facebook) ─────────
def candidatos_historial(entry: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Autores con actividad en las búsquedas guardadas del mismo alcance; sus posts ya están medidos."""
    al = entry.get("alcance") or {}
    llave = ("municipio_id", al.get("municipio_id")) if al.get("municipio_id") else ("estado_id", al.get("estado_id"))
    ids = [h["id"] for h in historial.listar() if llave[1] and (h.get("alcance") or {}).get(llave[0]) == llave[1]] or [entry["id"]]
    vistos, autores = set(), {}
    for hid in ids:
        r = (historial.obtener(hid) or {}).get("resumen") or {}
        for p in (r.get("posts_recientes") or []) + (r.get("por_confirmar") or []):
            u = p.get("user") or {}
            plat = p.get("plataforma") or "facebook"
            if plat == "facebook":
                m = re.search(r"facebook\.com/([^/?#]+)/(?:posts|videos|photos)", p.get("url") or "")
                handle = m.group(1) if m and m.group(1).lower() not in RESERVADOS else ""   # sin URL de página pública no se incluye (nada de perfiles personales)
            else:
                handle = u.get("usuario") or ""
            if pid(p) in vistos or not u.get("name") or not handle:
                continue
            vistos.add(pid(p))
            a = autores.setdefault((plat, handle), {"nombre": u["name"], "usuario": handle, "plataforma": plat, "seguidores": None, "posts": []})
            if isinstance(p.get("seguidores"), int):
                a["seguidores"] = max(a["seguidores"] or 0, p["seguidores"])   # dato medido que ya trae el post (p. ej. X)
            a["posts"].append({"fecha": p.get("time"), "texto": p.get("text") or "", "interacciones": int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)})
    return sorted(autores.values(), key=lambda a: -sum(p["interacciones"] for p in a["posts"]))[:15]


URL_CUENTA = {"facebook": "https://www.facebook.com/{}", "x": "https://x.com/{}", "tiktok": "https://www.tiktok.com/@{}", "instagram": "https://www.instagram.com/{}/"}


# ───────── Estimado y generación ─────────
HANDLES = ("youtube", "instagram", "tiktok", "facebook")
URL_PLAT = {"youtube": "https://www.youtube.com/@{}", **URL_CUENTA}
SIN_MEDIR = "Sugerido, sin medir"


def _fuente_apify() -> bool:
    return fb.get_configured_fuente() == "apify" and bool(os.getenv("APIFY_TOKEN", "").strip())


def fila_sin_medir(c: Dict[str, Any], lugar: Dict[str, Any], motivo: str) -> Dict[str, Any]:
    """Sugerido por Gemini y todavía sin medir: aparece en la tabla con seguidores 'sin dato' y fuera del puntaje. La ubicación solo viene de la fuente web."""
    usuarios = {p: c[p] for p in HANDLES if c.get(p)}
    ub = ubicar(lugar, "", "", f"{c.get('razon', '')} {c.get('fuente_url', '')}" if c.get("es_del_lugar") else "")
    return {
        "nombre": c["nombre"], "categorias": c.get("categorias", []), "fuente_url": c.get("fuente_url", ""), "razon_sugerencia": c.get("razon", ""),
        "sugerido": True, "propia": False, "estado_medicion": "sugerido_sin_medir", "etiqueta": SIN_MEDIR, "motivo_sin_medir": motivo, "usuarios": usuarios,
        "plataformas": [{"plataforma": p, "usuario": u, "url": URL_PLAT[p].format(u), "seguidores": None, "verificado": None, "fecha_medicion": None} for p, u in usuarios.items()],
        "seguidores": None, "interaccion_promedio": None, "actividad": None, "nivel": None, "ambito": ub["ambito"], "evidencia_ubicacion": ub["evidencia"],
        "es_del_lugar": bool(c.get("es_del_lugar")), "origen": "gemini", "referente_nacional": not c.get("es_del_lugar"), "habla_de_la_persona": "sin dato", "ambito_etiqueta": "",
        "menciona_ficha": False, "tipo": None, "tono": None, "temas": [], "razon": "", "puntaje": None, "desglose": None,
        "fecha_medicion": None, "ejemplos": [],
    }


def medir_cuenta(fila: Dict[str, Any], ficha: Optional[Dict[str, Any]], lugar: Dict[str, Any], before_call: Optional[Callable]) -> Dict[str, Any]:
    """Mide SOLO esta cuenta (YouTube, Instagram, TikTok o Facebook). Lanza ValueError con el motivo si no se pudo."""
    cuentas, errores = [], []
    for p, u in (fila.get("usuarios") or {}).items():
        if p == "youtube":
            if not os.getenv("YOUTUBE_API_KEY", "").strip():
                errores.append("YouTube sin medir (falta YOUTUBE_API_KEY)")
                continue
            m = medir_youtube(u, fila["nombre"])
        else:
            if _tope() == 0:
                errores.append("Instagram y TikTok sin medir (APIFY_RADAR_MAX_CONSULTAS=0)" if p != "facebook" else "Facebook sin medir (APIFY_RADAR_MAX_CONSULTAS=0)")
                continue
            if not _fuente_apify():
                errores.append("Sin medir: Apify no está activo (FUENTE=fixture o falta APIFY_TOKEN)")
                continue
            datos = medir_lote(p, [u], before_call, False)
            m = datos.get(u.lower()) or datos.get(_slug(f"https://www.facebook.com/{u}"))
        if m and (m.get("seguidores") is not None or m["posts"]):
            cuentas.append(m)
        elif m is None:
            errores.append(f"{p}: cuenta no encontrada")
    if not cuentas:
        raise ValueError("; ".join(dict.fromkeys(errores)) or "No hay cuentas conocidas para medir")
    return _resumir({"nombre": fila["nombre"], "categorias": fila["categorias"], "razon": fila.get("razon_sugerencia", ""), "fuente_url": fila.get("fuente_url", ""),
                     "es_del_lugar": fila.get("es_del_lugar"), "sugerido": True}, cuentas, lugar, ficha)


def estimado_medir(fila: Dict[str, Any]) -> Dict[str, Any]:
    """Costo máximo de medir una sola cuenta."""
    c_ig, c_tt = float(os.getenv("APIFY_COSTO_IG_USD", "0.0026") or 0.0026), float(os.getenv("APIFY_COSTO_TIKTOK_1000", "3.7") or 3.7) / 1000 * int(cfg()["videos_medidos"])
    c_fb = float(os.getenv("APIFY_COSTO_POR_RESULTADO_USD", "0.005") or 0.005)
    filas = {}
    for p, u in (fila.get("usuarios") or {}).items():
        if p == "youtube":
            filas[p] = {"usuario": u, "costo_usd": 0.0, "unidades_youtube": 3 if u else 103, "activo": bool(os.getenv("YOUTUBE_API_KEY", "").strip())}
        else:
            filas[p] = {"usuario": u, "costo_usd": round({"instagram": c_ig, "tiktok": c_tt, "facebook": c_fb}[p], 4), "activo": _fuente_apify() and _tope() > 0}
    return {"nombre": fila["nombre"], "cuentas": filas, "total_usd": round(sum(f["costo_usd"] for f in filas.values() if f["activo"]), 4)}


def reordenar(radar: Dict[str, Any]) -> None:
    """Recalcula el puntaje solo con las filas medidas y vuelve a ordenar: medidos primero, sugeridos sin medir al final."""
    filas = radar["medidos"]
    for f in filas:
        f["ambito_etiqueta"] = "local" if f["ambito"] != "nacional" else ("nacional con base en el lugar" if f.get("referente_nacional") else "nacional")
        if f.get("estado_medicion") == "medido":
            f["puntaje"], f["desglose"] = None, None
    puntajes(filas)
    filas.sort(key=lambda f: (f.get("estado_medicion") != "medido", not f.get("menciona_ficha", False) if radar.get("persona") else False, f["puntaje"] is None, -(f["puntaje"] or 0), -(f["seguidores"] or 0)))
    fu = radar.get("fuentes") or {}
    fu["verificados"] = sum(1 for f in filas if f.get("sugerido") and f.get("estado_medicion") == "medido")
    fu["sin_medir"] = sum(1 for f in filas if f.get("estado_medicion") != "medido")
    radar["fuentes"] = fu


def estimado(entry: Dict[str, Any], ficha: Optional[Dict[str, Any]], incluir_referentes: bool = True) -> Dict[str, Any]:
    lugar = terminos_lugar(entry.get("alcance") or {})
    en_cache = _leer_cache(lugar["texto"], "todas") is not None
    apify = _fuente_apify() and _tope() > 0
    c_fb = float(os.getenv("APIFY_COSTO_POR_RESULTADO_USD", "0.005") or 0.005)
    c_ig = float(os.getenv("APIFY_COSTO_IG_USD", "0.0026") or 0.0026)
    ref = max(1, int(os.getenv("APIFY_RADAR_REF_MAX", str(cfg()["referentes"]["max_posts_por_fuente"])) or 30))
    pl_ = __import__("social.plataformas", fromlist=["costo_1000"])
    medicion = _tope() * max(c_fb, c_ig) if apify else 0.0
    fuentes_ref = ref * (pl_.costo_1000("tiktok") + pl_.costo_1000("instagram") + pl_.costo_1000("x")) / 1000 if (apify and incluir_referentes) else 0.0
    yt = bool(os.getenv("YOUTUBE_API_KEY", "").strip())
    return {"lugar": lugar["texto"], "peticiones_gemini": (0 if en_cache else 1) + 2, "sugerencias_en_cache": en_cache, "incluye_referentes": incluir_referentes,
            "creditos_apify_usd": round(medicion + fuentes_ref, 3), "perfiles_apify_max": _tope() if apify else 0, "tope_consultas": _tope(),
            "youtube_activo": yt, "unidades_youtube_max": (105 if (yt and incluir_referentes) else 0) + (_tope_yt() if yt else 0), "aviso": AVISO}


# ───────── generación por etapas: progreso, cancelación, tiempo máximo y resultado parcial ─────────
class Progreso:
    def __init__(self) -> None:
        self.etapa, self.i, self.n, self.mensaje = "", 0, 0, ""
        self.cancelado = threading.Event()
        self.parcial: Optional[Dict[str, Any]] = None
        self.estado = "corriendo"


class Cancelado(Exception):
    pass


def _correr(prog: Progreso, nombre: str, fn: Callable, timeout: float) -> Optional[str]:
    """Ejecuta una etapa con tiempo máximo y cancelación. Devuelve un aviso si falló o se agotó; las etapas guardan lo obtenido en el estado compartido."""
    if prog.cancelado.is_set():
        raise Cancelado()
    prog.i += 1
    prog.etapa = nombre
    ex = cf.ThreadPoolExecutor(max_workers=1)
    fut = ex.submit(contextvars.copy_context().run, fn)
    t0 = time.time()
    try:
        while True:
            try:
                fut.result(timeout=0.4)
                return None
            except cf.TimeoutError:
                if prog.cancelado.is_set():
                    raise Cancelado()
                if time.time() - t0 > timeout:
                    return f"{nombre}: tiempo máximo agotado ({int(timeout)} s); se continúa con lo obtenido"
    except llm.CuotaAgotada as exc:
        return str(exc)
    except Cancelado:
        raise
    except Exception as exc:
        print(f"[radar] etapa «{nombre}» falló: {exc}")
        return f"{nombre}: {str(getattr(exc, 'detail', exc))[:160]}"
    finally:
        ex.shutdown(wait=False)


def medidos_previos() -> Dict[str, Dict[str, Any]]:
    """Cuentas ya medidas en radares guardados: se reutilizan para no volver a pagar la medición."""
    out: Dict[str, Dict[str, Any]] = {}
    for h in historial.listar()[:40]:
        rd = ((historial.obtener(h["id"]) or {}).get("resumen") or {}).get("radar") or {}
        for f in rd.get("medidos", []):
            if f.get("estado_medicion") != "medido":
                continue
            for c in f.get("plataformas", []):
                if c.get("seguidores") is not None and c.get("usuario"):
                    out[f"{c['plataforma']}|{str(c['usuario']).lower()}"] = c
    return out


def _cuenta_de_autor(a: Dict[str, Any], plat: str, seg: Optional[int], previo: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    u = str(a["usuario"])
    url = f"https://www.youtube.com/channel/{u}" if plat == "youtube" and u.startswith("UC") and len(u) > 20 else URL_PLAT[plat].format(u)
    return {"plataforma": plat, "usuario": u, "url": url, "seguidores": seg if seg is not None else (previo or {}).get("seguidores"),
            "verificado": (previo or {}).get("verificado"), "bio": a.get("bio", ""), "posts": a["posts"], "fecha_medicion": (previo or {}).get("fecha_medicion") or _ahora()}


def generar(entry: Dict[str, Any], ficha: Optional[Dict[str, Any]], before_call: Optional[Callable] = None, refrescar: bool = False,
            incluir_referentes: bool = True, progreso: Optional[Progreso] = None) -> Dict[str, Any]:
    prog = progreso or Progreso()
    lugar = terminos_lugar(entry.get("alcance") or {})
    persona = (ficha or {}).get("nombre") or entry.get("tema") or ""
    periodo = (entry.get("resumen") or {}).get("periodo") or periodo_mod.resolver(30)
    t_etapa = float(os.getenv("RADAR_TIMEOUT_ETAPA_S", "30") or 30)
    t_apify = float(os.getenv("RADAR_TIMEOUT_APIFY_S", "150") or 150)
    maxa = int(cfg()["referentes"]["max_autores_por_plataforma"])
    st: Dict[str, Any] = {"filas": [], "hist": [], "creadores": [], "sug_msg": None, "avisos": [], "ref": {}, "contenido": None, "aviso_ia": None,
                          "vistos": set(), "reutilizados": 0, "yt_unidades": 0}
    prog.n = 5 + (4 if incluir_referentes else 0)
    previos = medidos_previos()

    def armar(estado: str) -> Dict[str, Any]:
        avisos = list(dict.fromkeys(st["avisos"]))
        fuentes = {"medidos_historial": len(st["hist"]), "sugeridos_gemini": len(st["creadores"]), "reutilizados": st["reutilizados"], "categorias_consultadas": len(cfg()["categorias"]),
                   "referentes": {p: len(v.get("posts", [])) for p, v in st["ref"].items()}}
        rd = {"version": 4, "estado": estado, "aviso": AVISO, "nota_normativa": NOTA_NORMATIVA, "fecha": _ahora(), "lugar": lugar["texto"], "persona": persona,
              "categorias": cfg()["categorias"], "niveles": cfg()["niveles"], "medidos": list(st["filas"]), "avisos": avisos, "fuentes": fuentes, "incluye_referentes": incluir_referentes,
              "contenido": st["contenido"], "aviso_ia": st["aviso_ia"], "modelos_usados": llm.info_sesion()["modelos_usados"], "cambio_por_cuota": llm.info_sesion()["cambio_por_cuota"]}
        reordenar(rd)
        rd["fuentes"].update({"verificados": rd["fuentes"].get("verificados", 0)})
        prog.parcial = rd
        return rd

    def agregar_fila(f: Dict[str, Any]) -> None:
        for c in f["plataformas"]:
            st["vistos"].add(f"{c['plataforma']}|{str(c['usuario']).lower()}")
        st["filas"].append(f)

    # 1) Cuentas medidas de tus búsquedas guardadas
    def e_historial() -> None:
        hist = candidatos_historial(entry, ficha)
        st["hist"] = hist
        tope = _tope()
        perfiles = {pl: (medir_lote(pl, [h["usuario"] for h in hist if h["plataforma"] == pl][:tope], before_call, refrescar) if tope else {}) for pl in ("facebook", "instagram", "tiktok")}
        for h in hist:
            pl = h["plataforma"]
            pg = perfiles.get(pl, {}).get(h["usuario"].lower()) or (perfiles["facebook"].get(_slug(f"https://www.facebook.com/{h['usuario']}")) if pl == "facebook" else None) or {}
            cuenta = {"plataforma": pl, "usuario": h["usuario"], "url": URL_CUENTA[pl].format(h["usuario"]), "seguidores": pg.get("seguidores") if pg.get("seguidores") is not None else h["seguidores"],
                      "verificado": pg.get("verificado"), "bio": pg.get("bio", ""), "posts": h["posts"], "fecha_medicion": pg.get("fecha_medicion") or _ahora()}
            f = _resumir({"nombre": pg.get("nombre") or h["nombre"], "sugerido": False, "menciona_ficha": bool(ficha), "origen": "historial"}, [cuenta], lugar, ficha)
            f["habla_de_la_persona"] = referentes.habla_de_la_persona(h["posts"], persona, ficha) if ficha else "sin dato"
            agregar_fila(f)
        armar("parcial")
    av = _correr(prog, "Cuentas de tus búsquedas guardadas", e_historial, t_apify)
    if av:
        st["avisos"].append(av)

    # 2) Sugerencias de Gemini: una sola llamada con todas las categorías (caché 30 días)
    def e_gemini() -> None:
        r = sugerir_todas(lugar, refrescar)
        st["creadores"] = fusionar([{**i, "categoria": i["categoria"]} for i in r["items"]])
        st["sug_msg"] = r["mensaje"]
        if r["mensaje"]:
            m = r["mensaje"]
            st["avisos"].append(f"Sin sugerencias externas ({m[0].lower() + m[1:]})" if m.startswith("Cuota") else m)
    if llm.todos_agotados(True):   # responde de inmediato con el mensaje, sin intentar la llamada
        st["sug_msg"] = llm.mensaje_cuota(True)
        st["avisos"].append("Sin sugerencias externas (" + st["sug_msg"][0].lower() + st["sug_msg"][1:] + ")")
        prog.i += 1
    else:
        av = _correr(prog, "Sugerencias de Gemini (todas las categorías)", e_gemini, t_etapa)
        if av:
            st["avisos"].append(av)
    armar("parcial")

    # 3) Referentes del territorio, sin Gemini (YouTube, TikTok, Instagram y X)
    if incluir_referentes:
        def e_yt() -> None:
            r = referentes.youtube_populares(lugar, periodo, _tope_yt(), refrescar)
            st["ref"]["youtube"] = r
            st["yt_unidades"] = r.get("unidades", 0)
            if r["estado"] in ("sin_clave", "sin_unidades", "error"):
                st["avisos"].append(r["motivo"])
        av = _correr(prog, "Referentes: videos populares de YouTube", e_yt, t_etapa)
        if av:
            st["avisos"].append(av)
        for plat, nombre in (("tiktok", "TikTok"), ("instagram", "Instagram"), ("x", "X")):
            def e_ap(plat=plat) -> None:
                if _tope() == 0 and fb.get_configured_fuente() == "apify":
                    st["ref"][plat] = {"posts": [], "estado": "omitido"}
                    st["avisos"].append("Instagram y TikTok sin medir (APIFY_RADAR_MAX_CONSULTAS=0)" if plat != "x" else "X sin consultar (APIFY_RADAR_MAX_CONSULTAS=0)")
                    return
                if not _fuente_apify() and fb.get_configured_fuente() != "fixture":
                    st["ref"][plat] = {"posts": [], "estado": "omitido"}
                    st["avisos"].append(f"{nombre} sin consultar (Apify no está activo: falta APIFY_TOKEN)")
                    return
                r = referentes.apify_populares(plat, lugar, periodo, before_call, refrescar)
                st["ref"][plat] = r
                if r["estado"] == "error":
                    st["avisos"].append(r["motivo"])
            av = _correr(prog, f"Referentes: {nombre}", e_ap, t_apify)
            if av:
                st["avisos"].append(av)
            armar("parcial")

    # 4) Medición: sugeridos de Gemini y autores de los referentes (reutiliza lo medido en el historial)
    def e_medir() -> None:
        pres = {"yt": max(0, _tope_yt() - st["yt_unidades"]), "apify": _tope()}
        hay_yt = bool(os.getenv("YOUTUBE_API_KEY", "").strip())
        # referentes: ya traen seguidores en YouTube, TikTok y X; Instagram se mide con el actor de perfiles
        ig_pend: List[Dict[str, Any]] = []
        for plat, r in st["ref"].items():
            for a in referentes.autores(r.get("posts", []), maxa):
                key = f"{plat}|{str(a['usuario']).lower()}"
                if key in st["vistos"]:
                    continue
                previo = previos.get(key)
                if previo and a["seguidores"] is None:
                    st["reutilizados"] += 1
                if plat == "instagram" and a["seguidores"] is None and not previo:
                    ig_pend.append(a)
                    continue
                f = _resumir({"nombre": a["nombre"], "sugerido": False, "origen": f"referente_{plat}", "habla": referentes.habla_de_la_persona(a["posts"], persona, ficha)}, [_cuenta_de_autor(a, plat, a["seguidores"], previo)], lugar, ficha)
                agregar_fila(f)
        if ig_pend and pres["apify"] > 0 and _fuente_apify():
            datos = medir_lote("instagram", [a["usuario"] for a in ig_pend][:pres["apify"]], before_call, refrescar)
            pres["apify"] -= min(len(ig_pend), pres["apify"])
        else:
            datos = {}
        for a in ig_pend:
            d = datos.get(str(a["usuario"]).lower()) or {}
            agregar_fila(_resumir({"nombre": a["nombre"], "sugerido": False, "origen": "referente_instagram", "habla": referentes.habla_de_la_persona(a["posts"], persona, ficha)},
                                  [_cuenta_de_autor(a, "instagram", d.get("seguidores"), None)], lugar, ficha))
            if d.get("seguidores") is None:
                st["avisos"].append("Instagram: seguidores sin dato en algunos referentes (perfiles sin medir)")
        # sugeridos de Gemini
        pend: Dict[str, List[Dict[str, Any]]] = {"instagram": [], "tiktok": [], "facebook": []}
        medidas: Dict[int, List[Dict[str, Any]]] = {id(c): [] for c in st["creadores"]}
        motivo: Dict[int, str] = {}
        for c in st["creadores"]:
            if c["youtube"] or not any(c[p] for p in ("instagram", "tiktok", "facebook")):
                if pres["yt"] > 0 and hay_yt:
                    pres["yt"] -= 3 + (100 if not c["youtube"] else 0)
                    m = medir_youtube(c["youtube"], c["nombre"])
                    if m:
                        medidas[id(c)].append(m)
                elif c["youtube"]:
                    motivo[id(c)] = "YouTube sin consultar (falta YOUTUBE_API_KEY o se alcanzó el tope)"
            for p in ("instagram", "tiktok", "facebook"):
                if c[p] and pres["apify"] > 0 and _fuente_apify():
                    pres["apify"] -= 1
                    pend[p].append(c)
        for p, lista in pend.items():
            datos = medir_lote(p, [c[p] for c in lista], before_call, refrescar)
            for c in lista:
                m = datos.get(c[p].lower()) or datos.get(_slug(f"https://www.facebook.com/{c[p]}"))
                if m:
                    medidas[id(c)].append(m)
        for c in st["creadores"]:
            cuentas = [m for m in medidas[id(c)] if m.get("seguidores") is not None or m["posts"]]
            c = {**c, "origen": "gemini", "referente_nacional": not c.get("es_del_lugar")}
            if cuentas:
                f = _resumir(c, cuentas, lugar, ficha)
                f["habla_de_la_persona"] = referentes.habla_de_la_persona([x for m in cuentas for x in m["posts"]], persona, ficha)
                agregar_fila(f)
                continue
            tiene = [p for p in HANDLES if c.get(p)]
            if not tiene:
                razon_ = "Sin usuario conocido: Gemini no dio cuentas"
            elif id(c) in motivo:
                razon_ = motivo[id(c)]
            elif _tope() == 0 and all(p in ("instagram", "tiktok", "facebook") for p in tiene):
                razon_ = "Instagram y TikTok sin medir (APIFY_RADAR_MAX_CONSULTAS=0)"
            elif "youtube" in tiene and not hay_yt:
                razon_ = "YouTube sin medir (falta YOUTUBE_API_KEY)"
            else:
                razon_ = "Sin medir: cuenta no encontrada o tope de consultas alcanzado"
            agregar_fila(fila_sin_medir(c, lugar, razon_))
        if st["creadores"] and not hay_yt:
            st["avisos"].append("YouTube sin medir (falta YOUTUBE_API_KEY)")
        if _tope() == 0 and st["creadores"]:
            st["avisos"].append("Instagram y TikTok sin medir (APIFY_RADAR_MAX_CONSULTAS=0)")
        elif not _fuente_apify() and st["creadores"]:
            st["avisos"].append("Instagram, TikTok y Facebook sin medir (Apify no está activo: FUENTE=fixture o falta APIFY_TOKEN)")
        armar("parcial")
    av = _correr(prog, "Midiendo cuentas", e_medir, t_apify)
    if av:
        st["avisos"].append(av)

    # 5) Contenido que funciona (patrones en código; temas y tono con una sola petición por lotes)
    def e_contenido() -> None:
        posts = [p for r in st["ref"].values() for p in r.get("posts", [])]
        seg = {f"{c['plataforma']}|{str(c['usuario']).lower()}": c["seguidores"] for f in st["filas"] for c in f["plataformas"] if c.get("seguidores") is not None}
        st["contenido"] = referentes.analizar_contenido(referentes.contenidos(posts, seg), clasificar=not llm.todos_agotados(True))
        if st["contenido"].get("aviso_clasificacion"):
            st["avisos"].append(st["contenido"]["aviso_clasificacion"])
    if incluir_referentes:
        av = _correr(prog, "Contenido que funciona", e_contenido, t_etapa)
        if av:
            st["avisos"].append(av)

    # 6) Tipo y tono de los medidos (Gemini; sin cuota se omite)
    def e_clasificar() -> None:
        st["aviso_ia"] = clasificar(st["filas"], persona)
    if llm.todos_agotados(True):
        st["aviso_ia"] = llm.mensaje_cuota(True)
        prog.i += 1
    else:
        av = _correr(prog, "Clasificación de tipo y tono", e_clasificar, t_etapa)
        if av:
            st["avisos"].append(av)

    cuota = bool(st["sug_msg"] and "Cuota" in st["sug_msg"]) or bool(st["aviso_ia"] and "Cuota" in str(st["aviso_ia"]))
    return armar("ok" if (st["creadores"] or st["filas"]) and not cuota else "parcial")
