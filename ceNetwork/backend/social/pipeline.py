"""
Pipeline de procesamiento para ceNetwork (Tlalpan, CDMX):
1. Filtro de fecha (descarta > 14 días configurable).
2. Filtro de homónimos ("Calzada de Tlalpan" sin referencia a la alcaldía) y alias ambiguos.
3. Clasificación con Gemini por post en JSON:
   {relevante: bool, categoria: seguridad|empleo|queja|obras|politica|noticia|otro, tipo_fuente: oficial|politico|medio|ciudadano}
   apoyado en config/fuentes.json. Descarta no relevantes (ofertas de empleo, vacíos, etc.).
4. Deduplicación de textos casi idénticos como una sola narrativa con su conteo.
5. Sentimiento con pysentimiento (español), modelo cargado una sola vez, solo sobre medio|ciudadano.
   Los posts oficiales/políticos se separan como "narrativa oficial".
"""
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
import hashlib
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import unicodedata
import requests

from social import coincidencia, llm
from social import periodo as periodo_mod
from social.identidad import idioma_es
from social.facebook import load_env_file, load_alias_config, matches_query_filter

BASE_DIR = Path(__file__).resolve().parents[1]
FUENTES_PATH = BASE_DIR / "config" / "fuentes.json"

CATEGORIAS_VALIDAS = {"seguridad", "empleo", "queja", "obras", "politica", "noticia", "otro"}
FUENTES_VALIDAS = {"persona", "oficial", "afin", "medio", "ciudadano"}   # "politico" del catálogo se normaliza a "afin"


def _tipo(t: Optional[str]) -> Optional[str]:
    return "afin" if t == "politico" else t

# Singleton del modelo pysentimiento (cargado una sola vez en todo el proceso)
_SENTIMENT_ANALYZER: Any = None
_SENTIMENT_INIT_DONE: bool = False


def get_pysentimiento_analyzer() -> Any:
    """Carga el analizador pysentimiento (español) una sola vez."""
    global _SENTIMENT_ANALYZER, _SENTIMENT_INIT_DONE
    if _SENTIMENT_INIT_DONE:
        return _SENTIMENT_ANALYZER
    _SENTIMENT_INIT_DONE = True
    try:
        from pysentimiento import create_analyzer  # type: ignore
        _SENTIMENT_ANALYZER = create_analyzer(task="sentiment", lang="es")
        print("[pipeline] Modelo pysentimiento (lang='es') cargado una sola vez.")
    except Exception as exc:
        print(f"[pipeline] pysentimiento no disponible en entorno ({exc}); activo respaldo léxico español.")
        _SENTIMENT_ANALYZER = None
    return _SENTIMENT_ANALYZER


def load_fuentes_config() -> Dict[str, List[Dict[str, Any]]]:
    """Lee config/fuentes.json con cuentas oficiales, de políticos y medios."""
    if FUENTES_PATH.exists():
        return json.loads(FUENTES_PATH.read_text(encoding="utf-8"))
    return {"oficial": [], "politico": [], "medio": []}


def parse_iso_datetime(raw_time: str) -> Optional[datetime]:
    """Convierte ISO 8601 a datetime UTC."""
    if not raw_time:
        return None
    try:
        clean = raw_time.strip()
        if clean.endswith("Z"):
            clean = clean[:-1] + "+00:00"
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def detect_known_source_type(post: Dict[str, Any], fuentes_cfg: Dict[str, List[Dict[str, Any]]]) -> Optional[str]:
    """Verifica si el autor o URL del post pertenece al catálogo config/fuentes.json."""
    user = post.get("user") or {}
    if not post.get("hasOwnText", True) and isinstance(post.get("sharedFromUser"), dict):
        user = post["sharedFromUser"]
    uid = str(user.get("id") or "").strip().lower()
    uname = str(user.get("name") or "").strip().lower()
    url = str(post.get("url") or "").strip().lower()

    for tipo in ("oficial", "politico", "medio"):
        for entry in fuentes_cfg.get(tipo, []):
            entry_id = str(entry.get("id") or "").strip().lower()
            if entry_id and uid and entry_id == uid:
                return tipo
            entry_name = str(entry.get("nombre") or "").strip().lower()
            if entry_name and entry_name in uname:
                return tipo
            for h in entry.get("handles", []):
                hl = str(h).strip().lower()
                if hl and (hl == uname or hl in uname or f"/{hl}/" in url or f"/{hl}" in url):
                    return tipo
    return None


