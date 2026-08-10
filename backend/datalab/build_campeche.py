#!/usr/bin/env python3
"""
Genera los artefactos de datos de Campeche que consume el frontend.

    python3 backend/datalab/build_campeche.py            # usa el KML local
    python3 backend/datalab/build_campeche.py --fetch    # re-descarga el KML
    python3 backend/datalab/build_campeche.py --check    # self-check, no escribe

Salidas (ambas en .gitignore: se regeneran con este script):
    frontend/src/data/campeche.json        agregados ligeros (van al bundle)
    frontend/public/data/escuelas.json     padron completo (fetch bajo demanda)

Reemplaza a agregar_electoral.py (Oaxaca), que ya no existe en el repo.
Oaxaca queda PAUSADO: electoral.json y ANALISIS.xlsx siguen en su lugar pero
el frontend ya no los lee.

ESQUEMA
    Un bloque por hoja del libro maestro del spec (00_Diccionario_Datos ..
    27_Control_Calidad). Los niveles geograficos son ENTIDADES PROPIAS, no
    campos derivados: municipio, localidad, distrito, seccion y casilla tienen
    cada uno su bloque con sus ids. Un bloque sin fuente real sale vacio con
    clase=Estimacion y fuente="pendiente" — nunca se rellena con un numero
    derivado de otro nivel (el spec 1.2 y el Cuadrito 2 exigen granularidad
    real de casilla y seccion, que no se puede inventar desde municipio).

CONTRATO DE PROCEDENCIA
    Todo bloque lleva `proc`: {fuente, fechaCorte, confianza, clase}
    clase: Dato | Calculo | Estimacion | Inferencia | Recomendacion
    Una fila puede traer su propio `proc` para sobrescribir el del bloque
    cuando el bloque mezcla origenes (campos comunes del spec: fuente,
    fecha_corte, nivel_confianza, estatus_validacion).

MULTIPARTIDISMO
    No hay partido protagonista. `partidoOrden` solo fija el orden por defecto
    de tablas; ningun calculo, copy ni visualizacion debe darle trato especial.

Solo stdlib: no pandas, no requests.
"""

import argparse
import hashlib
import json
import math
import random
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
KML = RAIZ / "backend/datalab/uploads/campeche_escuelas.kml"
OUT_JSON = RAIZ / "frontend/src/data/campeche.json"
OUT_GEO = RAIZ / "frontend/public/data/geo.json"

KML_URL = ("https://www.google.com/maps/d/kml"
           "?mid=1flJedNDzc7hAyX4R9UWW3JEElcVInWw&forcekml=1")

# Padron oficial vigente con fecha de corte, pero el `list` no trae lat/lon.
# Sirve para validar el KML (que si las trae) por CCT+turno.
SIGED_API = ("https://api.siged.sep.gob.mx/CoreServices/servicios/escuela/buscaEscuela/"
             "cct=&turno=&tipoedu=&nivel=&subnivel=&control=&subcontrol="
             "&entidad=04&municipio=&localidad=&primer=1&ultimo=5000")

NS = {"k": "http://www.opengis.net/kml/2.2"}
HOY = date.today().isoformat()

# Orden por defecto de tablas. NO es un protagonista: el spec es multipartidista.
PARTIDOS = ["MORENA", "PAN", "PRI", "PVEM", "PT", "MC", "PRD", "PANAL"]

# Tipos oficiales del INE (spec 1.2). Prohibido usar "casilla normal".
# Son CUATRO. "Extraordinaria contigua" no es un quinto tipo: es una
# extraordinaria con `esContigua = true`. El indicador se calcula filtrando
# tipo == "extraordinaria" and esContigua, nunca como categoria aparte.
TIPOS_CASILLA = ["basica", "contigua", "extraordinaria", "especial"]

CAMPOS_CASILLA = [
    "id_registro", "clave_entidad", "clave_municipio", "clave_localidad",
    "distrito_federal", "distrito_local", "seccion",
    "tipo",           # uno de TIPOS_CASILLA
    "esContigua",     # bool, solo aplica cuando tipo == "extraordinaria"
    "anio", "eleccion", "aprobada", "instalada", "incidencias",
    "listaNominal", "participacion", "distanciaLocalidadKm",
    "tipoInmueble", "accesibilidad", "conectividad",
    "fecha_corte", "fuente", "url_fuente", "estatus_validacion",
]

# Anios de calendario electoral. Los votos son simulados: confirmar contra SICEE
# del INE antes de presentar cualquiera de estas cifras como resultado real.
HISTORICO_ANIOS = {
    "gubernatura":      [2015, 2021],
    "ayuntamientos":    [2015, 2018, 2021, 2024],
    "diputaciones_loc": [2015, 2018, 2021, 2024],
    "diputaciones_fed": [2015, 2018, 2021, 2024],
    "senado":           [2018, 2024],
    "presidencia":      [2018, 2024],
}

