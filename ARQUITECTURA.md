# Cerebro Electoral — Arquitectura

Documento de **criterio**, no de inventario. El inventario (qué contiene cada
carpeta, cada archivo, cada campo) está en [CONTEXTO.md](CONTEXTO.md). Aquí va
por qué el sistema está armado así, cómo se reparte el trabajo entre las piezas,
y qué importa más que qué.

---

## 1. La forma del sistema

```
  INSUMO CRUDO            TRANSFORMACIÓN           DATO SERVIDO         PRESENTACIÓN
  ────────────            ──────────────           ────────────         ────────────

  XLSX del INE/IEEC  ──►  build_electoral.py  ──►  frontend/data/  ──►  HTML + JS
  (no se tocan)           (venv de datalab)        (JSON/GeoJSON)       (vanilla)
                                                        │
  SHP del INEGI      ──►  build_geo.py        ──────────┤
  KML de My Maps          build_inegi.py                │
                                                        │
  Publicaciones      ──►  captura manual      ──────────┘
  institucionales         (contexto_campeche.json)

  Radio en vivo      ──►  MonitorSol (FastAPI + Whisper, :8001)  ──►  medios.html
                          la ÚNICA pieza con proceso corriendo
```

**La regla que define todo:** la transformación ocurre **una vez, en tu máquina,
y su resultado se commitea**. El navegador nunca transforma; sólo lee y pinta.
El build de Vercel no corre Python, no instala nada, no toca la base de datos —
porque no hay base de datos.

---

## 2. Cómo se reparte el trabajo

Cada capa tiene **una** responsabilidad y no invade la siguiente.

### Capa 1 — El crudo (`backend/datalab/uploads/`)

**Responsabilidad:** existir sin cambiar.

Es el archivo tal como lo publicó la institución. No se edita, no se limpia, no
se le corrige un acento. Si algo está mal en el crudo, se corrige en el
pipeline y queda escrito por qué. El crudo es la prueba: sin él, ningún número
del sistema es defendible.

### Capa 2 — El pipeline (`backend/datalab/pipeline/`)

**Responsabilidad:** convertir crudo en dato, y **fallar ruidosamente** cuando
no puede.

Todo el conocimiento sucio del dominio vive aquí y en ningún otro lado:

| problema del crudo | cómo lo resuelve el pipeline |
|---|---|
| El encabezado no dice qué partido es cada columna (son 16 logos PNG) | md5 de cada logotipo contra la tabla `LOGOS`. Un logo desconocido **detiene el proceso** |
| El número de columnas cambia entre distritos (Palizada trae 12, no 16) | se resuelve por archivo, nada de posiciones fijas |
| El encarte numera municipios con el orden del INE, el INEGI con otro | cruce **por nombre normalizado**, nunca por número |
| El encarte no trae coordenadas, sólo domicilio en texto libre | similitud Jaccard contra el catálogo CCT (`UMBRAL_CRUCE = 0.55`) |
| Los nombres de funcionarios de casilla son datos personales | se descartan en el pipeline, nunca llegan al JSON |

Y verifica: la suma de los 16 partidos debe dar **exactamente** la columna
VOTOS VÁLIDOS del archivo original.

**Por qué importa que esto esté aquí y no en el navegador:** si el cruce de
logotipos viviera en JS, cada usuario recalcularía lo mismo, un error saldría en
producción en vez de en tu terminal, y no habría forma de auditar el resultado
sin abrir DevTools.

### Capa 3 — El dato servido (`frontend/data/`)

**Responsabilidad:** ser un contrato estable y **autodescriptivo**.

Cada archivo lleva su `metadata`: `fuente`, `fecha_corte`, `cobertura`,
`metodologia`, y las excepciones que no se pueden perder — las tres sentencias
del TEEC, los 11 registros de voto anticipado, las 3 secciones sin municipio,
los 170 sitios sin coordenada con su motivo.

**El principio duro:** lo que no se tiene, se declara. No se rellena, no se
promedia, no se recorre al centroide del municipio. Un `casillas_2024_sin_geo.json`
con 170 registros y su motivo vale más que 170 puntos inventados en el mapa.

### Capa 4 — Los módulos JS (`frontend/js/`)

**Responsabilidad:** una puerta por dominio, y helpers que hacen imposible
violar las reglas.

