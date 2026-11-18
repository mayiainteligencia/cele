"""Análisis y recomendaciones sobre una búsqueda guardada. Una sola llamada a Gemini, solo al presionar el botón."""
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from social import llm
from social.lexico import pid
from social.pipeline import deduplicate_narratives
from social.quesesabe import atribuidos, calcular, confianza, terceros

ETIQUETA = "Borrador: validar antes de publicar"
MAX_MUESTRA = 25


def estimado(resumen: Dict[str, Any]) -> Dict[str, Any]:
    return {"peticiones_gemini": 1, "creditos_apify_usd": 0.0, "posts_base": len(atribuidos(resumen))}


def _agregados(resumen: Dict[str, Any], posts: List[Dict[str, Any]]) -> Dict[str, Any]:
    qs = resumen.get("que_se_sabe") or calcular(resumen)
    tp, tc = terceros(resumen)
    negativos = [p for p in tp if p.get("sentimiento") == "neg"]
    return {
        "por_tipo_fuente": qs["por_tipo_fuente"], "por_plataforma": qs["por_plataforma"],
        "sentimiento_de_terceros": resumen.get("sentimiento") if tp else None,
        "muestra_de_terceros": {"posts": len(tp), "comentarios": len(tc), "confianza": qs["confianza"]["nivel"]},
        "narrativas_principales": [{k: n[k] for k in ("titulo", "tipo_fuente", "cuentas", "posts", "interaccion", "comentarios_por_reaccion", "compartidos_por_reaccion", "desde")} for n in qs["narrativas"]],
        "categorias": resumen.get("categorias"),
        "palabras": {k: [(f["palabra"], f["posts"]) for f in (resumen.get("palabras") or {}).get(k, [])[:8]] for k in ("positivas", "negativas")},
        "temas": [(t["tema"], t["posts"]) for t in (resumen.get("temas") or {}).get("temas", [])],
        "narrativas_negativas": [{"titulo": c["titulo"], "posts": c["count"], "cuentas": len(c["fuentes"])} for c in deduplicate_narratives(negativos)[:6]],
    }


ACCION_MUESTRA = {"prioridad": "alta", "plazo": "inmediato", "canal": "datos", "evidencia": [],
                  "objetivo": "Conseguir una muestra de opinión de terceros: extraer comentarios de los posts con más interacción, ampliar el periodo o activar otras plataformas"}


