"""Palabras y temas sobre la persona. Los conteos son código; Gemini solo etiqueta temas (un lote por llamada)."""
import json
from pathlib import Path
import re
from typing import Any, Dict, List

from social import llm
from social.quesesabe import confianza
from social.facebook import normalize_text_no_accents

RUTA = Path(__file__).resolve().parents[1] / "config" / "lexico_es.json"
TEMAS = ("seguridad", "obras", "corrupcion", "trato", "propuestas", "servicios", "otro")
TIPOS_MENSAJE = ("acusacion", "queja", "peticion", "pregunta", "elogio", "otro")


def pid(p: Dict[str, Any], i: int = 0) -> str:
    return str(p.get("postId") or p.get("url") or f"post-{i}")


def posts_de_la_persona(resumen: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Solo posts de terceros atribuidos a la ficha (es_la_persona = si) y de tipo medio o ciudadano; lo que publica la propia persona no cuenta."""
    return [p for p in resumen.get("posts_recientes") or []
            if (p.get("atribucion") or {}).get("es_la_persona") == "si" and p.get("tipo_fuente") in ("medio", "ciudadano") and p.get("origen_post") != "publicado_por_persona"]


def base_opinion(resumen: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Posts de terceros más los comentarios ya atribuidos (heredan la atribución del post)."""
    return posts_de_la_persona(resumen) + list((resumen.get("comentarios") or {}).get("items") or [])


def _norm(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9# ]+", " ", normalize_text_no_accents(t or "").lower())).strip()


def _coincide(entrada: str, tokens: List[str], texto: str) -> bool:
    if " " in entrada:
        return entrada in texto
    return any(t == entrada for t in tokens) if len(entrada) <= 4 else any(t.startswith(entrada) for t in tokens)


def _contar(posts: List[Dict[str, Any]], grupos: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    filas = []
    for etiqueta, entradas in grupos.items():
        n_posts, menciones, ids, n_com = 0, 0, [], 0
        for i, p in enumerate(posts):
            texto = _norm(p.get("text") or "")
            tokens = texto.split()
            hit = sum(1 for e in entradas if _coincide(_norm(e), tokens, texto))
            if hit:
                if p.get("es_comentario"):
                    n_com += 1
                else:
                    n_posts += 1
                menciones += hit
                ids.append(pid(p, i))
        if n_posts or n_com:
            filas.append({"palabra": etiqueta, "posts": n_posts, "comentarios": n_com, "menciones": menciones, "ids": ids[:20]})
    return sorted(filas, key=lambda f: (-(f["posts"] + f["comentarios"]), -f["menciones"]))


def palabras(resumen: Dict[str, Any]) -> Dict[str, Any]:
    posts = base_opinion(resumen)
    n = len(posts)
    np_, nc = sum(1 for p in posts if not p.get("es_comentario")), sum(1 for p in posts if p.get("es_comentario"))
    out: Dict[str, Any] = {"muestra": n, "muestra_posts": np_, "muestra_comentarios": nc, "confianza": confianza(np_, nc), "suficiente": n > 0}
    if n == 0:   # solo con 0 no hay cifra; con 1 o más se muestra como preliminar
        out["mensaje"] = "Sin posts ni comentarios de terceros atribuidos"
        return out
    lex = json.loads(RUTA.read_text(encoding="utf-8"))
    sent = {"pos": 0, "neu": 0, "neg": 0}
    for p in posts:
        if p.get("sentimiento") in sent:
            sent[p["sentimiento"]] += 1
    out.update({"positivas": _contar(posts, lex["positivas"]), "negativas": _contar(posts, lex["negativas"]), "sentimiento": sent})
    return out


def temas(resumen: Dict[str, Any]) -> Dict[str, Any]:
    """Una llamada a Gemini etiqueta tema y tipo de mensaje de cada post; los conteos y ejemplos se arman aquí."""
    posts = base_opinion(resumen)[:40]
    np_, nc = sum(1 for p in posts if not p.get("es_comentario")), sum(1 for p in posts if p.get("es_comentario"))
    if not posts:
        return {"muestra": 0, "suficiente": False, "confianza": confianza(0, 0), "mensaje": "Sin posts ni comentarios de terceros atribuidos"}
    items = [{"id": i, "texto": (p.get("text") or "")[:400]} for i, p in enumerate(posts)]
    prompt = (
        "Etiqueta cada publicación sobre una persona pública. Responde SOLO un arreglo JSON: "
        f'{{"id": n, "tema": {"|".join(TEMAS)}, "tipo": {"|".join(TIPOS_MENSAJE)}}}. '
        "tema=trato es cómo trata a la gente; tipo=acusacion es atribuirle una falta concreta.\n"
        f"Publicaciones: {json.dumps(items, ensure_ascii=False)}"
    )
    try:
        r = llm.generar_json(prompt, tag="temas")
    except llm.CuotaAgotada:
        return {"muestra": len(posts), "suficiente": True, "confianza": confianza(np_, nc), "mensaje": llm.mensaje_cuota()}
    if r is None or not isinstance(r[0], list):
        return {"muestra": len(posts), "suficiente": True, "confianza": confianza(np_, nc), "mensaje": "Sin respuesta de IA"}
    por_tema: Dict[str, List[int]] = {}
    por_tipo: Dict[str, int] = {}
    for it in r[0]:
        try:
            i = int(it.get("id"))
            posts[i]
        except Exception:
            continue
        tema = it.get("tema") if it.get("tema") in TEMAS else "otro"
        tipo = it.get("tipo") if it.get("tipo") in TIPOS_MENSAJE else "otro"
        por_tema.setdefault(tema, []).append(i)
        por_tipo[tipo] = por_tipo.get(tipo, 0) + 1
    filas = [{"tema": t, "posts": sum(1 for i in ix if not posts[i].get("es_comentario")), "comentarios": sum(1 for i in ix if posts[i].get("es_comentario")), "ejemplos": [{"texto": posts[i]["text"][:220], "url": posts[i].get("url")} for i in ix[:3]]}
             for t, ix in sorted(por_tema.items(), key=lambda kv: -len(kv[1]))]
    return {"muestra": len(posts), "muestra_posts": np_, "muestra_comentarios": nc, "confianza": confianza(np_, nc), "suficiente": True, "temas": filas,
            "tipos_mensaje": [{"tipo": k, "posts": v} for k, v in sorted(por_tipo.items(), key=lambda kv: -kv[1])], "modelo": r[1]}
