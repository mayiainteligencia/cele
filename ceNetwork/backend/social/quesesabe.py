"""Panel «Qué se sabe hoy»: todo se calcula en código con los posts del periodo; ninguna cifra usa IA. Cada cifra declara su base (posts + comentarios)."""
import os
from typing import Any, Dict, List, Tuple

NOTA_SENAL = "Señal indirecta, no es sentimiento"
ALTA = 20


def minimo() -> int:
    return max(1, int(os.getenv("MUESTRA_MIN", "5") or 5))


def confianza(posts: int, comentarios: int = 0) -> Dict[str, Any]:
    """baja (< MUESTRA_MIN), media (MUESTRA_MIN a 19), alta (20 o más). Con base < MUESTRA_MIN la cifra es «Preliminar»; con 0 no hay cifra."""
    n = posts + comentarios
    mn = minimo()
    nivel = "baja" if n < mn else ("alta" if n >= max(ALTA, mn) else "media")
    return {"base": n, "posts": posts, "comentarios": comentarios, "nivel": nivel, "minimo": mn, "vacio": n == 0,
            "preliminar": 0 < n < mn, "etiqueta": f"Preliminar ({posts} {'post' if posts == 1 else 'posts'}{f' + {comentarios} comentarios' if comentarios else ''})" if 0 < n < mn else ""}


def terceros(resumen: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """(posts de ciudadanos y medios, comentarios) de terceros ya atribuidos. Sin atribución explícita (modo Tema) cuentan todos."""
    posts = [p for p in resumen.get("posts_recientes") or [] if p.get("tipo_fuente") in ("medio", "ciudadano") and p.get("origen_post") != "publicado_por_persona"
             and (p.get("atribucion") or {}).get("es_la_persona", "si") == "si"]
    return posts, list((resumen.get("comentarios") or {}).get("items") or [])


def atribuidos(resumen: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Todos los posts del periodo atribuidos (cualquier tipo de fuente): base del análisis de la narrativa oficial y afín."""
    posts = [p for p in resumen.get("posts_recientes") or [] if p.get("origen_post") != "publicado_por_persona"]
    return [p for p in posts if (p.get("atribucion") or {}).get("es_la_persona", "si") == "si"]


def _ratio(a: int, b: int):
    return round(a / b, 2) if b > 0 else None   # None = sin dato (no hay reacciones)


def _narrativa(c: Dict[str, Any]) -> Dict[str, Any]:
    r = c.get("reacciones") or {}
    reac, com, comp = int(c.get("likesCount") or 0), int(c.get("commentsCount") or 0), int(c.get("sharesCount") or 0)
    desglose = {"enojo": r.get("Angry", 0), "risa": r.get("Haha", 0), "tristeza": r.get("Sad", 0)}
    return {"titulo": c.get("titulo"), "fragmento": (c.get("texto") or "")[:220], "tipo_fuente": c.get("tipo_fuente"), "posts": c.get("count"),
            "cuentas": len(set(c.get("fuentes") or [])), "plataformas": c.get("plataformas") or [], "desde": c.get("desde") or c.get("time") or "",
            "interaccion": reac + com + comp, "reacciones": reac, "comentarios": com, "compartidos": comp,
            "comentarios_por_reaccion": _ratio(com, reac), "compartidos_por_reaccion": _ratio(comp, reac),
            "desglose_reacciones": desglose if any(desglose.values()) else None, "url": c.get("url") or ""}


def calcular(resumen: Dict[str, Any]) -> Dict[str, Any]:
    posts = resumen.get("posts_recientes") or []
    tp, tc = terceros(resumen)
    conf = confianza(len(tp), len(tc))
    # Conteo real por tipo de fuente: persona (publicado por ella, aparte), oficial, afín, medio, ciudadano y sin clasificar
    tipos = {"persona": int((resumen.get("publicado_por_persona") or {}).get("total") or len(resumen.get("publicado_por_persona_pipeline") or [])),
             "oficial": 0, "afin": 0, "medio": 0, "ciudadano": 0, "sin_clasificar": 0}
    for p in posts:
        t = p.get("tipo_fuente")
        tipos["afin" if t == "politico" else t if t in tipos else "sin_clasificar"] += 1
    ia = resumen.get("ia") or {}
    aviso_tipo = None
    if tipos["sin_clasificar"]:
        why = (ia.get("aviso") or "cuota de IA agotada").lower() if ia.get("cuota_agotada") else "sin IA disponible"
        aviso_tipo = f"{tipos['sin_clasificar']} posts sin clasificar ({why}); no cuentan como opinión"
    plats: Dict[str, int] = {}
    for p in posts:
        plats[p.get("plataforma", "facebook")] = plats.get(p.get("plataforma", "facebook"), 0) + 1
    clusters = (resumen.get("narrativa_oficial") or []) + (resumen.get("narrativa_ciudadana") or [])
    narr = sorted((_narrativa(c) for c in clusters), key=lambda n: (-n["cuentas"], -n["interaccion"]))[:5]
    mn = minimo()
    return {
        "confianza": conf, "total_posts": len(posts), "por_tipo_fuente": tipos, "por_plataforma": plats, "narrativas": narr, "nota_senal": NOTA_SENAL, "aviso_tipo": aviso_tipo,
        "falta": {"posts_terceros": len(tp), "comentarios_terceros": len(tc), "minimo": mn, "faltan_para_media": max(0, mn - conf["base"]), "faltan_para_alta": max(0, max(ALTA, mn) - conf["base"])},
    }