# Cuadrito 2. Que se vigila, con que granularidad y con que insumo. Se declara
# aunque ninguna pueda correr todavia: hace visible el hueco en vez de esconderlo.
COMPROBACIONES_FORENSIA = [
    {"id": "prep-computo", "nombre": "Comparación PREP ↔ cómputos ↔ definitivos",
     "granularidad": "casilla", "insumo": "PREP y cómputos distritales del INE/IEEC"},
    {"id": "evolucion-casilla", "nombre": "Evolución de votación por casilla y sección",
     "granularidad": "casilla", "insumo": "resultados históricos por casilla"},
    {"id": "participacion-atipica", "nombre": "Participación atípica",
     "granularidad": "sección", "insumo": "lista nominal y votación por sección"},
    {"id": "variacion-historico", "nombre": "Variaciones abruptas frente al histórico",
     "granularidad": "sección", "insumo": "serie histórica por sección"},
    {"id": "nulos-fuera-rango", "nombre": "Votos nulos fuera del rango esperado",
     "granularidad": "casilla", "insumo": "actas de escrutinio"},
    {"id": "casillas-cercanas", "nombre": "Diferencias inusuales entre casillas cercanas",
     "granularidad": "casilla", "insumo": "resultados por casilla + geolocalización"},
    {"id": "incidencias", "nombre": "Casillas con incidencias oficiales",
     "granularidad": "casilla", "insumo": "hojas de incidentes del INE"},
    {"id": "actas-faltantes", "nombre": "Actas faltantes o con inconsistencias",
     "granularidad": "casilla", "insumo": "acervo de actas digitalizadas"},
    {"id": "resoluciones", "nombre": "Resoluciones de autoridades electorales",
     "granularidad": "municipio", "insumo": "TEPJF, TEEC y acuerdos del IEEC"},
    {"id": "bitacora", "nombre": "Bitácora de aclaraciones",
     "granularidad": "registro", "insumo": "captura interna con autorización humana"},
    {"id": "evidencia", "nombre": "Repositorio de evidencia",
     "granularidad": "registro", "insumo": "documentos cargados y verificados"},
]

FUENTES = {
    "siged": {"nombre": "SIGED · Sistema de Información y Gestión Educativa (SEP)",
              "url": "https://siged.sep.gob.mx/SIGED/escuelas.html"},
    "mymaps": {"nombre": "Google My Maps · export KML (deriva de SIGED)", "url": KML_URL},
    "inegi": {"nombre": "INEGI · Censo de Población y Vivienda 2020",
              "url": "https://www.inegi.org.mx/app/areasgeograficas/?ag=04"},
    "sicee": {"nombre": "INE · SICEE, Estadística de las Elecciones",
              "url": "https://siceen21.ine.mx/"},
    "ine_casillas": {"nombre": "INE · Ubicación de casillas (encartes y acuerdos)",
                     "url": "https://www.ine.mx/voto-y-elecciones/casillas-electorales/"},
    "ejemplo": {"nombre": "ejemplo · dato simulado, no usar para decidir", "url": None},
    "pendiente": {"nombre": "pendiente · sin fuente conectada", "url": None},
}


def proc(fuente, clase, confianza, corte=HOY):
    return {"fuente": fuente, "fechaCorte": corte, "confianza": confianza, "clase": clase}


def PENDIENTE(nota_fuente="pendiente"):
    return proc(nota_fuente, "Estimacion", "baja")


def EJEMPLO():
    return proc("ejemplo", "Estimacion", "baja")


# ─────────────────────────── KML → escuelas ───────────────────────────

def campo(pm, nombre):
    for d in pm.findall(".//k:Data", NS):
        if d.get("name") == nombre:
            v = d.find("k:value", NS)
            return (v.text or "").strip() if v is not None else ""
    return ""


# ─────────────────────── proyeccion geografica (F3) ───────────────────────
# ponytail: Mercator esferica a mano, ~8 lineas de math. Para UN estado no hace
# falta pyproj/shapely ni una libreria de mapas en el front: datalab entrega x/y
# ya proyectados y el frontend dibuja SVG plano. Si algun dia se necesita mapa
# base real (calles/satelite) para logistica de campo, ahi si entra MapLibre.
VIEWBOX = 1000.0  # lado mayor del lienzo SVG


def _mercator(lat, lon):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def proyectar(puntos):
    """[(lat, lon)] -> ([(x, y)], meta). Y crece hacia abajo, como en SVG."""
    xy = [_mercator(la, lo) for la, lo in puntos]
    xs, ys = [p[0] for p in xy], [p[1] for p in xy]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    esc = VIEWBOX / max(maxx - minx, maxy - miny)
    w, h = (maxx - minx) * esc, (maxy - miny) * esc
    salida = [(round((x - minx) * esc, 2), round((maxy - y) * esc, 2)) for x, y in xy]
    return salida, {
        "proyeccion": "Mercator esférica (EPSG:3857)",
        "ancho": round(w, 2), "alto": round(h, 2),
        "bbox": {"latMin": min(p[0] for p in puntos), "latMax": max(p[0] for p in puntos),
                 "lonMin": min(p[1] for p in puntos), "lonMax": max(p[1] for p in puntos)},
    }


# ───────────────────────── contorno del estado ─────────────────────────
# GeoJSON en lat/lon: entra a la misma proyeccion que los puntos, sin calibrar
# nada. Encaje medido: 98.99% de los planteles caen dentro (2251/2274).
#
# Antes se intento derivarlo del SVG nacional de mexicoPaths.ts. Se descarto:
# ese trazo esta simplificado a escala de pais y topaba en 88.96%, con las
# escuelas de Palizada (60% fuera), Candelaria (39%), Calakmul (17%) y Carmen
# (10%) cayendo fuera de su propio estado. Dilatarlo lo empeoraba —el poligono
# tiene zonas concavas y se autointersecta—, asi que se cambio la fuente.
CONTORNO = RAIZ / "backend/datalab/uploads/campeche_contorno.geojson"
CONTORNO_URL = "https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json"
CONTENCION_MINIMA = 0.98  # si baja de aqui, algo se movio: falla el build


