# ceNetwork

Escucha social con mapa (MapLibre). Frontend Vite + TypeScript (`:5174`) y backend FastAPI (`:8000`).
`frontend/ceNetwork` es un symlink a esta carpeta (`ceNetwork/`).

## Arranque rápido (2 terminales)

**Backend**
```bash
cd ceNetwork/backend
source venv/bin/activate          # primera vez: python3 -m venv venv && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Comprobar: http://localhost:8000/health

**Frontend**
```bash
cd ceNetwork
npm install                       # solo la primera vez
npm run dev                       # http://localhost:5174
```

Otros: `npm run build` · `npm run preview` · `npm run build:geo`.

## Configuración

Copiar los ejemplos si faltan los `.env` (no se suben al repo):
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```
- `.env` (frontend): `VITE_API_URL=http://localhost:8000`, `VITE_API_TOKEN` (igual a `API_TOKEN` del backend si lo usas).
- `backend/.env`: ver abajo.

## Modos de fuente (`backend/.env`)

| | Con Apify | Sin Apify (demo) |
|---|---|---|
| Variables | `FUENTE=apify`, `FACEBOOK_FIXTURE=false` | `FUENTE=fixture` |
| Origen de posts | Actores de Apify en vivo | `public/data/tlalpan_facebook.json` (18 posts de una corrida real) |
| Costo | Créditos de Apify por llamada | Ninguno |
| Alcance | Cualquier lugar, tema o persona | Solo Tlalpan, filtrado por el tema escrito |
| Etiqueta en pantalla | En vivo | "Datos de ejemplo (fixture)" |
| Modo Persona | Dos pasos (perfiles → análisis) | Flujo anterior, sin perfiles ni página elegida |

### Con Apify
- Variables: `APIFY_TOKEN`, `APIFY_MAX_POSTS` (20), `FUENTE_CACHE_ONLY=0`, `MAX_REAL_SEARCHES_PER_HOUR`, `APIFY_PROFILE_SEARCH_TYPE`, `GEMINI_API_KEY`.
- **Tema**: `apify/facebook-search-scraper` con `{"categories": [query], "searchType": "posts", "resultsLimit": N}`. Si trae <5 posts, reintenta con una query más corta.
- **Persona paso 1** (`POST /social/persona/perfiles`): mismo actor con `searchType: "pages"` (nombre, URL, foto, verificación).
- **Persona paso 2** (`POST /social/persona/analizar`): `apify/facebook-posts-scraper` sobre la página elegida (`startUrls`, `resultsLimit`) + búsqueda del nombre entre comillas para menciones de terceros.
- **Caché**: `backend/.cache/apify/<hash>.json` (sha256 de tema, modo y tope). Una respuesta vacía no se guarda ni se reutiliza.
- **Límites/fallos**: pasado el tope por hora → 429. Si Apify falla en Tema cae al fixture; en Persona responde 502 (para no mostrar datos de ejemplo como si fueran de la persona).

### Sin Apify
- `get_configured_fuente()` lee el fixture y lo normaliza con `map_to_common_schema` (mismo esquema que Apify).
- `FUENTE_CACHE_ONLY=1`: sirve solo lo de `.cache/apify/`; si no hay caché, cae al fixture. Ideal para demos con el cliente.
- Reabrir una tarjeta del historial lee el JSON guardado: no llama a Apify ni a Gemini.

### Igual en ambos modos
Filtro de fecha (14 días), filtro por tema, clasificación con Gemini (o reglas si falta la key), deduplicación, sentimiento con pysentimiento, separación oficial / afín / medios, endpoints `POST /social/buscar` y `GET /social/buscar/{id}/resumen`, fichas, historial (`backend/.cache/historial/`) y el front.

## Problemas comunes
- **0 resultados**: revisar `FUENTE`, `APIFY_TOKEN` y que haya un lugar elegido en el selector (no hay territorio preseleccionado).
- **El front no conecta**: backend apagado o `VITE_API_URL` incorrecto; reiniciar `npm run dev` tras cambiar `.env`.
- **Puerto ocupado**: `lsof -i :5174` / `lsof -i :8000`.
