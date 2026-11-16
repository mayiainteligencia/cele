"""Conector con apify/facebook-search-scraper, caché en disco y fixture local de Tlalpan."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import unicodedata
import requests

BASE_DIR = Path(__file__).resolve().parents[1]
CENET_DIR = BASE_DIR.parent
ENV_PATH = BASE_DIR / ".env"
ALIAS_PATH = BASE_DIR / "config" / "alias.json"
FIXTURE_PATH = CENET_DIR / "public" / "data" / "tlalpan_facebook.json"
APIFY_CACHE_DIR = BASE_DIR / ".cache" / "apify"

# Variables definidas en el entorno del proceso antes de leer backend/.env
_INITIAL_ENV_KEYS = set(os.environ.keys())

STOPWORDS_ES = {
    "de", "la", "el", "en", "y", "a", "del", "los", "las",
    "un", "una", "unos", "unas", "por", "con", "para", "sin",
    "sobre", "entre", "hacia", "hasta", "desde", "como", "que",
    "al", "se", "su", "sus", "es", "son", "o", "u", "lo", "le",
    "les", "mi", "mis", "tu", "tus", "nos", "ante", "bajo", "contra",
    "durante", "mediante", "segun", "tras", "este", "esta", "estos", "estas",
    "ese", "esa", "esos", "esas", "aquel", "aquella", "mas", "pero", "si", "no",
}

NAME_CONNECTORS_ES = {"de", "del", "la", "las", "los", "el", "y"}


def load_env_file(env_path: Path = ENV_PATH) -> None:
    """Carga variables de backend/.env respetando overrides explícitos de la terminal."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip("\"'")
        if k and k not in _INITIAL_ENV_KEYS:
            os.environ[k] = v


load_env_file()


def load_alias_config() -> Dict[str, Any]:
    """Lee config/alias.json con los alias y homónimos de Tlalpan."""
    if ALIAS_PATH.exists():
        return json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    return {
        "alcaldia": "Tlalpan",
        "principales": [{"termino": "Tlalpan", "ambiguo": False}],
        "colonias_y_pueblos": [],
        "homonimos_descartar": [],
    }


def get_configured_fuente() -> str:
    """
    Determina la fuente configurada mediante FUENTE=fixture|apify (default: fixture).
    Mantiene compatibilidad con FACEBOOK_FIXTURE=false si FUENTE no está definida.
    """
    load_env_file()
    raw_fuente = os.getenv("FUENTE", "").strip().lower()
    if raw_fuente in ("apify", "fixture"):
        return raw_fuente
    fb_fix = os.getenv("FACEBOOK_FIXTURE", "true").strip().lower()
    if fb_fix in ("false", "0", "no"):
        return "apify"
    return "fixture"


def is_cache_only_enabled() -> bool:
    """Indica si FUENTE_CACHE_ONLY=1 está activo para usar solo caché en demos."""
    load_env_file()
    return os.getenv("FUENTE_CACHE_ONLY", "0").strip().lower() in ("1", "true", "yes", "si")


