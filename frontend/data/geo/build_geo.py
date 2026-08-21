#!/usr/bin/env python3
"""
Normaliza los insumos geoespaciales de Campeche a GeoJSON con propiedades
en snake_case.  Salidas en este mismo directorio.

    python3 frontend/data/geo/build_geo.py            # usa el KML cacheado
    python3 frontend/data/geo/build_geo.py --fetch    # re-descarga de My Maps

El límite estatal ya NO se genera aquí: lo produce build_inegi.py a partir del
Marco Geoestadístico, que es la fuente autoritativa. frontend/estados/campeche.geojson
quedó como insumo histórico sin uso.

Sobre el KMZ:
  frontend/estados/Campeche.kmz NO contiene puntos.  Es el stub de 351 bytes
  que Google My Maps entrega cuando no se marca "exportar a KML": adentro solo
  hay un <NetworkLink> al mapa publicado.  Los 2,274 puntos se bajan de esa URL
  con forcekml=1.  El KML crudo (7.8 MB) no se versiona; se re-descarga con
  --fetch.

Fuente de los puntos: catalogo de Centros de Trabajo (CCT) de la SEP, cargado
por el equipo a Google My Maps.  La fuente no declara fecha de corte.
"""

import argparse
import json
import pathlib
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

K = "{http://www.opengis.net/kml/2.2}"
AQUI = pathlib.Path(__file__).resolve().parent
ESTADOS = AQUI.parent.parent / "estados"
KML_CACHE = AQUI / ".cache_mymaps.kml"

FUENTE_ESCUELAS = "SEP — Catálogo de Centros de Trabajo (CCT), vía Google My Maps"

# Campo del KML -> (nombre snake_case, conversor)
CAMPOS = {
    "TIPO EDUCATIVO":              ("tipo_educativo", str),
    "NIVEL":                       ("nivel", str),
    "SUBCONTROL":                  ("subcontrol", str),
    "NOMBRE DE CENTRO DE TRABAJO": ("nombre_centro_trabajo", str),
    "CLAVE TURNO":                 ("clave_turno", int),
    "NOMBRE TURNO":                ("nombre_turno", str),
    "CLAVE ENTIDAD":               ("clave_entidad", str),
    "NOMBRE ENTIDAD":              ("nombre_entidad", str),
    "CLAVE MUNICIPIO":             ("clave_municipio", str),
    "NOMBRE MUNICIPIO":            ("nombre_municipio", str),
    "CLAVE LOCALIDAD":             ("clave_localidad", str),
    "NOMBRE LOCALIDAD":            ("nombre_localidad", str),
    "DOMICILIO COMPLETO":          ("domicilio_completo", str),
    "ALUMNOS TOTAL":               ("alumnos_total", int),
    "ALUMNOS HOMBRES":             ("alumnos_hombres", int),
    "ALUMNOS MUJERES":             ("alumnos_mujeres", int),
    "DOCENTES HOMBRES":            ("docentes_hombres", int),
    "DOCENTES MUJERES":            ("docentes_mujeres", int),
    "DOCENTES TOTAL":              ("docentes_total", int),
    "PERSONAL TOTAL":              ("personal_total", int),
    "AULAS EXISTENTES":            ("aulas_existentes", int),
    "AULAS EN USO":                ("aulas_en_uso", int),
    "SERVICIO":                    ("servicio", str),
    "SOSTENIMIENTO":               ("sostenimiento", str),
}
# LATITUD / LONGITUD se descartan de properties: ya viven en geometry.
DESCARTAR = {"LATITUD", "LONGITUD"}

# Caja envolvente de Campeche, para detectar coordenadas fuera de rango.
BBOX = (-92.5, 17.7, -89.0, 20.9)  # lon_min, lat_min, lon_max, lat_max

