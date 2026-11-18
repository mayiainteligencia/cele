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
import re
import threading
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
from social import periodo as periodo_mod
from social import referentes
from social import quesesabe
from social import persona as persona_mod
from social import plataformas as plataformas_mod
from social import analisis, coincidencia, entidades, historial, lexico, llm, monitoreo, radar
from social.identidad import puntaje_identidad, verificar_con_gemini, verificar_lote
from social.pipeline import descarte_registro, get_pysentimiento_analyzer, parse_iso_datetime, process_facebook_posts

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
    plataformas: List[str] = Field(default_factory=lambda: ['facebook'])
    dias: Optional[int] = None         # periodo: últimos N días (0 = todo el historial); sin dato usa MAX_POST_DAYS
    desde: Optional[str] = None        # rango personalizado YYYY-MM-DD
    hasta: Optional[str] = None
    entidad_id: Optional[str] = None   # ficha opcional: da usuarios y hashtags por plataforma


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
        "periodo": periodo_mod.resolver(),
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


@app.get("/social/estimado", dependencies=[Depends(verify_api_token)])
async def social_estimado(plataformas: str = "facebook", modo: str = "tema", dias: Optional[int] = None, desde: Optional[str] = None, hasta: Optional[str] = None):
    """Costo máximo estimado por plataforma y total, para la confirmación previa a buscar. Con periodo largo avisa que el tope no cambia."""
    return plataformas_mod.estimado(plataformas.split(","), modo, periodo_mod.resolver(dias, desde, hasta))


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
    plats = plataformas_mod.normalizar(req.plataformas)
    periodo = periodo_mod.resolver(req.dias, req.desde, req.hasta)
    sufijo = ("" if plats == ["facebook"] else ":" + ",".join(sorted(plats))) + ("" if periodo_mod.es_por_defecto(periodo) else ":p=" + periodo["etiqueta"])   # los ids de solo Facebook y 14 días no cambian
    query_id = build_query_id(tema, f"{modo}:{fuente_cfg}:{'cacheonly' if cache_only else 'normal'}{sufijo}", alcance_dict)
    ficha = entidades.obtener(req.entidad_id) if req.entidad_id else None

    try:
        run = plataformas_mod.ejecutar(tema, modo, alcance_dict, plats, ficha=ficha, refrescar=req.refrescar, before_call=check_and_record_real_search_quota, periodo=periodo)
        items = run["items"]
        fetched = run.get("fetched") or {}
        origen = run["origen"] if len(plats) > 1 or "facebook" not in plats else (fetched.get("origen") or fetched.get("source") or fuente_cfg)
        sin_datos_demo = bool(fetched.get("sin_datos_demo")) and plats == ["facebook"]
        mensaje = fetched.get("mensaje")

        resumen = process_facebook_posts(
            raw_mapped_posts=items,
            tema=tema,
            modo=modo,
            alcance=alcance_dict,
            source_type=origen,
            sin_datos_demo=sin_datos_demo,
            mensaje=mensaje,
            posts_fuente=len(items) if len(plats) > 1 or "facebook" not in plats else fetched.get("posts_fuente"),
            ref_time_iso=fetched.get("ref_time_iso"),
            ficha=ficha,
            periodo=periodo,
        )
        resumen["id"] = query_id
        resumen["origen"] = origen
        resumen["fuente_configurada"] = fuente_cfg
        resumen["plataformas_solicitadas"] = plats
        resumen["plataformas"] = plataformas_mod.completar_estados(run["estados"], resumen)
        resumen["costo_estimado_usd"] = round(sum(e["costo_usd"] for e in run["estados"].values()), 4)
        resumen["queries_ejecutadas"] = fetched.get("queries", [])
        if fetched.get("query_exacta"):
            resumen["query_exacta"] = fetched["query_exacta"]
        if fetched.get("queries_enviadas"):
            resumen["queries_enviadas"] = fetched["queries_enviadas"]
        if fetched.get("error"):
            resumen["warning"] = fetched["error"]

        _adjuntar_conocimiento(resumen)
        set_cached_result(query_id, resumen)
        historial.guardar(resumen, tema, modo, alcance_dict)
        _alertar_contenido_antiguo(resumen, ficha)
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
    logros_verificables: str = ""
    apodo: str = ""
    usuario_x: str = ""
    usuario_tiktok: str = ""
    usuario_instagram: str = ""
    hashtags_x: List[str] = []
    hashtags_tiktok: List[str] = []
    hashtags_instagram: List[str] = []
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


