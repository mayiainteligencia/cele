/* ============================================
   DCMarketAg — AUTH.JS
   ============================================
   Estado de sesión + sidebar + bloqueos.
   Se carga ANTES que cualquier otro script.

   ponytail: la sesión vive en localStorage y
   cualquier credencial entra. Es dummy: cuando
   haya API real, solo cambia Auth.login().
   ============================================ */

const DCM_KEY = 'dcm.session';

const Auth = {
  get state() {
    try { return JSON.parse(localStorage.getItem(DCM_KEY)); } catch { return null; }
  },
  set state(v) {
    if (v) localStorage.setItem(DCM_KEY, JSON.stringify(v));
    else localStorage.removeItem(DCM_KEY);
  },
  get logged() { return !!this.state; },
  get empresa() { return this.state?.empresa || null; },
  get agente() { return this.state?.agente || null; },
  get plan() { return this.state?.plan || null; },

  update(patch) { this.state = { ...(this.state || {}), ...patch }; },

  login(email, nombreEmpresa) {
    this.state = {
      empresa: { nombre: nombreEmpresa || email.split('@')[1]?.split('.')[0] || 'Mi Empresa', email },
      agente: null,
      plan: null,
    };
  },

  logout() {
    this.state = null;
    location.href = 'index.html';
  },
};

/* Valores por defecto del agente cuando aún no se configuró todo */
const AGENTE_DEFAULTS = {
  nombre: 'Agente Alpha-7',
  representa: 'ambas',
  categoria: 'Cloud Compute',
  region: 'North America',
  precioBase: 5000,
  precioMin: 4200,
  precioMax: 5500,
  color: '#6ca0dc',
  icono: 'bot',
  tono: 'directo',
  canal: 'email',
  destino: '',
  resumenDiario: true,

  /* Cuándo puede tu agente agendar reuniones con otros agentes */
  disponibilidad: {
    dias: ['lun', 'mar', 'mie', 'jue', 'vie'],
    desde: '09:00',
    hasta: '18:00',
    duracion: 30,
    zona: 'America/Mexico_City',
  },
};

function agenteConfig() {
  return { ...AGENTE_DEFAULTS, ...(Auth.agente || {}) };
}

/* Iconos disponibles para la cara del agente (nombres de Lucide). */
const ICONOS_AGENTE = ['bot', 'satellite', 'zap', 'brain', 'shield', 'rocket', 'cpu', 'radar'];

/* Pinta el icono del agente en un contenedor y refresca Lucide. */
function pintarIconoAgente(el, nombre) {
  if (!el) return;
  el.innerHTML = `<i data-lucide="${nombre}"></i>`;
  if (window.lucide) lucide.createIcons();
}


/* ════════════════════════════════════════════
   SIDEBAR — una sola fuente de verdad
   ════════════════════════════════════════════ */

// Navegación principal del Centro de Mando y Módulos — Cerebro Electoral (CE)
const NAV = [
  { href: 'index.html', page: 'inicio', icon: 'home', label: 'Inicio', libre: true },
  { href: 'mando.html', page: 'mando', icon: 'bar-chart-3', label: 'Centro de Mando Ejecutivo', libre: true },
  { href: 'cartografia.html', page: 'cartografia', icon: 'map', label: 'Cartografía & Capas', libre: true },
  { href: 'municipios.html', page: 'municipios', icon: 'building-2', label: '13 Municipios (Campeche)', libre: true },
  { href: 'infraestructura.html', page: 'infraestructura', icon: 'school', label: 'Infraestructura CCT', libre: true },
  { href: 'forensia.html', page: 'forensia', icon: 'shield-alert', label: 'Forensia & Anomalias', libre: true },
  { href: 'candidaturas.html', page: 'candidaturas', icon: 'users', label: 'Perfiles Públicos', libre: true },
  { href: 'medios.html', page: 'medios', icon: 'radio', label: 'Monitoreo de Medios', libre: true },
  { href: 'riesgos.html', page: 'riesgos', icon: 'network', label: 'Grafo de Riesgos', libre: true },
  { href: 'encuestas.html', page: 'encuestas', icon: 'trending-up', label: 'Poll of Polls', libre: true },
  { href: 'finanzas.html', page: 'finanzas', icon: 'dollar-sign', label: 'Copiloto Financiero', libre: true },
  { href: 'ceMobile.html', page: 'ceMobile', icon: 'smartphone', label: 'Copiloto Móvil', libre: true },
  { href: 'dia-d.html', page: 'dia-d', icon: 'check-circle-2', label: 'Estrategia Día D', libre: true },
  { href: 'decisiones.html', page: 'decisiones', icon: 'compass', label: 'Sala de Decisiones', libre: true },
  { href: 'roles.html', page: 'roles', icon: 'lock', label: 'Ciberseguridad & Roles', libre: true },
  { href: 'alertas.html', page: 'alertas', icon: 'bell', label: 'Tablero de Alertas', libre: true },
  { href: 'matriz.html', page: 'matriz', icon: 'file-spreadsheet', label: 'Matriz Maestro (28 Hojas)', libre: true },
  { href: 'fuentes.html', page: 'fuentes', icon: 'database', label: 'Fuentes & Trazabilidad', libre: true },
];

