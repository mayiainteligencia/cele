"""
Caché de 15 minutos en Firestore (con respaldo en disco local y memoria)
para las consultas de escucha social por query_id = sha256(tema | modo | alcance).
"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
LOCAL_CACHE_FILE = BASE_DIR / ".cache" / "firestore_cache.json"

_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}
_FIRESTORE_CLIENT: Any = None
_FIRESTORE_CHECKED: bool = False


def _get_firestore_client() -> Any:
    """Inicializa el cliente de Firestore una sola vez si hay credenciales disponibles."""
    global _FIRESTORE_CLIENT, _FIRESTORE_CHECKED
    if _FIRESTORE_CHECKED:
        return _FIRESTORE_CLIENT
    _FIRESTORE_CHECKED = True
    try:
        if not (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("FIRESTORE_PROJECT_ID")):
            return None
        from google.cloud import firestore  # type: ignore
        project = os.getenv("FIRESTORE_PROJECT_ID") or None
        _FIRESTORE_CLIENT = firestore.Client(project=project)
        print("[cache] Conectado a Google Cloud Firestore.")
    except Exception as exc:
        print(f"[cache] Firestore en nube no activo ({exc}); usando caché local compatible de 15 min.")
        _FIRESTORE_CLIENT = None
    return _FIRESTORE_CLIENT


def build_query_id(tema: str, modo: str, alcance: Optional[Dict[str, Any]]) -> str:
    """Genera un ID determinista de 12 caracteres para {tema, modo, alcance}."""
    alc = alcance or {}
    raw_key = json.dumps(
        {
            "tema": (tema or "").strip().lower(),
            "modo": (modo or "tema").strip().lower(),
            "nivel": alc.get("nivel") or "municipio",
            "estado_id": alc.get("estado_id") or "09",
            "municipio_id": alc.get("municipio_id") or "09012",
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:12]


def _load_disk_cache() -> Dict[str, Any]:
    if not LOCAL_CACHE_FILE.exists():
        return {}
    try:
        return json.loads(LOCAL_CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_disk_cache(store: Dict[str, Any]) -> None:
    try:
        LOCAL_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        LOCAL_CACHE_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        print(f"[cache] No se pudo persistir caché en disco: {exc}")


def get_cached_result(query_id: str) -> Optional[Dict[str, Any]]:
    """Obtiene el resumen en caché si su antigüedad es menor a CACHE_TTL_MINUTES (default 15 min)."""
    ttl_minutes = int(os.getenv("CACHE_TTL_MINUTES", "15") or 15)
    now_ts = datetime.now(timezone.utc).timestamp()
    max_age_sec = ttl_minutes * 60

    # 1. Intentar Firestore si está activo
    fs_client = _get_firestore_client()
    collection_name = os.getenv("FIRESTORE_COLLECTION", "ce_network_cache")
    if fs_client is not None:
        try:
            doc = fs_client.collection(collection_name).document(query_id).get()
            if doc.exists:
                data = doc.to_dict() or {}
                created_ts = float(data.get("created_ts") or 0)
                if now_ts - created_ts <= max_age_sec and "resumen" in data:
                    return data["resumen"]
        except Exception as exc:
            print(f"[cache] Error leyendo Firestore ({exc}), usando caché local.")

    # 2. Memoria / Disco local
    entry = _MEMORY_CACHE.get(query_id)
    if not entry:
        disk_store = _load_disk_cache()
        entry = disk_store.get(query_id)
        if entry:
            _MEMORY_CACHE[query_id] = entry

    if entry:
        created_ts = float(entry.get("created_ts") or 0)
        if now_ts - created_ts <= max_age_sec and "resumen" in entry:
            return entry["resumen"]

    return None


def set_cached_result(query_id: str, resumen: Dict[str, Any]) -> None:
    """Guarda el resumen en Firestore (si está activo) y en caché local con TTL de 15 min."""
    now_utc = datetime.now(timezone.utc)
    ttl_minutes = int(os.getenv("CACHE_TTL_MINUTES", "15") or 15)
    record = {
        "id": query_id,
        "created_ts": now_utc.timestamp(),
        "expires_at": (now_utc + timedelta(minutes=ttl_minutes)).isoformat(),
        "resumen": resumen,
    }

    _MEMORY_CACHE[query_id] = record
    disk_store = _load_disk_cache()
    disk_store[query_id] = record
    _save_disk_cache(disk_store)

    fs_client = _get_firestore_client()
    collection_name = os.getenv("FIRESTORE_COLLECTION", "ce_network_cache")
    if fs_client is not None:
        try:
            fs_client.collection(collection_name).document(query_id).set(record)
        except Exception as exc:
            print(f"[cache] Error escribiendo en Firestore ({exc}); guardado en caché local.")

