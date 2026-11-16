"""
Servidor FastAPI para ceNetwork — Escucha Social (Demo Tlalpan, CDMX).
Endpoints:
- POST /social/buscar {tema, modo, alcance}
- GET  /social/buscar/{id}/resumen
- GET  /health
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from social.cache import build_query_id, get_cached_result, set_cached_result
from social.facebook import (
    fetch_facebook_posts,
    get_configured_fuente,
    is_cache_only_enabled,
    load_env_file,
    search_persona_profiles,
    fetch_persona_posts,
)
from social import entidades, historial, monitoreo
from social.identidad import puntaje_identidad, verificar_con_gemini
from social.pipeline import get_pysentimiento_analyzer, process_facebook_posts

load_env_file()

# Ventana deslizante en memoria para límite de búsquedas reales (FACEBOOK_FIXTURE=false) por hora
_REAL_SEARCH_TIMESTAMPS: List[float] = []


def _prune_and_count_real_searches(now_ts: Optional[float] = None) -> int:
    now = now_ts if now_ts is not None else time.time()
    cutoff = now - 3600.0
    global _REAL_SEARCH_TIMESTAMPS
    _REAL_SEARCH_TIMESTAMPS = [ts for ts in _REAL_SEARCH_TIMESTAMPS if ts >= cutoff]
    return len(_REAL_SEARCH_TIMESTAMPS)


def check_and_record_real_search_quota() -> None:
    """Verifica el límite por hora de búsquedas reales (default 10/h) y lanza HTTP 429 si se excede."""
    load_env_file()
    max_per_hour = int(os.getenv("MAX_REAL_SEARCHES_PER_HOUR", "10") or 10)
    now = time.time()
    used = _prune_and_count_real_searches(now)
    if used >= max_per_hour:
        raise HTTPException(
            status_code=429,
            detail=f"Límite de búsquedas reales por hora excedido (máx. {max_per_hour} por hora).",
        )
    _REAL_SEARCH_TIMESTAMPS.append(now)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_env_file()
    get_pysentimiento_analyzer()
    print("[ceNetwork-backend] Servicio inicializado.")
    yield
    print("[ceNetwork-backend] Apagando servicio.")


app = FastAPI(
    title="ceNetwork Social Listening API",
    version="1.1.0",
    lifespan=lifespan,
)

raw_origins = os.getenv("CORS_ORIGINS", "*").strip()
allow_origins = ["*"] if raw_origins == "*" else [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_token(
    x_api_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> None:
    """Valida el token por header X-API-Token o Authorization Bearer si API_TOKEN está definido en .env."""
    expected = os.getenv("API_TOKEN", "").strip()
    if not expected:
        return
    bearer = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()
    provided = (x_api_token or bearer or "").strip()
    if provided != expected:
        raise HTTPException(status_code=401, detail="Token de API inválido o ausente.")


class AlcancePayload(BaseModel):
    nivel: str = "municipio"
    estado_id: Optional[str] = "09"
    municipio_id: Optional[str] = "09012"
    nombre: Optional[str] = None
    texto: Optional[str] = None   # nombre legible completo (p. ej. «Tlalpan, Ciudad de México»), para el historial


class BuscarRequest(BaseModel):
    tema: str = Field(default="")
    modo: str = Field(default="tema")
    alcance: Optional[AlcancePayload] = None
    refrescar: bool = False   # «Actualizar» del historial: ignora la caché de disco y repite la búsqueda real


def _empty_fallback_summary(
    query_id: str,
    tema: str,
    modo: str,
    alcance: Optional[Dict[str, Any]],
    error_msg: str,
) -> Dict[str, Any]:
    use_fixture = os.getenv("FACEBOOK_FIXTURE", "true").strip().lower() in ("true", "1", "yes", "si")
    return {
        "id": query_id,
        "cached": False,
        "error": error_msg,
        "query": {
            "tema": tema,
            "modo": modo,
            "alcance": alcance or {"nivel": "municipio", "estado_id": "09", "municipio_id": "09012"},
        },
        "fuente_datos": "fixture" if use_fixture else "apify",
        "es_fixture": use_fixture,
        "etiqueta_fuente": "DATOS DE EJEMPLO (fixture)" if use_fixture else "DATOS EN VIVO (Apify)",
        "sin_datos_demo": False,
        "mensaje": error_msg,
        "clasificador": "reglas",
        "fecha_corrida": datetime.now(timezone.utc).isoformat(),
        "ventana_dias": int(os.getenv("MAX_POST_DAYS", "14") or 14),
        "posts_fuente": 0,
        "posts_filtro_tema": 0,
        "total_posts": 0,
        "relevantes_posts": 0,
        "ciudadanos_medios_posts": 0,
        "oficiales_posts": 0,
        "porcentaje_oficial": 0.0,
        "descartados": {"por_filtro_tema": 0, "por_fecha": 0, "por_homonimo": 0, "no_relevantes_o_empleo": 0, "vacios": 0},
        "volumen": 0,
        "interacciones_totales": 0,
        "sentimiento": {"positive": 0, "neutral": 0, "negative": 0, "sin_clasificar": 0, "universo": "medio|ciudadano", "excluye_oficial": True},
        "categorias": [],
        "narrativa_oficial": [],
        "narrativa_ciudadana": [],
        "posts_recientes": [],
        "volumen_por_dia": [],
        "pico_posts_dia": 0,
    }


@app.get("/health")
async def health():
    load_env_file()
    fuente_cfg = get_configured_fuente()
    use_fixture = fuente_cfg == "fixture"
    apify_max_posts = int(os.getenv("APIFY_MAX_POSTS", "20") or 20)
    max_real_per_hour = int(os.getenv("MAX_REAL_SEARCHES_PER_HOUR", "10") or 10)
    return {
        "status": "ok",
        "servicio": "ceNetwork-backend",
        "fuente": fuente_cfg,
        "fuente_cache_only": is_cache_only_enabled(),
        "facebook_fixture": use_fixture,
        "apify_max_posts": apify_max_posts,
        "max_real_searches_per_hour": max_real_per_hour,
        "real_searches_used_last_hour": _prune_and_count_real_searches(),
    }


@app.post("/social/buscar", dependencies=[Depends(verify_api_token)])
async def social_buscar(req: BuscarRequest):
    load_env_file()
    tema = (req.tema or "").strip()
    if not tema:
        raise HTTPException(status_code=400, detail="Escribe un tema obligatorio para buscar.")

    modo = (req.modo or "tema").strip().lower()
    if modo not in ("tema", "persona", "tendencias"):
        modo = "tema"

    alcance_dict = (
        req.alcance.model_dump()
        if req.alcance
        else {"nivel": "municipio", "estado_id": "09", "municipio_id": "09012"}
    )

    fuente_cfg = get_configured_fuente()
    cache_only = is_cache_only_enabled()
    query_id = build_query_id(tema, f"{modo}:{fuente_cfg}:{'cacheonly' if cache_only else 'normal'}", alcance_dict)

    try:
        fetched = fetch_facebook_posts(tema=tema, modo=modo, alcance=alcance_dict, refresh=req.refrescar)
        items = fetched.get("items") or []
        origen = fetched.get("origen") or fetched.get("source") or fuente_cfg
        sin_datos_demo = bool(fetched.get("sin_datos_demo"))
        mensaje = fetched.get("mensaje")

        # Si se realizó una llamada en vivo a Apify (origen='apify'), contabilizar cuota por hora
        if origen == "apify":
            check_and_record_real_search_quota()

        resumen = process_facebook_posts(
            raw_mapped_posts=items,
            tema=tema,
            modo=modo,
            alcance=alcance_dict,
            source_type=origen,
            sin_datos_demo=sin_datos_demo,
            mensaje=mensaje,
            posts_fuente=fetched.get("posts_fuente"),
            ref_time_iso=fetched.get("ref_time_iso"),
        )
        resumen["id"] = query_id
        resumen["origen"] = origen
        resumen["fuente_configurada"] = fuente_cfg
        resumen["queries_ejecutadas"] = fetched.get("queries", [])
        if fetched.get("query_exacta"):
            resumen["query_exacta"] = fetched["query_exacta"]
        if fetched.get("queries_enviadas"):
            resumen["queries_enviadas"] = fetched["queries_enviadas"]
        if fetched.get("error"):
            resumen["warning"] = fetched["error"]

        set_cached_result(query_id, resumen)
        historial.guardar(resumen, tema, modo, alcance_dict)
        return {**resumen, "id": query_id, "cached": origen == "cache"}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[social/buscar] Error inesperado procesando consulta ({query_id}): {exc}")
        return _empty_fallback_summary(query_id, tema, modo, alcance_dict, str(exc))


class EntidadPayload(BaseModel):
    tipo: str = "persona"
    nombre: str = ""
    variantes: List[str] = []
    cargo: str = ""
    partido: str = ""
    territorio: Optional[Dict[str, Optional[str]]] = None
    paginas_oficiales: List[str] = []
    hashtags: List[str] = []
    palabras_descarte: List[str] = []
    idioma: str = "es"
    monitoreo: bool = False


@app.get("/entidades", dependencies=[Depends(verify_api_token)])
async def entidades_listar():
    return entidades.listar()


@app.post("/entidades", dependencies=[Depends(verify_api_token)])
async def entidades_crear(req: EntidadPayload):
    try:
        return entidades.guardar(entidades.normalizar(req.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.put("/entidades/{entidad_id}", dependencies=[Depends(verify_api_token)])
async def entidades_actualizar(entidad_id: str, req: EntidadPayload):
    if not entidades.obtener(entidad_id):
        raise HTTPException(status_code=404, detail="Ficha no encontrada.")
    try:
        return entidades.guardar(entidades.normalizar(req.model_dump(), id=entidad_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def verify_token_requerido(
    x_api_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> None:
    """Como verify_api_token, pero sin API_TOKEN configurado NO deja pasar (el endpoint gasta créditos)."""
    if not os.getenv("API_TOKEN", "").strip():
        raise HTTPException(status_code=503, detail="Define API_TOKEN en backend/.env para usar /monitoreo/ejecutar.")
    verify_api_token(x_api_token, authorization)


@app.post("/monitoreo/ejecutar", dependencies=[Depends(verify_token_requerido)])
async def monitoreo_ejecutar():
    """Pensado para Cloud Scheduler: busca por ficha con monitoreo activo (tope MONITOREO_MAX_POSTS) y evalúa picos y narrativas."""
    load_env_file()
    return monitoreo.ejecutar(entidades.listar(), before_call=check_and_record_real_search_quota)


@app.get("/monitoreo/estado", dependencies=[Depends(verify_api_token)])
async def monitoreo_estado():
    return monitoreo.estado_lineas_base(entidades.listar())


@app.get("/alertas", dependencies=[Depends(verify_api_token)])
async def alertas_listar(estado: Optional[str] = None):
    return monitoreo.listar_alertas(estado)


class AlertaEstado(BaseModel):
    estado: str


@app.put("/alertas/{aid}", dependencies=[Depends(verify_api_token)])
async def alertas_estado(aid: str, req: AlertaEstado):
    a = monitoreo.cambiar_estado(aid, req.estado)
    if a is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada o estado inválido (nueva|revisada|descartada).")
    return a


@app.post("/alertas/{aid}/borrador", dependencies=[Depends(verify_api_token)])
async def alertas_borrador(aid: str):
    a = next((x for x in monitoreo.listar_alertas() if x["id"] == aid), None)
    if a is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada.")
    return {"borrador": monitoreo.borrador_respuesta(a, entidades.obtener(a["ficha_id"]))}


class PerfilesRequest(BaseModel):
    nombre: str = Field(default="")


class AnalizarPersonaRequest(BaseModel):
    nombre: str = Field(default="")
    pagina_url: str = Field(default="")
    pagina_nombre: str = Field(default="")
    entidad_id: Optional[str] = None
    alcance: Optional[AlcancePayload] = None
    refrescar: bool = False


@app.post("/social/persona/perfiles", dependencies=[Depends(verify_api_token)])
async def persona_perfiles(req: PerfilesRequest):
    """Paso 1 (modo Persona): perfiles/páginas que coinciden con el nombre, para que el usuario elija."""
    nombre = (req.nombre or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Escribe un nombre obligatorio para buscar.")
    if get_configured_fuente() != "apify":
        return {"origen": "fixture", "perfiles": [], "mensaje": "Fuente=fixture: sin búsqueda de perfiles."}
    try:
        return search_persona_profiles(nombre, before_call=check_and_record_real_search_quota)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/social/persona/analizar", dependencies=[Depends(verify_api_token)])
async def persona_analizar(req: AnalizarPersonaRequest):
    """Paso 2 (modo Persona): publicaciones de la página elegida + menciones de terceros."""
    nombre, url = (req.nombre or "").strip(), (req.pagina_url or "").strip()
    if not nombre or not url:
        raise HTTPException(status_code=400, detail="Faltan el nombre y la página elegida.")
    ficha = entidades.obtener(req.entidad_id) if req.entidad_id else None
    if req.entidad_id and not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada.")
    try:
        r = fetch_persona_posts(nombre, url, (req.pagina_nombre or "").strip(),
                                before_call=check_and_record_real_search_quota, ficha=ficha, refresh=req.refrescar)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    todos = r["publicados"] + r["menciones"]
    con_texto = [p for p in todos if (p.get("text") or "").strip()]
    sin_texto = [p for p in todos if not (p.get("text") or "").strip()]

    # Con ficha: puntaje de identidad (bajo el umbral se descarta SIN llamar a Gemini) y luego es_la_persona.
    bajo_umbral, no_es, por_confirmar = 0, 0, []
    if ficha:
        umbral = int(os.getenv("IDENTIDAD_UMBRAL", "40") or 40)
        aceptados = []
        for p in con_texto:
            score, razones = puntaje_identidad(p, ficha)
            if score < umbral:
                bajo_umbral += 1
                continue
            v = ({"es_la_persona": "si", "razon": "Publicada por una página oficial"}
                 if p.get("origen_post") == "publicado_por_persona" else verificar_con_gemini(p, ficha))
            p["atribucion"] = {"puntaje": score, "razones": razones, "es_la_persona": v["es_la_persona"], "razon_ia": v["razon"]}
            if v["es_la_persona"] == "si":
                aceptados.append(p)
            elif v["es_la_persona"] == "incierto":
                por_confirmar.append(p)
            else:
                no_es += 1
        con_texto = aceptados
    origen = "apify" if "apify" in (r["origen_pagina"], r["origen_menciones"]) else "cache"
    resumen = process_facebook_posts(
        raw_mapped_posts=con_texto, tema=nombre, modo="persona", alcance=None,
        source_type=origen, posts_fuente=len(todos),
    )
    resumen["id"] = build_query_id(f"{nombre}|{url}", "persona:pagina", {})
    resumen["origen"] = origen
    resumen["descartados"]["vacios"] = len(sin_texto)
    if ficha:
        resumen["descartados"]["por_identidad"] = bajo_umbral
        resumen["descartados"]["no_es_la_persona"] = no_es
        resumen["por_confirmar"] = por_confirmar
        resumen["ficha"] = {"id": ficha["id"], "nombre": ficha["nombre"]}
    resumen["persona"] = {
        "pagina_url": url,
        "pagina_nombre": req.pagina_nombre,
        "publicados": sum(1 for p in resumen["posts_recientes"] if p.get("origen_post") == "publicado_por_persona"),
        "menciones": sum(1 for p in resumen["posts_recientes"] if p.get("origen_post") == "mencion"),
    }
    resumen["sin_texto"] = {
        "total": len(sin_texto),
        "publicados": sum(1 for p in sin_texto if p.get("origen_post") == "publicado_por_persona"),
        "menciones": sum(1 for p in sin_texto if p.get("origen_post") == "mencion"),
        "posts": [{"url": p.get("url"), "user": p["user"]["name"], "time": p.get("time"), "origen_post": p.get("origen_post")} for p in sin_texto],
    }
    historial.guardar(resumen, nombre, "persona", req.alcance.model_dump() if req.alcance else None)
    return {**resumen, "cached": origen == "cache"}


@app.get("/historial", dependencies=[Depends(verify_api_token)])
async def historial_listar():
    return historial.listar()


@app.get("/historial/{hid}", dependencies=[Depends(verify_api_token)])
async def historial_obtener(hid: str):
    e = historial.obtener(hid)
    if e is None:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada en el historial.")
    return e


@app.delete("/historial/{hid}", dependencies=[Depends(verify_api_token)])
async def historial_borrar(hid: str):
    if not historial.borrar(hid):
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada en el historial.")
    return {"ok": True}


@app.delete("/historial", dependencies=[Depends(verify_api_token)])
async def historial_vaciar():
    return {"ok": True, "borradas": historial.vaciar()}


@app.get("/social/buscar/{search_id}/resumen", dependencies=[Depends(verify_api_token)])
async def social_buscar_resumen(search_id: str):
    cached = get_cached_result(search_id)
    if cached is not None:
        return {**cached, "id": search_id, "cached": True}
    raise HTTPException(status_code=404, detail="Resumen de búsqueda no encontrado o expirado.")
