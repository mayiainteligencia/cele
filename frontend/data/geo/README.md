# Capas geoespaciales — Campeche

Todo lo de aquí se genera con `python3 frontend/data/geo/build_geo.py`.
Los insumos crudos viven en `frontend/estados/` y no se tocan.

---

## Archivos generados

### `limite_estatal.geojson` — 1 feature, 10 KB

Polígono del límite estatal.

| propiedad | tipo | ejemplo |
|---|---|---|
| `cve_ent` | string | `"04"` |
| `nombre_entidad` | string | `"Campeche"` |
| `fuente` | string | provisto por el equipo |
| `fecha_corte` | null | la fuente no la declara |

### `escuelas_campeche.geojson` — 2,274 features, 2.1 MB

Centros de trabajo de la SEP. Geometría: `Point` (lon, lat, 6 decimales).

| propiedad | tipo | ejemplo | nota |
|---|---|---|---|
| `cct` | string | `"04KPR0656Z"` | clave de centro de trabajo |
| `tipo_educativo` | string | `"BÁSICA"` | |
| `nivel` | string | `"PRIMARIA"` | 7 valores, ver abajo |
| `subcontrol` | string | `"FEDERAL"` | |
| `nombre_centro_trabajo` | string | | |
| `clave_turno` | int | `1` | |
| `nombre_turno` | string | `"MATUTINO"` | |
| `clave_entidad` | string | `"04"` | |
| `nombre_entidad` | string | `"CAMPECHE"` | |
| `clave_municipio` | string | `"011"` | 3 dígitos |
| `nombre_municipio` | string | `"CANDELARIA"` | |
| `clave_localidad` | string | `"1418"` | |
| `nombre_localidad` | string | `"LA ESPERANCITA"` | |
| `domicilio_completo` | string | | texto libre, sucio |
| `alumnos_total` / `_hombres` / `_mujeres` | int | `14` | |
| `docentes_total` / `_hombres` / `_mujeres` | int | `1` | |
| `personal_total` | int | `1` | |
| `aulas_existentes`, `aulas_en_uso` | int | `0` | |
| `servicio` | string | `"PRIMARIA CONAFE"` | |
| `sostenimiento` | string | `"PÚBLICO"` \| `"PRIVADO"` | |
| **`cve_mun`** | string | `"04011"` | *derivado*: entidad + municipio, clave INEGI. Llave para unir con datos municipales |
| **`estatus_ubicacion`** | string | `"potencial"` | *derivado*, ver regla abajo |
| **`capa_origen`** | string | `"Campeche_1"` | *derivado*: carpeta de My Maps |
| **`fuente`**, **`fecha_corte`** | string, null | | *derivado* |

`LATITUD` y `LONGITUD` del KML se descartan de `properties`: ya están en `geometry`.

---

## Conteos — cuál usar

Los tres números son distintos y significan cosas distintas:

| conteo | valor | qué es |
|---|---|---|
| features | 2,274 | registros CCT (una escuela con dos turnos son dos registros) |
| CCTs únicos | 2,191 | 83 CCTs se repiten; 24 se distinguen solo por turno |
| **coordenadas únicas** | **1,482** | **sitios físicos — este es el conteo de "ubicaciones potenciales de casilla"** |

Un plantel con primaria matutina y secundaria vespertina es un solo edificio.
Para hablar de casillas, cuenta sitios físicos, no registros.

Distribución: `PRIMARIA` 762 · `PREESCOLAR` 703 · `SECUNDARIA` 380 ·
`MEDIA SUPERIOR` 156 · `INICIAL` 143 · `LICENCIATURA` 80 · `POSGRADO` 50.
Público 1,993 · Privado 281.

---

## Regla de producto: `estatus_ubicacion`

El contrato define tres valores:

- `potencial` — la escuela existe y podría alojar una casilla
- `historica` — alojó una casilla en un proceso anterior
- `aprobada` — el INE la aprobó en el encarte del proceso vigente

**Hoy los 2,274 registros son `potencial`.** No hay ningún insumo del INE en el
repo, así que no se puede afirmar que una escuela fue o será casilla. El campo
existe para cuando llegue ese dato; no lo llenes con supuestos.

---

## Municipios: son 13, no 11

Los datos traen 13 municipios. Campeche tuvo 11 hasta 2021, cuando el congreso
local creó **Dzitbalché** (separado de Calkiní) y **Seybaplaya** (separado de
Champotón). Para 2027 el universo es de 13.

