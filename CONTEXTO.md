# Cerebro Electoral (CE) — Contexto del proyecto

Plataforma de inteligencia electoral para **Campeche (entidad 04)**, rumbo al
proceso local **2027 (gubernatura)**. Sirve datos reales de 2024 sobre un
frontend estático, con dos reglas duras que atraviesan todo el código:

1. **Toda salida declara su procedencia.** `Dato`, `Cálculo`, `Estimación`,
   `Inferencia`, `Recomendación` o `Simulado`. Un solo módulo produce esos
   badges (`frontend/js/procedencia.js`); si cambia el criterio, cambia ahí.
2. **Una proyección nunca se imprime como número solo.** Sale con intervalo
   (`Territorio.intervalo()`). Lo que no se tiene, se dice — no se rellena:
   una casilla que no cruza contra el catálogo CCT se queda sin geometría, no
   se le inventa un punto.

---

## Arquitectura en una línea

```
XLSX crudo (INE/IEEC)  →  build_electoral.py  →  JSON/GeoJSON en frontend/data/  →  fetch  →  HTML+JS vanilla
```

No hay servidor de aplicación. El frontend es **estático**: se despliega en
Vercel (`vercel.json` → `outputDirectory: "frontend"`) y trae sus datos con
`fetch` del propio repo. La única pieza viva es MonitorSol (FastAPI + Whisper,
puerto 8001), y sólo `medios.html` depende de ella.

---

## Qué va en cada carpeta

### `backend/datalab/` — el laboratorio de datos

Aquí vive el crudo y el código que lo procesa, junto al venv que lo lee.

- **`uploads/ResultadosYCasillas/`** — los insumos **originales, no se tocan**:
  - `ubicacionCasillas.xlsx` — encarte del INE, Proceso Electoral Federal
    2023-2024. Ubicación e integración de mesas directivas. **No trae
    coordenadas**, sólo domicilio en texto libre.
  - `DIP MR 01..21_SEC.xlsx` — cómputos del IEEC a nivel sección, diputaciones
    locales de mayoría relativa, uno por distrito local (21 archivos, ~3 MB c/u).
- **`pipeline/build_electoral.py`** — el único generador de datos electorales.
  Se corre con `backend/datalab/venv/bin/python backend/datalab/pipeline/build_electoral.py`.
  Lo no obvio de este script:
  - El encabezado de las hojas del IEEC **no dice qué partido es cada columna**:
    son 16 logotipos PNG incrustados. Se identifican cruzando el **md5 de cada
    logotipo** contra la tabla `LOGOS`. Un logo desconocido **detiene** el
    proceso en vez de correr las columnas en silencio.
  - El número de columnas **cambia entre distritos** (el 20, Palizada, trae 12
    contendientes, no 16). Por eso nada de posiciones fijas.
  - `verificar()` comprueba que la suma de los 16 partidos dé exactamente la
    columna VOTOS VÁLIDOS del archivo.
  - Los municipios se cruzan **por nombre normalizado, nunca por número**: el
    encarte usa el orden del INE y el Marco Geoestadístico usa otro.
  - Las coordenadas de casilla salen de cruzar el nombre del inmueble contra el
    catálogo CCT de la SEP, con similitud Jaccard sobre tokens distintivos
    (`UMBRAL_CRUCE = 0.55`) y bonus por localidad. **Los nombres de los
    funcionarios de casilla se descartan** — son datos personales.
- **`uploads/cartografiaCampeche/`** — 12 catálogos cartográficos del INE,
  corte **FEB2026** (.xlsx/.txt/.xls + el PDF índice). Dan la jerarquía
  sección → distrito federal → distrito local → municipio → localidad → manzana.
  **Ojo:** los nombres están en Unicode NFD; se ubican por fragmento
  normalizado, nunca hardcodeados.
- **`uploads/ine_cartografia/secciones_raw/`** — 26 respuestas crudas del
  endpoint público del INE, una por sección representante.
- **`pipeline/build_ine_cartografia.py`** — segundo pipeline. Cruza el endpoint
  `getConoceTuNuevoDistrito` (geometría de distrito) con los catálogos
  (jerarquía). `--descargar` baja el crudo, `--autocomprobar` corre sus asserts.
  El endpoint **no publica geometría de sección**: devuelve los distritos que
  la contienen.
- **`uploads/archivo/ANALISIS_electoral.xlsx`** — insumo de referencia, no
  entra al pipeline.
- **`reportes/`, `pipeline/reportes/`, `uploads/*.xlsx` sueltos** (MXM-Planta,
  circuito exterior) — **residuo de otro proyecto** (`monitorIAExtras`,
  inventario de publicidad OOH). No los usa nada de CE. Borrables.

### `backend/monitorsol/` — transcripción de radio en vivo

FastAPI + Whisper + WebSocket. La única pieza que necesita infraestructura
corriendo. Ver `backend/monitorsol/README.md` y `frontend/MONITORSOL.md`.

**Advertencia crítica:** sólo hay **bytecode `.pyc`**, no `.py`. Funciona
(Python 3.12.3) pero no se puede leer, corregir, ni sobrevive a un cambio de
intérprete. Falta recuperar el fuente de la máquina donde se desarrolló.

- `main.pyc` — app FastAPI, `GET /health`, routers bajo `/monitor`
- `api/monitor_routes.pyc` — `/start`, `/stop/{id}`, `/sessions`, `/testigos`
- `api/websocket.pyc` — `/ws/{sesion_id}`
- `core/` — `session_manager`, `stream_capture`, `transcriber`, `keyword_detector`
- `db/testigos.sqlite` — 437 registros reales de sesiones anteriores

### `frontend/data/` — la capa de datos servida

Todo se consume con `fetch` desde rutas relativas. Tres orígenes distintos:

#### `data/electoral/` — resultados 2024 (generado por el pipeline)

| archivo | contenido |
|---|---|
| `resultados_seccion_2024.json` | 542 secciones. Votos por los 16 contendientes, `bloques`, `validos`, `nulos`, `total`, `lista_nominal`, `ganador`, `segundo`, `margen`, `participacion`, `nulos_pct` |
| `resultados_municipio_2024.json` | 13 municipios. La suma de lo seccional. Alimenta 4 coloreados del mapa |
| `casillas_2024_sin_geo.json` | 170 sitios que **no** cruzaron, con su `motivo_sin_geo`. Se publican en vez de dibujarse en coordenada inventada |
| `secciones_catalogo_2026.json` | 555 secciones: jerarquía oficial → distrito federal, distrito local, municipio, urbano/rural. Sin geometría |
| `README.md` | contrato de estos archivos |

`metadata` conserva tres cosas que no hay que perder: `notas_tribunal` (tres
sentencias del TEEC que anularon casillas en los distritos 4, 5 y 7),
`voto_anticipado` (11 registros sin sección) y `secciones_sin_municipio`
(681, 781 y 991 aparecen en los cómputos pero no en el encarte).

**Bloques, no partidos.** En 2024 el voto se emitió también por coalición
(`PT-PVEM`, `PT-MORENA`, `PT-PVEM-MORENA`, `PVEM-MORENA`, `PRI-PRD`, en
columnas separadas). Leer sólo la columna del partido **subestima** su
votación, así que el ganador se decide sobre el bloque. `SHH` = Sigamos
Haciendo Historia.