def normalize_text_no_accents(text: str) -> str:
    """Normaliza un texto a minúsculas y sin acentos/diacríticos (NFKD)."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(text))
    no_diacritics = "".join(ch for ch in nfkd if unicodedata.category(ch) != "Mn")
    return no_diacritics.lower()


def is_tlalpan_scope(alcance: Optional[Dict[str, Any]]) -> bool:
    """
    El fixture de demostración solo aplica cuando el alcance seleccionado es
    el municipio/alcaldía de Tlalpan (estado_id='09', municipio_id='09012').
    """
    if not alcance or not isinstance(alcance, dict):
        return False
    nivel = str(alcance.get("nivel") or "").strip().lower()
    mun_id = str(alcance.get("municipio_id") or "").strip()
    nombre = normalize_text_no_accents(str(alcance.get("nombre") or ""))
    if nivel == "municipio" and (mun_id == "09012" or "tlalpan" in nombre):
        return True
    return False


def resolve_scope_place_name(alcance: Optional[Dict[str, Any]]) -> str:
    """Extrae el nombre del territorio si el alcance es estado o municipio."""
    if not alcance or not isinstance(alcance, dict):
        return ""
    nivel = str(alcance.get("nivel") or "").strip().lower()
    if nivel not in ("estado", "municipio"):
        return ""
    if is_tlalpan_scope(alcance):
        return "Tlalpan"
    return str(alcance.get("nombre") or "").strip()


def get_person_name_variant(nombre: str) -> Optional[str]:
    """Obtiene variante de nombre sin el segundo apellido si tiene 3 o más palabras."""
    tokens = [t for t in (nombre or "").strip().split() if t]
    if len(tokens) >= 3:
        # e.g. "Francisco Ríos Zertuche" -> "Francisco Ríos"
        return " ".join(tokens[:-1])
    return None


def build_apify_cache_key(
    tema: str,
    modo: str,
    max_posts: int,
    alcance: Optional[Dict[str, Any]] = None,
) -> str:
    """Calcula la clave de caché en disco como hash SHA-256 de (tema + modo + lugar + maxPosts)."""
    norm_tema = normalize_text_no_accents((tema or "").strip())
    norm_modo = (modo or "tema").strip().lower()
    if norm_modo == "persona":
        # En modo persona la búsqueda es solo por el nombre (sin lugar)
        raw_key = f"{norm_tema}+{norm_modo}+{int(max_posts)}"
    else:
        # En modo tema se incluye el lugar si el alcance es Estado o Municipio
        place = resolve_scope_place_name(alcance)
        norm_place = normalize_text_no_accents(place)
        raw_key = f"{norm_tema}+{norm_modo}+{norm_place}+{int(max_posts)}"
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:16]


def _read_apify_disk_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    """Lee del disco el resultado cacheado de Apify si existe."""
    cache_file = APIFY_CACHE_DIR / f"{cache_key}.json"
    if not cache_file.exists():
        return None
    try:
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data
    except Exception as exc:
        print(f"[facebook] Error leyendo caché en disco ({cache_file.name}): {exc}")
    return None


def _write_apify_disk_cache(
    cache_key: str,
    tema: str,
    modo: str,
    max_posts: int,
    queries: List[str],
    mapped_items: List[Dict[str, Any]],
) -> None:
    """Guarda en disco (JSON) las queries exactas y los posts normalizados al esquema común."""
    try:
        APIFY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file = APIFY_CACHE_DIR / f"{cache_key}.json"
        query_exacta = queries[0] if len(queries) == 1 else queries
        payload = {
            "key": cache_key,
            "tema": (tema or "").strip(),
            "modo": (modo or "tema").strip().lower(),
            "maxPosts": int(max_posts),
            "query_exacta": query_exacta,
            "queries_enviadas": queries,
            "queries": queries,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "items": mapped_items,
        }
        cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        print(f"[facebook] No se pudo guardar caché de Apify en disco ({cache_key}): {exc}")


def extract_significant_topic_words(tema: str) -> List[str]:
    """Extrae las palabras significativas del tema (sin palabras vacías), normalizadas."""
    norm = normalize_text_no_accents(tema)
    tokens = [t for t in re.split(r"[^a-z0-9]+", norm) if t]
    return [t for t in tokens if t not in STOPWORDS_ES and len(t) >= 2]


def matches_query_filter(post: Dict[str, Any], tema: str, modo: str = "tema") -> bool:
    """
    Evalúa si un post coincide estrictamente con el tema/persona escrito por el usuario:
    - Solo compara contra el término escrito por el usuario (nunca contra alias del lugar ni alcance).
    - Normaliza a minúsculas y sin acentos.
    - Usa límites de palabra (\\b), nunca subcadenas.
    - Modo Persona: exige el nombre completo o, como mínimo, nombre y apellido juntos (>= 2 palabras contiguas).
      No basta una sola palabra.
    - Modo Tema (y Tendencias): ignora palabras vacías y exige que aparezcan TODAS las palabras significativas
      (o la frase exacta) con límites de palabra.
    """
    # Lo publicado por la página elegida es de la persona aunque no escriba su propio nombre.
    if post.get("origen_post") == "publicado_por_persona":
        return True

    clean_query = normalize_text_no_accents((tema or "").strip())
    query_tokens = [t for t in re.split(r"[^a-z0-9]+", clean_query) if t]
    if not query_tokens:
        return False

    post_text = str(post.get("text") or "")
    modo_norm = (modo or "tema").strip().lower()

    if modo_norm == "persona":
        user_name = str((post.get("user") or {}).get("name") or "")
        shared_user = post.get("sharedFromUser")
        shared_name = str(shared_user.get("name") or "") if isinstance(shared_user, dict) else ""
        haystack = normalize_text_no_accents(f"{post_text} {user_name} {shared_name}")

        # Palabras sustantivas del nombre (sin conectores como "de", "del", "la")
        name_words = [t for t in query_tokens if t not in NAME_CONNECTORS_ES]
        if len(name_words) < 2:
            # En modo persona no basta una sola palabra; requiere al menos nombre y apellido
            return False

        # 1) Nombre completo exacto con límites de palabra
        full_pattern = r"\b" + r"\s+".join(re.escape(t) for t in query_tokens) + r"\b"
        if re.search(full_pattern, haystack):
            return True

        # 2) Como mínimo, nombre y apellido juntos (dos palabras contiguas del nombre)
        for i in range(len(name_words) - 1):
            w1 = re.escape(name_words[i])
            w2 = re.escape(name_words[i + 1])
            pair_pattern = rf"\b{w1}\s+(?:(?:de|del|la|las|los|el)\s+)?{w2}\b"
            if re.search(pair_pattern, haystack):
                return True
        return False

    # Modo Tema / Tendencias: solo contra el texto del post (nunca contra el lugar/alcance)
    haystack = normalize_text_no_accents(post_text)
    if not haystack:
        return False

    phrase_pattern = r"\b" + r"\s+".join(re.escape(t) for t in query_tokens) + r"\b"
    if re.search(phrase_pattern, haystack):
        return True

    sig_words = extract_significant_topic_words(tema)
    if not sig_words:
        return False

    return all(bool(re.search(rf"\b{re.escape(w)}\b", haystack)) for w in sig_words)


def filter_posts_by_query(
    items: List[Dict[str, Any]],
    tema: str,
    modo: str = "tema",
) -> List[Dict[str, Any]]:
    """Filtra una lista de posts mapeados aplicando matches_query_filter."""
    return [item for item in items if matches_query_filter(item, tema=tema, modo=modo)]


def build_facebook_queries(
    tema: str,
    modo: str = "tema",
    alcance: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Construye las queries de búsqueda para Apify y fixture:
    1. Modo Persona: la query enviada a Apify es SOLO el nombre escrito por el usuario;
       no le agrega el lugar. Variante: nombre sin segundo apellido (si tiene >= 3 palabras).
    2. Modo Tema: query = tema, y agrega el nombre del lugar solo si el alcance es Estado
       o Municipio y el tema no lo contiene. Variante: el tema limpio.
    """
    clean_tema = re.sub(r"\s+", " ", (tema or "").strip())
    if not clean_tema:
        return []

    modo_norm = (modo or "tema").strip().lower()

    if modo_norm == "persona":
        queries = [clean_tema]
        variant = get_person_name_variant(clean_tema)
        if variant and variant.lower() != clean_tema.lower():
            queries.append(variant)
        return queries

    # Modo Tema / Tendencias
    place = resolve_scope_place_name(alcance)
    if place:
        norm_tema = normalize_text_no_accents(clean_tema)
        norm_place = normalize_text_no_accents(place)
        # Solo agrega el lugar si el tema no lo contiene
        if re.search(rf"\b{re.escape(norm_place)}\b", norm_tema):
            primary = clean_tema
            variant = None
        else:
            primary = f"{clean_tema} {place}".strip()
            variant = clean_tema
    else:
        primary = clean_tema
        variant = None

    queries = [primary]
    if variant and variant.lower() != primary.lower():
        queries.append(variant)
    return queries