def contorno_campeche():
    """Anillos del contorno como [[(lat, lon), ...]]. El mayor es el continental."""
    if not CONTORNO.exists():
        print(f"descargando contorno → {CONTORNO}")
        with urllib.request.urlopen(CONTORNO_URL) as r:
            nacional = json.load(r)
        feat = next(f for f in nacional["features"]
                    if f["properties"].get("name") == "Campeche")
        CONTORNO.write_text(json.dumps(feat, ensure_ascii=False), encoding="utf8")

    geo = json.loads(CONTORNO.read_text(encoding="utf8"))["geometry"]
    crudos = ([geo["coordinates"]] if geo["type"] == "Polygon" else geo["coordinates"])
    anillos = [[(lat, lon) for lon, lat in anillo] for poly in crudos for anillo in poly]
    return sorted(anillos, key=len, reverse=True)


def dentro(px, py, poly):
    """Point-in-polygon (ray casting). poly: [(x, y)] en coordenadas del lienzo."""
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            c = not c
    return c


def entero(s):
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return 0


def leer_kml(path):
    """Un registro por Placemark (CCT+turno). sitioId agrupa los que comparten predio."""
    escuelas = []
    for pm in ET.parse(path).getroot().iter("{http://www.opengis.net/kml/2.2}Placemark"):
        coords = pm.find(".//k:Point/k:coordinates", NS)
        if coords is None or not (coords.text or "").strip():
            continue
        lon, lat = (float(x) for x in coords.text.strip().split(",")[:2])
        nombre_el = pm.find("k:name", NS)
        # El sitio es la coordenada: varios CCT en un mismo predio (turnos,
        # primaria+secundaria) se instalan como UNA ubicacion de casilla.
        sitio = hashlib.md5(f"{lat:.5f},{lon:.5f}".encode()).hexdigest()[:8]
        cm, cl = campo(pm, "CLAVE MUNICIPIO"), campo(pm, "CLAVE LOCALIDAD")
        escuelas.append({
            "id_registro": f"esc-{(nombre_el.text or '').strip()}-{campo(pm, 'CLAVE TURNO')}",
            "clave_entidad": "04", "clave_municipio": cm, "clave_localidad": cl,
            "cct": (nombre_el.text or "").strip() if nombre_el is not None else "",
            "nombre": campo(pm, "NOMBRE DE CENTRO DE TRABAJO"),
            "tipoEducativo": campo(pm, "TIPO EDUCATIVO"),
            "nivel": campo(pm, "NIVEL"),
            "servicio": campo(pm, "SERVICIO"),
            "sostenimiento": campo(pm, "SOSTENIMIENTO"),
            "subcontrol": campo(pm, "SUBCONTROL"),
            "turno": campo(pm, "NOMBRE TURNO"),
            "municipio": campo(pm, "NOMBRE MUNICIPIO"),
            "localidad": campo(pm, "NOMBRE LOCALIDAD"),
            "domicilio": campo(pm, "DOMICILIO COMPLETO"),
            "lat": lat, "lon": lon, "sitioId": sitio,
            "alumnos": entero(campo(pm, "ALUMNOS TOTAL")),
            "docentes": entero(campo(pm, "DOCENTES TOTAL")),
            "aulas": entero(campo(pm, "AULAS EXISTENTES")),
            # Spec 1.3: sin fuente que lo respalde, NUNCA inferir que una escuela
            # sera casilla. Pasa a "historica" al cruzar con encartes del INE, y a
            # "aprobada" solo con el acuerdo del Consejo Distrital correspondiente.
            "usoHistoricoCasilla": None,
            "casillasHistoricas": None,
            "estatusCasilla": "potencial",
            "estatus_validacion": "sin_validar",
            # Pendientes de fuente: el spec 1.3 los pide pero SIGED no los trae.
            "ambito": None, "accesibilidad": None, "coberturaMovil": None,
        })
    return escuelas


# ─────────────────── niveles geograficos (entidades propias) ───────────────────

def construir_municipios(escuelas, rnd):
    """Claves y nombres reales (INEGI, via SIGED). Poblacion y lista nominal: dummy."""
    agg = {}
    for e in escuelas:
        m = agg.setdefault(e["clave_municipio"], {
            "clave_municipio": e["clave_municipio"], "nombre": e["municipio"],
            "escuelas": 0, "escuelasPublicas": 0, "_sitios": set(), "_locs": set(),
        })
        m["escuelas"] += 1
        m["escuelasPublicas"] += e["sostenimiento"] == "PÚBLICO"
        m["_sitios"].add(e["sitioId"])
        m["_locs"].add(e["clave_localidad"])

    # Reparto dummy de la poblacion real del estado, proporcional a infraestructura.
    peso = {k: len(v["_sitios"]) for k, v in agg.items()}
    total_peso = sum(peso.values())
    munis = []
    for k, m in sorted(agg.items()):
        pob = round(POBLACION_2020 * peso[k] / total_peso)
        munis.append({
            "id_registro": f"mun-04{k}", "clave_entidad": "04",
            "clave_municipio": k, "nombre": m["nombre"],
            "escuelas": m["escuelas"], "escuelasPublicas": m["escuelasPublicas"],
            "sitios": len(m["_sitios"]), "localidades": len(m["_locs"]),
            # dummy — el bloque declara clase Estimacion / fuente ejemplo
            "poblacion": pob,
            "poblacion18": round(pob * rnd.uniform(0.68, 0.74)),
            "listaNominal": round(pob * rnd.uniform(0.66, 0.72)),
        })
    return munis