| módulo | es la única puerta a… | la regla que hace cumplir |
|---|---|---|
| `electoral.js` | resultados 2024 | ninguna vista lee el JSON directo; todas pasan por `Electoral.cargar()`, que cachea |
| `territorio.js` | contexto capturado a mano | `intervalo()` es la **única** forma de imprimir una proyección — imprime central + rango juntos |
| `procedencia.js` | el origen de cualquier cifra | 6 tipos, un solo lugar los produce. Cambia el criterio, cambia toda la app |
| `mapa.js` | Leaflet y las capas | catálogo con estado `disponible`/`pendiente`. Lo pendiente se registra con checkbox inhabilitado; **no se inventan polígonos** |
| `filtros.js` | el estado de filtrado | `sessionStorage` + URL. **localStorage a propósito no** |
| `auth.js` | la navegación | `NAV` es fuente única de los 7 grupos del riel |

Dos de esas reglas merecen explicación porque parecen arbitrarias y no lo son:

> **`intervalo()` y no un número.** Un porcentaje proyectado impreso solo se lee
> como resultado. En una herramienta que alguien usa para decidir dónde poner
> gente el día de la elección, esa confusión es el modo de fallo caro. Por eso
> no existe una sola ruta en `historico.js` que pinte un central sin su rango.

> **`sessionStorage` y no `localStorage`.** Si los filtros sobrevivieran al
> cierre del navegador, alguien abriría la herramienta días después, vería todo
> recortado a un municipio sin acordarse de por qué, y sacaría conclusiones
> sobre datos parciales. Muere con la pestaña, a propósito.

### Capa 5 — Las páginas (`frontend/*.html`)

**Responsabilidad:** componer. Nada más.

Una página declara `data-page`, incluye sus `<script>` en orden y monta
contenedores. La lógica vive en los módulos. Hoy esto se cumple bien en el grupo
**Territorio** (7 páginas con datos reales) y **no** en Análisis / Operación /
Sistema, que traen su contenido incrustado en el HTML.

---

## 3. Qué importa más que qué

Ordenado por lo que costaría perderlo.

### Crítico — sin esto el sistema deja de ser defendible

| pieza | por qué |
|---|---|
| **El crudo en `uploads/`** | es la prueba de todo. Sin él, ningún número es auditable |
| **`build_electoral.py`** | contiene todo el conocimiento del dominio. Reescribirlo desde cero es semanas, no días — el mapeo de logotipos salió de abrir 16 imágenes una por una |
| **`procedencia.js`** | es lo que impide que una estimación se lea como dato. Es la diferencia entre una herramienta seria y un tablero bonito |
| **Los `metadata` de los JSON** | las sentencias del TEEC, las secciones sin municipio, los 170 sin geo. Se pierden en silencio y nadie nota que faltan |

### Alto — el valor visible del producto

`electoral.js` + `mapa.js` + las 4 vistas de Territorio. Es lo único que hoy
corre sobre datos reales de punta a punta. Si hay que demostrar el sistema, se
demuestra esto.

### Medio — armado, pendiente de dato real

Análisis, Operación y Sistema (12 páginas). La UI está resuelta; el contenido es
demostración incrustada en HTML. Valen como contrato visual de lo que va ahí.

### Frágil — funciona pero no debería quedarse así

| pieza | riesgo |
|---|---|
| **MonitorSol** | sólo hay `.pyc`. No se lee, no se corrige, y se rompe al actualizar Python |
| **`medios.html`** | 1,454 líneas con el contrato de la API inline, contra un backend que no se puede modificar |

### Residuo — borrable sin consecuencia

`src/` (DCMarketAg), `frontend/data/mock/`, `backend/datalab/reportes/`, los
XLSX de OOH en `uploads/`, `backend/.env.example`.

---

## 4. Decisiones y por qué se tomaron así

| decisión | alternativa descartada | razón |
|---|---|---|
| **Frontend estático** | API + base de datos | el dato cambia una vez cada tres años. Una API sería infraestructura que mantener, monitorear y pagar para servir archivos que no cambian |
| **JSON commiteado al repo** | generarlo en el build | Vercel no corre Python. Y commiteado es diffeable: se ve qué cambió entre dos corridas del pipeline |
| **Vanilla, sin bundler** | React / Vite / Next | 24 páginas y 9k líneas de JS. Un build step agrega una forma de fallar sin resolver ninguna que exista |
| **Módulos en `window`** | ES modules / imports | funciona con `file://` y sin servidor. El costo real está abajo, en Deuda |
| **Leaflet por CDN** | npm + bundle | una etiqueta `<script>` contra un `package.json`, un lockfile y un build |
| **Sin login** | auth por rol | la plataforma es de acceso abierto hoy. Cuando haya control por rol, se construye contra el rol — no contra el bloque de sesión que se borró |

