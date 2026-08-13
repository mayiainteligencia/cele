# MonitorSol — checklist de arranque

`medios.html` es **la única página del sistema que depende de infraestructura
viva**. Todo lo demás corre con datos de demostración y funciona sin servidor.
Ésta no: sin backend no transcribe nada.

---

## Antes de presentar

```
[ ] 1.  Levantar el backend de MonitorSol en el puerto 8001
[ ] 2.  Abrir http://localhost:8001/health  →  debe responder 200
[ ] 3.  Servir el frontend   (cd frontend && python3 -m http.server 8899)
[ ] 4.  Abrir /medios.html   →  el badge de arriba debe decir "Backend activo"
[ ] 5.  Elegir una emisora del preset y arrancar una sesión de prueba
[ ] 6.  Confirmar que llegan líneas de transcripción con badge "Dato"
[ ] 7.  Meter una palabra clave que sepas que va a salir y ver la alerta
```

Si el paso 4 dice **"Servidor no disponible"**, la página sigue navegable pero
no transcribe. No presentes esta sección sin haber pasado el paso 6.

---

## ⚠ El código del servidor no está en este repositorio

Lo verifiqué: `backend/monitorsol/` contiene **únicamente el virtualenv**. No hay
ni un `.py`, ni `requirements.txt`, ni `Dockerfile`, ni nada en el historial de
git bajo ese nombre. Tampoco en `backend/datalab/`.

Lo que sí sobrevive es el entorno, y confirma que la solución es real:

| paquete | versión |
|---|---|
| `openai-whisper` | 20250625 |
| `torch` | 2.12.0 |
| `fastapi` | — |
| `uvicorn` | 0.29.0 |
| `websockets` | 12.0 |
| `pydantic` | 2.13.4 |
| `numba` / `llvmlite` | (aceleración de Whisper) |
| `aiosqlite` | (persistencia de sesiones) |
| `ffmpeg` (binding) | (decodifica el stream de audio) |

Python del venv: **3.12.3**.

**El servidor debe estar en la otra máquina.** Antes de la demo hay que traerlo
a este repo o a un lugar versionado. Mientras no esté, este checklist no se
puede completar de principio a fin en esta computadora.

Cuando aparezca, arranca así (el venv ya tiene todo instalado):

```bash
cd backend/monitorsol
venv/bin/python -m uvicorn <modulo>:app --port 8001 --reload
```

Sustituye `<modulo>` por el archivo que exponga el `app` de FastAPI.

---

## Contrato que el frontend espera

Extraído de `medios.html`. Sirve para verificar que el servidor que traigas es
el correcto, o para reconstruirlo si hiciera falta.

**Base HTTP:** `http://localhost:8001`  ·  **Base WS:** `ws://localhost:8001/ws`

| método | ruta | qué manda | qué devuelve |
|---|---|---|---|
| `GET`  | `/health` | — | 200 si está vivo |
| `POST` | `/monitor/start` | `{emisora_url, emisora_nombre, keywords[]}` | `{sesion_id}` |
| `POST` | `/monitor/stop/{sesion_id}` | — | — |
| `GET`  | `/monitor/sessions` | — | `{sesiones: [...]}` |
| `GET`  | `/monitor/testigos` | — | historial de grabaciones |
| `WS`   | `/ws/{sesion_id}` | — | ver abajo |

Mensajes que el WebSocket empuja:

```jsonc
{ "tipo": "transcripcion", "texto": "..." }
{ "tipo": "alerta", "keyword_detectada": "...", "transcripcion": "...",
  "emisora_nombre": "..." }
```

Campos que la UI lee de una sesión: `sesion_id`, `emisora_nombre`,
`emisora_url`, `keywords`, `status`, `total_chunks`, `total_detecciones`.

Si el servidor cambia alguno de estos nombres, la página deja de pintar sin
avisar. Es un contrato implícito; conviene fijarlo del lado del backend.

---

## Puertos y dependencias del sistema

| qué | dónde | nota |
|---|---|---|
| Backend MonitorSol | `:8001` | fijo en `medios.html`, no configurable todavía |
| Frontend estático | `:8899` | cualquier servidor sirve |
| `ffmpeg` | binario del sistema | Whisper lo necesita para decodificar el stream |
| Modelo Whisper | caché de `~/.cache/whisper` | **la primera corrida lo descarga**: hazlo antes de la demo, no enfrente del cliente |
| Salida a internet | — | las emisoras del preset son streams remotos |

El modelo es lo que más tarda en el primer arranque. Vale la pena precargarlo:

```bash
backend/monitorsol/venv/bin/python -c "import whisper; whisper.load_model('base')"
```

---

## Procedencia: qué es dato y qué es interpretación

Esta página es la que **más** necesita la distinción, justamente porque aquí sí
hay una fuente real detrás.

| lo que se ve | procedencia | por qué |
|---|---|---|
| Línea de transcripción | **Dato** | Sale del audio de una emisora identificada, con hora real |
| Palabra clave detectada | **Cálculo** | Coincidencia de texto sobre la transcripción |
| Sentimiento, tema, narrativa | **Inferencia** | Interpretación del modelo sobre el texto |
| Línea en modo demo | **Simulado** | No salió de ninguna emisora |

Regla que no cambia: **el sentimiento social no es intención de voto.** Si se
agrega análisis de sentimiento, el aviso va visible en la sección.

---

## Modo demo — decisión pendiente

Hoy, si el backend no responde, `medios.html` **cae sola en un modo demo que
fabrica líneas de transcripción** con frases de un arreglo fijo, cada 6
segundos, y esas líneas disparan alertas de palabra clave que suman a los
contadores de "detecciones totales".

Ya marqué esas líneas con el badge **Simulado** y el aviso de página, para que
no se lean como transcripción real. Pero el comportamiento de fondo —caer solo
en modo demo, sin que nadie lo pida— sigue ahí, y es una decisión de producto,
no un bug que deba arreglar por mi cuenta:

- **Opción A:** que el modo demo sea explícito. Si no hay backend, la página lo
  dice y ofrece un botón "Ver demostración sin servidor". Nada se fabrica sin
  que alguien lo haya pedido.
- **Opción B:** dejar la caída automática como está, ahora que va etiquetada.

Recomiendo A. En una herramienta electoral, que una pantalla genere contenido
plausible sola cuando se cae la red es el modo de fallo más caro que hay.
