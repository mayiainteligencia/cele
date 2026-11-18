"""Conector de TikTok (clockworks/tiktok-scraper). Entrada verificada: searchQueries, hashtags, profiles, resultsPerPage, profileSorting.
Salida: id, text (caption), createTimeISO, webVideoUrl, authorMeta{id, name, nickName, verified, fans?}, diggCount, shareCount, playCount, commentCount."""
import os
from typing import Any, Dict, List, Optional, Tuple

from social import persona
from social.periodo import fechas_consulta
from social.plataformas import nuevo_post, slug, usuario


def entradas(tema: str, modo: str, lugares: List[str], ficha: Optional[Dict[str, Any]], periodo: Dict[str, Any], tope: int) -> Tuple[Dict[str, Any], List[str]]:
    f = ficha or {}
    tema = (tema or "").strip()
    consultas, tags, perfiles = [], [], []
    if modo == "persona":
        # No hay búsqueda de etiquetados en este actor: se usan palabras (nombre y variantes con cargo/territorio), @usuario como texto y hashtags de la ficha.
        consultas = persona.consultas_texto(tema, f, lugares, maximo=3)
        if usuario(f.get("usuario_tiktok")):
            consultas.append("@" + usuario(f.get("usuario_tiktok")))
        tags = [h.lstrip("#") for h in [*(f.get("hashtags") or []), *(f.get("hashtags_tiktok") or [])] if h.strip()]
        perfiles = []
    else:
        consultas = [f"{tema} {lugares[0]}".strip()] if lugares else [tema]
        tags = [slug(tema), *(slug(l) for l in lugares[:1])]
    tags = [t for t in dict.fromkeys(tags) if t]
    n = len(consultas) + len(tags) + len(perfiles)
    if not n:
        return {}, []
    payload = {"searchQueries": consultas, "hashtags": tags, "profiles": perfiles, "resultsPerPage": max(1, tope // n), "profileSorting": "latest"}
    # Filtros de fecha nativos del actor: son un complemento de pago, por eso están apagados salvo TIKTOK_FILTROS_FECHA_NATIVOS=1. El código filtra siempre.
    if os.getenv("TIKTOK_FILTROS_FECHA_NATIVOS", "0") == "1":
        d0, d1 = fechas_consulta(periodo)
        if d0:
            payload["oldestPostDateUnified"] = d0.isoformat()
        if d1:
            payload["newestPostDate"] = d1.isoformat()
    return {k: v for k, v in payload.items() if v != []}, [*consultas, *(f"#{t}" for t in tags), *(f"@{u}" for u in perfiles)]


def mapear(r: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not r.get("id") and not r.get("webVideoUrl"):
        return None
    a = r.get("authorMeta") or {}
    # el texto de un video es su caption; si está vacío queda "sin texto"
    p = nuevo_post("tiktok", r.get("id"), r.get("text"), a.get("nickName") or a.get("name"), a.get("id"), a.get("name") or "", a.get("fans"),
                   r.get("createTimeISO") or "", r.get("webVideoUrl") or "", r.get("diggCount"), r.get("commentCount"), r.get("shareCount"), r.get("playCount"))
    dur = (r.get("videoMeta") or {}).get("duration") if isinstance(r.get("videoMeta"), dict) else r.get("videoMeta.duration")
    p["formato"], p["duracion"] = "video corto", dur if isinstance(dur, (int, float)) else None
    return p
