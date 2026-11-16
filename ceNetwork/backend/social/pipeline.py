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
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import unicodedata
import requests

from social.facebook import load_env_file, load_alias_config, matches_query_filter

BASE_DIR = Path(__file__).resolve().parents[1]
FUENTES_PATH = BASE_DIR / "config" / "fuentes.json"

CATEGORIAS_VALIDAS = {"seguridad", "empleo", "queja", "obras", "politica", "noticia", "otro"}
FUENTES_VALIDAS = {"oficial", "politico", "medio", "ciudadano"}

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
            "tipo_fuente": known_source or "ciudadano",
            "clasificador": "reglas",
        }

    tipo_fuente = known_source
    if not tipo_fuente:
        if any(w in uname for w in ("alcaldía", "alcaldia", "gobierno", "secretaría", "policial")):
            tipo_fuente = "oficial"
        elif any(w in uname for w in ("noticias", "denuncias", "diario", "red ", "hilo", "pueblo manda", "embargo")):
            tipo_fuente = "medio"
        else:
            tipo_fuente = "ciudadano"

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


def classify_post_with_gemini(
    post: Dict[str, Any],
    fuentes_cfg: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """
    Clasifica un post con Gemini devolviendo JSON:
    {relevante: bool, categoria: seguridad|empleo|queja|obras|politica|noticia|otro, tipo_fuente: oficial|politico|medio|ciudadano, clasificador: gemini|reglas}
    Respeta cuentas registradas en config/fuentes.json y nunca rompe si la API falla.
    """
    known_source = detect_known_source_type(post, fuentes_cfg)
    fallback = _heuristic_classify_post(post, known_source)

    # Si claramente es una oferta de empleo / guardia privado, ahorrar llamada o forzar descarte
    if fallback["categoria"] == "empleo" and not fallback["relevante"]:
        return fallback

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return fallback

    user_name = (post.get("user") or {}).get("name") or "Desconocido"
    text = (post.get("text") or "")[:1200]
    prompt = (
        "Clasifica esta publicación de Facebook sobre Tlalpan (CDMX) y responde SOLO un objeto JSON con las claves exactas:\n"
        '{"relevante": bool, "categoria": "seguridad"|"empleo"|"queja"|"obras"|"politica"|"noticia"|"otro", '
        '"tipo_fuente": "oficial"|"politico"|"medio"|"ciudadano"}\n'
        "Reglas:\n"
        "- relevante=false si es oferta de empleo/vacante laboral (ej. contratación de guardias), spam comercial o no trata sobre la alcaldía Tlalpan.\n"
        f"- Autor: {user_name}\n"
        f"- Fuente preidentificada en catálogo: {known_source or 'ninguna'}\n"
        f"- Texto: {text}"
    )

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"

    # Intento 1: SDK google.genai (convención de backend/datalab/pipeline/gemini_util.py)
    try:
        from google import genai  # type: ignore
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={"response_mime_type": "application/json", "temperature": 0},
        )
        parsed = json.loads(resp.text or "{}")
        if isinstance(parsed, dict) and "relevante" in parsed:
            cat = str(parsed.get("categoria") or fallback["categoria"]).lower()
            tf = known_source or str(parsed.get("tipo_fuente") or fallback["tipo_fuente"]).lower()
            rel = bool(parsed.get("relevante")) and cat != "empleo"
            return {
                "relevante": rel,
                "categoria": cat if cat in CATEGORIAS_VALIDAS else fallback["categoria"],
                "tipo_fuente": tf if tf in FUENTES_VALIDAS else fallback["tipo_fuente"],
                "clasificador": "gemini",
            }
    except Exception:
        pass

    # Intento 2: REST directo a generativelanguage.googleapis.com
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        resp = requests.post(
            url,
            params={"key": api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
            },
            timeout=8,
        )
        if resp.ok:
            data = resp.json()
            raw_txt = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "{}")
            )
            parsed = json.loads(raw_txt)
            if isinstance(parsed, dict) and "relevante" in parsed:
                cat = str(parsed.get("categoria") or fallback["categoria"]).lower()
                tf = known_source or str(parsed.get("tipo_fuente") or fallback["tipo_fuente"]).lower()
                rel = bool(parsed.get("relevante")) and cat != "empleo"
                return {
                    "relevante": rel,
                    "categoria": cat if cat in CATEGORIAS_VALIDAS else fallback["categoria"],
                    "tipo_fuente": tf if tf in FUENTES_VALIDAS else fallback["tipo_fuente"],
                    "clasificador": "gemini",
                }
    except Exception:
        pass

    return fallback


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
            if user_name not in matched_cluster["fuentes"]:
                matched_cluster["fuentes"].append(user_name)
        else:
            first_line = next((ln.strip() for ln in txt.splitlines() if ln.strip()), txt[:90])
            clusters.append({
                "titulo": first_line[:110],
                "texto": txt,
                "fuente": user_name,
                "fuentes": [user_name],
                "tipo_fuente": p.get("tipo_fuente", "ciudadano"),
                "categoria": p.get("categoria", "seguridad"),
                "sentimiento": p.get("sentimiento", "sin_clasificar"),
                "count": 1,
                "likesCount": int(p.get("likesCount") or 0),
                "commentsCount": int(p.get("commentsCount") or 0),
                "sharesCount": int(p.get("sharesCount") or 0),
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
) -> Dict[str, Any]:
    """Ejecuta el pipeline completo sobre los posts mapeados y devuelve el resumen estructurado."""
    load_env_file()
    alias_cfg = load_alias_config()
    fuentes_cfg = load_fuentes_config()
    max_days = int(os.getenv("MAX_POST_DAYS", "14") or 14)

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
    cutoff_dt = ref_time - timedelta(days=max_days)

    # Verificar el filtro por tema/persona también en pipeline (por si se invoca directamente)
    filtered_by_query = [
        p for p in raw_mapped_posts
        if matches_query_filter(p, tema=tema, modo=modo)
    ]
    effective_posts_fuente = int(posts_fuente) if posts_fuente is not None else len(raw_mapped_posts)
    posts_filtro_tema = len(filtered_by_query)
    descartados_filtro_tema = max(0, effective_posts_fuente - posts_filtro_tema)

    descartados_fecha = 0
    descartados_homonimo = 0
    descartados_no_relevantes = 0
    descartados_vacios = 0
    used_gemini = False

    relevantes: List[Dict[str, Any]] = []

    for post in filtered_by_query:
        raw_text = (post.get("text") or "").strip()
        if not raw_text:
            descartados_vacios += 1
            continue

        # 1. Filtro de fecha en código (> 14 días descartado)
        dt = parse_iso_datetime(post.get("time", ""))
        if dt is not None and dt < cutoff_dt:
            descartados_fecha += 1
            continue

        # 2. Filtro de homónimos ("Calzada de Tlalpan" sin contexto de alcaldía) y alias ambiguos
        is_hom, _reason = is_homonym_or_out_of_scope(raw_text, alias_cfg)
        if is_hom:
            descartados_homonimo += 1
            continue

        # 3. Clasificación con Gemini + config/fuentes.json
        cls = classify_post_with_gemini(post, fuentes_cfg)
        if cls.get("clasificador") == "gemini":
            used_gemini = True
        if not cls.get("relevante") or cls.get("categoria") == "empleo":
            descartados_no_relevantes += 1
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
        else:
            # Oficial / político se muestra aparte como narrativa oficial sin sesgar sentimiento ciudadano
            enriched["sentimiento"] = "oficial"
            enriched["sentimiento_probas"] = None
            enriched["sentimiento_motor"] = "excluido_oficial"

        relevantes.append(enriched)

    clasificador_usado = "gemini" if used_gemini else "reglas"
    relevantes_count = len(relevantes)
    print(
        f"[pipeline] Fuente={source_type} (origen={source_type}) tema='{tema}' modo='{modo}': "
        f"posts_fuente={effective_posts_fuente}, posts_filtro_tema={posts_filtro_tema}, "
        f"relevantes={relevantes_count} (descartados_fecha={descartados_fecha}, "
        f"descartados_homonimo={descartados_homonimo}, no_relevantes={descartados_no_relevantes})"
    )

    oficiales_posts = [p for p in relevantes if p.get("tipo_fuente") in ("oficial", "politico")]
    ciudadanos_medios_posts = [p for p in relevantes if p.get("tipo_fuente") in ("medio", "ciudadano")]

    pct_oficial = round((len(oficiales_posts) / relevantes_count) * 100, 1) if relevantes_count > 0 else 0.0

    # Sentimiento agregado SOLO sobre medio | ciudadano clasificados (excluyendo 'sin_clasificar')
    cm_total = len(ciudadanos_medios_posts)
    cm_clasificados = [p for p in ciudadanos_medios_posts if p.get("sentimiento") in ("pos", "neu", "neg")]
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
        "fecha_corrida": now_utc.isoformat(),
        "ventana_dias": max_days,
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
            "no_relevantes_o_empleo": descartados_no_relevantes,
            "vacios": descartados_vacios,
        },
        "volumen": relevantes_count,
        "interacciones_totales": total_interacciones,
        "sentimiento": {
            "positive": pos_pct,
            "neutral": neu_pct,
            "negative": neg_pct,
            "sin_clasificar": sin_clasificar_c,
            "universo": "medio|ciudadano",
            "excluye_oficial": True,
        },
        "categorias": categorias_list,
        "narrativa_oficial": narrativa_oficial,
        "narrativa_ciudadana": narrativa_ciudadana,
        "posts_recientes": relevantes_sorted,
        "volumen_por_dia": volumen_por_dia,
        "pico_posts_dia": pico_posts_dia,
    }
