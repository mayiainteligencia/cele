# DCMarketAg — Contexto del proyecto

## Qué es esto

Marketplace B2B donde agentes de IA negocian entre sí en nombre de empresas que buscan contratar servicios de nube / data center, y empresas que los ofrecen. El usuario no negocia directamente: tiene un agente que lo representa.

**Importante:** los agentes NO deciden precios libremente. Cada empresa oferente define de antemano una `ReglaDeCosto` (precio base, mínimo, máximo aceptable). El agente solo aplica esa regla: acepta, contraoferta dentro del rango, o propone una reunión humana si no hay acuerdo posible. El agente es un trabajador que hace contacto y regulariza el contrato — no un tomador de decisiones autónomo.

## Los dos flujos de usuario

**Registrado**: tiene cuenta, se le asigna un agente permanente. Ese agente negocia con los agentes oferentes y siempre le entrega el resultado completo (costo, oferente, condiciones).

**Invitado**: entra sin cuenta, se le asigna un agente temporal por 10 minutos. Al vencer el tiempo, el resultado se enmascara (blur) y se le ofrece suscribirse para ver el detalle completo.

## La negociación

- Máximo **3 rondas** de contraoferta entre agentes.
- Si al llegar a la ronda 3 no hay acuerdo, el sistema fuerza el resultado "proponer reunión" — nunca se queda en loop infinito.
- Cada ronda queda registrada (auditable), para que el usuario le pueda preguntar a su agente qué pasó.

## Estado actual

Esto es un **dummy para aprobación de stakeholders**, no la versión final. La prioridad es que el flujo se vea y se entienda completo, con datos simulados (JSON local, sin DB real, sin pagos reales, sin auth real). Si se aprueba, la lógica real se agrega después sobre esta misma base.

---

## Qué va en cada carpeta

### `src/domain/`
El núcleo del negocio. No debe depender de nada externo (ni de Express, ni de una DB, ni de una librería de pagos). Si algo de aquí necesita saber cómo se guarda en base de datos, está mal ubicado.

- `entities/` — Las cosas que existen en el negocio: `Usuario`, `Agente`, `Empresa`, `ReglaDeCosto`, `Negociacion`, `Contraoferta`, `Oferta`. Son estructuras de datos + validaciones propias del dominio.
- `rules/` — Lógica pura de negocio, como `evaluarOferta.ts`: dado una `Necesidad` y una `ReglaDeCosto`, decide si se acepta, se contraoferta o se propone reunión.

### `src/application/`
Los casos de uso: qué puede "hacer" el sistema. Orquestan el dominio, pero tampoco saben de HTTP ni de bases de datos concretas — hablan con el mundo exterior a través de `ports/`.

- `use-cases/` — Una acción completa del sistema: `AsignarAgentePermanente`, `AsignarAgenteTemporal`, `IniciarNegociacion`, `EvaluarContraoferta`, `CerrarAcuerdo`, `AplicarBlurInvitado`.
- `ports/` — Interfaces que el caso de uso necesita para funcionar (ej. `AgenteRepository`), pero sin decir cómo se implementan. La infraestructura las implementa después.

### `src/infrastructure/`
Todo lo "de afuera": cómo se guardan los datos, cómo se sirve por HTTP. Esto es lo que se puede cambiar sin tocar el dominio ni la aplicación.

- `data/` — `empresas.dummy.json`: las empresas y sus `ReglaDeCosto` fijas para la demo.
- `repositories/` — Implementaciones en memoria de los `ports/` (ej. `InMemoryAgenteRepository`). Después se pueden reemplazar por una DB real sin tocar el resto del proyecto.
- `http/` — `server.ts`: arranque del servidor Express.

### `src/interface/`
La puerta de entrada HTTP: recibe requests, llama al caso de uso correspondiente, devuelve respuesta.

- `routes/` — Definición de endpoints (`negociacion.routes.ts`, `usuario.routes.ts`).
- `controllers/` — Traducen el request HTTP a una llamada de caso de uso y el resultado de vuelta a JSON.

### `tests/`
Pruebas, sobre todo del límite de 3 rondas y de que `evaluarOferta` decida correctamente entre aceptar/contraofertar/reunión.

### Raíz
- `package.json`, `tsconfig.json` — configuración del proyecto Node/TypeScript.
- `.env.example` — variables de entorno necesarias (ninguna crítica todavía, es dummy).
- `README.md` — instrucciones de instalación y arranque (a llenar cuando el proyecto corra).