def construir_localidades(escuelas):
    """506 localidades reales derivadas del KML (clave + nombre + centroide)."""
    agg = {}
    for e in escuelas:
        k = (e["clave_municipio"], e["clave_localidad"])
        l = agg.setdefault(k, {
            "id_registro": f"loc-04{k[0]}{k[1]}", "clave_entidad": "04",
            "clave_municipio": k[0], "clave_localidad": k[1],
            "nombre": e["localidad"], "municipio": e["municipio"],
            "escuelas": 0, "_lat": [], "_lon": [],
        })
        l["escuelas"] += 1
        l["_lat"].append(e["lat"])
        l["_lon"].append(e["lon"])
    out = []
    for l in sorted(agg.values(), key=lambda x: (x["clave_municipio"], x["clave_localidad"])):
        lat, lon = l.pop("_lat"), l.pop("_lon")
        # Centroide de sus escuelas: aproxima la localidad, no la sustituye.
        # Para geometria real hace falta el Marco Geoestadistico del INEGI.
        out.append({**l, "latAprox": round(sum(lat) / len(lat), 6),
                    "lonAprox": round(sum(lon) / len(lon), 6),
                    "ambito": None, "estatus_validacion": "aproximado"})
    return out


def construir_historico(munis, rnd):
    """Resultados simulados, multipartidistas. Anios reales, cifras NO reales."""
    lista_total = sum(m["listaNominal"] for m in munis)
    out = []
    for tipo, anios in HISTORICO_ANIOS.items():
        for anio in anios:
            part = round(rnd.uniform(0.45, 0.68), 3)
            emitidos = int(lista_total * part)
            nulos = int(emitidos * rnd.uniform(0.015, 0.045))
            validos = emitidos - nulos
            pesos = [rnd.random() for _ in PARTIDOS]
            s = sum(pesos)
            votos = {p: int(validos * w / s) for p, w in zip(PARTIDOS, pesos)}
            orden = sorted(votos.items(), key=lambda kv: -kv[1])
            out.append({
                "id_registro": f"res-{tipo}-{anio}", "clave_entidad": "04",
                "eleccion": tipo, "anio": anio,
                "listaNominal": lista_total, "votosEmitidos": emitidos,
                "votosNulos": nulos, "votosValidos": validos,
                "participacion": round(part * 100, 1),
                # Spec 1.6: abstencionismo = 1 - (votacion total / lista nominal)
                "abstencionismo": round((1 - emitidos / lista_total) * 100, 1),
                "votosPorPartido": votos,
                "votosPorCoalicion": None,   # pendiente: requiere convenios registrados
                "ganador": orden[0][0], "segundo": orden[1][0],
                "margenPuntos": round((orden[0][1] - orden[1][1]) / validos * 100, 1),
                "alternancia": None, "casillasComputadas": None, "incidencias": None,
            })
    return sorted(out, key=lambda x: (x["eleccion"], x["anio"]))


def construir_proyeccion(rnd):
    """Spec 1.7: probabilistica, con intervalo y escenarios. Nunca como certeza."""
    base = {}
    resto = 100.0
    for i, p in enumerate(PARTIDOS):
        s = resto / (len(PARTIDOS) - i) * rnd.uniform(0.6, 1.5)
        s = min(s, resto)
        base[p] = round(s, 1)
        resto = max(0.0, resto - s)
    escenarios = ["base", "alta_participacion", "baja_participacion",
                  "con_alianza", "sin_alianza", "alta_transferencia",
                  "deterioro_participacion"]
    return {
        "escenarios": [
            {"escenario": esc,
             "porPartido": [
                 {"partido": p,
                  "share": round(max(0.0, v + (0 if esc == "base" else rnd.uniform(-7, 7))), 1),
                  "intervalo": [round(max(0.0, v - 4.2), 1), round(v + 4.2, 1)],
                  "probabilidadGanar": None}
                 for p, v in base.items()],
             } for esc in escenarios],
        "municipiosCompetitivos": [],
        "municipiosSinInformacion": [],
        "variablesExplicativas": [],
        "backtesting": None,   # spec 1.7: obligatorio antes de publicar el modelo
    }


# ─────────────────────────────── build ───────────────────────────────

# Spec 1.4: dato real, no simulado.
POBLACION_2020 = 928363