def is_homonym_or_out_of_scope(text: str, alias_cfg: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Descarta homónimos como 'Calzada de Tlalpan' cuando no se refieran a la alcaldía,
    y valida que los alias ambiguos tengan contexto de Tlalpan.
    """
    tl = text.lower()
    pueblos_no_ambiguos = [
        a["termino"].lower()
        for a in alias_cfg.get("colonias_y_pueblos", [])
        if not a.get("ambiguo")
    ]

    for hom in alias_cfg.get("homonimos_descartar", []):
        termino = str(hom.get("termino") or "").lower()
        if termino and termino in tl:
            contextos = [c.lower() for c in hom.get("requiere_contexto_alcaldia", [])] + pueblos_no_ambiguos
            if not any(ctx in tl for ctx in contextos):
                return True, f"Homónimo descartado ({hom.get('termino')})"

    # Si solo coincide con un alias ambiguo sin mencionar Tlalpan ni alcaldía
    ambiguos = [
        a["termino"].lower()
        for a in alias_cfg.get("colonias_y_pueblos", [])
        if a.get("ambiguo")
    ]
    if any(amb in tl for amb in ambiguos) and "tlalpan" not in tl and not any(p in tl for p in pueblos_no_ambiguos):
        return True, "Alias ambiguo sin referencia a Tlalpan"

    return False, ""


def _heuristic_classify_post(
    post: Dict[str, Any],
    known_source: Optional[str],
) -> Dict[str, Any]:
    """Clasificación determinista de respaldo si Gemini no responde o falla la red."""
    text = (post.get("text") or "").strip()
    tl = text.lower()
    uname = str((post.get("user") or {}).get("name") or "").lower()

    # Detectar ofertas de empleo / vacantes de guardias de seguridad privada
    job_patterns = [
        r"contrataci[oó]n inmediata",
        r"vacantes?",
        r"bolsa de trabajo",
        r"en busca de personas responsables para laborar",
        r"sueldo",
        r"prestaciones de ley",
        r"[uú]nete a nuestro equipo de seguridad",
        r"solicita guardias",
        r"seguridad privada",
    ]
    if any(re.search(pat, tl) for pat in job_patterns) or "seguridad privada" in uname:
        return {
            "relevante": False,
            "categoria": "empleo",
            "tipo_fuente": known_source or "sin_clasificar",
            "clasificador": "reglas",
        }

    tipo_fuente = known_source
    if not tipo_fuente:
        if any(w in uname for w in ("alcaldía", "alcaldia", "gobierno", "secretaría", "policial")):
            tipo_fuente = "oficial"
        elif any(w in uname for w in ("noticias", "denuncias", "diario", "red ", "hilo", "pueblo manda", "embargo")):
            tipo_fuente = "medio"
        else:
            tipo_fuente = "sin_clasificar"   # sin IA no se asume "ciudadano": no se cuenta como opinión

    # Categoría
    if any(w in tl for w in ("linchamiento", "denuncia", "queja", "bache", "fuga", "falta de agua", "bloqueo")):
        categoria = "queja" if "queja" in tl or "denuncia" in tl else "seguridad"
    elif any(w in tl for w in ("obras", "bacheo", "luminaria", "paviment", "infraestructura", "agua")):
        categoria = "obras"
    elif any(w in tl for w in ("delito", "polic", "patrulla", "seguridad", "inseguridad", "operativo", "guardia nacional", "ssc")):
        categoria = "seguridad"
    elif any(w in tl for w in ("encuesta", "inegi", "percepción", "reportan", " #enmedios")):
        categoria = "noticia"
    elif any(w in tl for w in ("transformación", "morena", "jefa de gobierno", "diputad", "elección")):
        categoria = "politica"
    else:
        categoria = "otro"

    return {
        "relevante": bool(len(tl) >= 15),
        "categoria": categoria,
        "tipo_fuente": tipo_fuente,
        "clasificador": "reglas",
    }


CLASIF_CACHE = BASE_DIR / ".cache" / "clasificacion.json"   # hash del texto -> clasificación de Gemini (nunca se reclasifica)
LOTE_CLASIF = 18


def _hash_texto(t: str) -> str:
    return hashlib.sha1(re.sub(r"\s+", " ", (t or "").strip().lower()).encode("utf-8")).hexdigest()[:20]


def classify_posts_batch(
    posts: List[Dict[str, Any]],
    fuentes_cfg: Dict[str, List[Dict[str, Any]]],
    tema: str = "",
    ficha: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], bool]:
    """Clasifica en lotes de ~18 posts por llamada (JSON por id). Devuelve (clasificaciones alineadas, cuota_agotada).
    Orden de recursos: reglas para empleo evidente -> caché por hash -> Gemini -> reglas si no hay IA o cuota."""
    out: List[Dict[str, Any]] = []
    known: List[Optional[str]] = []
    pendientes: List[int] = []
    try:
        cache = json.loads(CLASIF_CACHE.read_text(encoding="utf-8")) if CLASIF_CACHE.exists() else {}
    except Exception:
        cache = {}
    from social import persona as persona_mod   # import tardío: evita ciclo
    for i, post in enumerate(posts):
        ks = _tipo(detect_known_source_type(post, fuentes_cfg))
        known.append(ks)
        fb = _heuristic_classify_post(post, ks)
        out.append(fb)
        if ficha and persona_mod.es_propia(post, ficha):   # regla en código, antes de Gemini: lo que publica la persona no es opinión
            out[i] = {"relevante": True, "categoria": "politica", "tipo_fuente": "persona", "clasificador": "reglas"}
            continue
        if fb["categoria"] == "empleo" and not fb["relevante"]:
            continue
        h = _hash_texto((post.get("text") or "") + (f"|{ficha['id']}" if ficha else ""))
        hit = cache.get(h)
        if hit:
            cat = hit.get("categoria") if hit.get("categoria") in CATEGORIAS_VALIDAS else fb["categoria"]
            tf = ks or (_tipo(hit.get("tipo_fuente")) if _tipo(hit.get("tipo_fuente")) in FUENTES_VALIDAS else fb["tipo_fuente"])
            out[i] = {"relevante": bool(hit.get("relevante")) and cat != "empleo", "categoria": cat, "tipo_fuente": tf, "clasificador": "gemini"}
        elif llm.hay_clave():
            pendientes.append(i)

    agotada = False
    for k in range(0, len(pendientes), LOTE_CLASIF):
        lote = pendientes[k:k + LOTE_CLASIF]
        items = [{"id": j, "plataforma": posts[j].get("plataforma", "facebook"), "autor": (posts[j].get("user") or {}).get("name") or "Desconocido",
                  "fuente_catalogo": known[j] or "ninguna", "texto": (posts[j].get("text") or "")[:600]} for j in lote]
        prompt = (
            f"Clasifica estas publicaciones de redes sociales (Facebook, X, TikTok o Instagram) sobre «{tema or 'el tema de la búsqueda'}». Responde SOLO un arreglo JSON, "
            'un objeto por id: {"id": n, "relevante": bool, "categoria": "seguridad"|"empleo"|"queja"|"obras"|"politica"|"noticia"|"otro", '
            '"tipo_fuente": "oficial"|"afin"|"medio"|"ciudadano"}.\n'
            "relevante=false si es oferta de empleo, spam comercial o no trata del tema/lugar de la búsqueda.\n"
            + ("tipo_fuente: afin = cuenta del entorno de la persona (apoyo, fans, 'mi amigo', 'acompañamos al alcalde', hashtags de la administración, páginas que repiten el boletín); "
               "oficial = gobierno o institución; medio = medio de noticias; ciudadano = persona común sin señales de afinidad. "
               f"Ficha: {json.dumps({c: ficha.get(c) for c in ('nombre', 'cargo', 'partido', 'hashtags')}, ensure_ascii=False)}\n" if ficha else "")
            + f"Publicaciones: {json.dumps(items, ensure_ascii=False)}"
        )
        try:
            r = llm.generar_json(prompt, tag="clasificar-lote")
        except llm.CuotaAgotada:
            agotada = True
            break
        if r is None or not isinstance(r[0], list):
            continue
        for it in r[0]:
            try:
                j = int(it.get("id"))
            except Exception:
                continue
            if j not in lote:
                continue
            fb = out[j]
            cat = str(it.get("categoria") or fb["categoria"]).lower()
            cat = cat if cat in CATEGORIAS_VALIDAS else fb["categoria"]
            tf_ia = _tipo(str(it.get("tipo_fuente") or fb["tipo_fuente"]).lower())
            tf = known[j] or (tf_ia if tf_ia in FUENTES_VALIDAS else fb["tipo_fuente"])
            rel = bool(it.get("relevante")) and cat != "empleo"
            out[j] = {"relevante": rel, "categoria": cat, "tipo_fuente": tf, "clasificador": "gemini"}
            cache[_hash_texto((posts[j].get("text") or "") + (f"|{ficha['id']}" if ficha else ""))] = {"relevante": rel, "categoria": cat, "tipo_fuente": tf_ia if tf_ia in FUENTES_VALIDAS else tf}
    try:
        CLASIF_CACHE.parent.mkdir(parents=True, exist_ok=True)
        CLASIF_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        print(f"[pipeline] No se pudo guardar el caché de clasificación: {exc}")
    return out, agotada


_EMOJI_DECORATIVE_RE = re.compile(
    "["
    "\U00010000-\U0010ffff"  # Supplementary planes (all modern emojis, sirens 🚨, flags 🇲🇽, etc.)
    "\u2600-\u27bf"          # Misc symbols & Dingbats (✅, ✨, etc.)
    "\u2300-\u23ff"          # Misc technical (⏰, ⏳, etc.)
    "\u2b00-\u2bff"          # Misc symbols and arrows (⭐, ⬛, etc.)
    "\u25a0-\u25ff"          # Geometric shapes
    "\u2190-\u21ff"          # Arrows
    "\ufe00-\ufe0f"          # Variation selectors
    "\u200b-\u200f"          # Zero-width spaces / joiners
    "\u2028-\u202f"
    "\u2060-\u206f"
    "\u20e3"                 # Combining enclosing keycap
    "]+",
    flags=re.UNICODE,
)


def clean_display_text(text: str) -> str:
    """Limpia emojis, caracteres decorativos y enlaces markdown en crudo del texto para mostrar."""
    if not text:
        return ""
    norm = unicodedata.normalize("NFKC", text)
    # Convertir enlaces markdown [etiqueta](url) -> etiqueta
    norm = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", r"\1", norm)
    # Quitar emojis y símbolos decorativos
    norm = _EMOJI_DECORATIVE_RE.sub("", norm)
    # Limpiar espacios repetidos por línea preservando saltos de párrafo
    lines = [re.sub(r"[ \t]{2,}", " ", ln).strip() for ln in norm.splitlines()]
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def analyze_post_sentiment(post: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calcula sentimiento en español con pysentimiento (modelo cargado una sola vez).
    Si pysentimiento no está instalado o falla, usa analizador léxico + reacciones;
    cuando no hay señal clara, devuelve 'sin_clasificar' (nunca 'Neutro' por defecto ante fallo).
    """
    text = (post.get("text") or "").strip()
    analyzer = get_pysentimiento_analyzer()
    if analyzer is not None and text:
        try:
            pred = analyzer.predict(text[:512])
            output = str(getattr(pred, "output", "")).upper()
            probas = getattr(pred, "probas", {}) or {}
            label_map = {"POS": "pos", "NEG": "neg", "NEU": "neu"}
            if output in label_map:
                return {
                    "label": label_map[output],
                    "probas": {
                        "pos": round(float(probas.get("POS", 0.33)), 3),
                        "neu": round(float(probas.get("NEU", 0.34)), 3),
                        "neg": round(float(probas.get("NEG", 0.33)), 3),
                    },
                    "engine": "pysentimiento",
                }
        except Exception as exc:
            print(f"[pipeline] Error en predict de pysentimiento: {exc}")

    # Respaldo léxico español + reacciones de Facebook
    tl = text.lower()
    pos_words = (
        "reducción", "redujo", "baja en percepción", "mayor caída en percepción",
        "tranquilidad", "paz", "avanza", "fortaleciendo", "compromiso", "vocación",
        "resultados", "beneficio", "éxito", "logra la mayor reducción",
    )
    neg_words = (
        "linchamiento", "arrollar", "retuvieron", "denuncia", "asalto", "robo",
        "inseguridad", "delitos", "violencia", "bloquea", "queja", "peligro",
        "miedo", "balacera", "extorsión", "emergencia",
    )
    pos_hits = sum(1 for w in pos_words if w in tl)
    neg_hits = sum(1 for w in neg_words if w in tl)

    # Si habla de "reducción de percepción de inseguridad", es positivo/informativo
    if "reducción" in tl and "inseguridad" in tl:
        pos_hits += 2
        neg_hits = max(0, neg_hits - 1)
    if "caída en percepción de inseguridad" in tl or "redujo la percepción de inseguridad" in tl:
        pos_hits += 2
        neg_hits = max(0, neg_hits - 1)

    love_care = int(post.get("reactionLoveCount") or 0) + int(post.get("reactionCareCount") or 0)
    angry_sad = int(post.get("reactionAngryCount") or 0) + int(post.get("reactionSadCount") or 0)
    if love_care > angry_sad * 2 and love_care > 3:
        pos_hits += 1
    if angry_sad > love_care and angry_sad > 1:
        neg_hits += 2

    if pos_hits > neg_hits:
        return {"label": "pos", "probas": {"pos": 0.72, "neu": 0.20, "neg": 0.08}, "engine": "lexico-es"}
    if neg_hits > pos_hits:
        return {"label": "neg", "probas": {"pos": 0.10, "neu": 0.22, "neg": 0.68}, "engine": "lexico-es"}
    return {"label": "sin_clasificar", "probas": None, "engine": "sin_clasificar"}


def normalize_for_dedup(text: str) -> str:
    """Limpia emojis, URLs, hashtags y signos para comparar textos casi idénticos."""
    t = text.lower()
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"#\w+", " ", t)
    t = re.sub(r"[^a-záéíóúñü0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def are_texts_near_identical(a: str, b: str) -> bool:
    """Determina si dos publicaciones representan la misma narrativa o texto casi idéntico."""
    na = normalize_for_dedup(a)
    nb = normalize_for_dedup(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    ratio = SequenceMatcher(None, na[:450], nb[:450]).ratio()
    if ratio >= 0.68:
        return True

    # Comparación por conjunto de tokens significativos
    tokens_a = {w for w in na.split() if len(w) > 3}
    tokens_b = {w for w in nb.split() if len(w) > 3}
    if tokens_a and tokens_b:
        inter = len(tokens_a & tokens_b)
        union = len(tokens_a | tokens_b)
        if union > 0 and (inter / union) >= 0.52:
            return True

    # Caso común en Tlalpan: notas que citan la misma cifra ENSU INEGI (13.7% reducción percepción inseguridad)
    ensu_markers = ("percepcion", "inseguridad", "reduccion", "mayor")
    if all(m in na.translate(str.maketrans("áéíóú", "aeiou")) for m in ("percepcion", "inseguridad")) and \
       all(m in nb.translate(str.maketrans("áéíóú", "aeiou")) for m in ("percepcion", "inseguridad")):
        if ("mayor" in na and "mayor" in nb) or ("13 7" in na and "13 7" in nb):
            return True

    return False


REACCIONES = ('Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry', 'Care')


def deduplicate_narratives(posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Agrupa textos casi idénticos en una sola narrativa con su conteo y métricas agregadas."""
    clusters: List[Dict[str, Any]] = []
    for p in posts:
        txt = clean_display_text(p.get("text") or "")
        matched_cluster = None
        for cluster in clusters:
            if are_texts_near_identical(txt, cluster["texto"]):
                matched_cluster = cluster
                break

        raw_user = p.get("sharedFromUser") if (not p.get("hasOwnText", True) and isinstance(p.get("sharedFromUser"), dict)) else (p.get("user") or {})
        user_name = raw_user.get("name") or "Usuario"
        if matched_cluster is not None:
            matched_cluster["count"] += 1
            matched_cluster["likesCount"] += int(p.get("likesCount") or 0)
            matched_cluster["commentsCount"] += int(p.get("commentsCount") or 0)
            matched_cluster["sharesCount"] += int(p.get("sharesCount") or 0)
            for k in REACCIONES:
                matched_cluster["reacciones"][k] += int(p.get(f"reaction{k}Count") or 0)
            if p.get("time") and (not matched_cluster["desde"] or p["time"] < matched_cluster["desde"]):
                matched_cluster["desde"] = p["time"]
            if user_name not in matched_cluster["fuentes"]:
                matched_cluster["fuentes"].append(user_name)
            if p.get("plataforma", "facebook") not in matched_cluster["plataformas"]:
                matched_cluster["plataformas"].append(p.get("plataforma", "facebook"))
        else:
            first_line = next((ln.strip() for ln in txt.splitlines() if ln.strip()), txt[:90])
            clusters.append({
                "titulo": first_line[:110],
                "texto": txt,
                "fuente": user_name,
                "fuentes": [user_name],
                "plataformas": [p.get("plataforma", "facebook")],
                "tipo_fuente": p.get("tipo_fuente", "ciudadano"),
                "categoria": p.get("categoria", "seguridad"),
                "sentimiento": p.get("sentimiento", "sin_clasificar"),
                "count": 1,
                "likesCount": int(p.get("likesCount") or 0),
                "commentsCount": int(p.get("commentsCount") or 0),
                "sharesCount": int(p.get("sharesCount") or 0),
                "reacciones": {k: int(p.get(f"reaction{k}Count") or 0) for k in REACCIONES},   # desglose de reacciones (solo Facebook las trae)
                "desde": p.get("time") or "",
                "time": p.get("time") or "",
                "url": p.get("url") or "",
            })

    clusters.sort(key=lambda c: (c["count"], c["likesCount"] + c["sharesCount"]), reverse=True)
    return clusters


def build_daily_series(
    relevantes: List[Dict[str, Any]],
    ref_time: datetime,
    max_days: int = 14,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Construye la serie de 'Volumen por día' sobre la ventana configurada (14 días),
    contando posts por fecha (YYYY-MM-DD) y devolviendo (serie_diaria, pico_posts_dia).
    Si no hay posts relevantes, devuelve lista vacía y pico 0 para mostrar estado vacío.
    """
    if not relevantes:
        return [], 0

    meses_es = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    counts_by_day: Dict[str, int] = {}
    ref_date = ref_time.date()
    days_list = [ref_date - timedelta(days=i) for i in range(max_days - 1, -1, -1)]
    for d in days_list:
        counts_by_day[d.isoformat()] = 0

    for p in relevantes:
        dt = parse_iso_datetime(p.get("time", ""))
        d_key = (dt.date() if dt is not None else ref_date).isoformat()
        if d_key in counts_by_day:
            counts_by_day[d_key] += 1
        else:
            counts_by_day[d_key] = counts_by_day.get(d_key, 0) + 1

    serie_diaria: List[Dict[str, Any]] = []
    for d in days_list:
        iso_d = d.isoformat()
        cnt = counts_by_day.get(iso_d, 0)
        etiqueta = f"{d.day:02d} {meses_es[d.month - 1]}"
        serie_diaria.append({
            "fecha": iso_d,
            "etiqueta": etiqueta,
            "posts": cnt,
        })

    pico = max((b["posts"] for b in serie_diaria), default=0)
    return serie_diaria, pico


def historial_anterior(anteriores: List[Dict[str, Any]], ref: datetime, maximo: int = 10) -> List[Dict[str, Any]]:
    """Los posts anteriores al periodo con más interacción (máx. 10). No entran en ninguna cifra."""
    inter = lambda p: int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)
    return [{"autor": (p.get("user") or {}).get("name") or "Desconocido", "plataforma": p.get("plataforma", "facebook"), "fecha": p.get("time") or "",
             "fragmento": re.sub(r"\s+", " ", p.get("text") or "").strip()[:220], "url": p.get("url") or "", "interacciones": inter(p),
             "dias_antiguedad": max(0, (ref - p["_dt"]).days), "usuario": (p.get("user") or {}).get("usuario", ""), "texto": (p.get("text") or "")[:600]}
            for p in sorted(anteriores, key=inter, reverse=True)[:maximo]]


def contenido_antiguo_repetido(anteriores: List[Dict[str, Any]], ref: datetime, min_dias: int = 90) -> List[Dict[str, Any]]:
    """Textos de más de 90 días que aparecen casi idénticos en 2 o más cuentas distintas (insumo de la alerta «Contenido antiguo que reaparece»)."""
    viejos = [p for p in anteriores if (ref - p["_dt"]).days > min_dias and (p.get("text") or "").strip()]
    out = []
    for c in deduplicate_narratives(viejos):
        if c["count"] >= 2 and len(set(c["fuentes"])) >= 2:
            out.append({"titulo": c["titulo"], "fragmento": c["texto"][:220], "cuentas": len(set(c["fuentes"])), "plataformas": c.get("plataformas", []),
                        "ultima_fecha": c.get("time") or "", "url": c.get("url") or ""})
    return out[:5]


def descarte_registro(post: Dict[str, Any], motivo: str, nota: str = "") -> Dict[str, Any]:
    """Registro legible de un post descartado: motivo, autor, fecha, fragmento y enlace."""
    return {
        "motivo": motivo, "nota": nota,
        "autor": (post.get("user") or {}).get("name") or "Desconocido",
        "fecha": post.get("time") or "",
        "fragmento": re.sub(r"\s+", " ", (post.get("text") or "")).strip()[:180],
        "url": post.get("url") or "",
        "origen_post": post.get("origen_post"),
        "plataforma": post.get("plataforma", "facebook"),
        "coincidencia": (post.get("coincidencia") or {}).get("puntaje"),
    }


def process_facebook_posts(
    raw_mapped_posts: List[Dict[str, Any]],
    tema: str,
    modo: str,
    alcance: Optional[Dict[str, Any]],
    source_type: str = "fixture",
    sin_datos_demo: bool = False,
    mensaje: Optional[str] = None,
    posts_fuente: Optional[int] = None,
    ref_time_iso: Optional[str] = None,
    ficha: Optional[Dict[str, Any]] = None,
    periodo: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Ejecuta el pipeline completo sobre los posts mapeados y devuelve el resumen estructurado."""
    load_env_file()
    alias_cfg = load_alias_config()
    fuentes_cfg = load_fuentes_config()
    periodo = periodo or periodo_mod.resolver()

    now_utc = datetime.now(timezone.utc)
    # Si estamos corriendo con el fixture estático en otra fecha futura/pasada,
    # tomamos como referencia la fecha más reciente del lote para que la ventana de 14 días sea reproducible.
    ref_dt_override = parse_iso_datetime(ref_time_iso) if ref_time_iso else None
    parsed_times = [parse_iso_datetime(p.get("time", "")) for p in raw_mapped_posts]
    valid_times = [t for t in parsed_times if t is not None]
    if ref_dt_override is not None:
        ref_time = ref_dt_override
    elif source_type in ("fixture", "fixture-local") and valid_times:
        ref_time = max(valid_times)
    else:
        ref_time = now_utc
    desde_dt, hasta_dt = periodo_mod.ventana(periodo, ref_time)
    if periodo["tipo"] == "rango" and hasta_dt:
        ref_time = hasta_dt   # la gráfica termina en la fecha final elegida
        desde_dt, hasta_dt = periodo_mod.ventana(periodo, ref_time)
    max_days = periodo_mod.dias_serie(periodo, ref_time)
    anteriores: List[Dict[str, Any]] = []   # descartados por ser anteriores al periodo: contexto histórico aparte

    effective_posts_fuente = int(posts_fuente) if posts_fuente is not None else len(raw_mapped_posts)
    descartados_filtro_tema = 0
    descartados_fecha = 0
    descartados_homonimo = 0
    descartados_idioma = 0
    descartados_no_relevantes = 0
    used_gemini = False
    detalle: List[Dict[str, Any]] = []      # un registro por post descartado, con su motivo
    sin_texto_posts: List[Dict[str, Any]] = []
    por_confirmar_match: List[Dict[str, Any]] = []   # coincidencia débil: no se tiran, tampoco entran a las cifras
    pasaron_match = 0

    def _descartar(post: Dict[str, Any], motivo: str, nota: str = "") -> None:
        detalle.append(descarte_registro(post, motivo, nota))
        print(f"[pipeline]   -> Descartado [{(post.get('user') or {}).get('name') or '?'}] {post.get('url') or post.get('postId') or ''}: {motivo}{' (' + nota + ')' if nota else ''}")

    relevantes: List[Dict[str, Any]] = []
    candidatos: List[Dict[str, Any]] = []
    propios_pipeline: List[Dict[str, Any]] = []
    for post in raw_mapped_posts:
        raw_text = (post.get("text") or "").strip()
        # Sin texto: no entra al filtro; se cuenta y se lista aparte (con enlace)
        if not raw_text:
            sin_texto_posts.append(post)
            continue

        # Descarte propio de la plataforma (p. ej. retweets en X)
        if post.get("descarte_nota"):
            _descartar(post, "otro", post["descarte_nota"])
            continue

        # 1. Coincidencia con el tema/persona (puntaje, no todo o nada)
        c = coincidencia.puntuar(post, tema, modo, ficha)
        post = {**post, "coincidencia": {**c, "umbral": coincidencia.umbral()}}
        if c["puntaje"] <= 0:
            descartados_filtro_tema += 1
            _descartar(post, "no contiene el tema")
            continue
        if not coincidencia.pasa(c):
            por_confirmar_match.append(post)
            print(f"[pipeline]   -> Por confirmar [{(post.get('user') or {}).get('name') or '?'}]: coincidencia débil {c['puntaje']} ({', '.join(c['coincidencias'])})")
            continue
        pasaron_match += 1

        # 2. Filtro de fecha en código: solo cuenta lo que cae dentro del periodo elegido
        dt = parse_iso_datetime(post.get("time", ""))
        if dt is not None and ((desde_dt and dt < desde_dt) or (hasta_dt and dt > hasta_dt)):
            descartados_fecha += 1
            antes = bool(desde_dt and dt < desde_dt)
            _descartar(post, "fuera del periodo", ("anterior" if antes else "posterior") + f" al periodo ({periodo['etiqueta']})")
            if antes:
                anteriores.append({**post, "_dt": dt})
            continue

        # 3. Filtro de homónimos ("Calzada de Tlalpan" sin contexto de alcaldía) y alias ambiguos
        is_hom, _reason = is_homonym_or_out_of_scope(raw_text, alias_cfg)
        if is_hom:
            descartados_homonimo += 1
            _descartar(post, "homónimo", _reason)
            continue

        # 4. Idioma (solo con ficha en español)
        if ficha and (ficha.get("idioma") or "es") == "es" and not idioma_es(raw_text):
            descartados_idioma += 1
            _descartar(post, "otro idioma")
            continue
        candidatos.append(post)

    posts_filtro_tema = pasaron_match
    descartados_vacios = len(sin_texto_posts)

    # 3. Clasificación en lotes con Gemini (respaldo de modelos) + config/fuentes.json; reglas si no hay IA
    clasifs, cuota_agotada = classify_posts_batch(candidatos, fuentes_cfg, tema, ficha)
    for post, cls in zip(candidatos, clasifs):
        raw_text = (post.get("text") or "").strip()
        if cls.get("clasificador") == "gemini":
            used_gemini = True
        if not cls.get("relevante") or cls.get("categoria") == "empleo":
            descartados_no_relevantes += 1
            _descartar(post, "otro", "clasificada como no relevante (empleo, spam o ajena al tema)")
            continue

        if cls["tipo_fuente"] == "persona":   # publicado por la persona: no entra a ninguna cifra de opinión
            propios_pipeline.append(post)
            continue

        enriched = dict(post)
        enriched["text"] = clean_display_text(raw_text)
        enriched["categoria"] = cls["categoria"]
        enriched["tipo_fuente"] = cls["tipo_fuente"]
        enriched["clasificador"] = cls.get("clasificador", "reglas")
        enriched["relevante"] = True

        # 5. Sentimiento con pysentimiento SOLO sobre medio | ciudadano
        if enriched["tipo_fuente"] in ("medio", "ciudadano"):
            sent = analyze_post_sentiment(enriched)
            enriched["sentimiento"] = sent["label"]
            enriched["sentimiento_probas"] = sent["probas"]
            enriched["sentimiento_motor"] = sent["engine"]
        elif enriched["tipo_fuente"] in ("oficial", "afin", "politico"):
            # Oficial y afín no sesgan el sentimiento de terceros: se mide aparte, en el bloque «Afines y entorno»
            enriched["sentimiento"] = "oficial"
            enriched["sentimiento_probas"] = None
            enriched["sentimiento_motor"] = "excluido_oficial"
            enriched["sentimiento_entorno"] = analyze_post_sentiment(enriched)["label"]
        else:   # sin_clasificar: no se cuenta como opinión
            enriched["sentimiento"] = "sin_clasificar"
            enriched["sentimiento_probas"] = None
            enriched["sentimiento_motor"] = "sin_clasificar"

        relevantes.append(enriched)

    clasificador_usado = "gemini" if used_gemini else "reglas"
    relevantes_count = len(relevantes)
    print(
        f"[pipeline] Fuente={source_type} tema='{tema}' modo='{modo}': crudos={len(raw_mapped_posts)}, "
        f"sin_texto={len(sin_texto_posts)}, con_texto={len(raw_mapped_posts) - len(sin_texto_posts)}, "
        f"pasaron_coincidencia={posts_filtro_tema} (umbral {coincidencia.umbral()}), por_confirmar={len(por_confirmar_match)}, "
        f"relevantes={relevantes_count}, descartados={len(detalle)} "
        f"(no_contiene_tema={descartados_filtro_tema}, fecha={descartados_fecha}, homonimo={descartados_homonimo}, "
        f"idioma={descartados_idioma}, otro={descartados_no_relevantes})"
    )

    oficiales_posts = [p for p in relevantes if p.get("tipo_fuente") in ("oficial", "afin", "politico")]
    sin_clasificar_tipo = sum(1 for p in relevantes if p.get("tipo_fuente") == "sin_clasificar")
    ciudadanos_medios_posts = [p for p in relevantes if p.get("tipo_fuente") in ("medio", "ciudadano")]

    pct_oficial = round((len(oficiales_posts) / relevantes_count) * 100, 1) if relevantes_count > 0 else 0.0

    # Sentimiento agregado SOLO sobre medio | ciudadano clasificados (excluyendo 'sin_clasificar')
    cm_total = len(ciudadanos_medios_posts)
    cm_clasificados = [p for p in ciudadanos_medios_posts if p.get("sentimiento") in ("pos", "neu", "neg")]
    # «Afines y entorno»: oficial + afín, en un bloque aparte con su propia base
    ent = [p for p in oficiales_posts if p.get("sentimiento_entorno") in ("pos", "neu", "neg")]
    ent_pct = lambda k: round(100 * sum(1 for p in ent if p["sentimiento_entorno"] == k) / len(ent)) if ent else 0
    sentimiento_afines = {"positive": ent_pct("pos"), "neutral": ent_pct("neu"), "negative": ent_pct("neg"), "base": len(ent), "universo": "afin|oficial"}
    sin_clasificar_c = sum(1 for p in ciudadanos_medios_posts if p.get("sentimiento") == "sin_clasificar")
    if len(cm_clasificados) > 0:
        denom = len(cm_clasificados)
        pos_c = sum(1 for p in cm_clasificados if p.get("sentimiento") == "pos")
        neg_c = sum(1 for p in cm_clasificados if p.get("sentimiento") == "neg")
        pos_pct = round((pos_c / denom) * 100)
        neg_pct = round((neg_c / denom) * 100)
        neu_pct = max(0, 100 - pos_pct - neg_pct)
    else:
        pos_pct, neu_pct, neg_pct = 0, 0, 0

    # Categorías agregadas
    cat_counts: Dict[str, int] = {}
    for p in relevantes:
        c = str(p.get("categoria") or "otro")
        cat_counts[c] = cat_counts.get(c, 0) + 1

    categorias_list = [
        {
            "categoria": cat,
            "count": cnt,
            "porcentaje": round((cnt / relevantes_count) * 100, 1) if relevantes_count > 0 else 0.0,
        }
        for cat, cnt in sorted(cat_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # 4. Deduplicar textos casi idénticos como una sola narrativa con su conteo
    narrativa_oficial = deduplicate_narratives(oficiales_posts)
    narrativa_ciudadana = deduplicate_narratives(ciudadanos_medios_posts)

    # Anotar en cada post relevante cuántas veces se repitió su narrativa
    all_clusters = narrativa_oficial + narrativa_ciudadana
    for p in relevantes:
        rep = 1
        for cl in all_clusters:
            if are_texts_near_identical(p.get("text", ""), cl["texto"]):
                rep = cl["count"]
                break
        p["repeticiones"] = rep

    # Ordenar posts recientes por fecha descendente
    relevantes_sorted = sorted(
        relevantes,
        key=lambda x: x.get("time") or "",
        reverse=True,
    )

    # Volumen por día (ventana configurada de 14 días, contando posts por fecha y pico en posts/día)
    volumen_por_dia, pico_posts_dia = build_daily_series(relevantes, ref_time=ref_time, max_days=max_days)
    volumen_por_plataforma = {
        pl: build_daily_series([p for p in relevantes if p.get("plataforma", "facebook") == pl], ref_time=ref_time, max_days=max_days)[0]
        for pl in sorted({p.get("plataforma", "facebook") for p in relevantes})
    }

    total_interacciones = sum(
        int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)
        for p in relevantes
    )

    es_fixture = source_type in ("fixture", "fixture-local")
    effective_mensaje = mensaje
    if not effective_mensaje and not sin_datos_demo and relevantes_count == 0:
        effective_mensaje = "Sin publicaciones que mencionen este tema en los datos disponibles"

    return {
        "query": {
            "tema": tema,
            "modo": modo,
            "alcance": alcance or {"nivel": "municipio", "estado_id": "09", "municipio_id": "09012"},
        },
        "fuente_datos": source_type,
        "es_fixture": es_fixture,
        "etiqueta_fuente": "DATOS DE EJEMPLO (fixture)" if es_fixture else "DATOS EN VIVO (Apify)",
        "sin_datos_demo": bool(sin_datos_demo),
        "mensaje": effective_mensaje,
        "clasificador": clasificador_usado,
        "aviso_ia": ("Clasificación básica (sin IA)" if clasificador_usado == "reglas" and (cuota_agotada or not llm.hay_clave())
                     else "Clasificación parcial con IA: cuota agotada" if cuota_agotada else None),
        "ia": llm.info_sesion(),
        "modelos_usados": llm.info_sesion()["modelos_usados"],
        "fecha_corrida": now_utc.isoformat(),
        "ventana_dias": max_days,
        "fecha_referencia": ref_time.isoformat(),
        "posts_fuente": effective_posts_fuente,
        "posts_filtro_tema": posts_filtro_tema,
        "total_posts": effective_posts_fuente,
        "relevantes_posts": relevantes_count,
        "ciudadanos_medios_posts": cm_total,
        "oficiales_posts": len(oficiales_posts),
        "porcentaje_oficial": pct_oficial,
        "descartados": {
            "por_filtro_tema": descartados_filtro_tema,
            "por_fecha": descartados_fecha,
            "por_homonimo": descartados_homonimo,
            "por_idioma": descartados_idioma,
            "no_relevantes_o_empleo": descartados_no_relevantes,
            "vacios": descartados_vacios,
        },
        "descartados_detalle": detalle,
        "periodo": periodo,
        "historial_anterior": historial_anterior(anteriores, ref_time),
        "historial_anterior_total": len(anteriores),
        "antiguo_repetido": contenido_antiguo_repetido(anteriores, ref_time),
        "por_confirmar": por_confirmar_match,
        "sin_texto": {
            "total": len(sin_texto_posts),
            "publicados": sum(1 for p in sin_texto_posts if p.get("origen_post") == "publicado_por_persona"),
            "menciones": sum(1 for p in sin_texto_posts if p.get("origen_post") == "mencion"),
            "posts": [{"url": p.get("url"), "user": (p.get("user") or {}).get("name"), "time": p.get("time"), "origen_post": p.get("origen_post"), "plataforma": p.get("plataforma", "facebook")} for p in sin_texto_posts],
        },
        "umbral_coincidencia": coincidencia.umbral(),
        "volumen": relevantes_count,
        "interacciones_totales": total_interacciones,
        "sentimiento": {
            "positive": pos_pct,
            "neutral": neu_pct,
            "negative": neg_pct,
            "sin_clasificar": sin_clasificar_c,
            "universo": "medio|ciudadano",
            "base": len(cm_clasificados),
            "excluye_oficial": True,
        },
        "sentimiento_afines": sentimiento_afines,
        "sin_clasificar_tipo": sin_clasificar_tipo,
        "publicado_por_persona_pipeline": [descarte_registro(p, "persona") | {"interacciones": int(p.get("likesCount") or 0) + int(p.get("commentsCount") or 0) + int(p.get("sharesCount") or 0)} for p in propios_pipeline],
        "categorias": categorias_list,
        "narrativa_oficial": narrativa_oficial,
        "narrativa_ciudadana": narrativa_ciudadana,
        "posts_recientes": relevantes_sorted,
        "volumen_por_dia": volumen_por_dia,
        "volumen_por_dia_plataforma": volumen_por_plataforma,
        "pico_posts_dia": pico_posts_dia,
    }
