# Diseño — Tablero Cerebro Electoral

Referencia visual (imágenes del cliente, oct 2026): **paneles redondos y planos sobre casi negro**, cifras blancas grandes, color vivo sólo en el dato, encabezados tipo pestaña HUD. Sin vidrio translúcido, sin brillos de IA, sin escalar botones al pasar el cursor.

Todo vive en tokens (`css/colors.css`, `css/design-system.css`) y en el bloque final **"TABLERO"** de `css/components.css`. Quitar ese bloque devuelve el diseño anterior.

## Color
- Fondo `#03050b` / paneles `#090e1a` / tarjetas `#0d1424`. Borde `rgba(255,255,255,.09)`.
- Blanco `#fff` para títulos y cifras; cuerpo `#c3cad8`; apagado `#7d889e`.
- Azul sólo oscuro: botón `#2a38c4`; selección `#6d4cf0` (violeta).
- Series (en este orden): violeta `#8b5cf6` · cian `#22e0ff` · lima `#b6f03c` · ámbar `#ffb020` · magenta `#ff3d81` · azul `#3b82f6`. Partidos y severidad conservan sus colores institucionales/semánticos.
- Mapas: escala secuencial tipo plasma `--escala-1..6` (índigo → violeta → magenta → naranja).

## Tipografía
Space Grotesk (títulos y cifras) · Inter (cuerpo) · JetBrains Mono (etiquetas, cifras de tabla, insignias). Números siempre `tabular-nums`.

## Firma
1. **Encabezado de panel** `.panel__titulo`: pestaña angulada violeta + línea fina que corre hasta un cuadrito terminal (se dibuja sola en `.panel` cuyo primer hijo es el título).
2. **Barras rayadas** `.barra`: relleno diagonal en el color de la serie, marca blanca al final del valor, una serie distinta por fila, cifra en ficha oscura.

## Cómo deben verse las gráficas (de la referencia de estadísticas)
- Barras: rayado diagonal fino; la barra resaltada en color, el resto en gris claro; valor sobre la barra en blanco; eje y ticks tenues; líneas de cuadrícula punteadas.
- Barras horizontales: pista oscura con borde fino, relleno rayado, marca blanca en el extremo, % a la derecha.
- Barras apiladas / dobles: dos tonos de la misma serie (claro = valor, oscuro = comparación), leyenda arriba con cuadritos.
- Líneas: trazo fino blanco o de color, puntos pequeños, un punto resaltado con anillo y su valor encima; versión de área con degradado de la serie a transparente.
- Combo barras + línea: barras grises rayadas, línea de color con marcadores.
- Anillos (pie/gauge): arco grueso de color + anillo exterior punteado/segmentado, cifra grande al centro, etiquetas con línea guía; gauge semicircular con ticks.
- Dispersión: cuadrados o círculos translúcidos con borde de color; radar: polígonos concéntricos con relleno tenue.
- Flujos (ref. verde): líneas luminosas que convergen en un círculo con la cifra final; tarjetas de KPI con chip de variación (▲ 21.6 %).
- Encabezado de cada gráfica: pestaña HUD (como `.panel__titulo`). Fondo siempre casi negro; el color es sólo el dato.

## Composición (bento)
Riel de iconos a la izquierda; un panel héroe grande (mapa/gráfica principal) con una columna de tarjetas apiladas a su derecha; debajo una fila de tarjetas pequeñas (KPI, tabla, mazo de tarjetas). Radios grandes (18–26 px), separación 16 px, un solo acento por tarjeta.
