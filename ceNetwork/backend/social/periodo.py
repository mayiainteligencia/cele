"""Periodo de la búsqueda: últimos N días, rango personalizado (desde/hasta) o todo el historial. Reemplaza al MAX_POST_DAYS fijo."""
from datetime import date, datetime, time, timedelta, timezone
import os
from typing import Any, Dict, Optional, Tuple


def _fecha(v: Any) -> Optional[date]:
    try:
        return date.fromisoformat(str(v)[:10]) if v else None
    except ValueError:
        return None


def resolver(dias: Optional[int] = None, desde: Optional[str] = None, hasta: Optional[str] = None) -> Dict[str, Any]:
    """{tipo: dias|rango|todo, dias, desde, hasta, etiqueta}. dias=0 significa «todo el historial»; sin datos usa MAX_POST_DAYS (14)."""
    d0, d1 = _fecha(desde), _fecha(hasta)
    if d0 or d1:
        if d0 and d1 and d0 > d1:
            d0, d1 = d1, d0
        et = f"{d0.isoformat() if d0 else '…'} a {d1.isoformat() if d1 else 'hoy'}"
        return {"tipo": "rango", "dias": None, "desde": d0.isoformat() if d0 else None, "hasta": d1.isoformat() if d1 else None, "etiqueta": et}
    if dias is None:
        dias = int(os.getenv("MAX_POST_DAYS", "14") or 14)
    if int(dias) <= 0:
        return {"tipo": "todo", "dias": None, "desde": None, "hasta": None, "etiqueta": "Todo el historial"}
    n = min(int(dias), 3650)
    return {"tipo": "dias", "dias": n, "desde": None, "hasta": None, "etiqueta": "24 horas" if n == 1 else f"{n} días"}


def es_por_defecto(p: Dict[str, Any]) -> bool:
    return p["tipo"] == "dias" and p["dias"] == int(os.getenv("MAX_POST_DAYS", "14") or 14)


def ventana(p: Dict[str, Any], ref: datetime) -> Tuple[Optional[datetime], Optional[datetime]]:
    """(desde, hasta) en UTC; None = sin límite."""
    if p["tipo"] == "dias":
        return ref - timedelta(days=p["dias"]), None
    if p["tipo"] == "rango":
        d0, d1 = _fecha(p["desde"]), _fecha(p["hasta"])
        return (datetime.combine(d0, time.min, tzinfo=timezone.utc) if d0 else None,
                datetime.combine(d1, time.max, tzinfo=timezone.utc) if d1 else None)
    return None, None


def fechas_consulta(p: Dict[str, Any]) -> Tuple[Optional[date], Optional[date]]:
    """Fechas (día) para filtros nativos de los actores; hasta es inclusiva. El filtro exacto lo hace siempre el código."""
    ahora = datetime.now(timezone.utc)
    d0, d1 = ventana(p, ahora)
    return (d0.date() if d0 else None, d1.date() if d1 else None)


def dias_serie(p: Dict[str, Any], ref: datetime) -> int:
    """Días que abarca la gráfica de volumen por día (acotado para que se pueda leer)."""
    if p["tipo"] == "dias":
        return max(1, min(p["dias"], 120))
    if p["tipo"] == "rango":
        d0, d1 = _fecha(p["desde"]), _fecha(p["hasta"]) or ref.date()
        return max(1, min(((d1 - d0).days + 1) if d0 else 30, 120))
    return 90