#### `data/geo/` — capas geoespaciales

`limite_estatal`, `municipios`, `localidades`, `ageb_urbanas`, `ageb_rurales`,
`escuelas_campeche` (2,274 CCT de la SEP), `cabeceras_municipales`,
`casillas_2024.geojson` (415 features: **un punto por sitio, no por casilla**;
`n_casillas` manda el radio). Generados por `build_geo.py` / `build_inegi.py`.

Desde 2026-08-18, de `build_ine_cartografia.py`: `distritos_federales` (2),
`distritos_locales` (21) y `distritos_judiciales` (1, circuito 31). Coordenadas
a 6 decimales, el mismo corte que el resto del proyecto.

`PENDIENTE-INEGI-INE.md` documenta lo bloqueado: falta el Marco Geoestadístico
del INEGI (**edición 2021 o posterior** — Campeche pasó de 11 a 13 municipios
ese año). Quedan **2 capas** en `pendiente`: secciones electorales (falta el
shapefile del Marco Geográfico Electoral) y casillas aprobadas 2027.

**La geografía electoral cambió entre 2024 y 2026.** El catálogo del INE es de
febrero 2026 y los resultados son de 2024: 19 secciones son nuevas y 6 con
resultado ya no están vigentes (4, 79 y 105 desaparecieron por
reseccionalización; 681, 781 y 991 nunca fueron territoriales). Publicado en
`metadata.reconciliacion_2024`. **El cruce no es 1 a 1 y no hay que "arreglarlo".**

**El hueco importante:** hay resultado seccional pero **no polígono de
sección**, así que la sección no se puede pintar como superficie. Se ve en el
punto de su casilla y agregada a municipio.

#### `data/censo/` — población del Censo 2020

`poblacion_2020.json` (118 KB), de `build_censo.py` sobre el ITER del INEGI.
12 municipios y 501 localidades, con población total, sexo y tres cortes de
edad. Tres reglas duras que impone el dato de origen:

- **Un `*` del INEGI es confidencialidad, no cero.** Se emite `null` y se
  propaga: si una parte de una suma está suprimida, el derivado también es
  `null`. Afecta a 1,978 localidades (0.8% de la población, ninguna con
  polígono).
- **El desglose municipal NO se agrega desde localidades** — perdería a las
  suprimidas. Se toma de la fila municipal del ITER, que viene completa.
- **El Censo tiene 12 municipios y el proyecto 13.** Dzitbalché se erigió en
  2021: no tiene cifra municipal de 2020 y **la de Calkiní lo incluye**, así que
  no es comparable con el Calkiní electoral de 2024. Sus dos localidades sí
  recuperan el dato, renumeradas por nombre desde sus claves de Calkiní.

`mayores_18` es **Dato** (`P_18YMAS` viene tal cual). `menores_18` y
`mayores_50` son **Cálculo** (una resta y una suma de quinquenios).

#### `data/contexto_campeche.json` — contexto capturado a mano

Cifras que no salen de un archivo procesable. Cinco bloques, cada uno con su
procedencia:

- `inegi` — Censo 2020: población, sexo, edad mediana, densidad, lengua
  indígena. Declara su `pendiente`: falta el desglose municipal de población.
- `ine` — padrón y lista nominal 2024-06, distritos. Incluye la nota de por qué
  682,833 (padrón) ≠ 691,104 (actas de cómputo): son dos cortes distintos y
  **no se promedian**.
- `nse` — **estimación propia**, no AMAI (metodología registrada, requiere
  licencia). Por eso los niveles son alto/medio/bajo, no A/B, C+, C.
- `historico` — 2021 vs 2024.
- `proyeccion_2027` — modelo propio de gubernatura, con supuestos, fuerzas,
  rangos y `variable_critica`. Nunca pronóstico puntual.

#### `data/mock/` — datos sintéticos

`territorio.json` + `build_mock.py`. **Ya no lo lee ningún JS**: `Territorio`
migró a `contexto_campeche.json`. Queda una referencia obsoleta en
`fuentes.html:106`. Borrable junto con esa línea.

### `frontend/js/` — módulos globales (vanilla, sin bundler)

Se cargan por `<script src>` en orden. Cada uno expone un objeto en `window`.

| archivo | responsabilidad |
|---|---|
| `auth.js` | Riel lateral de **7 grupos** (`NAV`) + subnav de píldoras. Una sola fuente de verdad de la navegación. Sin login: acceso abierto |
| `app.js` | Centro de mando: animaciones, mapa ejecutivo, riel de 13 municipios, `MUNICIPIOS_PREDICCION` (escenarios de demo) |
| `procedencia.js` | Los 6 badges de origen del dato. Escapa todo lo que entra |
| `electoral.js` | **Única puerta** a los resultados 2024 y a la proyección. `cargar()`, `cargarCatalogo()`, `cargarProyeccion()` (los tres cachean), `registrarVariables()`, `fichaSeccion()`, `fichaMunicipio()`, `agregar()`, `municipiosPorGanador()`, `casillasNormativas()`, `porDistrito()`. **El ganador y el margen se calculan aquí y en ningún otro lado** |
| `censo.js` | **Única puerta** al Censo 2020. `cargar()`, `registrarVariables()` (6 choropleths), `ficha()`. Un `null` del INEGI nunca se pinta como 0 |
| `mapa.js` | Componente Leaflet reutilizable. `CATALOGO` de capas con estado `disponible`/`pendiente`. Lee tokens CSS para no duplicar colores |
| `territorio.js` | Carga `contexto_campeche.json` + helpers de render: `cifra`, `barra`, `intervalo`, `cinta`, `avisoSimulado`, `exportar` |
| `filtros.js` | Filtros globales. `sessionStorage` + URL (la URL manda). **`localStorage` a propósito no**: filtros que sobreviven al cierre del navegador hacen que alguien saque conclusiones sobre datos recortados sin saberlo |
| `vistas/{casillas,demografia,nse,historico}.js` | Render de las cuatro vistas de datos duros |
| `*.prueba.js` | Pruebas manuales de `mapa` y `procedencia` |

### `frontend/*.html` — 24 páginas, 7 grupos de navegación

**Centro de mando** — `mando.html`, `index.html` (landing).

**Territorio** (el grupo con datos reales):
- `cartografia.html` — mapa maestro, todas las capas. Resumen estatal fijo
  (quién ganó Campeche, por cuánto, y qué municipios ganó cada fuerza) + ficha
  municipal al clic con los 16 contendientes
- `municipios.html` — 13 municipios, GeoJSON de municipios + cabeceras
- `infraestructura.html` — catálogo CCT de la SEP
- `casillas.html` → `vistas/casillas.js` — casillas por tipo INE (Básica,
  Contigua, Extraordinaria, Especial; "casilla normal" no existe en la
  normativa) + **proporcionalidad por distrito real** (LGIPE art. 253, 21
  locales y 2 federales). El panel 2027 se queda **vacío a propósito**
- `demografia.html` → `vistas/demografia.js` — INEGI y INE en bloques
  separados; lo único que los cruza va marcado como CÁLCULO
- `nse.html` → `vistas/nse.js` — estimación propia con rangos
- `historico.html` → `vistas/historico.js` — 2021/2024 + proyección 2027

