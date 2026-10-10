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
    page: 'campana', icon: 'pie-chart', label: 'Inteligencia de campaña',
    href: 'campana.html', i18n: 'nav.campana',
  },
  {
    page: 'mando', icon: 'layout-dashboard', label: 'Centro de mando',
    href: 'mando.html', i18n: 'nav.mando',
  },
  {
    page: 'territorio', icon: 'map', label: 'Territorio',
    href: 'cartografia.html', i18n: 'nav.territorio',
    sub: [
      { href: 'cartografia.html',    page: 'cartografia',    label: 'Mapa maestro',    icon: 'layers',      i18n: 'sub.mapa' },
      { href: 'municipios.html',     page: 'municipios',     label: 'Municipios',      icon: 'building-2',  i18n: 'sub.municipios' },
      { href: 'demografia.html',     page: 'demografia',     label: 'Demografía',      icon: 'users-round', i18n: 'sub.demografia' },
      { href: 'nse.html',            page: 'nse',            label: 'Socioeconómico',  icon: 'layers-3',   i18n: 'sub.socioeconomico' },
      { href: 'casillas.html',       page: 'casillas',       label: 'Dónde se vota',   icon: 'vote',        i18n: 'sub.donde_vota' },
      { href: 'historico.html',      page: 'historico',      label: 'Resultados',      icon: 'history',     i18n: 'sub.resultados' },
      { href: 'prediccion.html',     page: 'prediccion',     label: 'Predicción',      icon: 'trending-up', i18n: 'sub.prediccion' },
    ],
  },
  {
    page: 'analisis', icon: 'microscope', label: 'Análisis',
    href: 'forensia.html', i18n: 'nav.analisis',
    sub: [
      { href: 'forensia.html',     page: 'forensia',     label: 'Forensia',     icon: 'shield-alert', i18n: 'sub.forensia' },
      { href: 'candidaturas.html', page: 'candidaturas', label: 'Candidaturas', icon: 'users',        i18n: 'sub.candidaturas' },
      { href: 'medios.html',       page: 'medios',       label: 'Medios',       icon: 'radio',        i18n: 'sub.medios' },
      { href: 'riesgos.html',      page: 'riesgos',      label: 'Grafo y riesgos', icon: 'network',   i18n: 'sub.grafo_riesgos' },
      { href: 'encuestas.html',    page: 'encuestas',    label: 'Encuestas',    icon: 'bar-chart-3',  i18n: 'sub.encuestas' },
      { href: 'discursos.html',    page: 'discursos',    label: 'Discursos',    icon: 'message-square-text', i18n: 'sub.discursos' },
    ],
  },
  {
    page: 'operacion', icon: 'clipboard-check', label: 'Operación',
    href: 'finanzas.html', i18n: 'nav.operacion',
    sub: [
      { href: 'finanzas.html', page: 'finanzas', label: 'Finanzas', icon: 'dollar-sign',    i18n: 'sub.finanzas' },
      { href: 'dia-d.html',    page: 'dia-d',    label: 'Día D',    icon: 'check-circle-2', i18n: 'sub.dia_d' },
    ],
  },
  { page: 'decisiones', icon: 'gavel', label: 'Sala de decisiones', href: 'decisiones.html', i18n: 'nav.decisiones' },
  { page: 'alertas',    icon: 'bell',  label: 'Alertas',            href: 'alertas.html',    i18n: 'nav.alertas' },
  {
    page: 'sistema', icon: 'shield-check', label: 'Sistema',
    href: 'roles.html', i18n: 'nav.sistema',
    sub: [
      { href: 'roles.html',   page: 'roles',   label: 'Roles y permisos', icon: 'lock',             i18n: 'sub.roles' },
      { href: 'fuentes.html', page: 'fuentes', label: 'Fuentes y trazabilidad', icon: 'database',    i18n: 'sub.fuentes' },
      { href: 'matriz.html',  page: 'matriz',  label: 'Matriz maestra',   icon: 'file-spreadsheet', i18n: 'sub.matriz' },
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
  const _t = (typeof CEi18n !== 'undefined') ? CEi18n.t : (k) => k;

  nav.innerHTML = `
    <div class="sidebar__avatar">
      <a href="ecosistema.html" class="avatar avatar--sm avatar--ce" data-tooltip="${_t('brand')} (${_t('brand.short')})">
        <span class="ce-brand-badge">${_t('brand.short')}</span>
      </a>
    </div>
    <ul class="sidebar__nav">
      ${NAV.map((item) => {
        const clases = [
          'sidebar__icon',
          grupo && item.page === grupo.page ? 'sidebar__icon--active' : '',
        ].filter(Boolean).join(' ');
        const tooltip = item.i18n ? _t(item.i18n) : item.label;
        return `<li>
          <a href="${item.href}" class="${clases}" data-tooltip="${tooltip}">
            <i data-lucide="${item.icon}"></i>
          </a>
        </li>`;
      }).join('')}
    </ul>
    <div class="sidebar__lang" style="margin-top:auto; padding:8px 0; display:flex; justify-content:center;" id="sidebar-lang-slot"></div>
  `;

  // Insert language toggle into sidebar
  if (typeof CEi18n !== 'undefined') {
    const slot = document.getElementById('sidebar-lang-slot');
    if (slot) slot.appendChild(CEi18n.renderToggleButton());
  }
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

  const _t = (typeof CEi18n !== 'undefined') ? CEi18n.t : (k) => k;

  // Remove existing subnav if re-rendering
  const existente = ancla.nextElementSibling;
  if (existente && existente.classList.contains('subnav-bar')) {
    existente.remove();
  }

  const barra = document.createElement('nav');
  barra.className = 'subnav-bar';
  barra.setAttribute('aria-label', `Vistas de ${grupo.label}`);
  barra.innerHTML = grupo.sub.map((s) => {
    const label = s.i18n ? _t(s.i18n) : s.label;
    return `
    <a href="${s.href}"
       class="subnav-btn${s.page === activa ? ' subnav-btn--active' : ''}"
       ${s.page === activa ? 'aria-current="page"' : ''}>
      <i data-lucide="${s.icon}"></i><span>${label}</span>
    </a>`;
  }).join('');

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

  const _t = (typeof CEi18n !== 'undefined') ? CEi18n.t : (k) => k;

  slot.innerHTML = `
    <div class="filter-pill" style="gap:8px; cursor:default;">
      <span style="display:inline-block;width:7px;height:7px;background:var(--accent-cyan);border-radius:50%;box-shadow:0 0 6px var(--accent-cyan);" class="animate-pulse"></span>
      <span style="font-size:0.78rem; font-weight:600; color:var(--text-heading);" data-i18n="nav.agentes">${_t('nav.agentes')}</span>
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

  // Apply i18n translations on load
  if (typeof CEi18n !== 'undefined') {
    CEi18n.aplicar();
  }
});

/* Re-render navigation elements when language changes */
document.addEventListener('ce:lang-change', () => {
  renderSidebar();
  renderSubnav();
  renderAuthPill();
  if (typeof CEi18n !== 'undefined') CEi18n.aplicar();
  if (window.lucide) lucide.createIcons();
});
