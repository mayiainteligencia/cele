"""Conector de X (apidojo/tweet-scraper). Campos de entrada verificados: searchTerms, maxItems, sort. Salida: id, url, text, createdAt,
retweetCount, replyCount, likeCount, quoteCount, isRetweet, author{userName, name, id, followers}."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from social import persona
from social.periodo import fechas_consulta
from social.plataformas import nuevo_post, usuario


def entradas(tema: str, modo: str, lugares: List[str], ficha: Optional[Dict[str, Any]], periodo: Dict[str, Any], tope: int) -> Tuple[Dict[str, Any], List[str]]:
    """Consultas con la sintaxis avanzada de X: lang:es, since:<fecha>, sin retweets; el lugar y sus alias van como términos (no geotags)."""
    d0, d1 = fechas_consulta(periodo)
    rango = (f" since:{d0.isoformat()}" if d0 else "") + (f" until:{(d1 + timedelta(days=1)).isoformat()}" if d1 else "")   # until es exclusivo
    ops = f"lang:es{rango} -filter:retweets"
    tema = (tema or "").strip().replace('"', "")
    if modo == "persona":
        # Menciones de terceros: nombre completo y variantes cortas con cargo/territorio, @usuario y respuestas; no se consulta lo que publica la propia persona
        f = ficha or {}
        u = usuario(f.get("usuario_x"))
        tags = [h.lstrip("#") for h in [*(f.get("hashtags") or []), *(f.get("hashtags_x") or [])] if h.strip()]
        completo, cortas = persona.variantes(tema, f)
        ctx = persona.contexto(f, lugares)
        ctx_q = f" ({' OR '.join(chr(34) + c + chr(34) for c in ctx)})" if ctx else ""
        terms = [f'"{completo}" {ops}'] + [f'"{v}"{ctx_q} {ops}' for v in cortas]
        if u:
            terms += [f"@{u} {ops}", f"to:{u} lang:es{rango}"]   # menciones al usuario y respuestas
        terms += [f"#{h} {ops}" for h in dict.fromkeys(tags)]
    else:
        lug = f" ({' OR '.join(chr(34) + x + chr(34) for x in lugares)})" if lugares else ""
        terms = [f'"{tema}"{lug} {ops}'] if " " in tema else [f"{tema}{lug} {ops}"]
    return {"searchTerms": terms, "sort": "Latest", "maxItems": tope}, terms


def _fecha(s: str) -> str:
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y").astimezone(timezone.utc).isoformat().replace("+00:00", ".000Z")
    except Exception:
        return ""


def mapear(r: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not r.get("id") and not r.get("url"):
        return None
    a = r.get("author") or {}
    p = nuevo_post("x", r.get("id"), r.get("text"), a.get("name"), a.get("id"), a.get("userName") or "", a.get("followers"), _fecha(r.get("createdAt") or ""),
                   r.get("url") or r.get("twitterUrl") or "", r.get("likeCount"), r.get("replyCount"), (r.get("retweetCount") or 0) + (r.get("quoteCount") or 0), r.get("viewCount"))
    p["metricas"]["retuits"] = r.get("retweetCount") if isinstance(r.get("retweetCount"), (int, float)) else None
    p["metricas"]["citas"] = r.get("quoteCount") if isinstance(r.get("quoteCount"), (int, float)) else None
    p["conversationId"] = str(r.get("conversationId") or r.get("inReplyToId") or "")
    if r.get("isRetweet") or p["text"].startswith("RT @"):
        p["descarte_nota"] = "retweet: duplica a otra cuenta"
    return p
