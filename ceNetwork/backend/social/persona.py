"""Modo Persona: qué dicen los demás de la persona, en su territorio.
Menciones de terceros por variantes del nombre (con cargo o territorio para evitar homónimos); lo que publica la propia persona se separa;
comentarios opcionales (con costo y tope); el sentimiento y las palabras salen solo de terceros."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from social import coincidencia, facebook as fb, periodo as periodo_mod
from social.quesesabe import confianza
from social.plataformas import lugar_terminos, usuario, etiquetar_facebook

BASE = Path(__file__).resolve().parents[1]
GEO_MUNICIPIOS = BASE.parent / "geo" / "municipios"


# ───────── variantes y consultas ─────────
def _n(t: str) -> str:
    return " ".join(coincidencia._toks(t))


def variantes(nombre: str, ficha: Optional[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """(nombre completo, variantes más cortas): variantes de la ficha, apodo y el nombre sin el último apellido."""
    completo = re.sub(r"\s+", " ", (nombre or "").strip())
    f = ficha or {}
    crudas = [*(f.get("variantes") or []), f.get("apodo") or "", fb.get_person_name_variant(completo) or ""]
    out, vistos = [], {_n(completo)}
    for v in crudas:
        v = re.sub(r"\s+", " ", str(v).strip())
        if v and _n(v) not in vistos:
            vistos.add(_n(v))
            out.append(v)
    return completo, out


def contexto(ficha: Optional[Dict[str, Any]], lugares: List[str]) -> List[str]:
    """Cargo y territorio: se combinan con las variantes cortas para no traer homónimos."""
    f = ficha or {}
    terr = ((f.get("territorio") or {}).get("nombre") or "").strip() or (lugares[0] if lugares else "")
    return [c for c in dict.fromkeys([str(f.get("cargo") or "").strip(), terr]) if c]


def consultas_texto(nombre: str, ficha: Optional[Dict[str, Any]], lugares: List[str], maximo: int = 6) -> List[str]:
    completo, cortas = variantes(nombre, ficha)
    ctx = contexto(ficha, lugares)
    qs = [f'"{completo}"']
    for v in cortas:
        qs += [f'"{v}" {c}' for c in ctx] if ctx else [f'"{v}"']
    return list(dict.fromkeys(qs))[:maximo]


def alcance_de_ficha(ficha: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """El territorio de la ficha es el alcance por defecto si el usuario no eligió otro."""
    t = (ficha or {}).get("territorio") or {}
    if not t.get("nombre"):
        return None
    nivel = "municipio" if t.get("municipio_id") else "estado"
    return {"nivel": nivel, "estado_id": t.get("estado_id"), "municipio_id": t.get("municipio_id"), "nombre": t["nombre"], "texto": t["nombre"]}


def tope_fb() -> int:
    return max(1, int(os.getenv("APIFY_MAX_PERSONA_FB", "15") or 15))


# ───────── propia persona ─────────
def es_propia(post: Dict[str, Any], ficha: Optional[Dict[str, Any]], pagina_url: str = "", pagina_nombre: str = "") -> bool:
    """True si lo publicó la persona o una de sus cuentas oficiales (ficha o página elegida): no cuenta como opinión de terceros."""
    f = ficha or {}
    u = (post.get("user") or {})
    pl = post.get("plataforma", "facebook")
    mio = usuario(f.get(f"usuario_{pl}")).lower() if pl in ("x", "tiktok", "instagram") else ""
    if mio and str(u.get("usuario") or "").lower() == mio:
        return True
    if pl == "facebook":
        slugs = {fb._slug_fb(x) for x in [pagina_url, *(f.get("paginas_oficiales") or [])] if x}
        slugs.discard("")
        if slugs and fb._slug_fb(post.get("url") or "") in slugs:
            return True
        if pagina_nombre and _n(u.get("name") or "") == _n(pagina_nombre):
            return True
    return bool(f.get("nombre")) and _n(u.get("name") or "") == _n(f["nombre"])


def contar_variantes(posts: List[Dict[str, Any]], nombre: str, ficha: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Qué variantes se buscaron y cuántos posts las mencionan (conteo sobre lo traído, antes de filtrar)."""
    completo, cortas = variantes(nombre, ficha)
    f = ficha or {}
    filas = [(completo, "nombre completo")] + [(v, "variante") for v in cortas]
    filas += [(f"#{h.lstrip('#')}", "hashtag") for h in [*(f.get("hashtags") or [])] if h.strip()]
    filas += [(f"@{usuario(f.get(k))}", "usuario") for k in ("usuario_x", "usuario_tiktok", "usuario_instagram") if usuario(f.get(k))]
    out = []
    for v, tipo in filas:
        toks = coincidencia._toks(v)
        n = sum(1 for p in posts if coincidencia._frase(toks, f" {' '.join(coincidencia._toks(p.get('text') or ''))} "))
        out.append({"variante": v, "tipo": tipo, "posts": n})
    return out