# Cabecera de cada municipio: el nombre de localidad tal como aparece en el
# catálogo CCT.  La coordenada NO se escribe a mano: se saca de la mediana de
# las escuelas de esa localidad, que forman un cúmulo apretado sobre la traza
# urbana.  La mediana (no el promedio) ignora la escuela suelta en las afueras.
#
# Ojo con Palizada y Calakmul: la localidad con MÁS escuelas de esos municipios
# no es la cabecera (El Juncal y Xpujil respectivamente compiten con ella), así
# que la cabecera se nombra explícitamente en vez de deducirla por conteo.
CABECERAS = {
    "04001": "CALKINÍ",
    "04002": "SAN FRANCISCO DE CAMPECHE",
    "04003": "CIUDAD DEL CARMEN",
    "04004": "CHAMPOTÓN",
    "04005": "HECELCHAKÁN",
    "04006": "HOPELCHÉN",
    "04007": "PALIZADA",
    "04008": "TENABO",
    "04009": "ESCÁRCEGA",
    "04010": "XPUJIL",
    "04011": "CANDELARIA",
    "04012": "SEYBAPLAYA",
    "04013": "DZITBALCHÉ",
}


def url_del_kmz() -> str:
    """Saca el href del NetworkLink que vive dentro del KMZ."""
    with zipfile.ZipFile(ESTADOS / "Campeche.kmz") as z:
        doc = z.read("doc.kml").decode("utf-8")
    href = re.search(r"<href>(.*?)</href>", doc, re.S)
    if not href:
        sys.exit("El KMZ no trae <NetworkLink>; revisa el archivo a mano.")
    return href.group(1).strip() + "&forcekml=1"


def bajar_kml() -> None:
    url = url_del_kmz()
    print(f"Descargando {url}")
    with urllib.request.urlopen(url, timeout=120) as r:
        KML_CACHE.write_bytes(r.read())
    print(f"  -> {KML_CACHE} ({KML_CACHE.stat().st_size / 1e6:.1f} MB)")


def entero(valor: str):
    """'1.0' -> 1 ; '' -> None. La fuente escribe los enteros como flotantes."""
    valor = (valor or "").strip()
    if not valor:
        return None
    try:
        return int(float(valor))
    except ValueError:
        return None


def construir_escuelas() -> dict:
    raiz = ET.parse(KML_CACHE).getroot()
    features, vistos, avisos = [], set(), []

    for carpeta in raiz.iter(K + "Folder"):
        capa = (carpeta.findtext(K + "name") or "").strip()
        for pm in carpeta.findall(K + "Placemark"):
            cct = (pm.findtext(K + "name") or "").strip()
            crudo = {
                d.get("name"): (d.findtext(K + "value") or "").strip()
                for d in pm.iter(K + "Data")
            }

            desconocidos = set(crudo) - set(CAMPOS) - DESCARTAR
            if desconocidos:
                avisos.append(f"{cct}: campos no mapeados {sorted(desconocidos)}")

            props = {"cct": cct}
            for origen, (destino, conv) in CAMPOS.items():
                bruto = crudo.get(origen, "")
                props[destino] = entero(bruto) if conv is int else (bruto or None)

            # Clave geoestadistica municipal INEGI: entidad + municipio.
            ent, mun = props.get("clave_entidad"), props.get("clave_municipio")
            props["cve_mun"] = f"{ent}{mun}" if ent and mun else None

            # Regla de producto: una escuela registrada NO es una casilla futura.
            # No hay insumo del INE todavia, asi que todas son "potencial".
            props["estatus_ubicacion"] = "potencial"
            props["capa_origen"] = capa
            props["fuente"] = FUENTE_ESCUELAS
            props["fecha_corte"] = None  # la fuente no la declara

            punto = pm.find(K + "Point")
            coords = (punto.findtext(K + "coordinates") or "").strip() if punto is not None else ""
            if not coords:
                avisos.append(f"{cct}: sin coordenadas, se omite")
                continue
            lon, lat = (round(float(v), 6) for v in coords.split(",")[:2])
            if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
                avisos.append(f"{cct}: coordenada fuera de Campeche ({lat}, {lon})")

            if cct in vistos:
                avisos.append(f"{cct}: CCT duplicado")
            vistos.add(cct)

            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            })

    for a in avisos[:20]:
        print("  aviso:", a)
    if len(avisos) > 20:
        print(f"  ... y {len(avisos) - 20} avisos más")

    return {
        "type": "FeatureCollection",
        "metadata": {
            "nombre": "Escuelas de Campeche (ubicaciones potenciales de casilla)",
            "fuente": FUENTE_ESCUELAS,
            "fecha_corte": None,
            "nota": "Ubicaciones POTENCIALES. Ninguna está aprobada como casilla "
                    "por el INE; eso requiere el encarte del proceso vigente.",
            "procedencia": "dato",
            "generado_por": "frontend/data/geo/build_geo.py",
            "total": len(features),
        },
        "features": features,
    }