---

## 5. Deuda arquitectónica

Ordenada por valor de arreglarla, no por gravedad.

### 1. `escuelas_campeche.geojson` (2.1 MB) se baja entero para contar

Cinco páginas lo piden: `app.js`, `demografia.js`, `cartografia`,
`infraestructura`, `municipios`. Varias sólo para **agregar por municipio** —
contar escuelas y sumar alumnado. Eso son 13 filas que el pipeline puede
precalcular en ~2 KB.

*Arreglo:* emitir `data/electoral/cct_por_municipio.json` desde el pipeline y
que las vistas lean eso. El geojson completo se queda solo para el mapa, que sí
necesita la geometría. **Es el cambio con mejor relación valor/esfuerzo del
proyecto.**

### 2. El orden de carga de scripts está replicado en 24 HTML

El nav tiene fuente única (`NAV`), los `<script src>` no. Agregar un módulo son
24 ediciones, y un orden mal puesto falla en runtime sin aviso.

*Arreglo:* ninguno barato. Un bundler cuesta más de lo que resuelve a esta
escala. **Conviene saberlo, no arreglarlo todavía.** Se vuelve urgente si
aparece un décimo módulo o si empieza a haber dependencias cruzadas nuevas.

### 3. Datos de demostración dentro del camino de código real

`MUNICIPIOS_PREDICCION` vive en `app.js`, que carga en **todas** las páginas. Y
17 páginas traen su contenido incrustado en el HTML. El sistema de procedencia
resuelve esto a nivel de *pantalla* — el badge "Simulado" se ve — pero a nivel
de *archivo* no se distingue lo real de lo demo sin abrirlo.

*Arreglo:* mover lo simulado a `data/demo/*.json` con `procedencia: "simulado"`
en el propio archivo. Cuando llegue el dato real, se sustituye el archivo y las
vistas no se tocan. Hacerlo **antes** de que llegue el dato real de Análisis y
Operación, no después.

### 4. MonitorSol sin código fuente

Es el único riesgo que no se puede mitigar desde este repo: hay que recuperar
los `.py` de la máquina donde se desarrollaron. Mientras tanto, los desajustes
de contrato se arreglan del lado del frontend o no se arreglan.

### 5. Falta geometría de secciones

Hay resultado seccional (542 secciones) pero no polígono, así que la sección no
se puede pintar como superficie: se ve como punto de casilla y agregada a
municipio. Bloquea 4 capas del mapa. Detalle y portales en
`frontend/data/geo/PENDIENTE-INEGI-INE.md`.

> **Requisito que no se puede pasar por alto:** el Marco Geoestadístico del
> INEGI tiene que ser **edición 2021 o posterior**. Campeche pasó de 11 a 13
> municipios ese año (Dzitbalché y Seybaplaya). Una edición previa da 11
> polígonos, dos municipios sin geometría, y **el mapa miente en silencio**.

---

## 6. Cómo crecer sin romper esto

- **Dato nuevo** → entra por el pipeline, sale como JSON con su `metadata`.
  Nunca se captura a mano algo que un script pueda leer del crudo.
- **Cifra nueva en pantalla** → sale con `Procedencia.badge()`. Sin excepción.
- **Proyección nueva** → sale con `Territorio.intervalo()`. Sin excepción.
- **Capa nueva del mapa** → se registra en el `CATALOGO` de `mapa.js`, aunque
  todavía no exista el archivo: se registra como `pendiente` y con la fuente de
  donde hay que obtenerla.
- **Módulo nuevo en JS** → primero preguntarse si cabe en uno existente. Cada
  módulo nuevo son 24 etiquetas `<script>` más y un orden de carga más frágil.

---

*Mantener junto con [CONTEXTO.md](CONTEXTO.md) y [APRENDIZAJES.md](APRENDIZAJES.md).
Éste explica el porqué; `CONTEXTO.md`, el qué; `APRENDIZAJES.md`, el concepto de
data engineering detrás de cada decisión, con su código real. Al cerrar sesión ("terminamos por hoy") se actualiza la bitácora de
CONTEXTO.md, y este archivo sólo si cambió una decisión de arquitectura.*