**Análisis** — `forensia.html`, `candidaturas.html`, `medios.html` (MonitorSol,
1,454 líneas, la única página con backend), `riesgos.html`, `encuestas.html`.

**Operación** — `finanzas.html`, `dia-d.html`.

**Sueltos** — `decisiones.html` (sala de decisiones), `alertas.html`.

**Sistema** — `roles.html`, `fuentes.html` (trazabilidad), `matriz.html`.

**Otros** — `mapa.html` (mapa standalone), `ceMobile.html` (ficha del copiloto).

Las páginas de Análisis, Operación y Sistema todavía traen su contenido
**incrustado en el HTML**, no leído de `data/`.

### `frontend/css/` — 8 hojas, sin framework

`design-system.css` (tokens), `colors.css` (paleta + colores de partido, que
lee `mapa.js`), `layout.css`, `components.css`, `animations.css`, `blobs.css`,
`mapa.css`, `auth.css`.

### `ceMobile/` — copiloto móvil

App aparte, mismo `colors.css`. `index.html` + `js/mobile.js` + `css/mobile.css`.

### `frontend/estados/` — crudo geográfico

`campeche.geojson`, `states.geojson`, `Campeche.kmz`, `mapa_campeche.html`.

---

## Cómo se consume el dato (la ruta completa)

```
casillas.html
  └─ <script src="js/vistas/casillas.js">
       └─ Electoral.cargar()          → fetch data/electoral/resultados_{municipio,seccion}_2024.json
       └─ Territorio.cargar()         → fetch data/contexto_campeche.json
       └─ Procedencia.badge('dato', { fuente, fechaCorte })

cartografia.html
  └─ CerebroMapa.crear('#mapa', { capas, choropleth })
       └─ fetch data/geo/<capa>.geojson   (bajo demanda, cacheado)
       └─ Electoral.registrarVariables()  → 5 choropleths municipales
       └─ Electoral.fichaSeccion()        → cruza props.seccion contra el resultado

medios.html
  └─ fetch http://localhost:8001/health   → badge "Backend activo"
  └─ fetch http://localhost:8001/monitor/{sessions,testigos,stop/:id}
  └─ ws://localhost:8001/ws/{sesion_id}
```

`Electoral.cargar()` y `Territorio.cargar()` **cachean la promesa**: varias
vistas en la misma página comparten una sola descarga.

---

## Lo que estos datos NO son

Son de **2024**. No son las casillas ni el resultado de 2027. Las casillas de
2027 dependen de acuerdos del INE que todavía no existen. El resultado de 2024
es pasado registrado: quien lo use para proyectar tiene que marcarlo como
estimación y publicar su intervalo, no repintar 2024.

---

## Deuda conocida

| qué | dónde |
|---|---|
| MonitorSol sólo tiene `.pyc`, falta el fuente | `backend/monitorsol/` |
| 170 de 585 sitios de casilla sin coordenada | resolver con datos del INE, no afinando el cruce por nombre |
| Falta geometría de secciones y distritos | `frontend/data/geo/PENDIENTE-INEGI-INE.md` |
| Falta desglose municipal de población del Censo | `contexto_campeche.json` → `inegi.pendiente` |
| ~~Botones de exportación no generan archivo~~ | **RESUELTO 2026-08-21.** CSV se genera de verdad desde la tabla en pantalla; Excel y PDF quedan deshabilitados con el motivo en el `title` (necesitan una librería que un frontend sin bundler no carga) |
| ~~`data/mock/`, `src/`, `datalab/reportes/`, `.env.example`~~ | **RESUELTO 2026-08-21.** Borrados. La fila anterior decía que `fuentes.html:106` citaba el mock: era **falsa** desde que la página se genera del manifiesto |
| `build_geo.py` sin autocomprobación | 11 de 12 pipelines la tienen; éste no |
| `build_inegi.py` no se puede ejecutar | ni el shapefile del Marco Geoestadístico ni `pyshp`/`pyproj` están en el repo. Sus 5 geojson existen pero no son regenerables; su metadata se corrigió en disco y lo declara |
| ~~El venv de datalab es una copia de otro proyecto~~ | **RESUELTO 2026-08-19.** Recreado limpio desde `backend/datalab/requirements.txt`. Sigue valiendo la regla: instalar siempre con `venv/bin/python -m pip`, nunca `bin/pip` |

---

## Cómo se mantiene este documento

Este archivo es **la fuente de verdad y la bitácora del proyecto**. No hay
CLAUDE.md ni tests: el contexto que no está aquí se pierde entre sesiones.

Son tres documentos con propósitos distintos, los tres fuera de git:

| archivo | qué es |
|---|---|
| `CONTEXTO.md` | **el qué** — estado del sistema, inventario, bitácora de sesiones |
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | **el porqué** — criterio, reparto de responsabilidades, deuda |
| [`APRENDIZAJES.md`](APRENDIZAJES.md) | **el cómo se aprende** — cada problema de datos resuelto, con su concepto, librería y fragmento real |

- Se **lee antes** de tocar código.
- Se **actualiza con cada cambio** que invalide algo de arriba.
- Al decir **"terminamos por hoy"** se suma una entrada fechada a la bitácora.
  Se suma, no se reescribe: el historial sirve para saber por qué algo quedó
  como quedó.

## Bitácora

### 2026-08-21 — Territorio reorganizado + nueva vista Predicción

**Una pregunta por vista.** `historico.html` respondía cuatro (cómo se votó en
2024, cómo quedó el Congreso, cómo se votó en 2021, qué pasa en 2027) y los
datos de escuelas estaban en TRES vistas a la vez —`municipios`, `demografia`
y la propia `infraestructura`—, todas leyendo el mismo geojson.

| vista | la pregunta |
|---|---|
| Mapa maestro | *¿dónde está cada cosa?* — **intacto, no se tocó** |
| Municipios | *¿qué territorio es este?* |
| Demografía | *¿quién vive y quién puede votar?* |
| Socioeconómico | *¿cómo viven, y eso se relaciona con el voto?* |
| Dónde se vota | *¿en qué inmuebles y con qué casillas?* — fusión de Casillas + CCT |
| Resultados | *¿cómo se ha votado?* |
| Predicción | *¿qué puede pasar en 2027?* — **nueva** |

El inventario CCT va en un `<details>` que **sólo descarga sus 2 MB al abrirlo**:
bajarlos al entrar habría reintroducido la deuda que se saldó precalculando el
agregado por municipio.

**La restricción que decidió el diseño de Predicción.** Antes de construir se
verificó `proyeccion_2027.json`: la simulación es **estatal** —seis bloques,
ninguna clave territorial—. No existe proyección 2027 por municipio. Por eso:

- **el mapa** son los ganadores **medidos de 2024** (badge Dato)
- **el titular** es la estimación **2027** (badge Estimación)

Pintar el mapa como si fuera la proyección habría insinuado que simulamos cada
municipio. No lo hicimos, y la nota bajo el mapa lo dice.

**La animación: 13 nodos SVG, 2 s, tres actos, y termina.** Siembra (0–0.5 s),
barrido de colores (0.5–1.4 s), asiento en el ganador real (1.4–2 s). Un solo
`requestAnimationFrame` que se cancela; ni canvas, ni partículas, ni loop de
fondo. Respeta `prefers-reduced-motion` saltando al acto 3.