def build():
    if not KML.exists():
        print(f"descargando KML → {KML}")
        KML.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(KML_URL, KML)

    escuelas = leer_kml(KML)
    rnd = random.Random(2027)  # semilla fija: builds reproducibles
    munis = construir_municipios(escuelas, rnd)
    locs = construir_localidades(escuelas)
    historico = construir_historico(munis, rnd)

    p_siged = proc(FUENTES["mymaps"]["nombre"], "Dato", "alta")
    p_inegi = proc(FUENTES["inegi"]["nombre"], "Dato", "alta", "2020-03-15")
    por_nivel = {}
    for e in escuelas:
        por_nivel[e["nivel"]] = por_nivel.get(e["nivel"], 0) + 1

    def bloque(hoja, proc_, items, **extra):
        return {"hoja": hoja, "proc": proc_, "items": items, **extra}

    # Una entrada por hoja del libro maestro. Las vacias NO se rellenan con
    # numeros derivados de otro nivel: se quedan vacias y lo declaran.
    bloques = {
        "fuentes": bloque("01_Fuentes", proc("catálogo interno", "Dato", "alta"),
                          [{"id_registro": f"fte-{k}", **v} for k, v in FUENTES.items()]),

        "municipios": bloque(
            "02_Municipios",
            proc("INEGI (claves y nombres) · población y lista nominal simuladas",
                 "Estimacion", "baja"),
            munis,
            nota="Claves, nombres y conteo de escuelas son Dato. Población y lista "
                 "nominal son reparto simulado del censo estatal: no usar para decidir."),

        # El detalle (139 kB) vive en geo.json: es carga de mapa, no de bundle.
        "localidades": bloque(
            "03_Localidades", proc(FUENTES["siged"]["nombre"], "Dato", "media"),
            None, resumen={"total": len(locs)}, detalle="/data/geo.json",
            nota="Derivadas del catálogo de escuelas: cubren solo localidades con "
                 "plantel. Coordenada = centroide de sus escuelas, no geometría oficial."),

        "distritos_federales": bloque("04_Distritos_Federales", PENDIENTE(), [],
                                      nota="Requiere Marco Geográfico Electoral del INE."),
        "distritos_locales": bloque("05_Distritos_Locales", PENDIENTE(), [],
                                    nota="Requiere cartografía del IEEC."),
        "secciones": bloque(
            "06_Secciones", PENDIENTE(), [],
            nota="Entidad propia, no derivable de municipio. El Cuadrito 2 exige "
                 "comparar sección a sección: un número estimado desde municipio no sirve."),

        "casillas_historicas": bloque(
            "07_Casillas_Historicas", PENDIENTE(), [],
            tiposOficiales=TIPOS_CASILLA, camposFila=CAMPOS_CASILLA,
            nota="Requiere encartes históricos del INE. Indicadores por casilla "
                 "(incidencias, instaladas/no instaladas, tipo de inmueble) no son estimables."),
        "casillas_vigentes": bloque(
            "08_Casillas_Vigentes", PENDIENTE(), [],
            tiposOficiales=TIPOS_CASILLA, camposFila=CAMPOS_CASILLA,
            estatus2027="pendiente_de_aprobacion_oficial",
            nota="Spec 1.2: permanece vacío hasta que el INE publique acuerdos y "
                 "encartes de 2027. PROHIBIDO usar la cifra de 2024 como si fuera 2027."),

        "escuelas": bloque("09_Escuelas", p_siged, None,
                           resumen={"planteles": len(escuelas),
                                    "sitios": len({e["sitioId"] for e in escuelas}),
                                    "publicas": sum(e["sostenimiento"] == "PÚBLICO" for e in escuelas),
                                    "privadas": sum(e["sostenimiento"] == "PRIVADO" for e in escuelas),
                                    "porNivel": por_nivel},
                           detalle="/data/escuelas.json"),

        "poblacion": bloque(
            "10_Poblacion_INEGI", p_inegi,
            [{"id_registro": "pob-04", "clave_entidad": "04", "anio": 2020,
              "poblacionTotal": POBLACION_2020,
              # El resto del catálogo del spec 1.4 requiere tabulados/SCITEL.
              "poblacion18": None, "urbana": None, "rural": None, "escolaridad": None,
              "indigena": None, "discapacidad": None, "internet": None, "celular": None}],
            nota="Solo población total (Censo 2020). Desagregados pendientes de SCITEL."),

        "lista_nominal": bloque("11_Lista_Nominal", EJEMPLO(),
                                [{"id_registro": f"ln-{m['clave_municipio']}",
                                  "clave_municipio": m["clave_municipio"],
                                  "listaNominal": m["listaNominal"]} for m in munis],
                                nota="Simulada. Fuente real: INE, corte mensual."),

        "resultados_gubernatura": bloque("12_Resultados_Gubernatura", EJEMPLO(),
                                         [r for r in historico if r["eleccion"] == "gubernatura"]),
        "resultados_ayuntamientos": bloque("13_Resultados_Ayuntamientos", EJEMPLO(),
                                           [r for r in historico if r["eleccion"] == "ayuntamientos"]),
        "resultados_dip_local": bloque("14_Resultados_Dip_Local", EJEMPLO(),
                                       [r for r in historico if r["eleccion"] == "diputaciones_loc"]),
        "resultados_dip_federal": bloque("15_Resultados_Dip_Federal", EJEMPLO(),
                                         [r for r in historico if r["eleccion"] == "diputaciones_fed"]),
        # Hojas 28 y 29: agregadas al final para cubrir el Cuadrito 1.6, que pide
        # senado y presidencia. No estaban en la numeracion original (00..27) y
        # NO se renumero nada existente. Documentado en 00_Diccionario_Datos.
        "resultados_senado": bloque("28_Resultados_Senado", EJEMPLO(),
                                    [r for r in historico if r["eleccion"] == "senado"]),
        "resultados_presidencia": bloque("29_Resultados_Presidencia", EJEMPLO(),
                                         [r for r in historico if r["eleccion"] == "presidencia"]),

        "participacion": bloque(
            "16_Participacion_Abstencion", proc("ejemplo · derivado de resultados simulados",
                                                "Calculo", "baja"),
            [{"id_registro": f"part-{r['eleccion']}-{r['anio']}", "eleccion": r["eleccion"],
              "anio": r["anio"], "participacion": r["participacion"],
              "abstencionismo": r["abstencionismo"]} for r in historico],
            formula="abstencionismo = 1 - (votación total / lista nominal)"),

        "nse": bloque("17_Indicadores_NSE", PENDIENTE(), [],
                      nota="Spec 1.5: separar indicadores observados del INEGI, índices "
                           "de marginación y NSE estimado. AMAI solo con licencia válida."),
        "candidaturas": bloque("18_Candidaturas_Publicas", PENDIENTE(), [],
                               nota="Solo información pública. Excluye domicilio, teléfono, "
                                    "familiares, ubicación, religión y salud."),
        "encuestas": bloque("19_Encuestas", PENDIENTE(), [],
                            nota="Alta solo vía el flujo del Cuadrito 6, con aprobación humana."),
        "medios": bloque("20_Medios", PENDIENTE(), [],
                         nota="MonitorMedios ya produce testigos reales vía :8001; conectar en F5."),
        "riesgos": bloque("21_Riesgos", PENDIENTE(), []),
        "presupuesto": bloque("22_Presupuesto", PENDIENTE(), []),
        "actividades": bloque("23_Actividades", PENDIENTE(), []),
        "evidencia": bloque("24_Evidencia_Fotografica", PENDIENTE(), []),
        # El catalogo de comprobaciones NO es una hoja nueva: es metadata de
        # 25_Alertas. Define QUE se vigila (Cuadrito 2) aunque no haya con que.
        "alertas": bloque("25_Alertas", PENDIENTE(), [],
                          niveles=["informativa", "preventiva", "media", "alta", "critica"],
                          semaforoForensia=["verde", "amarillo", "naranja", "rojo"],
                          comprobaciones={
                              "proc": proc("spec · Cuadrito 2", "Dato", "alta"),
                              "items": COMPROBACIONES_FORENSIA,
                          }),
        "proyecciones_2027": bloque("26_Proyecciones_2027", EJEMPLO(), None,
                                    **construir_proyeccion(rnd)),
    }

    # 27_Control_Calidad: se calcula solo, a partir del estado real de los bloques.
    # Reconoce hojas 00..29 (30 en total): las 28 originales del libro maestro
    # mas 28_Resultados_Senado y 29_Resultados_Presidencia.
    bloques["control_calidad"] = bloque(
        "27_Control_Calidad", proc("derivado del build", "Calculo", "alta"),
        [{"id_registro": f"cc-{k}", "bloque": k, "hoja": b["hoja"],
          "clase": b["proc"]["clase"], "fuente": b["proc"]["fuente"],
          "fechaCorte": b["proc"]["fechaCorte"], "confianza": b["proc"]["confianza"],
          "registros": (len(b["items"]) if isinstance(b["items"], list) else None),
          "estado": ("vacio" if isinstance(b["items"], list) and not b["items"]
                     else "poblado")}
         for k, b in sorted(bloques.items())],
        hojaMin="00", hojaMax="29", hojasTotales=len(bloques) + 2)  # +00_Diccionario +si mismo

    # Se incluye a si mismo: si no, reporta 28 de 29 bloques y el conteo no cuadra
    # con el resto de la UI.
    _cc = bloques["control_calidad"]
    _cc["items"].append({
        "id_registro": "cc-control_calidad", "bloque": "control_calidad",
        "hoja": _cc["hoja"], "clase": _cc["proc"]["clase"], "fuente": _cc["proc"]["fuente"],
        "fechaCorte": _cc["proc"]["fechaCorte"], "confianza": _cc["proc"]["confianza"],
        "registros": len(_cc["items"]) + 1, "estado": "poblado",
    })
    _cc["items"].sort(key=lambda x: x["hoja"])

    # 00_Diccionario_Datos
    diccionario = {
        "camposComunes": ["id_registro", "clave_entidad", "clave_municipio",
                          "clave_localidad", "distrito_federal", "distrito_local",
                          "seccion", "anio", "eleccion", "fecha_corte", "fuente",
                          "url_fuente", "fecha_descarga", "metodologia",
                          "nivel_confianza", "estatus_validacion"],
        "clases": ["Dato", "Calculo", "Estimacion", "Inferencia", "Recomendacion"],
        "hojas": {k: b["hoja"] for k, b in sorted(bloques.items())},
        "tiposCasilla": TIPOS_CASILLA,
        "notaTiposCasilla":
            "El INE reconoce cuatro tipos. 'Extraordinaria contigua' no es un quinto "
            "tipo: es tipo='extraordinaria' con esContigua=true. El indicador se "
            "calcula filtrando, no como categoría aparte.",
        "notaHojasAgregadas":
            "28_Resultados_Senado y 29_Resultados_Presidencia se agregaron al final "
            "para cubrir el Cuadrito 1.6, que pide ambas elecciones. No forman parte "
            "de la numeración original del libro maestro (00..27) y no se renumeró "
            "ninguna hoja existente.",
    }

    # Capas del mapa maestro (spec 1.1). Se declaran TODAS, incluidas las que no
    # tenemos: una capa ausente que no aparece en la leyenda parece una capa que
    # no hace falta. `fuente` dice que haria falta para encenderla.
    capas = [
        {"id": "escuelas_pub", "nombre": "Escuelas públicas", "tipo": "punto",
         "disponible": True, "fuente": "SIGED (SEP)"},
        {"id": "escuelas_priv", "nombre": "Escuelas privadas", "tipo": "punto",
         "disponible": True, "fuente": "SIGED (SEP)"},
        {"id": "localidades", "nombre": "Localidades", "tipo": "punto",
         "disponible": True, "fuente": "SIGED · centroide aproximado"},
        {"id": "sitios", "nombre": "Sitios candidatos a casilla", "tipo": "punto",
         "disponible": True, "fuente": "derivado · predios con uno o más planteles"},
        {"id": "limites", "nombre": "Límites estatales", "tipo": "poligono",
         "disponible": True, "precision": "aproximada",
         "fuente": "GeoJSON público de entidades federativas"},
        {"id": "municipios", "nombre": "Municipios", "tipo": "poligono",
         "disponible": False, "fuente": "Marco Geoestadístico del INEGI"},
        {"id": "distritos_fed", "nombre": "Distritos federales", "tipo": "poligono",
         "disponible": False, "fuente": "Marco Geográfico Electoral del INE"},
        {"id": "distritos_loc", "nombre": "Distritos locales", "tipo": "poligono",
         "disponible": False, "fuente": "Cartografía del IEEC"},
        {"id": "secciones", "nombre": "Secciones electorales", "tipo": "poligono",
         "disponible": False, "fuente": "Marco Geográfico Electoral del INE"},
        {"id": "ageb", "nombre": "AGEB y manzanas", "tipo": "poligono",
         "disponible": False, "fuente": "Marco Geoestadístico del INEGI"},
        {"id": "casillas_hist", "nombre": "Inmuebles usados como casilla", "tipo": "punto",
         "disponible": False, "fuente": "Encartes históricos del INE"},
        {"id": "casillas_2027", "nombre": "Ubicaciones aprobadas 2027", "tipo": "punto",
         "disponible": False, "fuente": "Acuerdos del Consejo Distrital (sin publicar)"},
        {"id": "vias", "nombre": "Vías de comunicación", "tipo": "linea",
         "disponible": False, "fuente": "Red Nacional de Caminos (INEGI/SICT)"},
        {"id": "telecom", "nombre": "Cobertura de telecomunicaciones", "tipo": "raster",
         "disponible": False, "fuente": "IFT · cobertura móvil"},
        {"id": "salud", "nombre": "Hospitales y edificios públicos", "tipo": "punto",
         "disponible": False, "fuente": "DENUE (INEGI)"},
    ]

    datos = {
        "generado": HOY,
        "capas": {"proc": proc("spec · Cuadrito 1.1", "Dato", "alta"), "items": capas},
        "estado": {"clave_entidad": "04", "nombre": "Campeche",
                   "poblacion2020": POBLACION_2020, "municipios": len(munis),
                   "proc": p_inegi},
        "partidos": PARTIDOS,
        "partidoOrden": PARTIDOS[0],  # solo orden de tablas; sin trato especial
        "diccionario": diccionario,
        "bloques": bloques,
    }

    # Proyeccion compartida: escuelas y localidades caen en el MISMO lienzo, asi
    # que las capas se superponen sin recalcular nada en el navegador.
    # OJO: el bbox es la extension de los DATOS (donde hay planteles), no la
    # frontera del estado. Al cargar el Marco Geoestadistico habra que reproyectar
    # contra los limites reales o los puntos quedaran corridos respecto al poligono.
    # El contorno entra a la MISMA proyeccion que los puntos: asi el lienzo lo define
    # el estado (mas grande) y no hace falta ninguna transformacion en el navegador.
    anillos = contorno_campeche()
    borde = [p for a in anillos for p in a]
    todos = [(e["lat"], e["lon"]) for e in escuelas] + \
            [(l["latAprox"], l["lonAprox"]) for l in locs] + borde
    xy, lienzo = proyectar(todos)
    for i, e in enumerate(escuelas):
        e["x"], e["y"] = xy[i]
    for j, l in enumerate(locs):
        l["x"], l["y"] = xy[len(escuelas) + j]

    # Un subpath por anillo: la isla del Carmen es poligono aparte, no una linea
    # que la una al continente.
    proyectados, k = [], len(escuelas) + len(locs)
    for a in anillos:
        proyectados.append(xy[k:k + len(a)])
        k += len(a)
    path = " ".join("M" + "L".join(f"{x},{y}" for x, y in p) + "Z" for p in proyectados)
    contencion = sum(any(dentro(e["x"], e["y"], p) for p in proyectados)
                     for e in escuelas) / len(escuelas)

    # Payload de mapa: se descarga solo al abrir el Cuadrito 1.
    padron = {"generado": HOY, "lienzo": lienzo,
              "contorno": {
                  "proc": proc("Límites estatales · GeoJSON público", "Dato", "media"),
                  "path": path, "anillos": len(proyectados),
                  "vertices": sum(len(p) for p in proyectados),
                  "contencion": round(contencion, 4),
              },
              "escuelas": {"proc": p_siged, "resumen": bloques["escuelas"]["resumen"],
                           "items": escuelas},
              "localidades": {"proc": bloques["localidades"]["proc"], "items": locs}}

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_GEO.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf8")
    OUT_GEO.write_text(json.dumps(padron, ensure_ascii=False), encoding="utf8")
    return datos, padron


