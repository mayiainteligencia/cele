/* ============================================
   CEREBRO ELECTORAL — NAVEGACIÓN
   ============================================
   Riel lateral de 7 grupos y segundo nivel de
   píldoras. Se carga ANTES que cualquier otro
   script de página.

   El bloque de sesión de DCMarketAg (Auth,
   AGENTE_DEFAULTS, agenteConfig, ICONOS_AGENTE,
   el diálogo de login) se eliminó: la plataforma
   es de acceso abierto y nada fuera de este
   archivo lo usaba. Cuando haya control por rol,
   se construye contra el rol, no contra aquello.
   ============================================ */

/* ════════════════════════════════════════════
   SIDEBAR — una sola fuente de verdad
   ════════════════════════════════════════════ */

/* Siete grupos en el riel. Los módulos que tienen varias vistas cuelgan de
   `sub` y se pintan como píldoras de segundo nivel dentro de la página.
   Trece iconos sueltos no caben en 80 px sin volverse una sopa. */
const NAV = [
  {
    page: 'mando', icon: 'layout-dashboard', label: 'Centro de mando',
    href: 'mando.html',
  },
  {
    page: 'territorio', icon: 'map', label: 'Territorio',
    href: 'cartografia.html',
    sub: [
      // Una pregunta por vista. Antes `historico` respondía cuatro (cómo se
      // votó en 2024, cómo quedó el Congreso, cómo se votó en 2021 y qué pasa
      // en 2027) y los datos de escuelas estaban repartidos en tres vistas.
      { href: 'cartografia.html',    page: 'cartografia',    label: 'Mapa maestro',    icon: 'layers' },
      { href: 'municipios.html',     page: 'municipios',     label: 'Municipios',      icon: 'building-2' },
      { href: 'demografia.html',     page: 'demografia',     label: 'Demografía',      icon: 'users-round' },
      { href: 'nse.html',            page: 'nse',            label: 'Socioeconómico',  icon: 'layers-3' },
      // Casillas e inmuebles eran dos pestañas para una sola pregunta: el
      // catálogo CCT existe justamente como sitios candidatos a alojar casilla.
      { href: 'casillas.html',       page: 'casillas',       label: 'Dónde se vota',   icon: 'vote' },
      { href: 'historico.html',      page: 'historico',      label: 'Resultados',      icon: 'history' },
      { href: 'prediccion.html',     page: 'prediccion',     label: 'Predicción',      icon: 'trending-up' },
    ],
  },
  {
    page: 'analisis', icon: 'microscope', label: 'Análisis',
    href: 'forensia.html',
    sub: [
      { href: 'forensia.html',     page: 'forensia',     label: 'Forensia',     icon: 'shield-alert' },
      { href: 'candidaturas.html', page: 'candidaturas', label: 'Candidaturas', icon: 'users' },
      { href: 'medios.html',       page: 'medios',       label: 'Medios',       icon: 'radio' },
      { href: 'riesgos.html',      page: 'riesgos',      label: 'Grafo y riesgos', icon: 'network' },
      { href: 'encuestas.html',    page: 'encuestas',    label: 'Encuestas',    icon: 'bar-chart-3' },
    ],
  },
  {
    page: 'operacion', icon: 'clipboard-check', label: 'Operación',
    href: 'finanzas.html',
    sub: [
      { href: 'finanzas.html', page: 'finanzas', label: 'Finanzas', icon: 'dollar-sign' },
      { href: 'dia-d.html',    page: 'dia-d',    label: 'Día D',    icon: 'check-circle-2' },
    ],
  },
  { page: 'decisiones', icon: 'gavel', label: 'Sala de decisiones', href: 'decisiones.html' },
  { page: 'alertas',    icon: 'bell',  label: 'Alertas',            href: 'alertas.html' },
  {
    page: 'sistema', icon: 'shield-check', label: 'Sistema',
    href: 'roles.html',
    sub: [
      { href: 'roles.html',   page: 'roles',   label: 'Roles y permisos', icon: 'lock' },
      { href: 'fuentes.html', page: 'fuentes', label: 'Fuentes y trazabilidad', icon: 'database' },
      { href: 'matriz.html',  page: 'matriz',  label: 'Matriz maestra',   icon: 'file-spreadsheet' },
    ],
  },
];

