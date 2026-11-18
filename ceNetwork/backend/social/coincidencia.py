"""Coincidencia de un post con el tema o la persona buscada, con puntaje 0-100 en lugar de todo o nada.
Pasa si puntaje >= MATCH_UMBRAL (60 por defecto); entre 1 y el umbral va a 'Por confirmar'; 0 se descarta."""
import os
import re
from typing import Any, Dict, List, Optional

from social.facebook import NAME_CONNECTORS_ES, STOPWORDS_ES, normalize_text_no_accents

# Puntajes por nivel de coincidencia (mayor = más seguro)
FRASE_EXACTA, VARIANTE, USUARIO_O_HASHTAG, TODAS_LAS_PALABRAS, NOMBRE_Y_APELLIDO, APELLIDO_CON_CONTEXTO, UNA_PALABRA = 100, 95, 90, 85, 75, 55, 35
MAX_PARCIAL_TEMA = 80   # tema con varias palabras: coincidir solo con algunas nunca iguala a coincidir con todas


def umbral() -> int:
    return int(os.getenv("MATCH_UMBRAL", "60") or 60)


def _toks(texto: str) -> List[str]:
    """Minúsculas, sin acentos ni signos: lista de tokens alfanuméricos."""
    return [t for t in re.split(r"[^a-z0-9]+", normalize_text_no_accents(texto or "")) if t]


def _frase(frase_toks: List[str], hay: str) -> bool:
    return bool(frase_toks) and f" {' '.join(frase_toks)} " in hay


def puntuar(post: Dict[str, Any], tema: str, modo: str = "tema", ficha: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """{puntaje, nivel, coincidencias[]}; 'coincidencias' dice qué coincidió para mostrarlo en el panel."""
    if post.get("origen_post") == "publicado_por_persona":
        return {"puntaje": 100, "nivel": "pagina_oficial", "coincidencias": ["Publicada por la página oficial de la persona"]}

    texto = str(post.get("text") or "")
    q = _toks(tema)
    if not q:
        return {"puntaje": 0, "nivel": "ninguna", "coincidencias": []}
    persona = (modo or "").strip().lower() == "persona"
    extra = ""
    if persona:   # en modo Persona también cuenta el autor y a quién se compartió
        extra = f" {(post.get('user') or {}).get('name') or ''} {((post.get('sharedFromUser') or {}).get('name') if isinstance(post.get('sharedFromUser'), dict) else '') or ''}"
    hay = f" {' '.join(_toks(texto + extra))} "
    toks = set(hay.split())

    if _frase(q, hay):
        return {"puntaje": FRASE_EXACTA, "nivel": "frase_exacta", "coincidencias": [f"Frase exacta «{tema.strip()}»"]}

    # Ficha: variantes (frase exacta de la variante), hashtags y usuario de la página oficial
    for v in (ficha or {}).get("variantes") or []:
        if _frase(_toks(v), hay):
            return {"puntaje": VARIANTE, "nivel": "variante", "coincidencias": [f"Variante «{v}»"]}
    for h in (ficha or {}).get("hashtags") or []:
        if _frase(_toks(h), hay):
            return {"puntaje": USUARIO_O_HASHTAG, "nivel": "hashtag", "coincidencias": [f"Hashtag «#{h.lstrip('#')}»"]}
    for u in (ficha or {}).get("paginas_oficiales") or []:
        slug = [s for s in re.split(r"[?#]", u)[0].strip("/").split("/") if s and not s.isdigit()][-1:] or [""]
        s_norm = "".join(_toks(slug[0]))
        if len(s_norm) >= 5 and s_norm in toks:
            return {"puntaje": USUARIO_O_HASHTAG, "nivel": "usuario_pagina", "coincidencias": [f"Usuario de la página oficial «{slug[0]}»"]}

    if persona:
        palabras = [t for t in q if t not in NAME_CONNECTORS_ES]
        presentes = [t for t in palabras if t in toks]
        if palabras and len(presentes) == len(palabras):
            return {"puntaje": TODAS_LAS_PALABRAS, "nivel": "todas_las_palabras", "coincidencias": presentes}
        for a, b in zip(palabras, palabras[1:]):   # nombre y apellido contiguos (se admite "de/del/la" en medio)
            if re.search(rf" {a} (?:(?:de|del|la|las|los|el) )?{b} ", hay):
                return {"puntaje": NOMBRE_Y_APELLIDO, "nivel": "nombre_y_apellido", "coincidencias": [f"{a} {b}"]}
        apellidos = [t for t in palabras[-2:] if len(t) >= 3 and t in toks]
        terr = (((ficha or {}).get("territorio") or {}).get("nombre") or "")
        contexto = [c for c in ((ficha or {}).get("cargo"), terr) if c and _frase(_toks(c), hay)]
        if apellidos and contexto:
            return {"puntaje": APELLIDO_CON_CONTEXTO, "nivel": "apellido_con_contexto",
                    "coincidencias": [f"apellido «{apellidos[0]}»", f"contexto «{contexto[0]}»"]}
        sueltas = [t for t in presentes if len(t) >= 4]
        if sueltas:
            return {"puntaje": UNA_PALABRA, "nivel": "una_palabra", "coincidencias": sueltas[:1]}
        return {"puntaje": 0, "nivel": "ninguna", "coincidencias": []}

    # Tema: palabras significativas ponderadas por longitud (las más largas pesan más); basta con las de más peso
    sig = [t for t in q if t not in STOPWORDS_ES and len(t) >= 2]
    presentes = [t for t in sig if t in toks]
    if not sig or not presentes:
        return {"puntaje": 0, "nivel": "ninguna", "coincidencias": []}
    if len(presentes) == len(sig):
        return {"puntaje": TODAS_LAS_PALABRAS, "nivel": "todas_las_palabras", "coincidencias": presentes}
    peso = sum(len(t) for t in presentes) / sum(len(t) for t in sig)
    return {"puntaje": max(1, round(MAX_PARCIAL_TEMA * peso)), "nivel": "parcial", "coincidencias": presentes}


def pasa(c: Dict[str, Any]) -> bool:
    return c["puntaje"] >= umbral()
