# Tarea pendiente: polígonos oficiales

Estado: **bloqueada, requiere acción de tu lado.**
Desbloquea el choropleth real y 8 de las 9 capas pendientes del mapa.

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
4. **Los distritos locales**: confirmarme si los consigues del IEEC Campeche o
   los esperamos del INE.

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