| cve_mun | municipio | cabecera | escuelas |
|---|---|---|---|
| 04001 | CALKINÍ | Calkiní | 104 |
| 04002 | CAMPECHE | San Francisco de Campeche | 459 |
| 04003 | CARMEN | Ciudad del Carmen | 414 |
| 04004 | CHAMPOTÓN | Champotón | 225 |
| 04005 | HECELCHAKÁN | Hecelchakán | 75 |
| 04006 | HOPELCHÉN | Hopelchén | 129 |
| 04007 | PALIZADA | Palizada | 70 |
| 04008 | TENABO | Tenabo | 24 |
| 04009 | ESCÁRCEGA | Escárcega | 178 |
| 04010 | CALAKMUL | Xpujil | 203 |
| 04011 | CANDELARIA | Candelaria | 346 |
| 04012 | SEYBAPLAYA | Seybaplaya | 20 |
| 04013 | DZITBALCHÉ | Dzitbalché | 27 |

Los `cve_mun` de esta tabla están verificados contra el archivo generado.
Aun así, coteja contra el catálogo INEGI antes de publicar cifras.

---

## `cabeceras_municipales.geojson` — 13 features, 3 KB

Punto de anclaje de cada municipio para el coloreado provisional.

| propiedad | ejemplo |
|---|---|
| `cve_mun` | `"04010"` |
| `nombre_municipio` | `"CALAKMUL"` |
| `cabecera` | `"XPUJIL"` |
| `escuelas_en_cabecera` | `13` |
| `escuelas_en_municipio` | `203` |

La coordenada es la **mediana** de las escuelas de la localidad cabecera. La
mediana y no el promedio: ignora la escuela suelta en las afueras que jalaría
el punto fuera de la traza urbana.

**Esto no es el centroide del municipio.** Sin polígonos no hay centroide que
calcular. El círculo del choropleth se dibuja aquí y su tamaño es fijo — no
representa superficie ni población. Cuando lleguen los polígonos del INEGI,
este archivo deja de usarse para el coloreado.

Dos municipios necesitan la cabecera nombrada a mano porque su localidad con
más escuelas no es la cabecera: **Palizada** (El Juncal tiene 5 escuelas, la
villa de Palizada 4) y **Calakmul** (la cabecera es Xpujil). Por eso
`CABECERAS` en `build_geo.py` es un diccionario explícito y no una deducción
por conteo.

---

## Capas que faltan — pendientes de obtener

Ninguna de estas está en el repo y **no se deben inventar**:

| capa | dónde se consigue |
|---|---|
| Municipios (polígonos) | Marco Geoestadístico INEGI |
| AGEB urbanas y rurales | Marco Geoestadístico INEGI |
| Localidades | Marco Geoestadístico INEGI |
| Distritos federales | Cartografía Electoral INE |
| Distritos locales | Cartografía Electoral INE / IEEC |
| Secciones electorales | Cartografía Electoral INE |
| Casillas históricas | Encartes INE de procesos anteriores |
| Casillas aprobadas 2027 | No existe todavía — el INE las publica después de aprobar acuerdos y encarte |

El componente de mapa las registra como capas vacías con estado "pendiente de
insumo", para que al llegar el archivo solo haya que soltarlo aquí.

Sin municipios, el choropleth municipal **no se puede dibujar como polígonos**;
mientras tanto se representa agregando los puntos por `cve_mun`.

---

## Sobre `frontend/estados/`

| archivo | qué es |
|---|---|
| `Campeche.kmz` | **351 bytes, cero puntos.** Es el stub que da My Maps cuando no marcas "exportar a KML": adentro solo hay un `<NetworkLink>` al mapa publicado. El script lee esa URL y baja el KML real (7.8 MB, 2,274 puntos) con `forcekml=1`. El KML crudo se cachea en `.cache_mymaps.kml` y está en `.gitignore`. |
| `campeche.geojson` | Límite estatal, un solo Feature. Sin municipios. |
| `states.geojson` | Los 32 estados, 361 KB. Solo para contexto nacional; no lo cargues en cada render. |
| `mapa_campeche.html` | Prototipo Leaflet standalone. Referencia, no producción. |

El conteo de 2,274 coincide con la suma de las dos carpetas de My Maps
(`Campeche_1` = 1,998 y `Campeche_2` = 276). My Maps parte las capas a los 2,000
puntos, así que el corte en 1,998 es el límite de la capa, no truncamiento de la
descarga. Si alguien agrega puntos al mapa original, corre `--fetch` y verifica
que el total suba.
