# Cerebro Electoral

Plataforma de inteligencia electoral. Convierte datos reales de elecciones
(Excel del cliente → JSON) en un tablero de mando con asistente por voz,
alertas en vivo y planes accionables. Demo/venta: "esto hicimos con la data que
nos dieron; con más datos, MAYIA hace mucho más".

Rama de trabajo: **`campanaelect`**. Datos actuales: **Oaxaca, elecciones
municipales 1998 y 2010**.

---

## Qué incluye

| Sección | id | Componente | Qué muestra |
|---------|----|-----------|-------------|
| Dashboard General | `dashboard` | `components/Dashboard.tsx` | Hero (MAYIA por voz) + mapa de México por señales + resumen por sección + módulos de monitoreo |
| Comando Central | `comando` | `components/ComandoCentral.tsx` | KPIs, alertas del sistema, actividad, votos por partido |
| Resultados | `resultados` | `components/ResultadosElectorales.tsx` | Selector de año, dona de ganados, tendencia PRI, votos, top municipios |
| Alertas | `alertas` | `components/AlertasElectoral.tsx` | Municipios recuperables, riesgo de abstención, competencia |
| Cerebro Electoral | `monitoria` | `components/MonitorIA.tsx` | Módulos de capacidades (dummy) |
| Monitor de Medios | `monitor` | `components/MonitorMedios.tsx` | Radio en vivo (real, servicio Python) |
| Inteligencia Electoral | `electoral` | `components/InteligenciaElectoral.tsx` | Share of voice, sentimiento, narrativas |

Navegación sin router: `src/App.tsx` con `useState` + `switch`. El menú vive en
`Sidebar.tsx` (desktop, colapsable) y `ResponsiveLayout.tsx` (bottom-nav móvil)
— **ambas listas se mantienen sincronizadas a mano**.

---

## Datos (lo importante)

Todo lo electoral sale de datos **reales** precomputados, no inventados.

```
backend/datalab/
├── uploads/ANALISIS.xlsx          fuente cruda del cliente (7 hojas)
├── datos/*.json                   extracción por hoja (COMPILADO, COMITÉ…)
├── agregar_electoral.py           → frontend/src/data/electoral.json
└── RESUMEN_DATOS.md               qué hay en el Excel y cómo alimenta cada sección
```

`agregar_electoral.py` calcula el ganador por municipio (la columna venía vacía),
agrega votos/ganados/recuperables/abstención y emite `electoral.json`. El front
lo consume tipado desde `src/data/electoral.ts`.

Regenerar tras cambiar el Excel o los `datos/*.json`:

```bash
cd backend/datalab
python3 agregar_electoral.py
```

Reglas: los vacíos se conservan como `null` (no se rellenan ni se inventan).
Solo 1998 y 2010 están completos; los demás años se ocultan.

### Cifras clave (Oaxaca 2010)
PRI ganó **427 de 597** municipios · **41.4%** de la votación (1,755,693 votos) ·
2ª fuerza **PRD** (93) · abstención **46.8%** · **6,086** representantes
($6,086,250) · **6** municipios perdidos por ≤5 votos (recuperables).

---

## Piezas interactivas

- **MAYIA (asistente)** — `Herocard.tsx` + `data/asistente.ts`. **Front-only,
  sin Gemini.** Navega por voz ("ve a Alertas") y responde con los datos en mano
  ("¿cómo vamos en municipios ganados?", "¿qué dicen de mí?", "última mención en
  radio"). El átomo (`BrainCanvas.tsx`) también está en el header como mini-jarvis
  (abre el asistente vía evento `jarvis:open`).
- **Buscador de secciones** — en el header; filtra por título/alias y navega.
- **Toasts en vivo** — `components/electoral/toast.tsx`. Emergen abajo-derecha,
  simulan detecciones de radio y sugerencias de MAYIA.
- **Confirmar plan** — `components/electoral/confirm.tsx`. Todo botón "Activar
  plan" (secciones, mapa, notificaciones) abre un modal de confirmación antes de
  aplicar y lanzar el toast de éxito.
- **Mapa por estado** — `MapaMexicoDashboard.tsx`. Hover/click muestra señales
  por canal (radio, in-app, open web, redes), sentimiento y predicción. Oaxaca =
  datos reales; resto = proyección determinista por estado.

---

## Correr el proyecto

Para el detalle de los 3 procesos (monitor Python, backend Node, frontend) ver
[`COMO_CORRER.md`](./COMO_CORRER.md).

Las 3 secciones nuevas (Comando/Resultados/Alertas) y el Dashboard **no
necesitan backend**: leen `electoral.json` estático. Basta el frontend:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
```

Monitor de Medios (radio en vivo) sí requiere el servicio Python (`:8001`).

---

## Branding

`src/config/branding.ts` centraliza nombre, logo y colores.
Actual: **Cerebro Electoral**, logo `assets/logosNativos/cerebroElectoralLogo.png`,
color primario morado `#8B5CF6`.

## Stack
React 19 · Vite 7 · TypeScript · recharts · lucide-react · estilos inline con
tokens de `branding.ts`. Backend Node/Express (`:3001`) + monitor Python
FastAPI (`:8001`).
# cele
