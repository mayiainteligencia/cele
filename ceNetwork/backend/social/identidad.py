"""Puntaje de identidad (0-100) por post y verificación con Gemini, a partir de la ficha de entidad."""
import json
import os
import re
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

from social.facebook import normalize_text_no_accents, matches_query_filter

# Pesos: el nombre completo solo llega justo al umbral (40); nombre parcial necesita corroboración.
PTS_NOMBRE_COMPLETO, PTS_NOMBRE_PARCIAL = 40, 25
PTS_CARGO, PTS_TERRITORIO, PTS_PARTIDO, PTS_HASHTAG, PTS_PAGINA_OFICIAL = 20, 15, 10, 10, 25
PEN_IDIOMA, PEN_DESCARTE, PEN_DESCARTE_MAX = 40, 30, 60

_ES = set("de la que el en y los se del las un por con no una su para es al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante".split())
_OTROS = set("the and of to in is that for with on are was this you it as at be by have from or an they we not but his her their will nao uma com os em do da dos foi ele seu sua sao".split())


def _tokens(txt: str) -> List[str]:
    return [t for t in re.split(r"[^a-z0-9]+", normalize_text_no_accents(txt)) if t]


def idioma_es(texto: str) -> bool:
    """Heurística por palabras vacías; ante la duda (texto corto) se asume español."""
    toks = _tokens(texto)
    if len(toks) < 6:
        return True
    es, otros = sum(t in _ES for t in toks), sum(t in _OTROS for t in toks)
    return not (otros >= 2 and otros > es)


def _en(termino: str, hay: str) -> bool:
    t = normalize_text_no_accents(termino).strip().lstrip("#@")
    return bool(t) and bool(re.search(rf"(?<![a-z0-9]){re.escape(t)}(?![a-z0-9])", hay))


def _slug(url: str) -> str:
    return urlparse(url).path.strip("/").split("/")[0].lower()


def puntaje_identidad(post: Dict[str, Any], ficha: Dict[str, Any]) -> Tuple[int, List[str]]:
    """Devuelve (puntaje 0-100, razones legibles de por qué se atribuyó/penalizó)."""
    if post.get("origen_post") == "publicado_por_persona":
        return 100, ["Publicada por una página oficial de la ficha"]
    texto = str(post.get("text") or "")
    hay = normalize_text_no_accents(f"{texto} {post.get('link') or ''}")
    nombres = [ficha["nombre"]] + list(ficha.get("variantes") or [])
    score, razones = 0, []

    completo = next((n for n in nombres if re.search(r"(?<![a-z0-9])" + r"\s+".join(map(re.escape, _tokens(n))) + r"(?![a-z0-9])", hay)), None)
    if completo:
        score += PTS_NOMBRE_COMPLETO; razones.append(f"Menciona el nombre «{completo}»")
    elif any(matches_query_filter(post, n, "persona") for n in nombres):
        score += PTS_NOMBRE_PARCIAL; razones.append("Menciona nombre y apellido")

    terr = (ficha.get("territorio") or {}).get("nombre") or ""
    if ficha.get("cargo") and _en(ficha["cargo"], hay):
        score += PTS_CARGO; razones.append(f"Menciona el cargo «{ficha['cargo']}»")
    if terr and _en(terr, hay):
        score += PTS_TERRITORIO; razones.append(f"Menciona el territorio «{terr}»")
    if ficha.get("partido") and _en(ficha["partido"], hay):
        score += PTS_PARTIDO; razones.append(f"Menciona el partido «{ficha['partido']}»")
    tag = next((h for h in ficha.get("hashtags") or [] if _en("#" + h.lstrip("#"), hay)), None)
    if tag:
        score += PTS_HASHTAG; razones.append(f"Usa el hashtag «#{tag.lstrip('#')}»")
    pag = next((u for u in ficha.get("paginas_oficiales") or [] if _slug(u) and _slug(u) in hay.replace(" ", "")), None)
    if pag:
        score += PTS_PAGINA_OFICIAL; razones.append("Etiqueta o enlaza una página oficial")

    if ficha.get("idioma", "es") == "es" and not idioma_es(texto):
        score -= PEN_IDIOMA; razones.append("Idioma distinto de español")
    descartes = [d for d in ficha.get("palabras_descarte") or [] if _en(d, hay)]
    if descartes:
        score -= min(PEN_DESCARTE_MAX, PEN_DESCARTE * len(descartes)); razones.append("Palabras de descarte: " + ", ".join(descartes))
    return max(0, min(100, score)), razones


def verificar_con_gemini(post: Dict[str, Any], ficha: Dict[str, Any]) -> Dict[str, str]:
    """Pregunta a Gemini, con la ficha completa como contexto, si el post trata de ESA persona. Nunca rompe."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"es_la_persona": "incierto", "razon": "Sin GEMINI_API_KEY: no se pudo verificar"}
    prompt = (
        "Decide si esta publicación de Facebook trata de la persona descrita en la ficha (hay homónimos). "
        'Responde SOLO JSON: {"es_la_persona": "si"|"no"|"incierto", "razon": "máx. 20 palabras"}.\n'
        f"Ficha: {json.dumps(ficha, ensure_ascii=False)}\n"
        f"Autor: {(post.get('user') or {}).get('name') or 'Desconocido'}\n"
        f"Texto: {(post.get('text') or '')[:1200]}"
    )
    try:
        from google import genai  # type: ignore
        resp = genai.Client(api_key=api_key).models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash",
            contents=prompt, config={"response_mime_type": "application/json", "temperature": 0})
        out = json.loads(resp.text or "{}")
        val = str(out.get("es_la_persona") or "").strip().lower()
        if val in ("si", "sí"):
            val = "si"
        if val in ("si", "no", "incierto"):
            return {"es_la_persona": val, "razon": str(out.get("razon") or "")[:200]}
    except Exception as exc:
        print(f"[identidad] Gemini falló: {exc}")
    return {"es_la_persona": "incierto", "razon": "Gemini no respondió: por confirmar"}