El copy no deja lugar a dudas: *«recárgala mil veces y el número no cambia»*.
El Monte Carlo corrió en el pipeline con semilla 20270606; la animación recorre
escenarios ya calculados, no genera ninguno.

**Dos fallos que la verificación en navegador atrapó:**

1. **La animación no cerraba sin frames.** En Chrome headless `rAF` dispara
   dos veces y se detenía a medias: el resultado no aparecía nunca. El estado
   final no puede depender de que lleguen suficientes frames —una pestaña de
   fondo pausa `rAF`—, así que ahora un `setTimeout` de respaldo garantiza el
   cierre aunque no llegue ni un frame.
2. **Las etiquetas salían vacías.** El geojson de cabeceras trae
   `nombre_municipio` (en mayúsculas), no `nombre`. Se toma el nombre de
   presentación del dato electoral, que ya viene acentuado del catálogo INEGI.

Verificado que los 13 nodos se pintan con los ganadores reales: SHH 10, MC 2,
PRI-PRD 1 — idéntico a `resultados_municipio_2024.json`.

### 2026-08-21 — `build_electoral.py` ya se autocomprueba de verdad

**El hueco que reporté mal.** Este pipeline no tenía `--autocomprobar` ni
`argparse`: ignoraba la bandera, corría el build completo regenerando sus
salidas, y salía con código 0. El bucle que cuenta ceros lo daba por
verificado. Nueve se autocomprobaban y uno se reconstruía en silencio.

Ahora tiene autocomprobación en tres capas, sin escribir nada (comprobado
comparando el md5 del árbol de datos antes y después):

1. **Invariantes de las tablas**, sin leer disco: que los bloques particionen
   exactamente las columnas de la boleta —ninguna sigla huérfana, ninguna en
   dos bloques, ningún partido fuera—, que `CVE_MUN` y `NOMBRE_MUN` cubran los
   mismos 13 municipios, y que `norm()` siga siendo idempotente y quitando
   acentos, que es de lo que depende el cruce encarte↔catálogo.
2. **Aritmética**, sobre un registro sintético: `por_bloque` no pierde ni
   inventa votos; `rematar` calcula ganador, margen y participación; y una
   sección sin lista nominal devuelve `null`, no 0.
3. **La salida publicada**, que es lo que el frontend lee.

**La primera corrida encontró algo.** Falló con 1 159 votos de diferencia entre
el agregado por sección y el municipal. Resultó ser el hueco ya documentado —
las secciones 681, 781 y 991, que el encarte no asigna a ningún municipio— pero
la aserción quedó **más fuerte** por el hallazgo: ya no exige que no haya
hueco, exige que el hueco esté **explicado por completo** por las secciones
declaradas huérfanas. Una fuga por cualquier otro motivo ya no puede esconderse
dentro de una discrepancia que dábamos por conocida.

**Verificada contra sabotajes**, no sólo por pasar en verde. Se inyectaron seis
fallos uno a uno —partido fuera de bloque, sigla contada dos veces, municipio
borrado, válidos alterados en una sección, lat/lon invertidos en una casilla,
500 votos evaporados del agregado municipal— y los seis se detectaron.

**Conteo honesto: 10 de 12.** `build_geo.py` y `build_inegi.py` siguen sin
autocomprobación; el segundo además no es ejecutable. La cifra correcta a
reportar de ahora en adelante es 10/12, no 10/10.

### 2026-08-21 — Limpieza: cuatro piezas

**1. APRENDIZAJES al día.** 27 → **29 entradas**. Las dos nuevas son de este
trabajo: el render que mentía (`smoothFactor`) y las tres formas de no tener
un dato (hay / falta / no aplica).

**2. Los 17 archivos sin declarar: ahora 0.**
Al perseguirlos aparecieron dos cosas que no sabíamos:

- **Son 12 pipelines, no 10.** `build_geo.py` y `build_inegi.py` viven en
  `frontend/data/geo/` desde antes de que existiera `backend/datalab/pipeline/`.
  `build_fuentes.py` sólo miraba en pipeline/, así que reportaba 10 y daba sus
  salidas por "captura manual". Corregido: ahora busca en los dos directorios.
- **Una declaración desglosada es una declaración.** `contexto_campeche.json`
  mezcla dato del INEGI, estimación propia y simulación; resumirlo en un solo
  valor de `procedencia` habría sido falso. Se declara
  `procedencia_por_bloque`, y el manifiesto lo acepta como declarado —igual que
  ya aceptaba un `null` explícito—. Lo mismo vale para el
  `procedencia_por_campo` que el censo ya traía.

**`build_inegi.py` resultó no ejecutable:** ni su shapefile de origen ni
`pyshp`/`pyproj` están en el repo. Sus 5 geojson se corrigieron en disco, con
una `nota_regeneracion` que lo dice en el archivo mismo.

**3. Basura de otro proyecto, fuera.** `src/` (24 archivos **vacíos** de
DCMarketAg, sin nada que los compilara), `frontend/data/mock/`,
`backend/datalab/reportes/` y `backend/.env.example` —que nombraba `DB_*` y
`GEMINI_API_KEY` de un backend que ya no existe—. Los 10 pipelines siguen en
verde después de borrarlos.

**4. El botón de exportar ya no miente.** CSV **se genera de verdad**, leyendo
la tabla que el usuario tiene delante —con sus filtros ya aplicados— y
escapando según RFC 4180, con BOM para que Excel abra los acentos. Excel y PDF
quedan deshabilitados con el motivo en el `title`.

Un fallo que la verificación en navegador atrapó: la primera versión borraba
`.barra` entera para quitar el adorno, pero la cifra vive **dentro**
(`.barra__txt`), así que vaciaba las columnas "Peso en el estado" y "Total".
Ahora sólo se quita `.barra__relleno`. Se comprobó exportando las dos vistas
reales: 15 filas cada una, sin celdas vacías salvo la que el diseño deja en
blanco a propósito (el total de una columna de porcentajes).

### 2026-08-21 — Partido dominante por distrito

**Local (21): choropleth construido.** Cada distrito local se tiñe con el
ganador de mayoría relativa reusando `mr_distritos` de diputaciones_2024.json
tal cual — no se recalculó ningún ganador. Verificado en navegador leyendo el
`fillColor` de los 21 polígonos: MC 6, SHH 14, PRI-PRD 1, idéntico a la fuente.

**Judicial: sin choropleth, por diseño.** Los cargos judiciales de elección
popular (reforma 2024-2025) no llevan afiliación partidista en la boleta, así
que un color de partido ahí no sería una simplificación sino una afirmación
falsa. Su ficha publica el dato judicial que sí existe —circuito 31, distrito
1— y dice «Partido: no aplica». Verificado que su relleno se queda en 0.05,
el de su propio trazo, y no recibe tinte.

**Federal (2): BLOQUEADO — no existe el dato.**
Los 21 archivos `DIP MR *.xlsx` del IEEC son de diputaciones LOCALES. No es
deducción por el número: lo dice su propio encabezado, idéntico en los 21 —
«RESULTADOS A NIVEL SECCIÓN DE LA ELECCIÓN DE DIPUTACIONES LOCALES POR EL
PRINCIPIO DE MAYORÍA RELATIVA». Un `grep -ril` sobre todo el repo no encuentra
nada de diputaciones federales ni del Congreso de la Unión.

