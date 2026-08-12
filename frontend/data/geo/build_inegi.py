#!/usr/bin/env python3
"""
Convierte el Marco Geoestadístico del INEGI (entidad 04, Campeche) a GeoJSON
en WGS84.  Salidas en este mismo directorio.

    .venv/bin/python frontend/data/geo/build_inegi.py            # usa el ZIP cacheado
    .venv/bin/python frontend/data/geo/build_inegi.py --fetch    # re-descarga

Requiere el venv del repo (pyshp + pyproj):
    python3 -m venv .venv && .venv/bin/pip install pyshp pyproj

Dos cosas que hay que saber de este insumo:

1. Viene en Mexico ITRF2008 / LCC (EPSG:6372), en METROS.  Leaflet necesita
   lat/lon (EPSG:4326).  Sin reproyectar, los polígonos caen en el Atlántico.

2. Los shapefiles no distinguen anillo exterior de hueco por campo, sino por
   sentido de giro: horario = exterior, antihorario = hueco.  Hay que agrupar
   los anillos a mano; si se tratan todos como exteriores, las lagunas y los
   enclaves se pintan sólidos.
"""

import argparse
import io
import json
import pathlib
import sys
import urllib.request
import zipfile

try:
    import shapefile  # pyshp
    from pyproj import Transformer
except ImportError:
    sys.exit("Falta pyshp o pyproj. Corre:\n"
             "  python3 -m venv .venv && .venv/bin/pip install pyshp pyproj\n"
             "y ejecuta este script con .venv/bin/python")

AQUI = pathlib.Path(__file__).resolve().parent
CACHE = AQUI / ".cache_mg04.zip"

# Marco Geoestadístico 2024 (corte cartográfico agosto 2024), entidad 04.
# Edición >= 2021: incluye Dzitbalché y Seybaplaya, creados ese año.
URL = ("https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/"
       "espanol/bvinegi/productos/geografia/marcogeo/794551132173/04_campeche.zip")
FUENTE = "INEGI — Marco Geoestadístico 2024"
FECHA_CORTE = "2024-08"

# 5 decimales ≈ 1 m. Más que suficiente para un mapa estatal y recorta el
# archivo casi a la mitad frente a la precisión original.
DECIMALES = 5

# shp base -> (archivo de salida, nombre legible, campo de nombre, campos extra)
CAPAS = {
    "04mun":  ("municipios.geojson", "Municipios de Campeche", "NOMGEO", []),
    "04ent":  ("limite_estatal.geojson", "Límite estatal de Campeche", "NOMGEO", []),
    "04l":    ("localidades.geojson", "Localidades urbanas y rurales amanzanadas",
               "NOMGEO", ["AMBITO"]),
    "04a":    ("ageb_urbanas.geojson", "AGEB urbanas", None, ["CVE_AGEB", "CVE_LOC"]),
    "04ar":   ("ageb_rurales.geojson", "AGEB rurales", None, ["CVE_AGEB"]),
}

transformar = Transformer.from_crs("EPSG:6372", "EPSG:4326", always_xy=True)


def bajar() -> None:
    print(f"Descargando {URL}")
    with urllib.request.urlopen(URL, timeout=600) as r:
        CACHE.write_bytes(r.read())
    print(f"  -> {CACHE} ({CACHE.stat().st_size / 1e6:.1f} MB)")


def area_firmada(anillo) -> float:
    """Positiva = antihorario. En un shapefile eso significa hueco."""
    s = 0.0
    for (x1, y1), (x2, y2) in zip(anillo, anillo[1:]):
        s += x1 * y2 - x2 * y1
    return s / 2


def a_wgs84(anillo):
    lons, lats = transformar.transform([p[0] for p in anillo], [p[1] for p in anillo])
    return [[round(lon, DECIMALES), round(lat, DECIMALES)] for lon, lat in zip(lons, lats)]


