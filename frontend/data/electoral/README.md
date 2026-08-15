# Resultados y casillas — Campeche 2024

Todo lo de aquí se genera con:

```
backend/datalab/venv/bin/python frontend/data/electoral/build_electoral.py
```

Los insumos crudos viven en `backend/datalab/uploads/ResultadosYCasillas/` y no
se tocan: el encarte del INE (`ubicacionCasillas.xlsx`) y los 21 archivos
`DIP MR NN_SEC.xlsx` del IEEC, uno por distrito local.

Es el **Proceso Electoral Local 2023-2024**, elección de **diputaciones locales
de mayoría relativa**. No es la elección de gubernatura ni la federal.

---

## Archivos generados

### `../geo/casillas_2024.geojson` — 415 features, 371 KB

Un `Point` por **sitio**, no por casilla: cuatro urnas en la misma escuela son
un edificio. Las propiedades relevantes:

| propiedad | ejemplo | nota |
|---|---|---|
| `seccion` | `"3"` | llave contra `resultados_seccion_2024.json` |
| `cve_mun` | `"04002"` | clave INEGI, llave contra las capas municipales |
| `casillas` | `"B1, C1, C2"` | las urnas de ese sitio |
| `n_casillas` | `3` | manda el radio del punto en el mapa |
| `tipos` | `"B, C"` | B básica, C contigua, E extraordinaria, S especial |
| `ubicacion` | | domicilio completo del encarte, texto libre |
| `inmueble` | `"PRIMARIA MAESTROS CAMPECHANOS"` | lo que va antes de la primera coma |
| `cct` / `nombre_cct` | `"04DPR0010Z"` | plantel con el que cruzó |
| `similitud_cruce` | `1.0` | 1.0 es coincidencia exacta de nombre |
| `estatus_ubicacion` | `"historica"` | alojó casilla en un proceso anterior |

**Los nombres de los funcionarios de casilla se descartan.** El encarte trae
nueve por casilla; son datos personales y no aportan nada al mapa.

### `casillas_2024_sin_geo.json` — 170 sitios

El encarte **no publica coordenadas**: sólo un domicilio en texto. Las
coordenadas salen de cruzar el nombre del inmueble contra el catálogo CCT de la
SEP. De 585 sitios, 415 cruzan y 170 no. Esos 170 se publican aquí, con su
`motivo_sin_geo`, en vez de dibujarse en una coordenada inventada:

- ~85 no son plantel escolar (parques, mercados, canchas, domicilios
  particulares). No están en el catálogo CCT y nunca lo van a estar.
- El resto son planteles cuyo nombre en el encarte no coincide con el del
  catálogo (abreviaturas, plantel registrado con otro nombre).

Baja el faltante consiguiendo las coordenadas de casilla del INE, no afinando
el cruce por nombre.

### `resultados_seccion_2024.json` — 542 secciones, 360 KB

```
secciones["3"] = {
  cve_mun, distrito_local, distritos_locales,
  votos: { PAN, PRI, ..., "PT-PVEM-MORENA", ... },   // 16 contendientes
  bloques: { PAN, "PRI-PRD", MC, SHH, ... },         // partido + sus coaliciones
  validos, no_registradas, nulos, total, lista_nominal, casillas,
  ganador, ganador_nombre, ganador_votos, segundo,
  margen, participacion, nulos_pct
}
```

`metadata` conserva tres cosas que no hay que perder:

- `notas_tribunal` — las tres sentencias del TEEC que anularon casillas en los
  distritos 4, 5 y 7.
- `voto_anticipado` — 11 registros que no pertenecen a ninguna sección.
- `secciones_sin_municipio` — 681, 781 y 991 aparecen en los cómputos pero no
  en el encarte federal, así que no se les puede asignar municipio. Quedan
  fuera de la agregación municipal.

### `resultados_municipio_2024.json` — 13 municipios, 11 KB

La suma de lo seccional. La sección se asigna a municipio con el encarte.
Alimenta cuatro coloreados del mapa: ganador, participación, margen y voto nulo.

---

## Bloques, no partidos

En 2024 el voto se emitió también por coalición: hay columnas para `PT-PVEM`,
`PT-MORENA`, `PT-PVEM-MORENA`, `PVEM-MORENA` y `PRI-PRD`, separadas de las de
cada partido. **Leer sólo la columna del partido subestima su votación.**

Por eso `bloques` agrupa a cada partido con sus coaliciones, y el ganador se
decide sobre el bloque. `SHH` es Sigamos Haciendo Historia (PT-PVEM-Morena).

---

## Cómo se identifican los partidos

El encabezado de las hojas del IEEC **no dice qué partido es cada columna**: son
16 logotipos PNG incrustados. Y el número de columnas cambia entre distritos —
el 20 (Palizada) trae 12 contendientes, no 16.

`build_electoral.py` lee el dibujo de cada archivo y cruza el md5 de cada
logotipo contra la tabla `LOGOS`. Un logotipo desconocido detiene el proceso en
vez de correr las columnas en silencio. Además, `verificar()` comprueba que la
suma de los 16 partidos dé exactamente la columna VOTOS VÁLIDOS del archivo.

---

## Lo que estos datos NO son

Son de **2024**. No son las casillas ni el resultado de 2027:

- Las casillas de 2027 dependen de acuerdos del INE que todavía no existen.
- El resultado de 2024 es pasado registrado. Quien lo use para proyectar tiene
  que marcarlo como estimación y publicar su intervalo, no repintar 2024.
- Sigue faltando la **geometría de las secciones**. Hay resultado seccional pero
  no polígono, así que la sección no se puede pintar como superficie. Se ve en
  el punto de su casilla y agregada a municipio. Ver `../geo/PENDIENTE-INEGI-INE.md`.
