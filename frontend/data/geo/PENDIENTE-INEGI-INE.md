# Tarea pendiente: polígonos oficiales

Estado: **parcialmente resuelta (2026-08-18).** Los distritos ya están; falta
la geometría de sección.

---

## ✅ RESUELTO — Distritos, sin shapefile y sin cuenta

`backend/datalab/pipeline/build_ine_cartografia.py` los obtiene de un endpoint
público del INE que **no pide token ni cuenta**:

```
https://cartografia.ine.mx/sige8/api/getConoceTuNuevoDistrito?entidad=4&seccion=N
```

Ya publicados y activables en el mapa:

| capa | features | archivo |
|---|---|---|
| Distritos federales | 2 | `distritos_federales.geojson` |
| Distritos locales | 21 | `distritos_locales.geojson` |
| Distritos judiciales electorales | 1 (circuito 31) | `distritos_judiciales.geojson` |

Y la jerarquía tabular de las 555 secciones (sección → distrito federal,
distrito local, municipio, urbano/rural) en
`../electoral/secciones_catalogo_2026.json`, salida de los catálogos del INE
que ya estaban descargados en `backend/datalab/uploads/cartografiaCampeche/`.

Esto responde el punto 4 de "qué necesito de tu lado": **los distritos locales
ya no hay que pedírselos al IEEC.**

---

## ❌ SIGUE PENDIENTE — Geometría de sección

El endpoint **no devuelve el polígono de la sección que se le pide**: devuelve
los tres distritos que la contienen. Su nombre lo dice — "conoce tu nuevo
distrito" responde *¿en qué distrito estoy?*, no *¿qué forma tengo?*.

Así que sigue sin poderse pintar la sección como superficie. Hay resultado
seccional de 542 secciones y jerarquía de 555, pero no polígono. Se sigue
viendo como punto de casilla y agregada a municipio.

Para esto sí hace falta el **shapefile del Marco Geográfico Electoral** del
INE, y sigue aplicando todo lo de abajo.

---

## ⚠ La geografía electoral cambió entre 2024 y 2026

El catálogo del INE es del corte **febrero 2026**; los resultados son del
proceso **2024**. No cruzan 1 a 1:

- **19 secciones** existen en 2026 y no tienen resultado 2024 (las 558–571 son
  nuevas; también 1, 50, 68, 78 y 99).
- **6 secciones** tienen resultado 2024 y ya no están en el catálogo: 4, 79 y
  105 desaparecieron por reseccionalización; 681, 781 y 991 nunca fueron
  secciones territoriales (voto anticipado / en el extranjero).

Está publicado en `metadata.reconciliacion_2024` del catálogo. **No es un error
de captura y no hay que "arreglarlo"**: quien cruce resultado 2024 con
geografía 2026 tiene que declarar el faltante, igual que con las casillas sin
coordenada.

---

## Lo que sigue pendiente del shapefile

Desbloquea el choropleth real y las capas de superficie que faltan.

---

## Qué falta y de dónde sale

### Marco Geoestadístico — INEGI

Portal: <https://www.inegi.org.mx/temas/mg/> → descarga **por entidad**, clave
**04 (Campeche)**. Es un ZIP con shapefiles. De adentro sirven:

| archivo | capa del mapa | prioridad |
|---|---|---|
| `04mun.shp` | Municipios | **alta** — sin esto no hay choropleth real |
| `04l.shp` / `04lpr.shp` | Localidades (urbanas y rurales) | media |
| `04a.shp` | AGEB urbanas | media |
| `04ar.shp` | AGEB rurales | media |
| `04ent.shp` | Límite estatal | baja — ya tenemos uno |

**Requisito que no se puede pasar por alto:** la edición tiene que ser **2021 o
posterior**. Campeche pasó de 11 a 13 municipios ese año, cuando el congreso
local creó Dzitbalché y Seybaplaya. Una edición previa te va a dar 11 polígonos
y dos municipios sin geometría, y el mapa va a mentir en silencio. Al recibir el
archivo lo primero que verifico es que traiga 13.

### Cartografía Electoral — INE

Portal: <https://cartografia.ine.mx/sige7/> (Sistema de Consulta de Cartografía
Electoral). De ahí salen:

| capa | nota |
|---|---|
| Secciones electorales | el corte cambia con cada redistritación |
| Distritos federales | vigentes para el proceso 2027 |
| Distritos locales | pueden venir del IEEC en vez del INE |
| Casillas históricas | no es cartografía: son los **encartes** de procesos anteriores |

El acceso a algunos productos del INE pide cuenta o solicitud formal. No sé si
ya la tienen.

---

## Qué necesito de tu lado

1. **Autorización para descargar yo el Marco Geoestadístico**, o el ZIP puesto en
   `frontend/estados/`. Es una descarga grande de un sitio de gobierno; no la
   hago sin que me digas.
2. **Confirmar la edición** que quieres usar. Recomiendo la más reciente
   disponible, y en todo caso ≥2021 por lo de los 13 municipios.
3. **Decirme si tienen acceso al INE** para la cartografía electoral, o si eso
   se gestiona aparte y va más adelante en el calendario.
4. ~~**Los distritos locales**: confirmarme si los consigues del IEEC Campeche o
   los esperamos del INE.~~ **Resuelto**: salieron del endpoint público, los 21.

## Qué necesito instalar (yo lo hago, es aviso no petición)

En esta máquina no hay nada para leer shapefiles: ni `ogr2ogr` (GDAL), ni
`pyshp`, ni `fiona`, ni `geopandas`. Cuando llegue el ZIP instalo `pyshp`, que
es la dependencia más chica de las cuatro y alcanza para convertir SHP a
GeoJSON. Si prefieres cero dependencias nuevas, la alternativa es que exportes
el GeoJSON desde QGIS de tu lado y me pases eso.

---

## Qué se destraba cuando llegue

- Choropleth municipal de verdad, con superficie pintada. Hoy es un círculo
  anclado en la cabecera, marcado como provisional en la leyenda.
- Las capas de municipios, localidades y AGEB pasan de "pendiente de insumo" a
  activables.
- Navegación estado → municipio → localidad (regla transversal 5). Hoy sólo
  llega a municipio, y por agregación de puntos.
- Cruce de las 2,274 escuelas contra sección electoral, que es lo que permite
  hablar de cobertura de casilla en serio.

Nada de esto se simula mientras tanto. El mapa registra las capas vacías y las
muestra inhabilitadas con su fuente de origen en el tooltip.

De las 4 capas que estaban en `pendiente`, quedan **2**: secciones electorales
(falta el shapefile) y casillas aprobadas 2027 (dependen de acuerdos del INE
que todavía no existen).