def geometria(shape):
    """Agrupa los anillos del shapefile en Polygon o MultiPolygon."""
    cortes = list(shape.parts) + [len(shape.points)]
    anillos = [shape.points[cortes[i]:cortes[i + 1]] for i in range(len(cortes) - 1)]

    poligonos = []
    for anillo in anillos:
        if len(anillo) < 4:
            continue
        if anillo[0] != anillo[-1]:
            anillo = list(anillo) + [anillo[0]]
        convertido = a_wgs84(anillo)
        # Antihorario en el shapefile = hueco del polígono anterior.
        # GeoJSON (RFC 7946) pide exterior antihorario y huecos horarios,
        # así que en ambos casos se invierte el sentido.
        if area_firmada(anillo) > 0 and poligonos:
            poligonos[-1].append(convertido[::-1])
        else:
            poligonos.append([convertido[::-1]])

    if not poligonos:
        return None
    if len(poligonos) == 1:
        return {"type": "Polygon", "coordinates": poligonos[0]}
    return {"type": "MultiPolygon", "coordinates": [[a for a in p] for p in poligonos]}


def convertir(zf: zipfile.ZipFile, base: str) -> dict:
    salida, titulo, campo_nombre, extras = CAPAS[base]

    partes = {}
    for ext in ("shp", "dbf", "shx"):
        nombre = f"conjunto_de_datos/{base}.{ext}"
        partes[ext] = io.BytesIO(zf.read(nombre))

    lector = shapefile.Reader(shp=partes["shp"], dbf=partes["dbf"], shx=partes["shx"],
                              encoding="latin-1")
    campos = [f[0] for f in lector.fields[1:]]

    features = []
    for shape, registro in zip(lector.shapes(), lector.records()):
        r = dict(zip(campos, registro))
        geom = geometria(shape) if shape.shapeType != shapefile.NULL else None
        if geom is None:
            print(f"  aviso: {base} {r.get('CVEGEO')} sin geometría, se omite")
            continue

        props = {
            "cvegeo": r.get("CVEGEO"),
            "cve_ent": r.get("CVE_ENT"),
            "fuente": FUENTE,
            "fecha_corte": FECHA_CORTE,
        }
        if "CVE_MUN" in r:
            props["cve_mun"] = f"{r['CVE_ENT']}{r['CVE_MUN']}"
        if campo_nombre:
            props["nombre"] = r.get(campo_nombre)
        for extra in extras:
            props[extra.lower()] = r.get(extra)

        features.append({"type": "Feature", "properties": props, "geometry": geom})

    return {
        "type": "FeatureCollection",
        "metadata": {
            "nombre": titulo,
            "fuente": FUENTE,
            "fecha_corte": FECHA_CORTE,
            "crs_origen": "EPSG:6372 (Mexico ITRF2008 / LCC)",
            "total": len(features),
        },
        "features": features,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="re-descarga el ZIP del INEGI")
    args = ap.parse_args()

    if args.fetch or not CACHE.exists():
        bajar()

    with zipfile.ZipFile(CACHE) as zf:
        for base in CAPAS:
            datos = convertir(zf, base)
            ruta = AQUI / CAPAS[base][0]
            ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
            print(f"{CAPAS[base][0]}: {datos['metadata']['total']} features, "
                  f"{ruta.stat().st_size / 1e6:.2f} MB")

    # El universo municipal manda: si no son 13, la edición está vieja.
    municipios = json.loads((AQUI / "municipios.geojson").read_text())
    n = municipios["metadata"]["total"]
    if n != 13:
        sys.exit(f"\nERROR: {n} municipios, se esperaban 13. "
                 "Campeche pasó de 11 a 13 en 2021 (Dzitbalché y Seybaplaya). "
                 "Estás usando una edición anterior del Marco Geoestadístico.")
    print(f"\nOK — {n} municipios, edición {FECHA_CORTE}")


if __name__ == "__main__":
    main()
