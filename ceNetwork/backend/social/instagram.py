"""Conector de Instagram (apify/instagram-scraper). Entrada verificada: directUrls, resultsType, resultsLimit, onlyPostsNewerThan.
No hay búsqueda por palabra clave: se usan hashtags (de la ficha o derivados del tema y del lugar) y perfiles de la ficha.
Salida: id, caption, url, likesCount, commentsCount, timestamp, ownerUsername, ownerFullName, ownerId, videoViewCount, videoPlayCount."""
from typing import Any, Dict, List, Optional, Tuple

from social.periodo import fechas_consulta
from social.plataformas import nuevo_post, slug, usuario


def entradas(tema: str, modo: str, lugares: List[str], ficha: Optional[Dict[str, Any]], periodo: Dict[str, Any], tope: int) -> Tuple[Dict[str, Any], List[str]]:
    f = ficha or {}
    mencion = None
    if modo == "persona":
        # Hashtags de la ficha y del nombre; y los posts que etiquetan a la persona (resultsType "mentions" con su perfil)
        tags = [h.lstrip("#") for h in [*(f.get("hashtags") or []), *(f.get("hashtags_instagram") or []), tema] if h.strip()]
        perfiles = []
        mencion = usuario(f.get("usuario_instagram"))
    else:
        tags, perfiles = [tema, *lugares[:1]], []
    tags = [t for t in dict.fromkeys(slug(x) for x in tags) if t]
    urls = [f"https://www.instagram.com/explore/tags/{t}/" for t in tags] + [f"https://www.instagram.com/{u}/" for u in perfiles]
    if not urls and not mencion:
        return {}, []
    d0, _ = fechas_consulta(periodo)   # el actor solo filtra por "más nuevo que"; el límite superior lo aplica el código
    n_corridas = 2 if mencion else 1
    payload = {"directUrls": urls, "resultsType": "posts", "resultsLimit": max(1, tope // n_corridas // len(urls))} if urls else None
    if payload and d0:
        payload["onlyPostsNewerThan"] = d0.isoformat()
    payloads = [x for x in [payload] if x]
    consultas = [*(f"#{t}" for t in tags), *(f"@{u}" for u in perfiles)]
    if mencion:
        pm = {"directUrls": [f"https://www.instagram.com/{mencion}/"], "resultsType": "mentions", "resultsLimit": max(1, tope // n_corridas)}
        if d0:
            pm["onlyPostsNewerThan"] = d0.isoformat()
        payloads.append(pm)
        consultas.append(f"etiquetados @{mencion}")
    return (payloads if len(payloads) > 1 else (payloads[0] if payloads else {})), consultas


def mapear(r: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not r.get("id") and not r.get("url"):
        return None
    vistas = r.get("videoPlayCount") if r.get("videoPlayCount") is not None else r.get("videoViewCount")
    # el texto de un reel o video es su caption; si está vacío queda "sin texto"
    p = nuevo_post("instagram", r.get("id"), r.get("caption"), r.get("ownerFullName") or r.get("ownerUsername"), r.get("ownerId"), r.get("ownerUsername") or "", None,
                   r.get("timestamp") or "", r.get("url") or "", r.get("likesCount"), r.get("commentsCount"), None, vistas)
    tipo, prod = str(r.get("type") or ""), str(r.get("productType") or "")
    p["formato"] = "reel" if (prod == "clips" or tipo == "Video") else "carrusel" if tipo == "Sidecar" else "foto"
    p["duracion"] = r.get("videoDuration") if isinstance(r.get("videoDuration"), (int, float)) else None
    return p