function renderSidebar() {
  const nav = document.getElementById('sidebar');
  if (!nav) return;

  const activa = document.body.dataset.page;

  nav.innerHTML = `
    <div class="sidebar__avatar">
      <a href="index.html" class="avatar avatar--sm avatar--ce" data-tooltip="Cerebro Electoral (CE)">
        <span class="ce-brand-badge">CE</span>
      </a>
    </div>
    <ul class="sidebar__nav">
      ${NAV.map((item) => {
        const bloqueado = !item.libre && !Auth.logged;
        const clases = [
          'sidebar__icon',
          item.page === activa ? 'sidebar__icon--active' : '',
          bloqueado ? 'sidebar__icon--locked' : '',
        ].filter(Boolean).join(' ');
        return `<li>
          <a href="${bloqueado ? '#' : item.href}" class="${clases}"
             data-tooltip="${item.label}"
             ${bloqueado ? 'data-needs-auth="1"' : ''}>
            <i data-lucide="${item.icon}"></i>
          </a>
        </li>`;
      }).join('')}
    </ul>
    ${Auth.logged ? `
      <button class="sidebar__icon sidebar__logout" id="sidebar-logout" data-tooltip="Cerrar sesión">
        <i data-lucide="log-out"></i>
      </button>` : ''}
  `;

  document.getElementById('sidebar-login')?.addEventListener('click', () => openAuth());
  document.getElementById('sidebar-logout')?.addEventListener('click', () => Auth.logout());
  nav.querySelectorAll('[data-needs-auth]').forEach((el) =>
    el.addEventListener('click', (e) => { e.preventDefault(); openAuth(); })
  );
}


/* ════════════════════════════════════════════
   DIÁLOGO DE LOGIN / REGISTRO
   ════════════════════════════════════════════
   ponytail: <dialog> nativo. Sin librería de
   modales, sin manejo de foco propio.
   ════════════════════════════════════════════ */

function buildAuthDialog() {
  if (document.getElementById('auth-dialog')) return;

  const dlg = document.createElement('dialog');
  dlg.id = 'auth-dialog';
  dlg.className = 'auth-dialog';
  dlg.innerHTML = `
    <div class="auth-card glass-strong">
      <button class="auth-card__close" id="auth-close" aria-label="Cerrar">
        <i data-lucide="x"></i>
      </button>

      <div class="auth-card__brand">DC</div>
      <h2 class="text-h2" id="auth-title">Crea tu cuenta de empresa</h2>
      <p class="text-small auth-card__sub" id="auth-sub">
        Da de alta tu agente, dile qué compras o qué vendes, y él se encarga del resto.
      </p>

      <div class="auth-tabs">
        <button class="auth-tab auth-tab--active" data-mode="signup">Crear cuenta</button>
        <button class="auth-tab" data-mode="login">Ya tengo cuenta</button>
      </div>

      <form id="auth-form" class="auth-form">
        <label class="field" id="field-empresa">
          <span class="field__label">Nombre de la empresa</span>
          <input type="text" name="empresa" class="field__input" placeholder="Aether Systems" required>
        </label>
        <label class="field">
          <span class="field__label">Correo corporativo</span>
          <input type="email" name="email" class="field__input" placeholder="tu@empresa.com" required>
        </label>
        <label class="field">
          <span class="field__label">Contraseña</span>
          <input type="password" name="password" class="field__input" placeholder="••••••••" required minlength="6">
        </label>
        <button type="submit" class="btn-primary auth-submit" id="auth-submit">
          <i data-lucide="arrow-right"></i>
          <span>Crear cuenta y dar de alta mi agente</span>
        </button>
      </form>

      <p class="auth-card__foot text-small">
        Demo para stakeholders — cualquier correo y contraseña funcionan.
      </p>
    </div>
  `;
  document.body.appendChild(dlg);

  let modo = 'signup';

  const setModo = (m) => {
    modo = m;
    dlg.querySelectorAll('.auth-tab').forEach((t) =>
      t.classList.toggle('auth-tab--active', t.dataset.mode === m)
    );
    const esSignup = m === 'signup';
    dlg.querySelector('#field-empresa').style.display = esSignup ? '' : 'none';
    dlg.querySelector('[name="empresa"]').required = esSignup;
    dlg.querySelector('#auth-title').textContent = esSignup
      ? 'Crea tu cuenta de empresa'
      : 'Entra a tu cuenta';
    dlg.querySelector('#auth-sub').textContent = esSignup
      ? 'Da de alta tu agente, dile qué compras o qué vendes, y él se encarga del resto.'
      : 'Tu agente te está esperando con el historial completo.';
    dlg.querySelector('#auth-submit span').textContent = esSignup
      ? 'Crear cuenta y dar de alta mi agente'
      : 'Entrar';
  };

  dlg.querySelectorAll('.auth-tab').forEach((t) =>
    t.addEventListener('click', () => setModo(t.dataset.mode))
  );

  dlg.querySelector('#auth-close').addEventListener('click', () => dlg.close());

  // Click en el backdrop cierra
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });

  dlg.querySelector('#auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    Auth.login(datos.get('email'), datos.get('empresa'));
    // Cuenta nueva → directo a dar de alta el agente.
    location.href = 'index.html';
  });

  if (window.lucide) lucide.createIcons();
}