class MedirRequest(BaseModel):
    nombre: str
    confirmar: bool = False


class RadarRequest(BaseModel):
    confirmar: bool = False
    refrescar: bool = False
    incluir_referentes: bool = True


class PerfilesRequest(BaseModel):
    nombre: str = Field(default="")


class AnalizarPersonaRequest(BaseModel):
    nombre: str = Field(default="")
    pagina_url: str = Field(default="")
    pagina_nombre: str = Field(default="")
    entidad_id: Optional[str] = None
    alcance: Optional[AlcancePayload] = None
    refrescar: bool = False
    plataformas: List[str] = Field(default_factory=lambda: ['facebook'])
    dias: Optional[int] = None
    desde: Optional[str] = None
    hasta: Optional[str] = None


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
    """Modo Persona: qué dicen los demás de la persona, en su territorio. Busca menciones de terceros en las plataformas marcadas;
    la página oficial (pagina_url) es opcional y solo sirve para identificar y separar lo que publica la propia persona."""
    nombre, url = (req.nombre or "").strip(), (req.pagina_url or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Escribe el nombre de la persona.")
    ficha = entidades.obtener(req.entidad_id) if req.entidad_id else None
    if req.entidad_id and not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada.")
    plats = plataformas_mod.normalizar(req.plataformas)
    periodo = periodo_mod.resolver(req.dias, req.desde, req.hasta)
    alcance = req.alcance.model_dump() if req.alcance else persona_mod.alcance_de_ficha(ficha)   # el territorio de la ficha es el alcance por defecto
    pagina_nombre = (req.pagina_nombre or "").strip()

    # 1) Menciones de terceros en todas las plataformas marcadas (cada una registra su estado)
    run = plataformas_mod.ejecutar(nombre, "persona", alcance, plats, ficha=ficha, refrescar=req.refrescar, before_call=check_and_record_real_search_quota, periodo=periodo)
    items = list(run["items"])
    estados = run["estados"]
    # 2) Opcional: publicaciones de la página elegida
    paginas = persona_mod.publicaciones_pagina([url, *((ficha or {}).get("paginas_oficiales") or [])] if url else [], pagina_nombre, req.refrescar, check_and_record_real_search_quota)
    vistos = {i.get("url") for i in items if i.get("url")}
    items += [p for p in paginas if p.get("url") not in vistos]

    # 3) Lo que publica la propia persona o sus cuentas se separa; no entra a las cifras de opinión
    propios, terceros = [], []
    for it in items:
        (propios if persona_mod.es_propia(it, ficha, url, pagina_nombre) else terceros).append(it)
    for it in propios:
        it["origen_post"] = "publicado_por_persona"
    for it in terceros:
        it["origen_post"] = "mencion"
    variantes = persona_mod.contar_variantes(items, nombre, ficha)

    con_texto = [p for p in terceros if (p.get("text") or "").strip()]
    sin_texto = [p for p in terceros if not (p.get("text") or "").strip()]
    detalle: List[Dict[str, Any]] = []
    por_confirmar: List[Dict[str, Any]] = []

    # 4) Coincidencia con puntaje (sin Gemini): sin coincidencia se descarta; débil va a 'Por confirmar'
    pasaron: List[Dict[str, Any]] = []
    for p in con_texto:
        c = coincidencia.puntuar(p, nombre, "persona", ficha)
        p = {**p, "coincidencia": {**c, "umbral": coincidencia.umbral()}}
        if coincidencia.pasa(c):
            pasaron.append(p)
        elif c["puntaje"] > 0:
            por_confirmar.append(p)
        else:
            detalle.append(descarte_registro(p, "no contiene el tema"))

    # 5) Atribución de identidad: puntaje con la ficha y es_la_persona por lote con Gemini. Solo "si" entra a las cifras.
    bajo_umbral, no_es = 0, 0
    if ficha:
        umbral = int(os.getenv("IDENTIDAD_UMBRAL", "40") or 40)
        candidatos = []
        for p in pasaron:
            score, razones = puntaje_identidad(p, ficha)
            if score < umbral:
                bajo_umbral += 1
                detalle.append(descarte_registro(p, "otro", f"identidad baja ({score} de 100): {'; '.join(razones) or 'sin señales de la ficha'}"))
            else:
                candidatos.append((p, score, razones))
        veredictos = verificar_lote([c[0] for c in candidatos], ficha)
        aceptados = []
        for (p, score, razones), v in zip(candidatos, veredictos):
            p["atribucion"] = {"puntaje": score, "razones": razones, "es_la_persona": v["es_la_persona"], "razon_ia": v["razon"]}
            if v["es_la_persona"] == "si":
                aceptados.append(p)
            elif v["es_la_persona"] == "incierto":
                por_confirmar.append(p)
            else:
                no_es += 1
                detalle.append(descarte_registro(p, "otro", f"no es la persona: {v['razon']}"))
    else:   # sin ficha no hay con qué distinguir homónimos: entra por coincidencia de nombre y se avisa
        aceptados = pasaron
        for p in aceptados:
            p["atribucion"] = {"puntaje": p["coincidencia"]["puntaje"], "razones": ["Coincidencia de nombre; sin ficha"], "es_la_persona": "si", "razon_ia": ""}

    origen = run["origen"]
    resumen = process_facebook_posts(
        raw_mapped_posts=aceptados, tema=nombre, modo="persona", alcance=alcance,
        source_type=origen, posts_fuente=len(items), ficha=ficha, periodo=periodo,
    )
    resumen["id"] = build_query_id(f"{nombre}|{url}|{','.join(sorted(plats))}" + ("" if periodo_mod.es_por_defecto(periodo) else f"|{periodo['etiqueta']}"), "persona:menciones", alcance or {})
    resumen["origen"] = origen
    resumen["posts_filtro_tema"] = len(pasaron)
    resumen["plataformas_solicitadas"] = plats
    resumen["costo_estimado_usd"] = round(sum(e["costo_usd"] for e in estados.values()), 4)
    resumen["descartados"]["vacios"] = len(sin_texto)
    resumen["descartados"]["por_filtro_tema"] = sum(1 for d in detalle if d["motivo"] == "no contiene el tema")
    resumen["descartados"]["por_identidad"] = bajo_umbral
    resumen["descartados"]["no_es_la_persona"] = no_es
    resumen["descartados_detalle"] = detalle + resumen.get("descartados_detalle", [])
    resumen["por_confirmar"] = por_confirmar + resumen.get("por_confirmar", [])
    resumen["plataformas"] = plataformas_mod.completar_estados(estados, resumen)
    if ficha:
        resumen["ficha"] = {"id": ficha["id"], "nombre": ficha["nombre"]}
    resumen["variantes_buscadas"] = variantes
    resumen["alcance_usado"] = alcance
    if not ficha or not (ficha.get("cargo") or (ficha.get("territorio") or {}).get("nombre")):
        resumen["aviso_ficha"] = "Completa la ficha para distinguirlo de homónimos"
    n_rel = resumen["relevantes_posts"]
    if n_rel < 5:
        resumen["aviso_menciones"] = f"Pocas menciones en el periodo ({n_rel}). Prueba con un periodo más largo o con variantes del nombre"
    resumen["lugares_mencion"] = persona_mod.lugares_mencionados(resumen["posts_recientes"], alcance)
    resumen["opinion"] = persona_mod.opinion(resumen)
    _adjuntar_conocimiento(resumen)

    # Publicado por la persona: separado de las cifras de opinión; página inactiva si lo último tiene más de 30 días
    fechas_pag = [d for d in (parse_iso_datetime(p.get("time", "")) for p in propios if p.get("plataforma", "facebook") == "facebook") if d]
    ultima = max(fechas_pag) if fechas_pag else None
    dias_sin = (datetime.now(timezone.utc) - ultima).days if ultima else None
    dsd, dhh = periodo_mod.ventana(periodo, datetime.now(timezone.utc))
    en_periodo = [p for p in propios if (lambda d: d is None or ((not dsd or d >= dsd) and (not dhh or d <= dhh)))(parse_iso_datetime(p.get("time", "")))]
    resumen["publicado_por_persona"] = {
        "total": len(propios), "en_periodo": len(en_periodo),
        "posts": [{"autor": (p.get("user") or {}).get("name"), "plataforma": p.get("plataforma", "facebook"), "fecha": p.get("time"), "url": p.get("url"),
                   "fragmento": re.sub(r"\s+", " ", p.get("text") or "")[:200], "interacciones": persona_mod._interacciones(p)} for p in sorted(en_periodo, key=persona_mod._interacciones, reverse=True)[:15]]}
    print(f"[persona] crudos={len(items)} propios={len(propios)} terceros={len(terceros)} sin_texto={len(sin_texto)} pasaron_coincidencia={len(pasaron)} "
          f"por_confirmar={len(resumen['por_confirmar'])} relevantes={n_rel} variantes={[(v['variante'], v['posts']) for v in variantes]}")
    for d in detalle:
        print(f"[persona]   -> Descartado [{d['autor']}] {d['url']}: {d['motivo']}{' (' + d['nota'] + ')' if d['nota'] else ''}")
    resumen["persona"] = {
        "ultima_publicacion": ultima.isoformat() if ultima else None,
        "inactiva": bool(dias_sin is not None and dias_sin > 30),
        "dias_sin_publicar": dias_sin,
        "pagina_url": url,
        "pagina_nombre": pagina_nombre,
        "publicados": len(propios),
        "menciones": len(resumen["posts_recientes"]),
    }
    resumen["sin_texto"] = {
        "total": len(sin_texto),
        "publicados": 0,
        "menciones": len(sin_texto),
        "posts": [{"url": p.get("url"), "user": p["user"]["name"], "time": p.get("time"), "origen_post": p.get("origen_post"), "plataforma": p.get("plataforma", "facebook")} for p in sin_texto],
    }
    historial.guardar(resumen, nombre, "persona", alcance)
    _alertar_contenido_antiguo(resumen, ficha)
    return {**resumen, "cached": origen == "cache"}


@app.get("/persona/comentarios/{hid}/estimado", dependencies=[Depends(verify_api_token)])
async def persona_comentarios_estimado(hid: str):
    return persona_mod.estimado_comentarios(_entrada(hid)["resumen"])


class ComentariosRequest(BaseModel):
    confirmar: bool = False
    refrescar: bool = False


@app.post("/persona/comentarios/{hid}", dependencies=[Depends(verify_api_token)])
async def persona_comentarios(hid: str, req: ComentariosRequest):
    """Extrae comentarios (Facebook) y respuestas (X) de los posts de terceros con más interacción. Requiere confirmar=true; ya extraídos no se repiten."""
    e = _entrada(hid)
    r = e["resumen"]
    if (r.get("comentarios") or {}).get("items") and not req.refrescar:
        return r["comentarios"]
    if not req.confirmar:
        raise HTTPException(status_code=400, detail="Confirma el consumo estimado antes de extraer comentarios.")
    com = persona_mod.extraer_comentarios(r, check_and_record_real_search_quota, req.refrescar)
    historial.anexar(hid, "comentarios", com)
    r["comentarios"] = com
    historial.anexar(hid, "opinion", persona_mod.opinion(r))
    _adjuntar_conocimiento(r)
    historial.anexar(hid, "que_se_sabe", r["que_se_sabe"])
    historial.anexar(hid, "muestra", r["muestra"])
    historial.anexar(hid, "palabras", lexico.palabras(r))   # las cifras de palabras y temas se recalculan con los comentarios
    historial.anexar(hid, "temas", {})
    return com


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


def _adjuntar_conocimiento(resumen: Dict[str, Any]) -> None:
    """«Qué se sabe hoy» y la confianza de la muestra: calculado en código, sin IA, con los posts del periodo."""
    resumen["que_se_sabe"] = quesesabe.calcular(resumen)
    resumen["muestra"] = resumen["que_se_sabe"]["confianza"]


def _alertar_contenido_antiguo(resumen: Dict[str, Any], ficha: Optional[Dict[str, Any]]) -> None:
    try:
        monitoreo.alertas_contenido_antiguo(resumen, ficha)
    except Exception as exc:   # una alerta que falla nunca debe romper la búsqueda
        print(f"[alertas] No se pudo evaluar el contenido antiguo: {exc}")


def _entrada(hid: str) -> Dict[str, Any]:
    e = historial.obtener(hid)
    if e is None:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada en el historial.")
    return e


def _ficha_de(e: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    fid = (e["resumen"].get("ficha") or {}).get("id")
    return entidades.obtener(fid) if fid else None


@app.post("/que-se-sabe/{hid}", dependencies=[Depends(verify_api_token)])
async def que_se_sabe(hid: str):
    """Panel «Qué se sabe hoy» para una búsqueda guardada (también las anteriores a este panel). Solo código: sin IA ni créditos."""
    e = _entrada(hid)
    _adjuntar_conocimiento(e["resumen"])
    historial.anexar(hid, "que_se_sabe", e["resumen"]["que_se_sabe"])
    historial.anexar(hid, "muestra", e["resumen"]["muestra"])
    return e["resumen"]["que_se_sabe"]


@app.post("/palabras/{hid}", dependencies=[Depends(verify_api_token)])
async def palabras_calcular(hid: str):
    """Palabras positivas/negativas con el léxico local: sin IA ni créditos. Se guarda en el historial."""
    e = _entrada(hid)
    r = lexico.palabras(e["resumen"])
    historial.anexar(hid, "palabras", r)
    return r


@app.post("/temas/{hid}", dependencies=[Depends(verify_api_token)])
async def temas_calcular(hid: str):
    """Temas y tipos de mensaje: 1 petición a Gemini. Si ya existen, no se repite."""
    e = _entrada(hid)
    if e["resumen"].get("temas") and (e["resumen"]["temas"] or {}).get("temas"):
        return e["resumen"]["temas"]
    r = lexico.temas(e["resumen"])
    if r.get("temas"):
        historial.anexar(hid, "temas", r)
    return {**r, "ia": llm.info_sesion()}


@app.get("/analisis/{hid}/estimado", dependencies=[Depends(verify_api_token)])
async def analisis_estimado(hid: str):
    return analisis.estimado(_entrada(hid)["resumen"])


@app.get("/ia/estado", dependencies=[Depends(verify_api_token)])
async def ia_estado():
    return {"modelos": llm.estado_modelos(), "agotados": llm.todos_agotados(True), "mensaje": llm.mensaje_cuota(True) if llm.todos_agotados(True) else None}


@app.get("/ia/diagnostico", dependencies=[Depends(verify_api_token)])
def ia_diagnostico():
    """Una llamada real mínima por modelo: resultado o error exacto."""
    return {"modelos": llm.diagnostico()}


@app.post("/ia/reintentar", dependencies=[Depends(verify_api_token)])
async def ia_reintentar():
    """Ignora las esperas de los modelos: la siguiente petición prueba cada uno una vez."""
    llm.reintentar_ahora()
    return {"modelos": llm.estado_modelos()}


@app.post("/analisis/{hid}", dependencies=[Depends(verify_api_token)])
async def analisis_generar(hid: str):
    """Solo al presionar 'Generar análisis'. Si ya existe uno guardado, lo devuelve sin llamar a Gemini."""
    e = _entrada(hid)
    if (e["resumen"].get("analisis") or {}).get("estado") == "ok":
        return e["resumen"]["analisis"]
    r = analisis.generar(e["resumen"], _ficha_de(e))
    if r.get("estado") == "ok":
        historial.anexar(hid, "analisis", r)
    return r


@app.get("/radar/{hid}/estimado", dependencies=[Depends(verify_api_token)])
async def radar_estimado(hid: str, incluir_referentes: bool = True):
    e = _entrada(hid)
    return radar.estimado(e, _ficha_de(e), incluir_referentes)


def _fila_radar(e: Dict[str, Any], nombre: str):
    rd = e["resumen"].get("radar") or {}
    fila = next((f for f in rd.get("medidos", []) if f["nombre"] == nombre and f.get("estado_medicion") != "medido"), None)
    if rd.get("version") != 4 or fila is None:
        raise HTTPException(status_code=404, detail="Esa cuenta no está como «Sugerido, sin medir» en el radar guardado.")
    return rd, fila


@app.get("/radar/{hid}/medir/estimado", dependencies=[Depends(verify_api_token)])
async def radar_medir_estimado(hid: str, nombre: str):
    return radar.estimado_medir(_fila_radar(_entrada(hid), nombre)[1])


@app.post("/radar/{hid}/medir", dependencies=[Depends(verify_api_token)])
async def radar_medir(hid: str, req: MedirRequest):
    """Mide solo la cuenta indicada (confirmar=true tras mostrar el costo) y la integra al puntaje del radar guardado."""
    e = _entrada(hid)
    rd, fila = _fila_radar(e, req.nombre)
    if not req.confirmar:
        raise HTTPException(status_code=400, detail="Confirma el consumo estimado antes de medir.")
    ficha = _ficha_de(e)
    try:
        nueva = radar.medir_cuenta(fila, ficha, radar.terminos_lugar(e.get("alcance") or {}), check_and_record_real_search_quota)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    rd["medidos"] = [nueva if f is fila else f for f in rd["medidos"]]
    radar.reordenar(rd)
    historial.anexar(hid, "radar", rd)
    return rd


RADAR_JOBS: Dict[str, Dict[str, Any]] = {}


def _correr_radar(hid: str, e: Dict[str, Any], ficha: Optional[Dict[str, Any]], refrescar: bool, incluir: bool) -> None:
    prog = radar.Progreso()
    job = {"prog": prog, "estado": "corriendo", "radar": None, "error": None}
    RADAR_JOBS[hid] = job

    def run() -> None:
        rd = None
        try:
            rd = radar.generar(e, ficha, before_call=check_and_record_real_search_quota, refrescar=refrescar, incluir_referentes=incluir, progreso=prog)
            job["estado"] = "listo"
        except radar.Cancelado:
            rd = prog.parcial
            job["estado"] = "cancelado"
            if rd:
                rd["estado"] = "parcial"
                rd["avisos"] = [*rd.get("avisos", []), "Generación cancelada: se muestra lo obtenido hasta ahora"]
        except Exception as exc:
            print(f"[radar] falló: {exc}")
            rd = prog.parcial
            job["estado"], job["error"] = "error", str(getattr(exc, "detail", exc))
            if rd:
                rd["estado"] = "parcial"
                rd["avisos"] = [*rd.get("avisos", []), f"El radar se detuvo: {job['error']}; se muestra lo obtenido"]
        if rd:
            historial.anexar(hid, "radar", rd)
        job["radar"] = rd

    threading.Thread(target=run, daemon=True).start()


@app.post("/radar/{hid}", dependencies=[Depends(verify_api_token)])
async def radar_generar(hid: str, req: RadarRequest):
    """Inicia la generación del radar en segundo plano (progreso en GET /radar/{hid}/progreso). Requiere confirmar=true. Un radar guardado no se repite salvo refrescar."""
    e = _entrada(hid)
    if not req.confirmar:
        raise HTTPException(status_code=400, detail="Confirma el consumo estimado antes de generar el radar.")
    guardado = e["resumen"].get("radar") or {}
    if guardado.get("version") == 4 and guardado.get("estado") == "ok" and not req.refrescar:
        return {"estado": "listo", "radar": guardado}
    if (RADAR_JOBS.get(hid) or {}).get("estado") == "corriendo":
        return {"estado": "corriendo"}
    _correr_radar(hid, e, _ficha_de(e), req.refrescar, req.incluir_referentes)
    return {"estado": "corriendo"}


@app.get("/radar/{hid}/progreso", dependencies=[Depends(verify_api_token)])
async def radar_progreso(hid: str):
    job = RADAR_JOBS.get(hid)
    if job is None:
        guardado = (historial.obtener(hid) or {}).get("resumen", {}).get("radar")
        return {"estado": "listo" if guardado else "sin_trabajo", "radar": guardado}
    p = job["prog"]
    return {"estado": job["estado"], "etapa": p.etapa, "i": p.i, "n": p.n, "filas_parciales": len((p.parcial or {}).get("medidos", [])),
            "radar": job["radar"] if job["estado"] != "corriendo" else None, "error": job["error"]}


@app.post("/radar/{hid}/cancelar", dependencies=[Depends(verify_api_token)])
async def radar_cancelar(hid: str):
    job = RADAR_JOBS.get(hid)
    if job and job["estado"] == "corriendo":
        job["prog"].cancelado.set()
    return {"ok": True}


@app.post("/radar/{hid}/formatos", dependencies=[Depends(verify_api_token)])
async def radar_formatos(hid: str):
    """«Sugerir formatos»: borradores a partir de los patrones medidos de contenido; se guardan en el radar."""
    e = _entrada(hid)
    rd = e["resumen"].get("radar") or {}
    if rd.get("version") != 4 or not rd.get("contenido"):
        raise HTTPException(status_code=404, detail="Primero genera el radar con referentes.")
    r = referentes.borrador_formatos(rd["contenido"], _ficha_de(e))
    if r.get("estado") == "ok":
        rd["formatos"] = r
        historial.anexar(hid, "radar", rd)
    return r


@app.get("/social/buscar/{search_id}/resumen", dependencies=[Depends(verify_api_token)])
async def social_buscar_resumen(search_id: str):
    cached = get_cached_result(search_id)
    if cached is not None:
        return {**cached, "id": search_id, "cached": True}
    raise HTTPException(status_code=404, detail="Resumen de búsqueda no encontrado o expirado.")
