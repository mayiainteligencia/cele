"""Fichas de entidad (persona | tema | partido): Firestore con respaldo en JSON local (config/entidades.json)."""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from social.cache import _get_firestore_client

RESPALDO = Path(__file__).resolve().parents[1] / "config" / "entidades.json"
TIPOS = ("persona", "tema", "partido")
CAMPOS_LISTA = ("variantes", "paginas_oficiales", "hashtags", "palabras_descarte")


def _coleccion() -> str:
    return os.getenv("FIRESTORE_ENTIDADES_COLLECTION", "entidades")


def _leer_local() -> Dict[str, Dict[str, Any]]:
    try:
        return json.loads(RESPALDO.read_text(encoding="utf-8")) if RESPALDO.exists() else {}
    except Exception as exc:
        print(f"[entidades] No se pudo leer {RESPALDO.name}: {exc}")
        return {}


def normalizar(data: Dict[str, Any], id: Optional[str] = None) -> Dict[str, Any]:
    """Valida y limpia una ficha. Lanza ValueError si falta el nombre o el tipo es inválido."""
    nombre = str(data.get("nombre") or "").strip()
    tipo = str(data.get("tipo") or "persona").strip().lower()
    if not nombre:
        raise ValueError("La ficha necesita un nombre.")
    if tipo not in TIPOS:
        raise ValueError(f"tipo debe ser uno de {', '.join(TIPOS)}.")
    terr = data.get("territorio") or {}
    ficha: Dict[str, Any] = {
        "id": id or str(data.get("id") or uuid.uuid4().hex[:10]),
        "tipo": tipo,
        "nombre": nombre,
        "cargo": str(data.get("cargo") or "").strip(),
        "partido": str(data.get("partido") or "").strip(),
        # 'nombre' del territorio es un añadido a {estado_id, municipio_id}: hace falta texto para las queries.
        "territorio": {k: (str(terr.get(k)).strip() or None) if terr.get(k) else None for k in ("estado_id", "municipio_id", "nombre")},
        "idioma": str(data.get("idioma") or "es").strip().lower() or "es",
        "monitoreo": bool(data.get("monitoreo")),   # activa la corrida programada de /monitoreo/ejecutar
    }
    for campo in CAMPOS_LISTA:
        vals = data.get(campo) or []
        ficha[campo] = [str(v).strip() for v in vals if str(v).strip()] if isinstance(vals, list) else []
    return ficha


def listar() -> List[Dict[str, Any]]:
    cli = _get_firestore_client()
    if cli is not None:
        try:
            return sorted((d.to_dict() for d in cli.collection(_coleccion()).stream()), key=lambda f: f.get("nombre", ""))
        except Exception as exc:
            print(f"[entidades] Firestore no disponible ({exc}); usando respaldo local.")
    return sorted(_leer_local().values(), key=lambda f: f.get("nombre", ""))


def obtener(id: str) -> Optional[Dict[str, Any]]:
    return next((f for f in listar() if f.get("id") == id), None)


def guardar(ficha: Dict[str, Any]) -> Dict[str, Any]:
    """Escribe siempre en el respaldo local y, si hay credenciales, también en Firestore."""
    store = _leer_local()
    store[ficha["id"]] = ficha
    RESPALDO.parent.mkdir(parents=True, exist_ok=True)
    RESPALDO.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    cli = _get_firestore_client()
    if cli is not None:
        try:
            cli.collection(_coleccion()).document(ficha["id"]).set(ficha)
        except Exception as exc:
            print(f"[entidades] No se pudo escribir en Firestore ({exc}); queda en el respaldo local.")
    return ficha