# ───────── Facebook: menciones y página opcional ─────────
def facebook_menciones(nombre: str, ficha: Optional[Dict[str, Any]], alcance: Optional[Dict[str, Any]], refrescar: bool, before_call: Optional[Callable]) -> Dict[str, Any]:
    lugares = lugar_terminos(alcance)
    qs = consultas_texto(nombre, ficha, lugares)[:3]
    if fb.get_configured_fuente() == "fixture":
        raws = json.loads(fb.FIXTURE_PATH.read_text(encoding="utf-8"))
        return {"items": [fb.map_to_common_schema(r) for r in raws if isinstance(r, dict)], "origen": "fixture", "consultas": qs}
    payload: Dict[str, Any] = {"categories": qs, "searchType": "posts", "resultsLimit": tope_fb()}
    if lugares:
        payload["locations"] = [lugares[0]]
    actor = os.getenv("APIFY_ACTOR_ID", "apify~facebook-search-scraper").strip() or "apify~facebook-search-scraper"
    key = fb._persona_cache_key("persona-fb-menciones", "|".join(qs), "|".join(payload.get("locations", [])), tope_fb())
    items, origen = fb._cached_or_run(key, {"paso": "menciones-fb", "queries": qs}, lambda: fb._run_actor(actor, payload, before_call),
                                      lambda raws: [fb.map_to_common_schema(r) for r in raws if isinstance(r, dict)], refrescar)
    return {"items": items, "origen": origen, "consultas": qs}


def publicaciones_pagina(urls: List[str], pagina_nombre: str, refrescar: bool, before_call: Optional[Callable]) -> List[Dict[str, Any]]:
    """Opcional: publicaciones de la página oficial elegida (sirve para identificar y separar lo que publica la propia persona)."""
    urls = [u for u in dict.fromkeys(urls) if u]
    if not urls or fb.get_configured_fuente() == "fixture":
        return []
    mx = int(os.getenv("APIFY_MAX_POSTS", "20") or 20)
    actor = os.getenv("APIFY_PAGE_POSTS_ACTOR_ID", "apify~facebook-posts-scraper").strip()
    items, _ = fb._cached_or_run(fb._persona_cache_key("pagina", "|".join(sorted(urls)), mx), {"paso": "pagina", "paginas": urls},
                                 lambda: fb._run_actor(actor, {"startUrls": [{"url": u} for u in urls], "resultsLimit": mx}, before_call),
                                 lambda raws: [fb.map_to_common_schema(r) for r in raws if isinstance(r, dict)], refrescar)
    for it in items:
        etiquetar_facebook(it)
        if pagina_nombre and it["user"]["name"] == "Usuario de Facebook":
            it["user"] = {**it["user"], "name": pagina_nombre}
    return items


# ───────── dónde se habla ─────────
def lugares_mencionados(posts: List[Dict[str, Any]], alcance: Optional[Dict[str, Any]], maximo: int = 10) -> List[Dict[str, Any]]:
    """Municipios del estado del alcance (y colonias de config/alias.json si es Tlalpan) citados en los posts de opinión. Es un conteo por texto, no geolocalización."""
    nombres: Dict[str, str] = {}
    eid = str((alcance or {}).get("estado_id") or "")
    if eid and GEO_MUNICIPIOS.exists():
        for f in GEO_MUNICIPIOS.glob("*.json"):
            try:
                feats = json.loads(f.read_text(encoding="utf-8")).get("features", [])
            except Exception:
                continue
            if feats and str(feats[0].get("properties", {}).get("estado_id")) == eid:
                nombres.update({str(x["properties"]["nombre"]): "municipio" for x in feats})
                break
    if fb.is_tlalpan_scope(alcance):
        try:
            cfg = json.loads((BASE / "config" / "alias.json").read_text(encoding="utf-8"))
            nombres.update({c["termino"]: "colonia" for c in cfg.get("colonias_y_pueblos", []) if not c.get("ambiguo")})
        except Exception:
            pass
    haystacks = [f" {' '.join(coincidencia._toks(p.get('text') or ''))} " for p in posts]
    filas = []
    for nom, tipo in nombres.items():
        t = coincidencia._toks(nom)
        n = sum(1 for h in haystacks if coincidencia._frase(t, h))
        if n:
            filas.append({"lugar": nom, "tipo": tipo, "posts": n})
    return sorted(filas, key=lambda f: -f["posts"])[:maximo]