def generar(resumen: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    posts = atribuidos(resumen)
    tp, tc = terceros(resumen)
    qs = resumen.get("que_se_sabe") or calcular(resumen)
    tipos = qs["por_tipo_fuente"]
    # La base la declara el código, no el modelo: cuántos posts, de qué tipo de fuente y cuánta muestra de terceros hay
    base = {"posts": len(posts), "tipos_fuente": tipos, "plataformas": qs["por_plataforma"], "muestra_terceros": {"posts": len(tp), "comentarios": len(tc)}, "confianza": confianza(len(tp), len(tc))}
    out0 = {"etiqueta": ETIQUETA, "fecha": datetime.now(timezone.utc).isoformat(), "posts_base": len(posts), "base": base}
    if not posts:
        return {**out0, "estado": "sin_base", "mensaje": "No hay posts atribuidos en el periodo: no hay base para analizar"}
    muestra = sorted(posts, key=lambda p: -(int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0)))[:MAX_MUESTRA]
    ids = {pid(p, i) for i, p in enumerate(posts)}
    logros = (ficha or {}).get("logros_verificables", "").strip()
    sin_terceros = not tp and not tc
    prompt = (
        "Eres analista de comunicación pública. Con los datos de abajo responde SOLO JSON con las claves exactas: "
        '{"mensajes_clave": [str], "temas": [str], "huecos": [str], "hallazgos": [str], "riesgos": [str], "oportunidades": [str], '
        '"acciones": [{"prioridad": "alta"|"media"|"baja", "plazo": str, "canal": str, "objetivo": str, "evidencia": [id de post]}], '
        '"respuestas": [{"narrativa": str, "clasificacion": "critica_legitima"|"posible_desinformacion"|"ataque", "respuesta": str, "evidencia": [id de post]}], '
        '"contenido": [{"idea": str, "canal": str, "logro_base": str}]}.\n'
        "Puedes analizar la narrativa oficial y afín: mensajes clave, temas, interacción, huecos y riesgos de que el mensaje no llegue. "
        "REGLAS ESTRICTAS: (1) Empieza cada hallazgo declarando su base («Con N posts de fuente X…»). "
        "(2) PROHIBIDO afirmar o insinuar qué opina el público, la ciudadanía o los vecinos si la muestra de terceros (ciudadanos y medios, más comentarios) es 0; "
        "con muestra baja usa lenguaje preliminar («en los N posts disponibles»). "
        "(3) No inventes cifras, fechas, nombres ni citas; donde falte un dato escribe [DATO A VALIDAR]. "
        "(4) Para critica_legitima propón atender o corregir, no solo contestar. "
        "(5) 'contenido' se basa SOLO en los logros verificables dados; sin logros, devuélvelo vacío. "
        "(6) Prohibido sugerir cuentas falsas, bots o difusión simulada. Cada evidencia debe ser un id de la muestra.\n"
        + ("(7) NO HAY muestra de terceros: la primera acción debe ser conseguir esa muestra.\n" if sin_terceros else "")
        + f"Persona: {(ficha or {}).get('nombre') or resumen.get('query', {}).get('tema')} ({(ficha or {}).get('cargo') or 'sin cargo'})\n"
        f"Logros verificables: {logros or 'ninguno'}\n"
        f"Base: {json.dumps(base, ensure_ascii=False)}\n"
        f"Agregados: {json.dumps(_agregados(resumen, posts), ensure_ascii=False)}\n"
        f"Muestra de posts: {json.dumps([{'id': pid(p), 'fuente': p.get('tipo_fuente'), 'plataforma': p.get('plataforma', 'facebook'), 'sent': p.get('sentimiento'), 'texto': (p.get('text') or '')[:280]} for p in muestra], ensure_ascii=False)}"
    )
    try:
        r = llm.generar_json(prompt, analisis=True, tag="analisis")
    except llm.CuotaAgotada:
        return {**out0, "estado": "cuota_agotada", "mensaje": llm.mensaje_cuota(True)}
    if r is None or not isinstance(r[0], dict):
        return {**out0, "estado": "sin_respuesta", "mensaje": "Gemini no devolvió un análisis válido; reintenta."}
    d, modelo = r
    lista = lambda k: [str(x) for x in d.get(k) or [] if str(x).strip()][:8]
    ev = lambda x: [i for i in (x.get("evidencia") or []) if i in ids]   # solo ids reales
    acciones = [{**{k: str(a.get(k) or "") for k in ("prioridad", "plazo", "canal", "objetivo")}, "evidencia": ev(a)} for a in d.get("acciones") or [] if isinstance(a, dict)][:10]
    if sin_terceros:   # sin muestra de terceros, la primera recomendación es conseguirla (lo garantiza el código, no el modelo)
        acciones = [ACCION_MUESTRA] + [a for a in acciones if "muestra" not in a["objetivo"].lower()][:9]
    return {
        **out0, "estado": "ok", "modelo": modelo, "cambio_por_cuota": llm.info_sesion()["cambio_por_cuota"],
        "mensajes_clave": lista("mensajes_clave"), "temas": lista("temas"), "huecos": lista("huecos"),
        "hallazgos": lista("hallazgos"), "riesgos": lista("riesgos"), "oportunidades": lista("oportunidades"),
        "acciones": acciones,
        "respuestas": [{"narrativa": str(a.get("narrativa") or ""), "clasificacion": str(a.get("clasificacion") or ""),
                        "respuesta": str(a.get("respuesta") or ""), "evidencia": ev(a)}
                       for a in d.get("respuestas") or [] if isinstance(a, dict)][:6],
        "contenido": ([{k: str(a.get(k) or "") for k in ("idea", "canal", "logro_base")}
                       for a in d.get("contenido") or [] if isinstance(a, dict)][:6] if logros else []),
        "aviso_contenido": None if logros else "Captura los logros verificables en la ficha para recibir ideas de contenido propio.",
        "aviso_muestra": "Sin muestra de terceros: este análisis no afirma qué opina el público." if sin_terceros else (f"Muestra de terceros {base['confianza']['etiqueta'] or 'con confianza ' + base['confianza']['nivel']}." ),
    }