Lo único que tenemos por distrito federal es el catálogo del INE: qué sección
cae en cuál. Eso es geografía, no resultado — no dice cuántos votos tuvo nadie.
Agregar los votos locales por distrito federal daría un número con aspecto de
resultado que no corresponde a ninguna elección celebrada: son boletas
distintas, candidaturas distintas y una autoridad distinta. La capa se queda
sin tinte y su ficha dice «sin dato en el repositorio».

Para desbloquearlo hace falta el cómputo distrital de la elección federal de
diputaciones (Cámara de Diputados) para los 2 distritos de Campeche, que
publica el INE, no el IEEC.

**Qué elige cada demarcación**, ahora en el panel de capas y en la ficha: la
federal manda al Congreso de la Unión, la local al Congreso del Estado, y la
judicial es demarcación para cargos judiciales sin partido asociado. Las tres
se dibujan sobre el mismo territorio; sin decirlo no hay cómo saber que
responden a tres elecciones distintas.

### 2026-08-21 — Capas de distrito: cuatro correcciones

**1. La deduplicación era correcta; el aplanamiento era del render.**
Se amplió la verificación de Fase 1 (que sólo comparó las secciones 3 y 7) a
19 secciones cruzando 4 municipios distintos. El MD5 del polígono es idéntico
siempre — incluso consultando el mismo distrito local desde Campeche y desde
Tenabo. Las 26 peticiones se sostienen; no hay que rehacer el pipeline.

Los vértices guardados coinciden **exactamente** con los de la API (1 955 en el
distrito federal 1, 18 226 en el judicial): el redondeo a 6 decimales no pierde
ninguno. La causa real era `smoothFactor`, que en Leaflet vale 1.0 por defecto
y simplifica cada trazo al dibujarlo. Medido en Ciudad del Carmen a zoom 11:
**773 puntos dibujados con 1.0 contra 2 606 con 0.4** — se descartaba el 70 %
del detalle visible. Corregido a 0.4.

**2. El judicial sí dibujaba: es el estado entero.**
El archivo tiene 18 226 vértices y una geometría válida. El problema es que el
distrito judicial 1 *es* Campeche: el 58 % de sus vértices caen a menos de
500 m del límite estatal (mediana 200 m). Con trazo fino y sin relleno se
pintaba encima del contorno del estado, que ya está dibujado, y encenderlo no
cambiaba nada visible. Ahora: punteado ancho, tinte tenue y la etiqueta dice
«(1, todo el estado)».

**3. Tres matices separados**, no sólo tres guiones: ámbar (federal, sólido
grueso), cian (local, guion corto), rosa (judicial, punteado ancho).

**4. Ficha con el formato del INE**, resuelta por geometría —punto-en-polígono
contra los polígonos descargados— y no por una tabla nuestra. Verificado
contra 415 casillas reales: 100 % resuelve federal, local y judicial. Si el
punto no cae en ningún polígono dice «falta ese dato»; nunca inventa.

**Hallazgo lateral:** el punto-en-polígono discrepa del catálogo en 21 de 409
casillas, todas en distrito local. No es un error: se consultó a la API el
polígono de esas secciones y **tampoco contiene** la casilla de 2024. Es la
resección 2024→2026 ya documentada. El federal coincide al 100 % porque sus
distritos son tan grandes que una resección rara vez cruza su frontera.

### 2026-08-20 — Regresión corregida en `historico.html`

Al colapsar los cargadores (pieza 4 de la limpieza) se rompió la proyección.
El cargador propio de `proyeccion_2027.json` **renombraba** `simulacion` → `sim`
y `sensibilidad` → `sensibilidad`; el genérico no renombra nada. `historico.js`
seguía pidiendo `proyeccion.sim`, recibía `undefined` y `pintar()` reventaba
con "No se pudieron cargar los resultados históricos".

Arreglado en la vista, no en el cargador: la clave real del archivo es
`simulacion`, y ese nombre debe estar donde se consume.

**Lo que falló en mi verificación:** al colapsar comprobé que las 7 vistas
*resolvieran* su cargador —que la función existiera—, no que recibieran la
**misma forma** que antes. Existir y devolver lo mismo son cosas distintas.
Ahora las 7 vistas se prueban contra la salida real del cargador genérico
(`Object.assign({}, json, {meta: json.metadata})`), con el universo completo y
filtrado a un municipio.

De los 7 cargadores, sólo `cargarProyeccion` cambiaba de forma. `cargarCatalogo`
también dejó de renombrar, pero `casillas.js` usa `.secciones`, que sigue
existiendo en la raíz del archivo.

### 2026-08-19 — Limpieza de conjunto: cinco piezas

Auditoría del sistema completo tras cerrar el roadmap. Cinco arreglos.

**1. `fuentes.html` generada, no escrita.** Décimo pipeline `build_fuentes.py`
→ `frontend/data/fuentes.json`. La página de trazabilidad citaba **un solo
archivo** —`data/mock/territorio.json`, muerto desde Fase 2— mientras el
sistema servía 24. Ahora se genera leyendo la metadata de cada archivo
publicado, así que no puede quedarse vieja sin que se note.

Lee la fuente donde cada pipeline la puso (`fuente`, `casa`, `fuente_base`,
`fuentes`) en vez de forzar un cambio de esquema en nueve pipelines
verificados. **No rellena:** lo que no está declarado se lista en
`falta_declarar` — y son **17 de 24 archivos**, casi todos sin `procedencia`.
Un `null` explícito (la fecha de corte del CCT, que la SEP no publica) **no**
cuenta como faltante: es una respuesta, no un hueco.

**2. La deuda #1 saldada.** `escuelas_campeche.geojson` (2 MB) lo bajaban 6
páginas; dos de ellas sólo para contar planteles por municipio. `build_censo.py`
ahora precalcula `cct_por_municipio.json` (**2 KB**) y `app.js` +
`demografia.js` lo consumen. El geojson completo se queda para el mapa, que sí
necesita la geometría. `verificar()` comprueba que el agregado no pierda
planteles: 2,274 = suma + sin municipio.

**3. Dos cifras falsas corregidas.** `mando.html` decía "3 Pendientes —
Secciones y **Distritos** en proceso de acceso" (Fase 1 resolvió los distritos;
son 2). `municipios.html` decía 486 planteles CCT en Campeche; el conteo real
es **459**.

**4. Cargadores colapsados.** `electoral.js` tenía 8 funciones de carga, 7
idénticas. Una sola `cargador(archivo, etiqueta)` parametrizada: **546 → 425
líneas**. Cachea la promesa, no el resultado, y borra la entrada si falla para
no dejar una promesa rota en caché.

**5. Venv recreado limpio.** El anterior era una copia: `bin/pip` apuntaba a
`agroMayia` y `pyvenv.cfg` decía que se creó en `PRIBrain`. Nuevo
`backend/datalab/requirements.txt` con **sólo lo que se importa de verdad** —
openpyxl, numpy, pypdf. La copia arrastraba pandas, python-dateutil y six, que
no usa nadie. Los 10 pipelines pasan con el venv nuevo.

### 2026-08-19 — Fase 6 (parcial): fiscalización externa · Google Trends bloqueado

Noveno pipeline `build_auditoria.py` → `auditoria.json` (92 KB). Panel nuevo en
`riesgos.html` — **no en Finanzas**: es fiscalización externa sobre el municipio,
no gasto de campaña.