function openAuth(modo = 'signup') {
  buildAuthDialog();
  const dlg = document.getElementById('auth-dialog');
  dlg.querySelector(`.auth-tab[data-mode="${modo}"]`)?.click();
  dlg.showModal();
}


/* ════════════════════════════════════════════
   BLOQUEOS PARA INVITADOS
   ════════════════════════════════════════════
   Cualquier elemento con data-gate="mensaje"
   se difumina y muestra un CTA si no hay sesión.
   ════════════════════════════════════════════ */

function applyGates() {
  if (Auth.logged) return;

  document.querySelectorAll('[data-gate]').forEach((el) => {
    el.classList.add('gated');
    const lock = document.createElement('div');
    lock.className = 'gate-lock';
    lock.innerHTML = `
      <div class="gate-lock__inner glass-strong">
        <i data-lucide="lock" class="gate-lock__icon"></i>
        <span class="gate-lock__msg">${el.dataset.gate}</span>
        <button class="btn-primary gate-lock__btn">Crear cuenta gratis</button>
        <button class="gate-lock__link">Ya tengo cuenta</button>
      </div>
    `;
    lock.querySelector('.gate-lock__btn').addEventListener('click', () => openAuth('signup'));
    lock.querySelector('.gate-lock__link').addEventListener('click', () => openAuth('login'));
    el.appendChild(lock);
  });
}

/* Páginas que exigen sesión: <body data-auth-required> */
function guardPage() {
  if (!document.body.hasAttribute('data-auth-required') || Auth.logged) return false;
  const main = document.getElementById('main-content');
  if (main) {
    main.innerHTML = `
      <section class="auth-wall glass-strong">
        <div class="auth-wall__icon"><i data-lucide="lock"></i></div>
        <h1 class="text-h1">Esta sección es para empresas registradas</h1>
        <p class="text-body" style="color: var(--text-muted); max-width: 46ch;">
          Crea tu cuenta para dar de alta tu agente, elegir tu plan y ver todo lo que
          hace mientras negocia por ti.
        </p>
        <div class="auth-wall__actions">
          <button class="btn-primary" id="wall-signup">
            <i data-lucide="user-plus"></i> Crear cuenta gratis
          </button>
          <button class="btn-glass" id="wall-login">Ya tengo cuenta</button>
        </div>
        <a href="index.html" class="auth-wall__back text-small">
          <i data-lucide="arrow-left"></i> Seguir explorando servicios
        </a>
      </section>
    `;
    document.getElementById('wall-signup').addEventListener('click', () => openAuth('signup'));
    document.getElementById('wall-login').addEventListener('click', () => openAuth('login'));
  }
  document.querySelector('.filter-bar')?.remove();
  if (window.lucide) lucide.createIcons();
  return true; // la página no debe seguir inicializando
}


