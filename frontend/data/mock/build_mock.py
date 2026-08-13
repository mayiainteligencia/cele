#!/usr/bin/env python3
"""
Genera los datos de DEMOSTRACIÓN del módulo territorial.

    python3 frontend/data/mock/build_mock.py     -> territorio.json

TODO lo que sale de aquí es SINTÉTICO.  No viene del INEGI, ni del INE, ni
del IEEC.  No sirve para decidir nada.  Cada bloque del JSON lleva
`procedencia: "simulado"` y la UI lo pinta con el badge rayado.

Lo único real es el esqueleto:
  * los 13 municipios y sus claves geoestadísticas (INEGI, verificado)
  * las cabeceras (build_geo.py)
  * los conteos de escuelas y alumnado por municipio (catálogo CCT de la SEP)

Los números simulados se derivan de esos agregados reales con una semilla
fija, así que son reproducibles y guardan proporciones creíbles entre
municipios: donde hay más escuelas hay más población, y de ahí sale la
lista nominal, las secciones y las casillas.

Cuando lleguen los insumos del INE, este archivo se borra y las vistas
apuntan al dato real sin tocar los componentes.
"""

import json
import pathlib
import random

AQUI = pathlib.Path(__file__).resolve().parent
GEO = AQUI.parent / "geo"
SEMILLA = 4  # clave de la entidad, para que quede memorable y fija

# Ancla de orden de magnitud para el total estatal.  Campeche ronda el millón
# de habitantes; el simulador reparte esta cifra entre los 13 municipios en
# proporción al alumnado CCT.  NO es el dato del censo: es el orden correcto
# para que la demo no muestre cifras imposibles.
ANCLA_POBLACION = 930_000

# Reparto nacional de partidos con presencia real en Campeche.  Las cifras
# que se les asignan abajo son inventadas; los nombres no.
PARTIDOS = ["MORENA", "PAN", "PRI", "PVEM", "PT", "MC", "PRD"]

# Nivel socioeconómico, cortes tipo AMAI.  La metodología AMAI real requiere
# licencia; esto es una distribución sintética con las mismas etiquetas.
NSE = ["A/B", "C+", "C", "C-", "D+", "D", "E"]


def leer_geo():
    esc = json.loads((GEO / "escuelas_campeche.geojson").read_text())
    cab = json.loads((GEO / "cabeceras_municipales.geojson").read_text())

    agregado = {}
    for f in esc["features"]:
        p = f["properties"]
        cve = p["cve_mun"]
        a = agregado.setdefault(cve, {"escuelas": 0, "alumnado": 0, "rurales": 0})
        a["escuelas"] += 1
        a["alumnado"] += p.get("alumnos_total") or 0
        # Proxy de ruralidad: planteles CONAFE y de servicio comunitario.
        if "CONAFE" in (p.get("servicio") or "") or "COMUNITARIO" in (p.get("nombre_centro_trabajo") or ""):
            a["rurales"] += 1

    for f in cab["features"]:
        p = f["properties"]
        agregado[p["cve_mun"]].update(nombre=p["nombre_municipio"], cabecera=p["cabecera"])

    return agregado


