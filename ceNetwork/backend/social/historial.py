"""Historial de búsquedas: un JSON por búsqueda en .cache/historial/<id>.json (máx. 100). No llama a Apify ni a Gemini."""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional

DIR = Path(__file__).resolve().parents[1] / ".cache" / "historial"
MAX_ENTRADAS = 100
_ID_OK = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _archivo(id: str) -> Optional[Path]:
    return DIR / f"{id}.json" if _ID_OK.match(id or "") else None


def _total(resumen: Dict[str, Any]) -> int:
    """Posts útiles de la búsqueda: relevantes + 'Por confirmar'."""
    return int(resumen.get("relevantes_posts") or 0) + len(resumen.get("por_confirmar") or [])


def guardar(resumen: Dict[str, Any], tema: str, modo: str, alcance: Optional[Dict[str, Any]]) -> bool:
    """Guarda la búsqueda salvo que la fuente no haya devuelto nada. Misma búsqueda = mismo id = se sobrescribe."""
    path = _archivo(str(resumen.get("id") or ""))
    if path is None or (_total(resumen) == 0 and not resumen.get("posts_fuente")):   # con posts en la fuente se guarda aunque todo se descarte: sirve para revisar el filtro
        return False
    try:
        DIR.mkdir(parents=True, exist_ok=True)
        entrada = {
            "id": resumen["id"],
            "fecha": datetime.now(timezone.utc).isoformat(),
            "tema": tema,
            "modo": modo,
            "alcance": alcance or {},
            "origen": resumen.get("origen") or resumen.get("fuente_datos") or "",
            "n_posts": _total(resumen),
            "plataformas": resumen.get("plataformas_solicitadas") or ["facebook"],
            "periodo": resumen.get("periodo"),
            "resumen": resumen,
        }
        path.write_text(json.dumps(entrada, ensure_ascii=False), encoding="utf-8")
        for viejo in sorted(DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)[:-MAX_ENTRADAS]:
            viejo.unlink()
        return True
    except Exception as exc:
        print(f"[historial] No se pudo guardar: {exc}")
        return False


def listar() -> List[Dict[str, Any]]:
    out = []
    for p in DIR.glob("*.json") if DIR.exists() else []:
        try:
            e = json.loads(p.read_text(encoding="utf-8"))
            out.append({k: e.get(k) for k in ("id", "tema", "modo", "alcance", "fecha", "origen", "n_posts", "plataformas", "periodo")})
        except Exception:
            continue
    return sorted(out, key=lambda e: e.get("fecha") or "", reverse=True)


def obtener(id: str) -> Optional[Dict[str, Any]]:
    p = _archivo(id)
    return json.loads(p.read_text(encoding="utf-8")) if p and p.exists() else None


def anexar(id: str, clave: str, valor: Any) -> bool:
    """Guarda un bloque generado (palabras, analisis, radar...) dentro del resumen de la búsqueda."""
    e = obtener(id)
    if e is None:
        return False
    e["resumen"][clave] = valor
    _archivo(id).write_text(json.dumps(e, ensure_ascii=False), encoding="utf-8")
    return True


def borrar(id: str) -> bool:
    p = _archivo(id)
    if p and p.exists():
        p.unlink()
        return True
    return False


def vaciar() -> int:
    n = 0
    for p in DIR.glob("*.json") if DIR.exists() else []:
        p.unlink(); n += 1
    return n