# ───────── comentarios ─────────
def _interacciones(p: Dict[str, Any]) -> int:
    return int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)


def candidatos_comentarios(resumen: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """Posts de terceros ya atribuidos, de Facebook y X, con más interacción."""
    tope_p = max(1, int(os.getenv("APIFY_MAX_COMENTARIOS_POSTS", "5") or 5))
    base = [p for p in resumen.get("posts_recientes") or [] if (p.get("atribucion") or {}).get("es_la_persona") == "si" and p.get("origen_post") != "publicado_por_persona"]
    por = {pl: sorted((p for p in base if p.get("plataforma", "facebook") == pl and p.get("url")), key=_interacciones, reverse=True)[:tope_p] for pl in ("facebook", "x")}
    return por


def estimado_comentarios(resumen: Dict[str, Any]) -> Dict[str, Any]:
    c = candidatos_comentarios(resumen)
    tope = max(1, int(os.getenv("APIFY_MAX_COMENTARIOS", "50") or 50))
    cf, cx = float(os.getenv("APIFY_COSTO_COMENTARIO_FB_1000", "2.5") or 2.5), float(os.getenv("APIFY_COSTO_X_1000", "0.4") or 0.4)
    filas = {"facebook": {"posts": len(c["facebook"]), "max_comentarios": tope if c["facebook"] else 0, "costo_usd": round(tope * cf / 1000, 4) if c["facebook"] else 0.0},
             "x": {"posts": len(c["x"]), "max_comentarios": tope if c["x"] else 0, "costo_usd": round(tope * cx / 1000, 4) if c["x"] else 0.0}}
    live = fb.get_configured_fuente() == "apify"
    return {"en_vivo": live, "plataformas": filas, "total_usd": round(sum(f["costo_usd"] for f in filas.values()), 4) if live else 0.0, "tope_comentarios": tope}


def _comentario(texto: Any, fecha: str, url: str, nombre: Any, uid: Any, usuario_: str, pl: str, parent: Dict[str, Any], likes: Any = 0) -> Dict[str, Any]:
    return {"text": str(texto or "").strip(), "time": fecha or "", "url": url or "", "plataforma": pl, "es_comentario": True, "tipo_fuente": "ciudadano",
            "likesCount": int(likes) if str(likes).isdigit() else 0, "commentsCount": 0, "sharesCount": 0,
            "user": {"id": str(uid or ""), "name": str(nombre or "Usuario"), "usuario": usuario_},
            "post_url": parent.get("url"), "atribucion": {**(parent.get("atribucion") or {}), "razon_ia": "Comentario en un post atribuido a la persona"}}


def extraer_comentarios(resumen: Dict[str, Any], before_call: Optional[Callable], refrescar: bool = False) -> Dict[str, Any]:
    """Comentarios (Facebook) y respuestas (X) de los posts de terceros con más interacción. Heredan la atribución del post."""
    from social.pipeline import analyze_post_sentiment
    from social import x as cx
    c = candidatos_comentarios(resumen)
    tope = max(1, int(os.getenv("APIFY_MAX_COMENTARIOS", "50") or 50))
    items: List[Dict[str, Any]] = []
    estados: Dict[str, Any] = {}
    if fb.get_configured_fuente() == "fixture":
        raws = json.loads((BASE / "fixtures" / "comentarios.json").read_text(encoding="utf-8")) if (BASE / "fixtures" / "comentarios.json").exists() else []
        padres = c["facebook"] + c["x"]
        for i, r in enumerate(raws):
            if padres:
                p = padres[i % len(padres)]
                items.append(_comentario(r.get("text"), r.get("date"), r.get("commentUrl"), r.get("profileName"), r.get("profileId"), "", p.get("plataforma", "facebook"), p, r.get("likesCount")))
        estados = {"fixture": {"estado": "ok", "comentarios": len(items)}}
    else:
        padres_fb = {p["url"]: p for p in c["facebook"]}
        if padres_fb:
            actor = os.getenv("APIFY_ACTOR_FB_COMENTARIOS", "apify/facebook-comments-scraper")
            payload = {"startUrls": [{"url": u} for u in padres_fb], "resultsLimit": max(1, tope // len(padres_fb)), "includeNestedComments": False}
            d0, _ = periodo_mod.fechas_consulta(resumen.get("periodo") or periodo_mod.resolver())
            if d0:
                payload["onlyCommentsNewerThan"] = d0.isoformat()
            try:
                got, _o = fb._cached_or_run(fb._persona_cache_key("coment-fb", json.dumps(payload, sort_keys=True)), {"paso": "comentarios-fb"},
                                            lambda: fb._run_actor(actor, payload, before_call), lambda raws: [r for r in raws if isinstance(r, dict) and r.get("text")], refrescar)
                for r in got[:tope]:
                    p = padres_fb.get(r.get("facebookUrl")) or next(iter(padres_fb.values()))
                    items.append(_comentario(r.get("text"), r.get("date"), r.get("commentUrl"), r.get("profileName"), r.get("profileId"), "", "facebook", p, r.get("likesCount")))
                estados["facebook"] = {"estado": "ok", "comentarios": sum(1 for i in items if i["plataforma"] == "facebook")}
            except Exception as exc:
                estados["facebook"] = {"estado": "error", "motivo": str(getattr(exc, "detail", exc))[:200]}
        padres_x = {str(p.get("postId")): p for p in c["x"] if str(p.get("postId", "")).isdigit()}
        if padres_x:
            actor = os.getenv("APIFY_ACTOR_X", "apidojo/tweet-scraper")
            payload = {"conversationIds": list(padres_x), "maxItems": tope}
            try:
                got, _o = fb._cached_or_run(fb._persona_cache_key("coment-x", json.dumps(payload, sort_keys=True)), {"paso": "respuestas-x"},
                                            lambda: fb._run_actor(actor, payload, before_call), lambda raws: [m for m in (cx.mapear(r) for r in raws if isinstance(r, dict)) if m], refrescar)
                for t in got:
                    if t["postId"] in padres_x or not t["text"]:
                        continue   # el propio tweet raíz no es un comentario
                    p = padres_x.get(str(t.get("conversationId") or "")) or next(iter(padres_x.values()))
                    items.append(_comentario(t["text"], t["time"], t["url"], t["user"]["name"], t["user"]["id"], t["user"].get("usuario", ""), "x", p, t["likesCount"]))
                estados["x"] = {"estado": "ok", "comentarios": sum(1 for i in items if i["plataforma"] == "x")}
            except Exception as exc:
                estados["x"] = {"estado": "error", "motivo": str(getattr(exc, "detail", exc))[:200]}
    for it in items:
        s = analyze_post_sentiment(it)
        it["sentimiento"], it["sentimiento_motor"] = s["label"], s["engine"]
    return {"fecha": datetime.now(timezone.utc).isoformat(), "items": items, "estados": estados, "posts_consultados": len(c["facebook"]) + len(c["x"])}


def opinion(resumen: Dict[str, Any]) -> Dict[str, Any]:
    """Sentimiento de opinión sobre terceros: posts (ciudadano/medio) + comentarios atribuidos. Muestra cuántos respaldan la cifra."""
    posts = [p for p in resumen.get("posts_recientes") or [] if p.get("tipo_fuente") in ("medio", "ciudadano") and p.get("origen_post") != "publicado_por_persona"
             and (p.get("atribucion") or {}).get("es_la_persona", "si") == "si"]
    coment = (resumen.get("comentarios") or {}).get("items") or []
    todos = [x for x in [*posts, *coment] if x.get("sentimiento") in ("pos", "neu", "neg")]
    n = len(todos)
    cnt = {k: sum(1 for x in todos if x["sentimiento"] == k) for k in ("pos", "neu", "neg")}
    pct = lambda k: round(100 * cnt[k] / n) if n else 0
    return {"posts": sum(1 for x in todos if not x.get("es_comentario")), "comentarios": sum(1 for x in todos if x.get("es_comentario")), "base": n,
            "positive": pct("pos"), "neutral": pct("neu"), "negative": pct("neg"), "suficiente": n > 0,
            "confianza": confianza(sum(1 for x in todos if not x.get("es_comentario")), sum(1 for x in todos if x.get("es_comentario")))}