/** Grupo al que pertenece la página activa, mirando también sus `sub`. */
function grupoActivo(pagina) {
  return NAV.find((g) =>
    g.page === pagina || (g.sub || []).some((s) => s.page === pagina)
  );
}

function renderSidebar() {
  const nav = document.getElementById('sidebar');
  if (!nav) return;

  const activa = document.body.dataset.page;
  const grupo = grupoActivo(activa);

  nav.innerHTML = `
    <div class="sidebar__avatar">
      <a href="ecosistema.html" class="avatar avatar--sm avatar--ce" data-tooltip="Cerebro Electoral (CE)">
        <span class="ce-brand-badge">CE</span>
      </a>
    </div>
    <ul class="sidebar__nav">
      ${NAV.map((item) => {
        const clases = [
          'sidebar__icon',
          grupo && item.page === grupo.page ? 'sidebar__icon--active' : '',
        ].filter(Boolean).join(' ');
        return `<li>
          <a href="${item.href}" class="${clases}" data-tooltip="${item.label}">
            <i data-lucide="${item.icon}"></i>
          </a>
        </li>`;
      }).join('')}
    </ul>
  `;
}

/* Segundo nivel.

   El diseño aprobado ponía estas píldoras en la zona izquierda de la barra
   superior, pero las páginas de módulo no tienen barra superior: solo
   index.html la monta. Así que se insertan bajo el encabezado de la página,
   con el componente .subnav-bar que ya existía en layout.css sin usarse. */
function renderSubnav() {
  const activa = document.body.dataset.page;
  const grupo = grupoActivo(activa);
  if (!grupo || !grupo.sub) return;

  const ancla = document.querySelector('.mando-header');
  if (!ancla) return;

  const barra = document.createElement('nav');
  barra.className = 'subnav-bar';
  barra.setAttribute('aria-label', `Vistas de ${grupo.label}`);
  barra.innerHTML = grupo.sub.map((s) => `
    <a href="${s.href}"
       class="subnav-btn${s.page === activa ? ' subnav-btn--active' : ''}"
       ${s.page === activa ? 'aria-current="page"' : ''}>
      <i data-lucide="${s.icon}"></i><span>${s.label}</span>
    </a>`).join('');

  ancla.insertAdjacentElement('afterend', barra);
}


/* ════════════════════════════════════════════
   AUTH — Sin login requerido
   Acceso directo para todos los usuarios.
   ════════════════════════════════════════════ */

/* Auth gates removed — open access platform */


/* ════════════════════════════════════════════
   STATUS BAR (reemplaza login pill)
   Muestra estado de los agentes activos
   ════════════════════════════════════════════ */

function renderAuthPill() {
  const slot = document.getElementById('auth-slot');
  if (!slot) return;

  slot.innerHTML = `
    <div class="filter-pill" style="gap:8px; cursor:default;">
      <span style="display:inline-block;width:7px;height:7px;background:var(--accent-cyan);border-radius:50%;box-shadow:0 0 6px var(--accent-cyan);" class="animate-pulse"></span>
      <span style="font-size:0.78rem; font-weight:600; color:var(--text-heading);">8 Agentes Activos</span>
      <i data-lucide="cpu" class="icon-xs" style="color:var(--accent-cyan);"></i>
    </div>
  `;
}


/* ════════════════════════════════════════════
   DISPONIBILIDAD DEL AGENTE
   ════════════════════════════════════════════
   Con esto los agentes acuerdan la hora de una
   reunión sin preguntarle nada al usuario.
   ════════════════════════════════════════════ */

/* Toast y agente handlers viven en app.js */

/* Lanza una secuencia de avisos con separación entre ellos */
function toastsEnSecuencia(lista, primerRetraso = 2500, separacion = 5200) {
  lista.forEach((t, i) => setTimeout(() => {
    if (window.CE && CE.toast) CE.toast(t);
  }, primerRetraso + i * separacion));
}



/* ════════════════════════════════════════════
   ARRANQUE COMÚN
   ════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderSubnav();
  renderAuthPill();
  // Restore sidebar scroll position and persist on scroll
  const nav = document.getElementById('sidebar');
  if (nav) {
    nav.addEventListener('scroll', () => {
      sessionStorage.setItem('sidebarScroll', nav.scrollTop);
    });
    const pos = sessionStorage.getItem('sidebarScroll');
    if (pos) nav.scrollTop = parseInt(pos, 10);
  }
  if (window.lucide) lucide.createIcons();
});