**Fuente: ASECAM**, datos abiertos en `.xlsx`. 175 observaciones de las cuentas
públicas 2023 y 2024. **Los 13 municipios cruzan**: Palizada 24 · Campeche 23 ·
Tenabo 18 · Escárcega 15 · Seybaplaya 12 · Candelaria 10 · Calakmul 10 · Calkiní
6 · Hecelchakán 6 · Champotón 5 · Carmen 4 · Dzitbalché 2 · Hopelchén 1.

**Clasificación por TIPO de entidad, no por si el nombre menciona un
municipio.** "Instituto Tecnológico Superior de Champotón" es estatal y está en
Champotón: colgarle esa observación al municipio le atribuiría algo que no es
suyo. Ayuntamiento 90 · organismo municipal (DIF, agua potable) 46 · estatal 39.

**El certificado TLS de ASECAM está incompleto** (sirve sin el intermedio;
`unable to get local issuer certificate`, código 20). **No se desactivó la
verificación.** Se leyó la extensión Authority Information Access del propio
certificado, se descargó el intermedio de DigiCert, se guardó en
`uploads/asecam/RapidSSLTLSRSACAG1.pem` y se añade al almacén del sistema. El
pipeline **aborta** si ese PEM falta, para que nadie lo "arregle" con
`verify=False`.

**Vías descartadas, con su razón:**
- `datos.gob.mx` — su API de CKAN devuelve **403** desde este entorno.
- **ASF federal — BLOQUEADA.** `asf.gob.mx` publica 37 PDF y cero archivos
  procesables; `asfdatos.gob.mx` es un sistema de consulta web, no un catálogo
  de descarga.
- Archivos ASECAM anteriores a 2023 — otro esquema (2022 trae una hoja
  "Pliegos" con otras columnas). Fuera hasta verificar el mapeo.

**GOOGLE TRENDS — BLOQUEADO.** Verificado empíricamente: el endpoint interno da
**HTTP 429 a la primera petición**, `trends.googleapis.com` da **404**, la API
oficial está en **alpha con acceso por solicitud**, y `pytrends` está
**archivada desde abril de 2025**. Se descartaron pagar un tercero y raspar el
endpoint interno (sin contrato, se rompe en silencio, zona gris de ToS). El
usuario tramita el acceso a la API alpha; se retoma cuando haya aprobación.

### 2026-08-19 — Fase 7: correlaciones

Octavo pipeline `build_correlaciones.py` → `correlaciones_2024.json` (9 KB).
Panel nuevo al final de `nse.html`. Badge **Inferencia** en todo.

**El ingreso no existe como variable.** El bloque `nse` es una estimación
**estatal**; su propio archivo dice que "el modelo no baja a nivel municipal y
no se va a inventar el desglose". Lo único municipal es una tipología
cualitativa de 4 grupos, dos de ellos con **un solo municipio**. No hay
correlación ingreso-participación y no se fabricó.

**Dos niveles, separados por su n:**

| nivel | n | correlaciones que incluyen el cero |
|---|---|---|
| sección | 542 | **0 de 4** |
| municipio | 12 | **4 de 5** |

El caso que resume la fase: `participación vs % de 50 y más` da **r = +0.480**
con **IC95 [−0.130, +0.826]** — parece relación moderada y es compatible con no
haber ninguna. Publicar ese 0.480 sin su intervalo era el error que esta fase
existía para no cometer.

**Método:** Pearson, IC95 por **transformación z de Fisher** (asimétrico, porque
r está acotado en [−1,1]), más **jackknife** para ver si el resultado depende de
un caso. Con n=12, quitar Palizada mueve r de +0.480 a +0.360.

A nivel sección lo único demográfico disponible es el **tipo urbano/rural/mixto**
del catálogo del INE. Es categórica, así que se comparan medias con su IC:
urbano 63.72% [62.68, 64.76] · rural 66.88% [64.70, 69.06] — casi se tocan.

**Advertencias publicadas:** falacia ecológica (describe territorios, nunca
personas), Dzitbalché sin censo, **Calkiní contaminado** (su censo 2020 incluye
a Dzitbalché y su resultado 2024 no — quitarlo mueve r de +0.480 a +0.464), y
el desfase Censo 2020 / elección 2024.

**Descartado:** asignar demografía municipal a cada sección para subir n a 542.
Las observaciones no serían independientes —doce valores repetidos— y el
intervalo saldría estrecho por una precisión que no existe.

### 2026-08-19 — Pieza independiente: forensia / detección de anomalías

Séptimo pipeline `build_forensia.py` → `forensia_2024.json` (191 KB, sólo lo
carga `forensia.html`). Nueva vista `js/vistas/forensia.js`.

**El criterio, anclado a la distribución real de las 542 secciones:**
z robusto = `0.6745 × (x − mediana) ÷ MAD`, **estratificado en 5 quintiles de
lista nominal**. Cortes en |z| 2.5 (amarillo) y 3.5 (naranja).

- **Por qué estratificar:** la sd de participación es 14.2 en el quintil más
  chico y 9.5 en el mayor. Un umbral plano marcaría a las chicas por chicas.
- **Por qué mediana y MAD:** la sd la inflan los propios atípicos
  (*enmascaramiento*). MAD tiene breakdown point del 50%; la sd, del 0%.

Reparto: **verde 492 (90.8%) · amarillo 31 (5.7%) · naranja 18 (3.3%) · rojo 1**.

**Regla estructural del semáforo:** el **rojo NO se puede alcanzar por
estadística** — sólo lo enciende una sentencia. Está verificado en
`verificar()`, no confiado a la redacción.

**La verdad-terreno NO calibró el detector, y ése fue el hallazgo.** De las 6
secciones con casillas anuladas (50B, 68B, 78B, 99B, 1B, 122S):