def _evaluate_and_log_query_posts(
    query_num: int,
    query_text: str,
    raw_posts: List[Dict[str, Any]],
    tema: str,
    modo: str,
    seen_urls: set,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Evalúa los posts devueltos por una query de Apify:
    - Deduplica por URL.
    - Aplica filtro de tema/persona.
    - Loguea por query cuántos devolvió Apify, cuántos pasaron el filtro y el motivo corto de cada descarte.
    Devuelve (nuevos_mapeados_unicos, que_pasaron_filtro).
    """
    posts_devueltos = len(raw_posts)
    pasaron: List[Dict[str, Any]] = []
    nuevos_unicos: List[Dict[str, Any]] = []
    descartes: List[Tuple[str, str, str]] = []

    for idx, raw in enumerate(raw_posts, 1):
        mapped = map_to_common_schema(raw)
        raw_url = str(mapped.get("url") or mapped.get("postId") or "").strip()
        url_short = (raw_url[:65] + "...") if len(raw_url) > 65 else (raw_url or f"post_{idx}")
        author = mapped.get("user", {}).get("name") or "Desconocido"

        if raw_url and raw_url in seen_urls:
            descartes.append((author, url_short, "url duplicada"))
            continue
        if raw_url:
            seen_urls.add(raw_url)
        nuevos_unicos.append(mapped)

        text = (mapped.get("text") or "").strip()
        if not text:
            descartes.append((author, url_short, "sin texto"))
            continue

        if not matches_query_filter(mapped, tema=tema, modo=modo):
            if (modo or "").strip().lower() == "persona":
                motivo = f"no menciona persona '{tema}' (falta nombre y apellido juntos)"
            else:
                motivo = f"no menciona tema '{tema}'"
            descartes.append((author, url_short, motivo))
            continue

        pasaron.append(mapped)

    print(
        f"[facebook] Query {query_num} enviada a Apify: '{query_text}' | "
        f"Apify devolvió {posts_devueltos} posts | pasaron filtro: {len(pasaron)} | "
        f"descartados: {len(descartes)}"
    )
    for author, u_short, motivo in descartes:
        print(f"[facebook]   -> Descarte [{author}] ({u_short}): {motivo}")

    return nuevos_unicos, pasaron


def map_to_common_schema(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapea un ítem crudo de apify/facebook-search-scraper al esquema común:
    text, time, url, likesCount, commentsCount, sharesCount, reaction*Count, user, link, media.
    """
    primary_text = (raw.get("text") or "").strip()
    shared_post = raw.get("sharedPost") if isinstance(raw.get("sharedPost"), dict) else {}
    shared_text = (shared_post.get("text") or "").strip()
    if primary_text and shared_text and shared_text not in primary_text:
        full_text = f"{primary_text}\n\n[Publicación compartida]: {shared_text}"
    else:
        full_text = primary_text or shared_text

    user_obj = raw.get("user") or raw.get("pageName") or {}
    if not isinstance(user_obj, dict):
        user_obj = {"id": "", "name": str(user_obj)}

    likes_val = raw.get("likesCount") if raw.get("likesCount") is not None else raw.get("likes", 0)
    comments_val = raw.get("commentsCount") if raw.get("commentsCount") is not None else raw.get("comments", 0)
    shares_val = raw.get("sharesCount") if raw.get("sharesCount") is not None else raw.get("shares", 0)

    media_list = raw.get("media")
    if not isinstance(media_list, list):
        media_list = raw.get("attachments") if isinstance(raw.get("attachments"), list) else []

    mapped: Dict[str, Any] = {
        "postId": str(raw.get("postId") or raw.get("id") or ""),
        "text": full_text,
        "time": raw.get("time") or "",
        "url": raw.get("url") or raw.get("facebookUrl") or "",
        "likesCount": int(likes_val or 0),
        "commentsCount": int(comments_val or 0),
        "sharesCount": int(shares_val or 0),
        "reactionLikeCount": int(raw.get("reactionLikeCount") or 0),
        "reactionLoveCount": int(raw.get("reactionLoveCount") or 0),
        "reactionHahaCount": int(raw.get("reactionHahaCount") or 0),
        "reactionWowCount": int(raw.get("reactionWowCount") or 0),
        "reactionSadCount": int(raw.get("reactionSadCount") or 0),
        "reactionAngryCount": int(raw.get("reactionAngryCount") or 0),
        "reactionCareCount": int(raw.get("reactionCareCount") or 0),
        "user": {
            "id": str(user_obj.get("id") or ""),
            "name": str(user_obj.get("name") or "Usuario de Facebook"),
            "profilePic": user_obj.get("profilePic") or "",
        },
        "hasOwnText": bool(primary_text),
        "sharedFromUser": (shared_post.get("user") or shared_post.get("pageName")) if isinstance(shared_post, dict) else None,
        "link": raw.get("link") or shared_post.get("url") or None,
        "media": media_list,
    }

    for key, val in raw.items():
        if key.startswith("reaction") and key.endswith("Count") and key not in mapped:
            try:
                mapped[key] = int(val or 0)
            except (ValueError, TypeError):
                mapped[key] = 0

    return mapped


def _load_from_fixture(
    tema: str,
    modo: str,
    alcance: Optional[Dict[str, Any]],
    max_posts: int,
    queries: List[str],
    configured_fuente: str = "fixture",
    fallback_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Carga y filtra posts desde tlalpan_facebook.json con el mismo formato común."""
    origen = "fixture"
    if fallback_reason:
        print(
            f"[facebook] FALLBACK a fixture ({FIXTURE_PATH.name}): {fallback_reason}"
        )

    if configured_fuente == "fixture" and alcance is not None and not is_tlalpan_scope(alcance):
        print(
            f"[facebook] Fuente={configured_fuente} (origen={origen}): alcance fuera de Tlalpan en modo demo | "
            f"devolvió 0 posts | pasaron filtro ({modo}='{tema}'): 0 posts"
        )
        return {
            "source": "fixture",
            "origen": origen,
            "fuente_configurada": configured_fuente,
            "queries": queries,
            "items": [],
            "posts_fuente": 0,
            "posts_filtro_tema": 0,
            "ref_time_iso": None,
            "sin_datos_demo": True,
            "mensaje": "Sin datos en modo demo para este alcance",
            "error": fallback_reason,
        }

    try:
        if not FIXTURE_PATH.exists():
            msg = f"Fixture no encontrado en {FIXTURE_PATH}"
            print(f"[facebook] Fuente={configured_fuente} (origen={origen}): {msg}")
            return {
                "source": "fixture",
                "origen": origen,
                "fuente_configurada": configured_fuente,
                "queries": queries,
                "items": [],
                "posts_fuente": 0,
                "posts_filtro_tema": 0,
                "ref_time_iso": None,
                "sin_datos_demo": False,
                "mensaje": None,
                "error": fallback_reason or msg,
            }

        raw_items = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw_items, list):
            raw_items = []
        mapped_items = [map_to_common_schema(item) for item in raw_items[:max_posts]]
        posts_fuente = len(mapped_items)
        all_times = [str(m.get("time") or "") for m in mapped_items if m.get("time")]
        ref_time_iso = max(all_times) if all_times else None

        filtered_items = filter_posts_by_query(mapped_items, tema=tema, modo=modo)
        posts_filtro_tema = len(filtered_items)
        fb_note = f", fallback='{fallback_reason}'" if fallback_reason else ""
        print(
            f"[facebook] Fuente={configured_fuente} (origen={origen}{fb_note}): devolvió {posts_fuente} posts | "
            f"pasaron filtro ({modo}='{tema}'): {posts_filtro_tema} posts"
        )
        return {
            "source": "fixture",
            "origen": origen,
            "fuente_configurada": configured_fuente,
            "queries": queries,
            "items": filtered_items,
            "posts_fuente": posts_fuente,
            "posts_filtro_tema": posts_filtro_tema,
            "ref_time_iso": ref_time_iso,
            "sin_datos_demo": False,
            "mensaje": None,
            "error": fallback_reason,
        }
    except Exception as exc:
        print(f"[facebook] Error leyendo fixture: {exc}")
        return {
            "source": "fixture",
            "origen": origen,
            "fuente_configurada": configured_fuente,
            "queries": queries,
            "items": [],
            "posts_fuente": 0,
            "posts_filtro_tema": 0,
            "ref_time_iso": None,
            "sin_datos_demo": False,
            "mensaje": None,
            "error": str(exc),
        }


def fetch_facebook_posts(
    tema: str,
    modo: str = "tema",
    alcance: Optional[Dict[str, Any]] = None,
    limit: Optional[int] = None,
    refresh: bool = False,
) -> Dict[str, Any]:
    """
    Controla la fuente mediante FUENTE=fixture|apify (default: fixture):
    - FUENTE=fixture: lee tlalpan_facebook.json.
    - FUENTE=apify:
      1) Verifica caché en disco por clave = hash(tema + modo + maxPosts). Si existe, lo reutiliza (origen=cache).
      2) Si FUENTE_CACHE_ONLY=1 y no está en caché, hace fallback al fixture (origen=fixture).
      3) Llama a Apify (actor de scraping de posts de Facebook) con maxPosts=20 (APIFY_MAX_POSTS) y el tema/persona.
      4) Guarda resultado real en caché de disco y devuelve el mismo formato de post (origen=apify).
      5) Si Apify falla o se acaba el crédito, hace fallback al fixture y lo loguea claramente (origen=fixture).
    """
    load_env_file()
    configured_fuente = get_configured_fuente()
    cache_only = is_cache_only_enabled()
    max_posts = int(limit or os.getenv("APIFY_MAX_POSTS", "20") or 20)
    queries = build_facebook_queries(tema=tema, modo=modo, alcance=alcance)

    if configured_fuente == "fixture":
        return _load_from_fixture(
            tema=tema,
            modo=modo,
            alcance=alcance,
            max_posts=max_posts,
            queries=queries,
            configured_fuente="fixture",
        )

    # FUENTE=apify: 1) Revisar caché en disco (clave = hash de tema+modo+maxPosts)
    cache_key = build_apify_cache_key(tema=tema, modo=modo, max_posts=max_posts, alcance=alcance)
    cached_data = None if refresh else _read_apify_disk_cache(cache_key)
    if cached_data is not None and cached_data.get("items"):   # un resultado vacío no se reutiliza
        raw_cached_items = cached_data.get("items") or []
        mapped_items = [
            item if ("postId" in item and "user" in item and "likesCount" in item) else map_to_common_schema(item)
            for item in raw_cached_items[:max_posts]
        ]
        posts_fuente = len(mapped_items)
        all_times = [str(m.get("time") or "") for m in mapped_items if m.get("time")]
        ref_time_iso = max(all_times) if all_times else None
        filtered_items = filter_posts_by_query(mapped_items, tema=tema, modo=modo)
        posts_filtro_tema = len(filtered_items)
        cached_queries = cached_data.get("queries_enviadas") or cached_data.get("queries") or queries
        query_exacta = cached_data.get("query_exacta") or (cached_queries[0] if len(cached_queries) == 1 else cached_queries)
        print(
            f"[facebook] Fuente=apify (origen=cache, key={cache_key}): devolvió {posts_fuente} posts | "
            f"pasaron filtro ({modo}='{tema}'): {posts_filtro_tema} posts"
        )
        return {
            "source": "cache",
            "origen": "cache",
            "fuente_configurada": "apify",
            "cache_key": cache_key,
            "query_exacta": query_exacta,
            "queries_enviadas": cached_queries,
            "queries": cached_queries,
            "items": filtered_items,
            "posts_fuente": posts_fuente,
            "posts_filtro_tema": posts_filtro_tema,
            "ref_time_iso": ref_time_iso,
            "sin_datos_demo": False,
            "mensaje": None,
            "error": None,
        }

    # 2) Si FUENTE_CACHE_ONLY=1 está activo, no llamar a Apify en demos
    if cache_only:
        return _load_from_fixture(
            tema=tema,
            modo=modo,
            alcance=alcance,
            max_posts=max_posts,
            queries=queries,
            configured_fuente="apify",
            fallback_reason=f"FUENTE_CACHE_ONLY=1 activo y sin caché en disco para key={cache_key}",
        )

    # 3) Llamada real a Apify usando APIFY_TOKEN desde .env
    apify_token = os.getenv("APIFY_TOKEN", "").strip()
    if not apify_token:
        return _load_from_fixture(
            tema=tema,
            modo=modo,
            alcance=alcance,
            max_posts=max_posts,
            queries=queries,
            configured_fuente="apify",
            fallback_reason="APIFY_TOKEN no configurado en .env",
        )

    actor_id = os.getenv("APIFY_ACTOR_ID", "apify~facebook-search-scraper").strip() or "apify~facebook-search-scraper"
    actor_url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
    primary_query = queries[0] if queries else (tema or "").strip()
    modo_norm_call = (modo or "tema").strip().lower()
    scope_place = resolve_scope_place_name(alcance)

    def _call_actor(q_text: str, n_limit: int) -> Tuple[bool, int, str, List[Dict[str, Any]]]:
        payload = {
            "categories": [q_text],
            "searchType": "posts",
            "resultsLimit": n_limit,
        }
        if modo_norm_call != "persona" and scope_place:
            payload["locations"] = [scope_place]   # schema del actor: array de texto libre (país, ciudad o provincia)
        try:
            print(
                f"[facebook] Llamando a Apify ({actor_id}) con query='{q_text}' "
                f"(modo={modo}, maxPosts={n_limit})..."
            )
            resp = requests.post(
                actor_url,
                params={"token": apify_token},
                json=payload,
                timeout=90,
            )
            if not resp.ok:
                detail = resp.text[:220].replace("\n", " ")
                return False, resp.status_code, detail, []
            raw_data = resp.json()
            raw_data = raw_data if isinstance(raw_data, list) else []
            first = raw_data[0] if raw_data and isinstance(raw_data[0], dict) else {}
            print(f"[facebook] Apify {actor_id} devolvió {len(raw_data)} items crudos | claves del primero: {sorted(first.keys())}")
            return True, resp.status_code, "", raw_data
        except Exception as exc:
            return False, 500, str(exc), []

    try:
        # Llamada 1 con la query principal
        ok1, code1, err1, raw_items_1 = _call_actor(primary_query, max_posts)
        if not ok1:
            credit_hint = "crédito agotado / límite de cuenta" if code1 in (402, 403, 429) else f"HTTP {code1}"
            return _load_from_fixture(
                tema=tema,
                modo=modo,
                alcance=alcance,
                max_posts=max_posts,
                queries=queries,
                configured_fuente="apify",
                fallback_reason=f"Apify {credit_hint}: {err1}",
            )

        queries_enviadas = [primary_query]
        seen_urls: set = set()

        mapped_unicos_1, pasaron_1 = _evaluate_and_log_query_posts(
            query_num=1,
            query_text=primary_query,
            raw_posts=raw_items_1,
            tema=tema,
            modo=modo,
            seen_urls=seen_urls,
        )
        all_mapped_items: List[Dict[str, Any]] = list(mapped_unicos_1)

        # 2. Si la primera query devuelve menos de 5 posts, ejecuta una segunda con una variante (nombre sin segundo apellido), respetando el tope total de APIFY_MAX_POSTS
        if len(raw_items_1) < 5 and len(queries) > 1:
            variant_query = queries[1]
            remaining_limit = max_posts - len(raw_items_1)
            if remaining_limit > 0 and variant_query.strip().lower() != primary_query.strip().lower():
                print(
                    f"[facebook] Query 1 devolvió {len(raw_items_1)} posts (< 5). "
                    f"Ejecutando segunda query con variante: '{variant_query}' (tope restante={remaining_limit})..."
                )
                ok2, code2, err2, raw_items_2 = _call_actor(variant_query, remaining_limit)
                if ok2:
                    queries_enviadas.append(variant_query)
                    mapped_unicos_2, pasaron_2 = _evaluate_and_log_query_posts(
                        query_num=2,
                        query_text=variant_query,
                        raw_posts=raw_items_2,
                        tema=tema,
                        modo=modo,
                        seen_urls=seen_urls,
                    )
                    all_mapped_items.extend(mapped_unicos_2)
                else:
                    print(f"[facebook] Segunda query falló ({code2}): {err2} — continuando con resultados de query 1.")

        # Guardar en caché de disco el resultado real deduplicado (no se guardan resultados vacíos)
        if all_mapped_items:
            _write_apify_disk_cache(
                cache_key=cache_key,
                tema=tema,
                modo=modo,
                max_posts=max_posts,
                queries=queries_enviadas,
                mapped_items=all_mapped_items,
            )

        posts_fuente = len(all_mapped_items)
        filtered_items = filter_posts_by_query(all_mapped_items, tema=tema, modo=modo)
        posts_filtro_tema = len(filtered_items)
        query_exacta = queries_enviadas[0] if len(queries_enviadas) == 1 else queries_enviadas
        print(
            f"[facebook] Fuente=apify (origen=apify, key={cache_key}): devolvió {posts_fuente} posts únicos | "
            f"pasaron filtro ({modo}='{tema}'): {posts_filtro_tema} posts | queries={queries_enviadas}"
        )
        return {
            "source": "apify",
            "origen": "apify",
            "fuente_configurada": "apify",
            "cache_key": cache_key,
            "query_exacta": query_exacta,
            "queries_enviadas": queries_enviadas,
            "queries": queries_enviadas,
            "items": filtered_items,
            "posts_fuente": posts_fuente,
            "posts_filtro_tema": posts_filtro_tema,
            "ref_time_iso": None,
            "sin_datos_demo": False,
            "mensaje": None,
            "error": None,
        }
    except Exception as exc:
        return _load_from_fixture(
            tema=tema,
            modo=modo,
            alcance=alcance,
            max_posts=max_posts,
            queries=queries,
            configured_fuente="apify",
            fallback_reason=f"Excepción al invocar Apify: {exc}",
        )


# ───────────────────────── Modo Persona en dos pasos ─────────────────────────
# Paso 1: buscar perfiles/páginas por nombre (el usuario elige la correcta: hay homónimos).
# Paso 2: con la página elegida, traer sus publicaciones + menciones de terceros. Cada paso cachea por separado.

def _persona_cache_key(prefix: str, *parts: Any) -> str:
    raw = "|".join(normalize_text_no_accents(str(p).strip()) for p in parts)
    return f"{prefix}-{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]}"


# Contadores de la corrida en curso (los reinicia quien los lee): llamadas reales y items crudos, para estimar costo.
STATS: Dict[str, int] = {"llamadas": 0, "items": 0}


def _run_actor(actor_id: str, payload: Dict[str, Any], before_call=None) -> List[Dict[str, Any]]:
    """Llamada real a Apify. `before_call` (cuota por hora) se ejecuta antes y su excepción NO se captura aquí."""
    token = os.getenv("APIFY_TOKEN", "").strip()
    if not token:
        raise RuntimeError("APIFY_TOKEN no configurado en backend/.env")
    if before_call:
        before_call()
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
    print(f"[facebook] Apify {actor_id}: {json.dumps(payload, ensure_ascii=False)[:200]}")
    resp = requests.post(url, params={"token": token}, json=payload, timeout=120)
    if not resp.ok:
        raise RuntimeError(f"Apify HTTP {resp.status_code}: {resp.text[:200]}".replace("\n", " "))
    data = resp.json()
    data = data if isinstance(data, list) else []
    STATS["llamadas"] += 1
    STATS["items"] += len(data)
    first = data[0] if data and isinstance(data[0], dict) else {}
    print(f"[facebook] Apify {actor_id} devolvió {len(data)} items crudos | claves del primero: {sorted(first.keys())}")
    return data


def _cached_or_run(key: str, meta: Dict[str, Any], run, mapper, refresh: bool = False) -> Tuple[List[Dict[str, Any]], str]:
    """Devuelve (items_mapeados, 'cache'|'apify'). Respeta FUENTE_CACHE_ONLY."""
    cached = None if refresh else _read_apify_disk_cache(key)
    if cached is not None and cached["items"]:   # un resultado vacío no se reutiliza: puede ser un fallo de input
        return cached["items"], "cache"
    if is_cache_only_enabled():
        raise RuntimeError("FUENTE_CACHE_ONLY=1 activo y no hay caché para este paso")
    items = mapper(run())
    if not items:
        return items, "apify"
    try:
        APIFY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (APIFY_CACHE_DIR / f"{key}.json").write_text(
            json.dumps({**meta, "key": key, "saved_at": datetime.now(timezone.utc).isoformat(), "items": items},
                       ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        print(f"[facebook] No se pudo guardar caché ({key}): {exc}")
    return items, "apify"


def _map_profile(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    url = str(raw.get("url") or raw.get("pageUrl") or raw.get("facebookUrl") or "").strip()
    if not url:
        return None
    cats = raw.get("categories") or raw.get("category") or ""
    return {
        "nombre": str(raw.get("title") or raw.get("name") or raw.get("pageName") or "").strip() or url,
        "url": url,
        "categoria": ", ".join(str(c) for c in cats) if isinstance(cats, list) else str(cats),
        "seguidores": int(raw.get("followers") or raw.get("followersCount") or raw.get("likes") or 0),
    }


def search_persona_profiles(nombre: str, before_call=None) -> Dict[str, Any]:
    """Paso 1: lista de páginas que coinciden con el nombre (input según el schema de apify/facebook-search-scraper)."""
    load_env_file()
    nombre = re.sub(r"\s+", " ", (nombre or "").strip())
    max_n = int(os.getenv("APIFY_MAX_PROFILES", "10") or 10)
    actor = os.getenv("APIFY_ACTOR_ID", "apify~facebook-search-scraper").strip() or "apify~facebook-search-scraper"
    # searchType válidos del actor: pages-google | pages | profiles | posts | reels
    search_type = os.getenv("APIFY_PROFILE_SEARCH_TYPE", "pages").strip() or "pages"
    crudos = {"n": 0, "claves": []}

    def run():
        raw = _run_actor(actor, {"categories": [nombre], "searchType": search_type, "resultsLimit": max_n}, before_call)
        crudos["n"], crudos["claves"] = len(raw), sorted(raw[0].keys()) if raw and isinstance(raw[0], dict) else []
        return raw

    def mapper(raw_items):
        seen, out = set(), []
        for r in raw_items:
            m = _map_profile(r)
            if m and m["url"] not in seen:
                seen.add(m["url"]); out.append(m)
        return out[:max_n]

    items, origen = _cached_or_run(
        _persona_cache_key("perfiles-v2", nombre, max_n, search_type),
        {"paso": "perfiles", "nombre": nombre},
        run, mapper,
    )
    mensaje = None
    if not items:
        mensaje = ("Facebook no devolvió páginas para este nombre" if not crudos["n"] else
                   f"Facebook devolvió {crudos['n']} resultados pero no se reconocieron sus campos (claves: {', '.join(crudos['claves'])})")
    return {"origen": origen, "perfiles": items, "mensaje": mensaje}


def _ficha_queries(nombre: str, ficha: Optional[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    """Queries de menciones: nombre completo + cargo y/o territorio de la ficha; y `locations` si hay territorio."""
    base = f'"{nombre}"'
    if not ficha:
        return [base], []
    terr = ficha.get("territorio") or {}
    lugar = str(terr.get("nombre") or "").strip() if (terr.get("municipio_id") or terr.get("estado_id")) else ""
    qs = [f"{base} {ficha['cargo']}"] if ficha.get("cargo") else []
    if lugar:
        qs.append(f"{base} {lugar}")
    return (qs or [base]), ([lugar] if lugar else [])


def fetch_persona_posts(nombre: str, pagina_url: str, pagina_nombre: str = "", before_call=None,
                        ficha: Optional[Dict[str, Any]] = None, refresh: bool = False,
                        max_posts: Optional[int] = None) -> Dict[str, Any]:
    """Paso 2: posts de la(s) página(s) ('publicado_por_persona') y menciones de terceros ('mencion').
    Con ficha: las páginas oficiales de la ficha se consultan siempre y las queries combinan nombre + cargo/territorio."""
    load_env_file()
    nombre = re.sub(r"\s+", " ", (nombre or "").strip())
    max_posts = int(max_posts or os.getenv("APIFY_MAX_POSTS", "20") or 20)
    posts_actor = os.getenv("APIFY_PAGE_POSTS_ACTOR_ID", "apify~facebook-posts-scraper").strip()
    search_actor = os.getenv("APIFY_ACTOR_ID", "apify~facebook-search-scraper").strip() or "apify~facebook-search-scraper"

    def map_posts(raw_items):
        return [map_to_common_schema(r) for r in raw_items]

    urls = [u for u in dict.fromkeys([pagina_url] + list((ficha or {}).get("paginas_oficiales") or [])) if u]
    propios, o1 = _cached_or_run(
        _persona_cache_key("pagina", "|".join(sorted(urls)), max_posts),
        {"paso": "pagina", "paginas": urls},
        lambda: _run_actor(posts_actor, {"startUrls": [{"url": u} for u in urls], "resultsLimit": max_posts}, before_call),
        map_posts, refresh,
    ) if urls else ([], "cache")
    qs, locs = _ficha_queries(nombre, ficha)
    payload_m = {"categories": qs, "searchType": "posts", "resultsLimit": max_posts}
    if locs:
        payload_m["locations"] = locs
    terceros, o2 = _cached_or_run(
        _persona_cache_key("menciones-v3", "|".join(qs), "|".join(locs), max_posts),
        {"paso": "menciones", "nombre": nombre, "queries": qs},
        lambda: _run_actor(search_actor, payload_m, before_call),
        map_posts, refresh,
    )

    pag_norm = normalize_text_no_accents(pagina_nombre)
    publicados = []
    for p in propios[:max_posts]:
        p = {**p, "origen_post": "publicado_por_persona"}
        if pagina_nombre and p["user"]["name"] == "Usuario de Facebook":
            p["user"] = {**p["user"], "name": pagina_nombre}
        publicados.append(p)

    urls_propios = {p["url"] for p in publicados if p.get("url")}
    menciones = []
    for p in terceros[:max_posts]:
        if p.get("url") in urls_propios:
            continue
        if pag_norm and normalize_text_no_accents(p["user"]["name"]) == pag_norm:
            continue   # lo publicó la propia página: ya está en 'publicados'
        nombres = [nombre] + list((ficha or {}).get("variantes") or [])
        if (p.get("text") or "").strip() and not any(matches_query_filter(p, n, "persona") for n in nombres):
            continue   # con texto pero no menciona nombre y apellido
        menciones.append({**p, "origen_post": "mencion"})

    return {"origen_pagina": o1, "origen_menciones": o2, "publicados": publicados, "menciones": menciones}