/* ════════════════════════════════════════════
   BOTÓN DE SESIÓN EN LA BARRA SUPERIOR
   ════════════════════════════════════════════ */

function renderAuthPill() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;

  if (Auth.logged) {
    const b = agenteConfig();
    slot.innerHTML = `
      <a href="index.html" class="filter-pill filter-pill--account">
        <span class="account-dot" style="background:${b.color}"><i data-lucide="${b.icono}"></i></span>
        <span>
          <span class="filter-pill__label">${Auth.empresa.nombre}</span>
          <span class="filter-pill__value">${Auth.plan ? planLabel(Auth.plan) : 'Sin plan'}</span>
        </span>
      </a>
    `;
  } else {
    slot.innerHTML = `
      <button class="filter-pill filter-pill--cta" id="pill-login">
        <span>Entrar / Registrarme</span>
        <i data-lucide="log-in" class="filter-pill__icon"></i>
      </button>
    `;
    slot.querySelector('#pill-login').addEventListener('click', () => openAuth());
  }
}

function planLabel(plan) {
  return plan === 'permanente' ? 'Plan Permanente' : 'Plan Temporal';
}


/* ════════════════════════════════════════════
   DISPONIBILIDAD DEL AGENTE
   ════════════════════════════════════════════
   Con esto los agentes acuerdan la hora de una
   reunión sin preguntarle nada al usuario.
   ════════════════════════════════════════════ */

const DIAS = [
  { id: 'lun', corto: 'L',  largo: 'Lunes' },
  { id: 'mar', corto: 'M',  largo: 'Martes' },
  { id: 'mie', corto: 'X',  largo: 'Miércoles' },
  { id: 'jue', corto: 'J',  largo: 'Jueves' },
  { id: 'vie', corto: 'V',  largo: 'Viernes' },
  { id: 'sab', corto: 'S',  largo: 'Sábado' },
  { id: 'dom', corto: 'D',  largo: 'Domingo' },
];

function disponibilidad() {
  return agenteConfig().disponibilidad || AGENTE_DEFAULTS.disponibilidad;
}

/* Resumen legible: "L a V, 9:00–18:00 · bloques de 30 min" */
function resumenDisponibilidad() {
  const d = disponibilidad();
  const activos = DIAS.filter((x) => d.dias.includes(x.id));
  if (!activos.length) return 'Sin días disponibles — tu agente no puede agendar.';
  const dias = activos.map((x) => x.corto).join(' ');
  return `${dias} · ${d.desde}–${d.hasta} · bloques de ${d.duracion} min`;
}


/* ════════════════════════════════════════════
   TOASTS
   ════════════════════════════════════════════
   El agente trabaja solo: los avisos son la
   única forma en que el usuario se entera.
   ════════════════════════════════════════════ */

const TOAST_ICONO = {
  contrato: 'file-check',
  reunion:  'calendar-check',
  oferta:   'inbox',
  ronda:    'repeat',
};

function toast({ tipo = 'oferta', titulo, texto, duracion = 7000 } = {}) {
  let pila = document.getElementById('toast-stack');
  if (!pila) {
    pila = document.createElement('div');
    pila.id = 'toast-stack';
    pila.className = 'toast-stack';
    document.body.appendChild(pila);
  }

  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `
    <span class="toast__icon"><i data-lucide="${TOAST_ICONO[tipo] || 'bell'}"></i></span>
    <div class="toast__body">
      <strong class="toast__title">${titulo}</strong>
      <span class="toast__text">${texto}</span>
    </div>
    <button class="toast__close" aria-label="Cerrar"><i data-lucide="x"></i></button>
  `;

  const cerrar = () => {
    el.classList.add('toast--out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  el.querySelector('.toast__close').addEventListener('click', cerrar);
  pila.appendChild(el);
  if (window.lucide) lucide.createIcons();

  setTimeout(cerrar, duracion);
  return el;
}

/* Lanza una secuencia de avisos con separación entre ellos */
function toastsEnSecuencia(lista, primerRetraso = 2500, separacion = 5200) {
  lista.forEach((t, i) => setTimeout(() => toast(t), primerRetraso + i * separacion));
}


/* ════════════════════════════════════════════
   ARRANQUE COMÚN
   ════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderAuthPill();
  // Los scripts de página consultan esta bandera antes de renderizar.
  window.DCM_BLOCKED = guardPage();
  if (!window.DCM_BLOCKED) applyGates();
  if (window.lucide) lucide.createIcons();
});
