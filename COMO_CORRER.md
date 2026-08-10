# Cómo correr el proyecto

Son **3 procesos** independientes. Hay que tener los 3 corriendo a la vez.

| # | Servicio        | Carpeta              | Puerto | Tecnología        |
|---|-----------------|----------------------|--------|-------------------|
| 1 | Monitor (audio) | `backend/monitorsol` | 8001   | Python / FastAPI  |
| 2 | Backend API     | `backend`            | 3001   | Node / Express    |
| 3 | Frontend        | `frontend`           | 5173   | React / Vite      |

El front (Vite) hace proxy:
- `/api/monitor/*` → `localhost:8001/monitor/*` (servicio Python)
- `/api/*` (resto: chat, departamentos) → `localhost:3001` (Node)
- WebSocket `ws://localhost:8001/ws/...` → directo, sin proxy

---

## 1. Monitor Python (monitorsol) — puerto 8001

```bash
cd backend/monitorsol
source venv/bin/activate
export SSL_CERT_FILE=/Library/Frameworks/Python.framework/Versions/3.12/etc/openssl/cert.pem
export REQUESTS_CA_BUNDLE=/Library/Frameworks/Python.framework/Versions/3.12/etc/openssl/cert.pem
uvicorn main:app --host 0.0.0.0 --port 8001
```

- **NO uses `--reload`**: el código está como `.pyc` sin fuente (sourceless) y el reloader falla al re-importar.
- Comandos en **líneas separadas**, no todo pegado en una sola línea.
- Verifica: http://localhost:8001/docs debe dar 200.

### ⚠️ El source `.py` no existe (solo `.pyc`)
El código fuente del monitor nunca se subió a git; solo quedaron los `.pyc` compilados
(Python 3.12). La app fue reconstruida extrayéndolos del commit `44633bd4` como módulos
sourceless. Estructura actual:

```
backend/monitorsol/
├── main.pyc
├── config.pyc
├── api/{monitor_routes,websocket}.pyc
├── core/{keyword_detector,session_manager,stream_capture,transcriber}.pyc
├── db/{__init__,models,testigos_repo}.pyc + testigos.sqlite
└── venv/
```

Si los `.pyc` se borran, recuperarlos así (desde la raíz del repo):

```bash
C=44633bd4
for f in $(git ls-tree -r --name-only $C -- backend/monitorsol | grep 'cpython-312.pyc'); do
  rel=${f#backend/monitorsol/}
  dest="backend/monitorsol/$(echo "$rel" | sed 's#__pycache__/##; s#\.cpython-312##')"
  mkdir -p "$(dirname "$dest")"
  git show "$C:$f" > "$dest"
done
git show "$C:backend/monitorsol/db/testigos.sqlite" > backend/monitorsol/db/testigos.sqlite
```

> Para **editar** el monitor necesitas el `.py` real (de otra máquina/backup). Con `.pyc` solo se ejecuta.

### Rutas que expone (bajo `/monitor`)
`POST /monitor/start` · `DELETE /monitor/stop/{sesion_id}` · `GET /monitor/sessions` · `GET /monitor/testigos` · `WS /ws/{sesion_id}` · `GET /health`

---

## 1.5 Datos de Campeche (antes del primer `npm run dev`)

El frontend importa `frontend/src/data/campeche.json` y descarga
`frontend/public/data/geo.json`. **Ninguno de los dos está en git** — son
artefactos generados. Si acabas de clonar, el build de Vite falla hasta que los
generes:

```bash
python3 backend/datalab/build_campeche.py --fetch
```

Solo stdlib, no necesita venv ni pip. `--fetch` descarga el KML de escuelas
(~7.8 MB) desde Google My Maps; sin la bandera reutiliza el que ya esté en
`backend/datalab/uploads/`. Salida esperada:

```
OK · 2274 planteles · 1469 sitios · 506 localidades · 29 bloques (14 pendientes de fuente)
escrito → frontend/src/data/campeche.json (49 kB)
escrito → frontend/public/data/geo.json (1786 kB)
```

`--check` valida sin escribir: falla si el pipeline rompe una garantía del spec
(escuelas naciendo como casilla confirmada, casillas 2027 rellenadas con cifras
de 2024, bloques sin procedencia).

El build es determinista (semilla fija): dos corridas dan el mismo archivo.

> **Casi todo el dataset es simulado.** Reales: el catálogo de escuelas y
> localidades (SIGED/SEP), las claves y nombres de municipio, y la población del
> Censo 2020. Todo lo demás sale marcado `clase: Estimacion` con
> `fuente: "ejemplo"` o `"pendiente"`, y el frontend lo pinta como tal. No usar
> ninguna cifra marcada así para decidir nada.

### Oaxaca (pausado)
`frontend/src/data/electoral.json` y `backend/datalab/uploads/ANALISIS.xlsx` son
el dataset anterior (Oaxaca). Se conservan como referencia pero el frontend ya
no los lee. El script que generó `electoral.json` no existe en el repo: ese
dataset no es reproducible.

---

## 2. Backend Node (API) — puerto 3001

```bash
cd backend
cp .env.example .env     # solo la primera vez
# editar .env: GEMINI_API_KEY y datos de MySQL
npm install              # solo la primera vez
npm run dev              # o: npm start
```

`.env` requerido:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=dashboard_ia_db
DB_PORT=3306
GEMINI_API_KEY=tu_api_key   # https://aistudio.google.com/app/apikey
PORT=3001
```

> Nota: en `index.js` la importación de `monitorRoutes.js` está comentada a propósito
> (ese archivo nunca existió; el monitor es el servicio Python, no una ruta del Node).
> Si lo descomentas, el Node crashea con `ERR_MODULE_NOT_FOUND`.

---

## 3. Frontend — puerto 5173

```bash
cd frontend
npm install              # solo la primera vez
npm run dev
```

Abre http://localhost:5173

El proxy está en `frontend/vite.config.ts`. Si reinicias el front, toma la config nueva.

---

## Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `ERR_MODULE_NOT_FOUND ...monitorRoutes.js` | Node importa una ruta inexistente | Ya comentado en `index.js`; no lo descomentes |
| `GEMINI_API_KEY no está configurada` | Falta `.env` en `backend` | `cp .env.example .env` y llenar la key |
| `[vite] http proxy error /api/monitor/... ECONNREFUSED` | El monitor Python (:8001) no está corriendo | Levanta el proceso 1 |
| `[vite] http proxy error /api/chat ECONNREFUSED` | El Node (:3001) no está corriendo | Levanta el proceso 2 |
| `uvicorn: Could not import module main` | Faltan los `.pyc` o no activaste el venv | `source venv/bin/activate` y revisa la sección de recuperar `.pyc` |
| uvicorn falla al guardar/recargar | Usaste `--reload` con módulos sourceless | Corre sin `--reload` |