- **5 no tienen resultado publicado** — sus votos se anularon. El detector no
  puede marcarlas. *(Y esto explica 5 de las "19 secciones del catálogo sin
  resultado" que en Fase 1 se atribuyeron a reseccionalización.)*
- La única con datos, la **122, es estadísticamente ordinaria** (|z| < 1 en los
  tres indicadores). Ningún umbral la marcaría.

Conclusión publicada en la propia pantalla: **anomalía estadística y anulación
jurídica miden cosas distintas.** Una casilla se anula por irregularidades de
procedimiento, que no dejan huella en el reparto de votos. Por eso los dos
canales van separados.

**Copy corregido.** La página traía "Nivel de Riesgo", "Acción Jurídica",
"anomalía severa que requiere revisión jurídica" colgando de umbrales, y KPIs
inventados. Los niveles ahora describen lo medido: *Dentro de lo esperado ·
Desviación moderada · Desviación pronunciada · Con resolución del Tribunal*.

**Retirado por falta de dato:** la "divergencia PREP vs Cómputos" que la página
mostraba con cifras inventadas. **No hay datos de PREP en el repositorio.**
Queda pedido — es el indicador más útil para esto. Tampoco se hace análisis de
dígitos (Benford): requiere votos por casilla y sólo hay agregado por sección.

**Hallazgo suelto:** la sección **474** tiene 315 electores, 1 casilla y **cero
votos**. No es participación baja sino ausencia de votación; se declara aparte
para no mezclar un hueco de dato con un patrón de voto.

### 2026-08-18 — Pieza independiente: asignación de diputaciones (MR + RP)

Sexto pipeline `build_diputaciones.py` → `diputaciones_2024.json`. Integración
oficial de la **LXV Legislatura**, con dos fuentes primarias conseguidas:

- **Ley de Instituciones y Procedimientos Electorales del Estado de Campeche**
  (Decreto 236, P.O. 1/jun/2023). Art. 15: 21 MR + 14 RP en una
  circunscripción plurinominal. **Confirmado literalmente.**
- **Acuerdo CG/116/2024 del IEEC** (45ª sesión extraordinaria, 9/sep/2024),
  emitido tras las sentencias TEEC/JIN/DIP/1, 2 y 5/2024.

Texto extraído de ambos PDF (con `pypdf`) en
`backend/datalab/uploads/ieec_acuerdos/`, para re-verificar sin re-descargar.

**El algoritmo estaba mal, no sólo los parámetros.** El **art. 573** asigna
primero **una diputación directa** a cada partido sobre el 3%, y sólo después
reparte *el resto* por cociente natural. Con 6 partidos sobre el umbral, el
cociente se calcula sobre **8** pendientes, no sobre 14. La versión anterior
repartía las 14 por fórmula y producía un resultado plausible que sumaba bien.

Dos bases de votación distintas (art. 569): el **umbral** va sobre Votación
Válida Emitida; el **cociente** sobre Votación Estatal Emitida (que además
deduce a los partidos bajo 3%).

**Resultado oficial** — VVE 419,632 · VEE 397,424 · cociente 49,678:

| partido | MR | RP | total |
|---|---|---|---|
| MORENA | 12 | 4 | 16 |
| MC | 6 | 4 | 10 |
| PRI | 1 | 2 | 3 |
| PAN | 0 | 2 | 2 |
| PT | 1 | 1 | 2 |
| PVEM | 1 | 1 | 2 |

**Comprobación cruzada:** el algoritmo corregido, corrido sobre nuestros
archivos (que son **previos** a las sentencias: 416,950 votos válidos contra
419,632, −2,682), reparte las 14 **exactamente igual** que el acuerdo. Que
coincida partiendo de cifras distintas es lo que valida la fórmula. El MR por
bloque también cuadra: SHH 14 = MORENA 12 + PT 1 + PVEM 1.

**El `computable: false` del art. 116 quedó resuelto:** el acuerdo atribuye los
triunfos de MR *por partido*, así que la prueba de sobrerrepresentación ya se
puede hacer. Ningún partido rebasa los tres límites del art. 575 (MORENA es el
más cercano: 45.71% del Congreso contra un tope de 49.05%).

Panel nuevo en `historico.html`, badge **Dato** con fuente al acuerdo.

### 2026-08-18 — Fase 5: capas analíticas de mapa

**Distinción visual de capas.** Todas las capas de polígono compartían
`--mapa-limite`: con distrito federal y local encendidos a la vez, dos rejillas
idénticas. Ahora cada capa declara su `trazo` en el `CATALOGO` de `mapa.js`:

| capa | color | grosor | guion | relleno |
|---|---|---|---|---|
| Distritos federales (2) | `--serie-3` | 3 px | sólido | 0.04 |
| Distritos locales (21) | `--serie-4` | 1.5 px | `5,4` | 0.03 |
| Distritos judiciales (1) | `--serie-6` | 2 px | `12,6` | 0 |

Distinguen por **forma además de color** (codificación redundante): sobreviven a
la daltonía y al blanco y negro. Las capas sin `trazo` propio siguen igual que
antes. El panel de capas es ahora la leyenda: cada checkbox lleva su muestra.
Cero color nuevo.

**Competitividad y margen de riesgo.** `Electoral.competitividad()`,
`swingNecesario()` y `umbrales()`. El criterio **no es un número redondo**: se
ancla al σ medido en Fase 4.

- Para voltear un resultado basta desplazar **la mitad** del margen:
  `swing = margen ÷ 2`.
- Los cortes van en unidades de la volatilidad observada (σ = 4.5 pp):
  **en riesgo** ≤ 1σ de swing (margen ≤ 9 pp) · **vigilar** ≤ 2σ (≤ 18 pp) ·
  **seguro** por encima.
- Sanidad: caen cerca del 5/10/20 de la literatura. Coincidir es confirmación,
  no el origen.

Resultado: **5 municipios en riesgo, 1 a vigilar, 7 seguros**. Hopelchén se
voltea con 0.1 pp; Carmen necesita 17.5. Va como variable categórica de
coloreado y como dos filas en la ficha al clic.

Dos límites escritos en el código: σ se midió sobre el reparto **estatal** (un
municipio chico se mueve más, así que la clasificación es conservadora), y es
competitividad **de 2024**, no pronóstico de 2027.

Corregido de paso: las píldoras de `cartografia.html` decían "8 capas / 4
pendientes" y llevaban tres fases desfasadas — ahora se cuentan del `CATALOGO`.
Y el σ del umbral se leía de una constante duplicada; ahora `cartografia.html`
carga las encuestas y lo pasa, dejando la constante sólo como respaldo.

### 2026-08-18 — Fase 4: encuestas con margen de error real

Llegó el tracking de **Demoscopia**: 19 meses (ene-2025 a jul-2026), 8
categorías, muestra 1,000, MoE ±3.8% al 95%. Quinto pipeline
`build_encuestas.py` → `frontend/data/electoral/encuestas_2026.json`. Nueva
vista `js/vistas/encuestas.js`; `encuestas.html` perdió sus KPIs inventados.

**Procedencia: `dato_transcrito`, no `dato`.** Es transcripción manual desde la
interfaz de la casa, no descarga oficial. Verificada aritméticamente (los 19
meses suman 100.0%, comprobado de forma independiente), pero un error de lectura
que respete la suma no lo detecta esa verificación.

**El hallazgo que cambió el modelo:** la desviación de la serie **no sirve** como
medida de volatilidad. Cada mes es una muestra distinta de 1,000, y la MoE
declarada implica un efecto de diseño de 1.50. Descomponiendo
`var_obs = var_real + var_muestreo`:

| fuerza | sd obs | sd muestreo | sd real |
|---|---|---|---|
| morena | 1.57 | 1.88 | **0.00** — ruido |
| mc | 1.90 | 1.74 | 0.76 |
| pan | 1.11 | 0.69 | 0.87 |
| pri | 0.99 | 0.82 | 0.55 |
| pvem / pt / otros | — | — | 0.23 / 0.00 / 0.00 |
| no_decide | 3.44 | 1.41 | **3.14** — el que más se mueve |

**`SIGMA_LIDER = 8.0` (supuesto) fue sustituido por σ = 4.5 pp calculado**, de
tres estimaciones convergentes: deriva 18m 4.70 · caminata 11m 5.15 · distancia
2024→2026 3.52. `build_proyeccion.py` lo lee del archivo de encuestas.

**Efecto en la proyección:** SHH pasa de 87.3% a **97.8%** de probabilidad de
victoria; el intervalo del líder se estrecha de [33.4–59.8] a [39.2–54.0].

**Mapeo declarado:** SHH ← morena+pvem+pt (asume que repiten coalición), MC ← mc,
PRI-PRD ← pri, PAN ← pan, OTROS ← otros. `no_decide` **no se reparte**: se
excluye del denominador para el voto efectivo (Cálculo).

Sigue faltando: pares históricos encuesta-resultado para Campeche, que es lo que
permitiría estimar el sesgo encuesta→voto. La σ actual cubre la deriva, no ese
sesgo. Y la serie parece venir **suavizada** (σ del cambio mensual menor que la
del puro muestreo entre muestras independientes).

### 2026-08-18 — Fase 3: proyección 2027 por Monte Carlo (sólo electoral)

Cuarto pipeline: `build_proyeccion.py` → `frontend/data/electoral/proyeccion_2027.json`
(3.9 KB). Dirichlet sobre el reparto real de 2024, **100,000 iteraciones,
semilla fija 20270606**. Publica media, desviación, P5/P50/P95, IC95 y
probabilidad de victoria por bloque. Reemplaza los rangos escritos a mano.

**Dos de los tres insumos que pedía la fase no existen:** no hay ningún dato de
encuesta en el repositorio (`encuestas.html` es estática) ni participación de
2021. El modelo corre con dos observaciones reales.

**La dispersión es un SUPUESTO, no una estimación.** Sólo hay una transición
observada (2021→2024, rms 13.08 pp) y con n=1 no se estima una varianza. Por eso
se publica un **barrido de sensibilidad**: la probabilidad de victoria del
favorito va de **98.8% (σ=4) a 74.1% (σ=13)** — 24.7 pp que no vienen del dato.
`SIGMA_LIDER = 8.0` es el valor publicado.

Resultado con σ=8: SHH 46.5% [33.4–59.8] victoria 87.3% · MC 30.6% [19.0–43.2]
victoria 12.6% · PRI-PRD 12.5% victoria 0.1%. Difiere bastante de los números
escritos a mano que había antes (65/30/5), que estaban anclados en la
gubernatura 2021.

La participación **no** entra al modelo: proyecta reparto, y la participación no
cambia un reparto. Se dice en la metadata.

### 2026-08-18 — Fase 2: cruce demográfico (Censo 2020 ITER)

Llegó el ITER del Censo 2020, a nivel **localidad**. Nuevo `build_censo.py`
(tercer pipeline) → `frontend/data/censo/poblacion_2020.json` y nuevo módulo
`frontend/js/censo.js`. Seis variables de coloreado en `cartografia.html`
(población total, mujeres, hombres, 18+, menores de 18, 50+) y el desglose
completo en la ficha al clic, a nivel municipio y localidad.

Verificado antes de construir: el `*` del INEGI afecta al 71% de las
localidades pero **ninguna con polígono**, así que el mapa tiene cobertura
100%. El desglose municipal viene completo en el ITER. La clave de localidad
del ITER y la de `localidades.geojson` usan **el mismo formato de 9 dígitos**:
cruzan 501 de 511 polígonos.

`tam_loc.csv.csv` resultó ser la leyenda de una columna `TAMLOC` que **este
ITER no trae**. No se usa.

Bug corregido en `mapa.js`: el choropleth **no aplicaba `fichaExtra`**, así que
al hacer clic con un coloreado activo se perdían las filas que cuelgan los
módulos. La rama `'choropleth'` de `Electoral.fichaMunicipio` era código muerto.

También en `cartografia.html`: el badge de procedencia estaba hardcodeado a
`'calculo'` para toda variable. Ahora lo dirige la procedencia declarada por
cada una — el Censo distingue Dato de Cálculo campo por campo.

### 2026-08-18 — Fase 2: proporcionalidad de casillas por distrito

Tokenizados los 3 colores preexistentes (`--hero-claro-*` y `--sombra-ficha` en
`colors.css`, valores preservados exactos). **`verificar-colores.sh` pasa por
primera vez:** 154 tokens, cero hardcoded.

`Electoral.casillasNormativas()` + `porDistrito()` implementan LGIPE art. 253
(una casilla por cada 750 electores de la lista nominal seccional o fracción).
`cargarCatalogo()` trae el catálogo de Fase 1 sólo en la página que lo usa.
Panel nuevo en `casillas.html` anclado a los 21 distritos locales y 2 federales.

Validado: la fórmula reproduce exacto **517 de 542 secciones (95%)** y nunca
queda por encima de lo instalado. Normativa 1,203 · instaladas 1,230 · +27.
El redondeo va **por sección**; hacerlo sobre el total del distrito daría 939
(−264, un 22% menos) y llevaría a concluir un excedente inexistente.

Hallazgo: entre 2024 y 2026 sólo **una** sección cambió de distrito local (la
501, de DL 4 a DL 11).

**BLOQUEADO — el cruce demográfico del INEGI.** `contexto_campeche.json` sólo
trae cifras estatales y dos extremos municipales; no hay población por
municipio ni por distrito, ni grupos de edad. Requiere cargar el tabulado del
Censo. Ver reporte.

### 2026-08-18 — Fase 1: extensión de ficha y resumen estatal

`Electoral.agregar()` y `Electoral.municipiosPorGanador()` centralizan el
cálculo de ganador/margen/participación; `historico.js` dejó de sumar por su
cuenta y ahora las consume. `cartografia.html` gana el resumen estatal fijo y la
ficha municipal al clic, colgada del `fichaExtra` que ya existía.

Bug preexistente corregido: `.punto-color` vivía en `mapa.css`, pero lo pinta
`electoral.js` —módulo compartido— y `historico.html` no carga esa hoja. Los
puntos de color salían sin estilo ahí. Se movió a `components.css`.

Campeche 2024: ganó **PT-PVEM-Morena** con 15.95 pp sobre MC, 10 de 13
municipios. MC ganó Campeche y Dzitbalché; PRI-PRD, Hopelchén.

### 2026-08-18 — Fase 1: cartografía electoral oficial

Nuevo `build_ine_cartografia.py`. El endpoint del INE resultó devolver los
**distritos que contienen** a la sección, no la sección: se destrabaron
distritos federales, locales y judiciales (de 4 capas pendientes a 2), pero la
geometría de sección sigue faltando. 26 peticiones en vez de 555 porque el
polígono de un distrito es idéntico se pida desde donde se pida.

Se añadió el desglose de votos por partido (16 contendientes, estatal +
matriz municipal) a `historico.html`, calculado en el navegador sobre datos ya
cargados — sin archivo ni fetch nuevos. `verificar-colores.sh` falla con 3
colores **preexistentes** en `layout.css` y `mapa.css`, ajenos a este cambio.

Pendiente de decidir: si se corrigen esos 3 colores; y arrancar Fase 2.

### 2026-08-17
Auditoría completa del sistema: pipeline, capa de datos, módulos JS y las 24
páginas. Se reescribió este CONTEXTO.md, que hasta hoy describía otro proyecto
(DCMarketAg, marketplace B2B de negociación entre agentes).

Se crearon `ARQUITECTURA.md` (criterio y deuda) y `APRENDIZAJES.md` (bitácora
de data engineering, 9 entradas retroactivas). Los tres documentos quedaron
fuera de git; `CONTEXTO.md` se desrastreó con `git rm --cached`.

Pendiente de decidir: borrar `src/` (DCMarketAg), `frontend/data/mock/`,
`backend/datalab/reportes/` y los XLSX de OOH; commitear el movimiento de
`build_electoral.py` a `backend/datalab/pipeline/`.