def casillas_ine(lista_nominal, secciones, ruralidad, rnd):
    """Aplica las reglas de integración de casillas del INE.

    Básica       una por sección.
    Contigua     una por cada 750 electores que exceden los primeros 750
                 de la sección.
    Extraordinaria  secciones cuyas condiciones de acceso lo justifican;
                 aquí se aproxima con el índice de ruralidad.
    Especial     para electores en tránsito, se fijan por distrito, no por
                 municipio: son pocas y se concentran en las ciudades.
    """
    basicas = secciones
    # Reparte la lista nominal entre las secciones con algo de dispersión
    # en vez de asumirlas todas iguales.
    contiguas = 0
    for _ in range(secciones):
        electores = max(100, int(rnd.gauss(lista_nominal / secciones, lista_nominal / secciones * 0.35)))
        contiguas += max(0, -(-electores // 750) - 1)  # techo de la división, menos la básica

    extraordinarias = int(secciones * ruralidad * 0.18)
    return {"basica": basicas, "contigua": contiguas, "extraordinaria": extraordinarias}


def historico(rnd, sesgo):
    """Tres procesos comparables con resultados sintéticos coherentes."""
    salida = []
    for anio, cargo in ((2018, "Presidencia municipal"),
                        (2021, "Presidencia municipal"),
                        (2024, "Presidencia municipal")):
        # El sesgo por municipio hace que un lugar no cambie de color cada
        # elección sin razón: da continuidad a la serie.
        pesos = []
        for i, _ in enumerate(PARTIDOS):
            base = [38, 24, 19, 7, 5, 5, 2][i]
            pesos.append(max(1.0, rnd.gauss(base + sesgo[i], 4)))
        total = sum(pesos)
        pct = sorted(((p, round(w / total * 100, 1)) for p, w in zip(PARTIDOS, pesos)),
                     key=lambda x: -x[1])

        participacion = round(rnd.uniform(48, 68), 1)
        salida.append({
            "anio": anio,
            "cargo": cargo,
            "ganador": pct[0][0],
            "pct_ganador": pct[0][1],
            "segundo": pct[1][0],
            "pct_segundo": pct[1][1],
            "margen": round(pct[0][1] - pct[1][1], 1),
            "participacion": participacion,
            "abstencionismo": round(100 - participacion, 1),
            "nulos": round(rnd.uniform(1.8, 5.4), 1),
            "por_partido": dict(pct),
        })
    return salida


def proyeccion(rnd, hist):
    """Proyección 2027 como distribución de probabilidad, nunca como punto.

    Devuelve probabilidad de victoria por partido, intervalo de confianza
    del porcentaje esperado, y cuatro escenarios.  La UI tiene prohibido
    mostrar el central sin el intervalo.
    """
    ultima = hist[-1]["por_partido"]
    filas = []
    for p in PARTIDOS:
        centro = ultima.get(p, 2) + rnd.gauss(0, 3)
        centro = max(0.5, centro)
        amplitud = rnd.uniform(3.5, 7.5)  # media amplitud del intervalo
        filas.append({
            "partido": p,
            "pct_central": round(centro, 1),
            "ic_bajo": round(max(0, centro - amplitud), 1),
            "ic_alto": round(centro + amplitud, 1),
        })

    # Probabilidad de victoria por softmax sobre el central: suma 100.
    total = sum(pow(2.718, f["pct_central"] / 6) for f in filas)
    for f in filas:
        f["prob_victoria"] = round(pow(2.718, f["pct_central"] / 6) / total * 100, 1)
    filas.sort(key=lambda f: -f["prob_victoria"])

    part_base = hist[-1]["participacion"]
    escenarios = {
        "base": {
            "etiqueta": "Base",
            "participacion": round(part_base, 1),
            "puntero": filas[0]["partido"],
            "margen": round(filas[0]["pct_central"] - filas[1]["pct_central"], 1),
        },
        "alta_participacion": {
            "etiqueta": "Alta participación",
            "participacion": round(min(85, part_base + rnd.uniform(6, 12)), 1),
            "puntero": filas[0]["partido"],
            "margen": round(filas[0]["pct_central"] - filas[1]["pct_central"] + rnd.uniform(-3, 4), 1),
        },
        "baja_participacion": {
            "etiqueta": "Baja participación",
            "participacion": round(max(28, part_base - rnd.uniform(6, 14)), 1),
            "puntero": filas[0]["partido"] if rnd.random() > 0.3 else filas[1]["partido"],
            "margen": round(abs(rnd.gauss(3, 2)), 1),
        },
        "con_alianza": {
            "etiqueta": "Con alianza opositora",
            "participacion": round(part_base, 1),
            "puntero": filas[0]["partido"] if rnd.random() > 0.45 else filas[1]["partido"],
            "margen": round(abs(rnd.gauss(2.5, 2)), 1),
        },
    }

    # Confianza: menos histórico util y menos margen -> menos confianza.
    margen = filas[0]["pct_central"] - filas[1]["pct_central"]
    confianza = "alta" if margen > 12 else "media" if margen > 5 else "baja"

    return {
        "partidos": filas,
        "escenarios": escenarios,
        "confianza": confianza,
        "informacion_insuficiente": margen < 2.5,
    }


def main():
    rnd = random.Random(SEMILLA)
    agregado = leer_geo()
    municipios = []

    # El alumnado da la FORMA del reparto entre municipios; el total lo fija
    # un ancla de orden de magnitud, para que la suma estatal no salga
    # disparatada.  Sin el ancla, el factor por municipio acumulaba una lista
    # nominal mayor que la población del estado.
    alumnado_total = sum(a["alumnado"] for a in agregado.values())
    factor = ANCLA_POBLACION / alumnado_total

    for cve in sorted(agregado):
        a = agregado[cve]
        ruralidad = min(0.85, a["rurales"] / max(1, a["escuelas"]))

        # Proporcional al alumnado, con ruido para que no se vea calcado.
        poblacion = int(a["alumnado"] * factor * rnd.uniform(0.88, 1.12))
        lista_nominal = int(poblacion * rnd.uniform(0.66, 0.72))
        secciones = max(3, round(lista_nominal / rnd.uniform(1000, 1250)))

        cas = casillas_ine(lista_nominal, secciones, ruralidad, rnd)

        # Distribución NSE: más rural, más peso en los deciles bajos.
        crudo = [max(0.5, rnd.gauss(m, 2)) for m in
                 (6 - 5 * ruralidad, 11 - 6 * ruralidad, 17, 20,
                  19 + 4 * ruralidad, 16 + 6 * ruralidad, 11 + 8 * ruralidad)]
        suma = sum(crudo)
        nse = {k: round(v / suma * 100, 1) for k, v in zip(NSE, crudo)}

        sesgo = [rnd.gauss(0, 7) for _ in PARTIDOS]
        hist = historico(rnd, sesgo)

        municipios.append({
            "cve_mun": cve,
            "nombre": a["nombre"],
            "cabecera": a["cabecera"],
            # --- reales, del catálogo CCT ---
            "escuelas_cct": a["escuelas"],
            "alumnado_cct": a["alumnado"],
            # --- simulados ---
            "poblacion": poblacion,
            "lista_nominal": lista_nominal,
            "secciones": secciones,
            "casillas": cas,
            "indice_ruralidad": round(ruralidad, 3),
            "nse": nse,
            "historico": hist,
            "proyeccion_2027": proyeccion(rnd, hist),
        })

    # Las especiales se fijan por distrito, no por municipio: Campeche tiene
    # dos distritos federales y las de tránsito se ponen en las dos ciudades.
    por_cve = {m["cve_mun"]: m for m in municipios}
    for cve, n in (("04002", 6), ("04003", 4)):
        por_cve[cve]["casillas"]["especial"] = n
    for m in municipios:
        m["casillas"].setdefault("especial", 0)
        m["casillas"]["total"] = sum(v for k, v in m["casillas"].items() if k != "total")

    salida = {
        "metadata": {
            "nombre": "Datos de demostración del módulo territorial",
            "procedencia": "simulado",
            "advertencia": "Valores sintéticos. No provienen de INEGI, INE ni IEEC. "
                           "No deben usarse para tomar decisiones ni publicarse como cifras oficiales.",
            "semilla": SEMILLA,
            "reales": ["cve_mun", "nombre", "cabecera", "escuelas_cct", "alumnado_cct"],
            "simulados": ["poblacion", "lista_nominal", "secciones", "casillas",
                          "nse", "historico", "proyeccion_2027"],
            "fuente_esqueleto": "INEGI Marco Geoestadístico 2024 (municipios) · SEP CCT (escuelas)",
            "pendiente_real": "Lista nominal, secciones, casillas y resultados: INE / IEEC.",
        },
        "partidos": PARTIDOS,
        "nse_cortes": NSE,
        "municipios": municipios,
    }

    ruta = AQUI / "territorio.json"
    ruta.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")))

    tot = {k: sum(m["casillas"][k] for m in municipios)
           for k in ("basica", "contigua", "extraordinaria", "especial", "total")}
    print(f"territorio.json: {len(municipios)} municipios, {ruta.stat().st_size/1000:.0f} KB")
    print(f"  lista nominal simulada: {sum(m['lista_nominal'] for m in municipios):,}")
    print(f"  secciones simuladas:    {sum(m['secciones'] for m in municipios):,}")
    print(f"  casillas: {tot}")


if __name__ == "__main__":
    main()