def construir_cabeceras(escuelas: dict) -> dict:
    """Punto de anclaje de cada municipio, para el coloreado provisional.

    Es la cabecera municipal, no el centroide del municipio: mientras no haya
    polígonos del INEGI no existe un centroide real que calcular.
    """
    porloc = {}
    total_mun = {}
    for f in escuelas["features"]:
        p = f["properties"]
        cve, loc = p.get("cve_mun"), p.get("nombre_localidad")
        if not cve:
            continue
        total_mun[cve] = total_mun.get(cve, 0) + 1
        if loc == CABECERAS.get(cve):
            porloc.setdefault(cve, {"nombre": p["nombre_municipio"], "pts": []})
            porloc[cve]["pts"].append(f["geometry"]["coordinates"])

    faltan = set(total_mun) - set(porloc)
    if faltan:
        print(f"  aviso: sin escuelas en la cabecera de {sorted(faltan)}; "
              "revisa el nombre en CABECERAS")

    def mediana(vals):
        v = sorted(vals)
        n = len(v)
        return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2

    features = []
    for cve, d in sorted(porloc.items()):
        lon = round(mediana([c[0] for c in d["pts"]]), 6)
        lat = round(mediana([c[1] for c in d["pts"]]), 6)
        features.append({
            "type": "Feature",
            "properties": {
                "cve_mun": cve,
                "nombre_municipio": d["nombre"],
                "cabecera": CABECERAS[cve],
                "escuelas_en_cabecera": len(d["pts"]),
                "escuelas_en_municipio": total_mun[cve],
                "fuente": FUENTE_ESCUELAS,
                "fecha_corte": None,
            },
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        })

    return {
        "type": "FeatureCollection",
        "metadata": {
            "nombre": "Cabeceras municipales de Campeche",
            "fuente": FUENTE_ESCUELAS,
            "fecha_corte": None,
            "nota": "Coordenada = mediana de las escuelas de la localidad cabecera. "
                    "Punto de anclaje para el coloreado provisional; NO es el "
                    "centroide del municipio ni sustituye al polígono del INEGI.",
            # CÁLCULO, no dato: la SEP no publica una coordenada de cabecera.
            # Ésta la derivamos nosotros y por eso no se marca como dato.
            "procedencia": "calculo",
            "generado_por": "frontend/data/geo/build_geo.py",
            "total": len(features),
        },
        "features": features,
    }


def escribir(nombre: str, datos: dict) -> None:
    ruta = AQUI / nombre
    ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    print(f"{nombre}: {datos['metadata']['total']} features, "
          f"{ruta.stat().st_size / 1e6:.2f} MB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="re-descarga el KML de My Maps")
    args = ap.parse_args()

    if args.fetch or not KML_CACHE.exists():
        bajar_kml()

    escuelas = construir_escuelas()
    escribir("escuelas_campeche.geojson", escuelas)
    escribir("cabeceras_municipales.geojson", construir_cabeceras(escuelas))


if __name__ == "__main__":
    main()