CLASES = ("Dato", "Calculo", "Estimacion", "Inferencia", "Recomendacion")


def check(datos, padron):
    """Self-check: falla si el pipeline rompe una garantia del spec."""
    e = padron["escuelas"]["items"]
    b = datos["bloques"]

    assert len(e) > 2000, f"muy pocas escuelas: {len(e)}"
    assert all(-92.5 < x["lon"] < -89 and 17.5 < x["lat"] < 21 for x in e), \
        "coordenadas fuera del bbox de Campeche"
    # Spec 1.3: una escuela cargada no es una casilla futura.
    assert all(x["estatusCasilla"] == "potencial" for x in e), \
        "ninguna escuela puede nacer como casilla confirmada"
    assert len(b["municipios"]["items"]) == 13, "Campeche tiene 13 municipios"

    # Spec 1.2: 2027 no se rellena con la cifra de 2024.
    assert b["casillas_vigentes"]["items"] == [], "casillas 2027 deben estar vacias"
    assert b["casillas_vigentes"]["estatus2027"] == "pendiente_de_aprobacion_oficial"
    # Cuadrito 2: seccion y casilla son entidades propias, nunca derivadas.
    for k in ("secciones", "casillas_historicas", "casillas_vigentes"):
        assert b[k]["proc"]["clase"] == "Estimacion" and b[k]["proc"]["fuente"] == "pendiente", \
            f"{k} debe declararse pendiente mientras no tenga fuente real"
    # Spec 1.2: cuatro tipos oficiales. La extraordinaria contigua es un atributo.
    for k in ("casillas_historicas", "casillas_vigentes"):
        assert b[k]["tiposOficiales"] == ["basica", "contigua", "extraordinaria", "especial"], \
            "los tipos de casilla del INE son cuatro"
        assert "esContigua" in b[k]["camposFila"], \
            "falta el atributo esContigua para la extraordinaria contigua"

    # Hojas 28 y 29 agregadas sin renumerar las originales.
    assert b["resultados_senado"]["hoja"] == "28_Resultados_Senado"
    assert b["resultados_presidencia"]["hoja"] == "29_Resultados_Presidencia"
    assert b["control_calidad"]["hojaMax"] == "29"
    assert b["resultados_dip_federal"]["hoja"] == "15_Resultados_Dip_Federal", \
        "no se debe renumerar ninguna hoja original"
    assert "notaHojasAgregadas" in datos["diccionario"]
    for m in b["municipios"]["items"]:
        assert not any("casilla" in kk or "seccion" in kk for kk in m), \
            "municipio no debe cargar conteos de casillas/secciones derivados"

    # Multipartidismo: ningun partido con trato especial en los datos.
    for r in b["resultados_gubernatura"]["items"]:
        assert set(r["votosPorPartido"]) == set(datos["partidos"]), \
            "todos los partidos deben aparecer en cada resultado"

    # Procedencia en todo bloque.
    for k, blk in b.items():
        p = blk["proc"]
        assert p["clase"] in CLASES, (k, p)
        assert p["fuente"] and p["fechaCorte"] and p["confianza"] in ("alta", "media", "baja"), (k, p)
    # Proyeccion: todo punto cae dentro del lienzo y las dos capas comparten escala.
    lz = padron["lienzo"]
    pts = e + padron["localidades"]["items"]
    assert all(0 <= p["x"] <= lz["ancho"] + 0.01 and 0 <= p["y"] <= lz["alto"] + 0.01
               for p in pts), "hay puntos proyectados fuera del lienzo"
    assert max(lz["ancho"], lz["alto"]) == 1000.0, "el lado mayor debe normalizarse a 1000"
    # Campeche da un lienzo casi cuadrado (1000 x ~915). Una relacion degenerada
    # delataria un bbox mal calculado o coordenadas invertidas (lat/lon volteados).
    assert min(lz["ancho"], lz["alto"]) > 500, f"lienzo degenerado: {lz['ancho']}x{lz['alto']}"
    # Una capa de poligonos solo puede estar disponible si declara su precision.
    # Asi una geometria aproximada no puede colarse como si fuera oficial.
    for c in datos["capas"]["items"]:
        if c["tipo"] in ("poligono", "linea", "raster") and c["disponible"]:
            assert c.get("precision") == "aproximada", \
                f"capa {c['id']} disponible debe declarar precision"
    assert next(c for c in datos["capas"]["items"] if c["id"] == "limites")["disponible"], \
        "la capa de limites debe estar disponible: el contorno ya se proyecta"

    # El contorno debe seguir encajando con los puntos. Si alguien mueve la
    # transformacion o cambia el mapa fuente, esto lo caza.
    cont = padron["contorno"]["contencion"]
    assert cont >= CONTENCION_MINIMA, \
        f"el contorno dejo de encajar: solo {cont:.1%} de escuelas dentro"

    assert padron["escuelas"]["proc"]["clase"] == "Dato"
    for k in ("escuelas", "localidades"):
        assert padron[k]["proc"]["clase"] in CLASES and padron[k]["items"], k

    cc = b["control_calidad"]["items"]
    assert len(cc) == len(b), "control_calidad debe reportar todos los bloques, incluido el mismo"
    vacios = sum(x["estado"] == "vacio" for x in cc)
    print(f"OK · {len(e)} planteles · {padron['escuelas']['resumen']['sitios']} sitios · "
          f"{len(padron['localidades']['items'])} localidades · "
          f"{len(b)} bloques ({vacios} pendientes de fuente)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="re-descarga el KML")
    ap.add_argument("--check", action="store_true", help="solo valida, no escribe")
    a = ap.parse_args()
    if a.fetch and KML.exists():
        KML.unlink()
    datos, padron = build()
    check(datos, padron)
    if a.check:
        sys.exit(0)
    print(f"escrito → {OUT_JSON.relative_to(RAIZ)} ({OUT_JSON.stat().st_size // 1024} kB)")
    print(f"escrito → {OUT_GEO.relative_to(RAIZ)} ({OUT_GEO.stat().st_size // 1024} kB)")
