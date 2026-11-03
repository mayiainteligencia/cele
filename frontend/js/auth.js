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
  { page: 'conocimiento', icon: 'book-user', label: 'Conocimiento', href: 'conocimiento.html', i18n: 'nav.conocimiento' },
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
   CATÁLOGO DE AGENTES EN MODO MUESTRA ('FAKE')
   ════════════════════════════════════════════
   12 agentes autónomos simulados que alimentan
   las notificaciones emergentes, la salud del
   sistema ('Servidores activos'), las estrategias
   de campo ('Nosotros sabemos por quién vas a votar'),
   el pulso de redes sociales ('Construye en tiempo
   real la elección') y los grafos de conocimiento.
   ════════════════════════════════════════════ */

const CE_AGENTES_MUESTRA = [
  {
    id: 'ag-syshealth',
    codigo: 'CE-SysHealth',
    nombre: 'Salud del Sistema & Cluster IA',
    categoria: 'salud',
    icono: 'server',
    color: 'var(--status-success)',
    servidor: 'SRV-CAM-01 · Cluster GPU 12/12',
    latencia: '8 ms',
    precision: '99.98% Uptime',
    estado: 'Servidores activos',
    rol: 'Monitoreo de salud del sistema, balanceo de servidores activos y sincronización en tiempo real de toda la plataforma.',
    accionVivo: 'Servidores activos (12/12 en línea). Construyendo en tiempo real la elección sin latencia.',
    nodosGrafo: ['Servidores Activos (12/12)', 'Núcleo Cerebro Electoral', 'Ingesta Redes Sociales 24/7']
  },
  {
    id: 'ag-socialpulse',
    codigo: 'CE-SocialPulse',
    nombre: 'Escucha Social & Construcción Electoral',
    categoria: 'redes',
    icono: 'share-2',
    color: 'var(--accent-purple)',
    servidor: 'SRV-CAM-02 · Stream Social',
    latencia: '14 ms',
    precision: '47.2K menciones/h',
    estado: 'Construye en tiempo real la elección',
    rol: 'Rastreo masivo en TikTok, Facebook, Instagram, X y YouTube que construye en tiempo real la elección a partir del humor social.',
    accionVivo: 'TikTok +412K interacciones · Sentimiento 94% positivo en Carmen y Campeche. Construye en tiempo real la elección.',
    nodosGrafo: ['TikTok Viral (412K)', 'Facebook Campeche (1.8M)', 'Instagram Reels (74% Pos)', 'X / Debate Público']
  },
  {
    id: 'ag-oraculo',
    codigo: 'CE-Oráculo-Voto',
    nombre: 'Predicción & Intención Individualizada',
    categoria: 'voto',
    icono: 'scan-eye',
    color: 'var(--accent-coral)',
    servidor: 'SRV-CAM-03 · Motor Bayesiano',
    latencia: '11 ms',
    precision: '94.8% Certeza',
    estado: 'Sabemos por quién vas a votar',
    rol: 'Cruce multi-variable (demografía INEGI + huella digital + histórico seccional) para inferir afinidad electoral hiper-local.',
    accionVivo: 'Modelo predictivo activo en 542 secciones: Nosotros sabemos por quién vas a votar (94.8% certeza estimada).',
    nodosGrafo: ['Oráculo: Sabemos por quién vas a votar', 'Padrón 542 Secciones', 'Micro-Targeting AGEB']
  },
  {
    id: 'ag-campo',
    codigo: 'CE-Campo-Táctico',
    nombre: 'Estrategias de Campo Activadas',
    categoria: 'campo',
    icono: 'compass',
    color: 'var(--accent-warm)',
    servidor: 'SRV-CAM-04 · Geo-Operación',
    latencia: '19 ms',
    precision: '128 Brigadas Activas',
    estado: 'Estrategias de campo activadas',
    rol: 'Activación automática de brigadas territoriales, rutas de barrido casa por casa y movilización donde el modelo detecta voto indeciso.',
    accionVivo: 'Estrategias de campo activadas en Champotón, Calkiní y Carmen. Conversión territorial en vivo.',
    nodosGrafo: ['Estrategias de Campo Activadas', 'Brigadas Casa por Casa (128)', 'Movilización Seccional']
  },
  {
    id: 'ag-grafo',
    codigo: 'CE-Grafo-Neural',
    nombre: 'Arquitecto del Grafo de Conocimiento',
    categoria: 'grafo',
    icono: 'network',
    color: 'var(--accent-cyan)',
    servidor: 'SRV-CAM-05 · NeoGraph Engine',
    latencia: '9 ms',
    precision: '1,842 Nodos / 4,610 Aristas',
    estado: 'Sincronizando Grafo Vivo',
    rol: 'Conecta actores políticos, líderes barriales, comunidades de redes sociales, problemáticas ENVIPE y secciones electorales.',
    accionVivo: 'Grafo de conocimiento actualizado: +64 nuevas conexiones entre tendencias de TikTok y secciones de Campeche.',
    nodosGrafo: ['Núcleo Cerebro Electoral', 'Líderes de Opinión y Actores', 'Comunidades Digitales']
  },
  {
    id: 'ag-enjambre',
    codigo: 'CE-Enjambre-Digital',
    nombre: 'Defensa de Narrativa & Contra-Bots',
    categoria: 'redes',
    icono: 'shield-alert',
    color: 'var(--accent-cyan)',
    servidor: 'SRV-CAM-06 · CyberShield',
    latencia: '12 ms',
    precision: '99.2% Detección Bots',
    estado: 'Contención Digital Activa',
    rol: 'Identifica ataques coordinados o granjas de bots en redes sociales y despliega contra-narrativas orgánicas al instante.',
    accionVivo: 'Neutralizado ataque coordinado de 340 cuentas sintéticas en X sobre tema hídrico en Champotón.',
    nodosGrafo: ['X / Debate Público', 'Defensa Contra-Bots', 'Narrativa Territorial']
  },
  {
    id: 'ag-whatsapp',
    codigo: 'CE-WhatsApp-Territorio',
    nombre: 'Red de Mensajería & Círculos Vecinales',
    categoria: 'campo',
    icono: 'message-circle',
    color: 'var(--status-success)',
    servidor: 'SRV-CAM-07 · Edge Messaging',
    latencia: '15 ms',
    precision: '340 Grupos Barriales',
    estado: 'Pulso Vecinal Activo',
    rol: 'Articula la comunicación directa con coordinadores de manzana, enlaces comunitarios y cadenas de confianza vecinal.',
    accionVivo: 'Activadas 48 cadenas de difusión vecinal en Cd. del Carmen Sur y Candelaria.',
    nodosGrafo: ['WhatsApp Territorial (340 Grupos)', 'Estrategias de Campo Activadas', 'Promoción del Voto']
  },
  {
    id: 'ag-microtarget',
    codigo: 'CE-MicroTarget',
    nombre: 'Segmentación Psicográfica por Colonia',
    categoria: 'voto',
    icono: 'target',
    color: 'var(--accent-purple)',
    servidor: 'SRV-CAM-08 · Segmenter AI',
    latencia: '16 ms',
    precision: '13 Municipios / 2,274 CCT',
    estado: 'Micro-Segmentación Activa',
    rol: 'Adapta el mensaje de campaña para cada segmento demográfico y socioeconómico sabiendo de antemano su inclinación de voto.',
    accionVivo: 'Segmentación activa: Jóvenes 18-29 en Escárcega y Campeche reciben narrativa de empleo e innovación.',
    nodosGrafo: ['Micro-Targeting AGEB', 'Oráculo: Sabemos por quién vas a votar', 'Instagram Reels (74% Pos)']
  },
  {
    id: 'ag-monitorsol',
    codigo: 'CE-MonitorSol-Audio',
    nombre: 'Transcripción Radio/TV Whisper AI',
    categoria: 'medios',
    icono: 'radio',
    color: 'var(--accent-blue)',
    servidor: 'SRV-CAM-09 · Whisper GPU',
    latencia: '22 ms',
    precision: '20 Emisoras en Vivo',
    estado: 'Escucha Radiofónica 24/7',
    rol: 'Transcribe en tiempo real estaciones de radio y TV locales en Campeche, cruzando menciones con el pulso de redes sociales.',
    accionVivo: 'Share of Voice 48.5% (+18pp vs oposición) en Radio Delfín Carmen y TRC Campeche.',
    nodosGrafo: ['MonitorSol Radio/TV (20 Emisoras)', 'Núcleo Cerebro Electoral']
  },
  {
    id: 'ag-sentinel',
    codigo: 'CE-Sentinel-Casillas',
    nombre: 'Blindaje de Casillas & Día D',
    categoria: 'campo',
    icono: 'vote',
    color: 'var(--accent-cyan)',
    servidor: 'SRV-CAM-10 · Sentinel Grid',
    latencia: '10 ms',
    precision: '1,230 Casillas / 98.4%',
    estado: 'Estructura Blindada',
    rol: 'Supervisa la cobertura de representantes generales y de casilla y estima el flujo de votantes hora por hora.',
    accionVivo: 'Cobertura verificada al 98.4% en las 1,230 casillas proyectadas. Alertas de movilización listas.',
    nodosGrafo: ['Padrón 542 Secciones', 'Estrategias de Campo Activadas']
  },
  {
    id: 'ag-forense',
    codigo: 'CE-Forense-Actas',
    nombre: 'Auditoría Electoral & Anomalías',
    categoria: 'alerta',
    icono: 'file-search',
    color: 'var(--sev-critica)',
    servidor: 'SRV-CAM-11 · Benford Engine',
    latencia: '13 ms',
    precision: '542 Secciones Auditadas',
    estado: 'Vigilancia Forense',
    rol: 'Detecta patrones atípicos de participación, voto nulo e inconsistencias aritméticas en actas para defensa jurídica inmediata.',
    accionVivo: 'Monitoreo prioritario en Sección 0142 (Champotón) y Sección 0084 (Palizada).',
    nodosGrafo: ['Padrón 542 Secciones', 'Núcleo Cerebro Electoral']
  },
  {
    id: 'ag-copiloto',
    codigo: 'CE-Copiloto-WarRoom',
    nombre: 'Orquestador Estratégico de Campaña',
    categoria: 'decision',
    icono: 'cpu',
    color: 'var(--accent-lime)',
    servidor: 'SRV-CAM-12 · Master Node',
    latencia: '7 ms',
    precision: 'Sincronización Total',
    estado: 'Construyendo la Elección',
    rol: 'Sintetiza la salud del sistema, las redes sociales, las estrategias de campo y los grafos de conocimiento para la toma de decisiones.',
    accionVivo: 'Escenario estatal favorable: 100,000 simulaciones Monte Carlo + escucha social en tiempo real.',
    nodosGrafo: ['Núcleo Cerebro Electoral', 'Oráculo: Sabemos por quién vas a votar', 'Estrategias de Campo Activadas']
  }
];

window.CE_AGENTES_MUESTRA = CE_AGENTES_MUESTRA;

/* ════════════════════════════════════════════
   SECUENCIA DE NOTIFICACIONES EMERGENTES
   ════════════════════════════════════════════
   Se disparan desde el instante en que se abre
   Cerebro Electoral para mostrar que el sistema
   construye en tiempo real la elección.
   ════════════════════════════════════════════ */

const CE_ALERTAS_EMERGENTES = [
  {
    tipo: 'salud',
    tag: 'SALUD DEL SISTEMA · SERVIDORES ACTIVOS',
    titulo: 'Servidores Activos (12/12 Nodos en Línea)',
    texto: 'Clúster neuronal operando al 99.98% (latencia 8ms). Construye en tiempo real la elección integrando redes sociales, campo y padrón electoral.',
    agente: 'CE-SysHealth · Modo Muestra',
    enlace: 'riesgos.html',
    enlaceTexto: 'Ver Grafo y Salud'
  },
  {
    tipo: 'redes',
    tag: 'REDES SOCIALES · TIEMPO REAL',
    titulo: 'Construye en Tiempo Real la Elección',
    texto: 'TikTok (+412K interacciones), Facebook (1.8M alcance), Instagram (74% positivo) y X: El pulso digital está moldeando la tendencia hoy en Campeche y Carmen.',
    agente: 'CE-SocialPulse · Modo Muestra',
    enlace: 'campana.html',
    enlaceTexto: 'Ver Pulso Social'
  },
  {
    tipo: 'voto',
    tag: 'ESTRATEGIAS DE CAMPO ACTIVADAS',
    titulo: 'Nosotros Sabemos por Quién Vas a Votar',
    texto: 'Estrategias de campo activadas en las 542 secciones. Cruce psicográfico de redes + territorio completado con 94.8% de certeza en intención de voto.',
    agente: 'CE-Oráculo-Voto · Modo Muestra',
    enlace: 'riesgos.html',
    enlaceTexto: 'Ver en el Grafo'
  },
  {
    tipo: 'grafo',
    tag: 'GRAFO DE CONOCIMIENTO · AGENTES FAKE',
    titulo: '12 Agentes IA Alimentando el Grafo Vivo',
    texto: '1,842 nodos sincronizados: comunidades digitales, líderes barriales, brigadas de campo e intención de voto conectados en el Grafo de Conocimiento.',
    agente: 'CE-Grafo-Neural · Modo Muestra',
    enlace: 'riesgos.html',
    enlaceTexto: 'Explorar Grafo'
  },
  {
    tipo: 'campo',
    tag: 'OPERACIÓN TERRITORIAL + WHATSAPP',
    titulo: 'Estrategias de Campo Activadas en 13 Municipios',
    texto: '128 brigadas y 340 grupos vecinales activados en Champotón, Calkiní y Candelaria. Sabemos dónde está cada voto indeciso y cómo movilizarlo.',
    agente: 'CE-Campo-Táctico · Modo Muestra',
    enlace: 'conocimiento.html',
    enlaceTexto: 'Ver Territorio y Grafo'
  },
  {
    tipo: 'redes',
    tag: 'TIKTOK & REELS · MICRO-TARGETING',
    titulo: 'Construye en Tiempo Real la Elección — Viralidad',
    texto: 'Pico de +4.2pp en sentimiento favorable tras despliegue de micro-narrativas segmentadas por AGEB. Nosotros sabemos por quién vas a votar.',
    agente: 'CE-MicroTarget · Modo Muestra',
    enlace: 'alertas.html',
    enlaceTexto: 'Tablero de Alertas'
  }
];

window.CE_ALERTAS_EMERGENTES = CE_ALERTAS_EMERGENTES;


/* ════════════════════════════════════════════
   STATUS BAR & DRAWER DE SALUD DEL SISTEMA
   ════════════════════════════════════════════ */

function renderAuthPill() {
  let slot = document.getElementById('auth-slot');
  // Si la página no tiene #auth-slot en el header, creamos un contenedor flotante superior derecho
  if (!slot) {
    slot = document.getElementById('ce-floating-hud');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'ce-floating-hud';
      slot.style.cssText = 'position:fixed; top:14px; right:20px; z-index:9990; display:flex; align-items:center; gap:8px; flex-wrap:wrap;';
      document.body.appendChild(slot);
    }
  }

  slot.innerHTML = `
    <div class="ce-live-strip">
      <button type="button" class="ce-hud-pill ce-hud-pill--salud" onclick="window.toggleCEDrawer && window.toggleCEDrawer()" title="Salud del Sistema: 12/12 Servidores Activos">
        <span class="ce-dot-online"></span>
        <span>Servidores activos (12/12)</span>
      </button>
      <button type="button" class="ce-hud-pill ce-hud-pill--redes" onclick="window.toggleCEDrawer && window.toggleCEDrawer()" title="Notificaciones de Redes Sociales en Tiempo Real">
        <span class="ce-dot-cyan"></span>
        <span>Construye en tiempo real la elección</span>
      </button>
      <a href="riesgos.html" class="ce-hud-pill ce-hud-pill--voto" title="Estrategias de campo activadas y Grafo de Conocimiento">
        <span class="ce-dot-coral"></span>
        <span>Estrategias activadas · Sabemos por quién vas a votar</span>
      </a>
    </div>
  `;

  ensureCEDrawer();
}

function ensureCEDrawer() {
  if (document.getElementById('ce-system-drawer')) return;
  const drawer = document.createElement('aside');
  drawer.id = 'ce-system-drawer';
  drawer.className = 'ce-drawer';
  drawer.setAttribute('aria-label', 'Centro de Salud del Sistema, Redes Sociales y Agentes');
  drawer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--velo-08); padding-bottom:10px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="ce-dot-online"></span>
        <strong style="font-size:0.86rem; color:var(--text-heading); font-family:var(--font-heading);">Cerebro Electoral · Tiempo Real</strong>
      </div>
      <button type="button" onclick="window.toggleCEDrawer()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem;">✕ Cerrar</button>
    </div>

    <!-- Bloque 1: Salud del Sistema -->
    <div style="background:var(--proc-recomendacion-bg); border:1px solid var(--status-success); border-radius:var(--radius-md); padding:10px 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <strong style="font-size:0.76rem; color:var(--status-success); text-transform:uppercase; letter-spacing:0.05em;">🟢 Salud del Sistema: Servidores Activos</strong>
        <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-heading);">99.98% Uptime · 8ms</span>
      </div>
      <div style="font-size:0.76rem; color:var(--text-body); line-height:1.4;">
        12/12 Nodos GPU en línea procesando flujos de redes sociales, censo, ENVIPE y estructura seccional. <strong>Construye en tiempo real la elección.</strong>
      </div>
    </div>

    <!-- Bloque 2: Estrategias de campo y predicción de voto -->
    <div style="background:var(--proc-inferencia-bg); border:1px solid var(--accent-coral); border-radius:var(--radius-md); padding:10px 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <strong style="font-size:0.76rem; color:var(--accent-coral); text-transform:uppercase; letter-spacing:0.05em;">🎯 Estrategias de Campo Activadas</strong>
        <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-heading);">542 Secciones</span>
      </div>
      <div style="font-size:0.76rem; color:var(--text-body); line-height:1.4;">
        <strong>Nosotros sabemos por quién vas a votar:</strong> Micro-targeting psicográfico y territorial activo con 94.8% de certeza bayesiana en los 13 municipios.
      </div>
    </div>

    <!-- Bloque 3: Agentes en Modo Muestra -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
      <span style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em;">12 Agentes Integrados (Modo Muestra / Fake)</span>
      <a href="riesgos.html" style="font-size:0.72rem; color:var(--accent-cyan); font-weight:600; text-decoration:none;">Ver en Grafo →</a>
    </div>
    <div style="display:flex; flex-direction:column; gap:6px; max-height:260px; overflow-y:auto; padding-right:4px;">
      ${CE_AGENTES_MUESTRA.map((a) => `
        <div style="background:var(--panel-fondo); border:1px solid var(--glass-border); border-radius:var(--radius-sm); padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.76rem; color:${a.color}; font-family:var(--font-mono);">[${a.codigo}]</strong>
            <span style="font-size:0.65rem; background:var(--velo-08); color:var(--text-heading); padding:1px 6px; border-radius:999px;">${a.estado}</span>
          </div>
          <div style="font-size:0.74rem; color:var(--text-heading); font-weight:600;">${a.nombre}</div>
          <div style="font-size:0.7rem; color:var(--text-body); line-height:1.35;">${a.accionVivo}</div>
        </div>
      `).join('')}
    </div>

    <div style="display:flex; gap:8px; margin-top:4px;">
      <button type="button" class="btn-primary" style="flex:1; justify-content:center; font-size:0.75rem; padding:8px;" onclick="window.dispararRafagaAlertas && window.dispararRafagaAlertas()">
        Probar Alerta Emergente Ahora
      </button>
      <a href="riesgos.html" class="btn-glass" style="flex:1; justify-content:center; font-size:0.75rem; padding:8px; text-decoration:none; text-align:center;">
        Abrir Grafo de Conocimiento
      </a>
    </div>
  `;
  document.body.appendChild(drawer);
}

window.toggleCEDrawer = function toggleCEDrawer() {
  ensureCEDrawer();
  const d = document.getElementById('ce-system-drawer');
  if (d) d.classList.toggle('ce-drawer--open');
};


/* ════════════════════════════════════════════
   MOTOR DE TOASTS / NOTIFICACIONES EMERGENTES
   ════════════════════════════════════════════ */

const TOAST_ICONO = {
  salud: 'server',
  redes: 'share-2',
  voto: 'scan-eye',
  campo: 'compass',
  grafo: 'network',
  alerta: 'shield-alert',
  medios: 'radio',
  finanzas: 'dollar-sign',
  operativo: 'map-pin',
  decision: 'gavel',
  sello: 'check-circle-2',
};

function actualizarPilaToasts(pila) {
  if (!pila) return;
  const items = Array.from(pila.querySelectorAll('.toast:not(.toast--out)'));
  // Máximo 3 en la baraja (1 al frente + hasta 2 replegadas detrás)
  while (items.length > 3) {
    const sobra = items.shift();
    sobra.remove();
  }
  const total = items.length;
  items.forEach((item, idx) => {
    // La última agregada es la frontal (profundidad 0), las anteriores van hacia atrás
    const profundidad = total - 1 - idx;
    item.setAttribute('data-stack-depth', profundidad);
    item.style.zIndex = `${100 - profundidad * 10}`;

    // Si está atrás, un clic en su borde la trae al frente
    if (profundidad > 0) {
      item.onclick = (e) => {
        if (!e.target.closest('.toast__close')) {
          pila.appendChild(item);
          actualizarPilaToasts(pila);
        }
      };
    } else {
      item.onclick = null;
    }
  });
}

function toast({
  tipo = 'redes',
  tag = 'CONSTRUYE EN TIEMPO REAL LA ELECCIÓN',
  titulo = 'Notificación de Cerebro Electoral',
  texto = '',
  agente = 'CE-SocialPulse · Modo Muestra',
  enlace = 'riesgos.html',
  enlaceTexto = 'Ver Grafo',
  duracion = 7500,
} = {}) {
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
      <div class="toast__meta">
        <span class="toast__tag">${tag}</span>
        <span class="toast__live"><span class="toast__live-dot"></span>En Vivo</span>
      </div>
      <strong class="toast__title">${titulo}</strong>
      <span class="toast__text">${texto}</span>
      <div class="toast__footer">
        <span style="font-family:var(--font-mono);">${agente}</span>
        ${enlace ? `<a href="${enlace}" class="toast__link">${enlaceTexto} →</a>` : ''}
      </div>
    </div>
    <button class="toast__close" aria-label="Cerrar"><i data-lucide="x"></i></button>
  `;

  let cerrado = false;
  const cerrar = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (cerrado) return;
    cerrado = true;
    el.classList.add('toast--out');
    setTimeout(() => {
      el.remove();
      actualizarPilaToasts(pila);
    }, 280);
  };

  el.querySelector('.toast__close').addEventListener('click', cerrar);
  pila.appendChild(el);
  actualizarPilaToasts(pila);
  if (window.lucide) lucide.createIcons();

  setTimeout(cerrar, duracion);
  return el;
}

window.toast = toast;

/* Lanza una secuencia de avisos con separación entre ellos */
function toastsEnSecuencia(lista, primerRetraso = 600, separacion = 5500) {
  lista.forEach((t, i) => setTimeout(() => {
    toast(t);
  }, primerRetraso + i * separacion));
}

let _ceAlertIdx = 0;
window.dispararRafagaAlertas = function dispararRafagaAlertas() {
  const item = CE_ALERTAS_EMERGENTES[_ceAlertIdx % CE_ALERTAS_EMERGENTES.length];
  _ceAlertIdx++;
  toast(item);
};

let _ceBooted = false;
function initEmergingAlertsOnOpen() {
  if (_ceBooted) return;
  _ceBooted = true;

  // Desde que se abre Cerebro Electoral ahí se ven las alertas de inmediato (500ms y 2200ms)
  setTimeout(() => {
    toast(CE_ALERTAS_EMERGENTES[0]); // Salud del sistema: Servidores activos
  }, 500);

  setTimeout(() => {
    toast(CE_ALERTAS_EMERGENTES[1]); // Redes sociales: Construye en tiempo real la elección
  }, 2200);

  setTimeout(() => {
    toast(CE_ALERTAS_EMERGENTES[2]); // Estrategias de campo: Nosotros sabemos por quién vas a votar
  }, 4800);

  _ceAlertIdx = 3;
  setInterval(() => {
    const alerta = CE_ALERTAS_EMERGENTES[_ceAlertIdx % CE_ALERTAS_EMERGENTES.length];
    _ceAlertIdx++;
    toast(alerta);
  }, 9500);
}


/* ════════════════════════════════════════════
   GRAFO DE CONOCIMIENTO ELECTORAL INTERACTIVO
   ════════════════════════════════════════════
   Se monta automáticamente en cualquier página
   que tenga #ce-grafo-conocimiento-box (riesgos.html,
   conocimiento.html, alertas.html).
   ════════════════════════════════════════════ */

const NODOS_GRAFO_CE = [
  // Núcleo Central
  {
    id: 'core', label: 'CEREBRO ELECTORAL', sub: 'Construye en tiempo real la elección',
    cat: 'salud', x: 0.50, y: 0.48, r: 26,
    metrica: '12 Agentes · 100% Online',
    detalle: 'Núcleo central que construye en tiempo real la elección fusionando escucha de redes sociales, salud de servidores activos, estrategias de campo y predicción del voto.',
    agente: 'CE-Copiloto-WarRoom'
  },
  // Salud del Sistema
  {
    id: 'srv', label: 'Servidores Activos (12/12)', sub: 'Salud del Sistema · 99.98% Uptime',
    cat: 'salud', x: 0.22, y: 0.20, r: 19,
    metrica: 'Latencia 8ms · Cluster GPU',
    detalle: 'Estado de salud del sistema: 12 servidores activos en cluster privado con cifrado AES-256 procesando streams de redes sociales, radio Whisper AI y cómputos seccionales.',
    agente: 'CE-SysHealth'
  },
  {
    id: 'ingesta', label: 'Ingesta Tiempo Real 24/7', sub: '47.2K eventos/hora',
    cat: 'salud', x: 0.36, y: 0.14, r: 15,
    metrica: 'Stream Activo · Sin pérdida',
    detalle: 'Pipeline de datos en vivo que alimenta el grafo de conocimiento desde redes sociales, brigadas móviles y encuestas.',
    agente: 'CE-SysHealth'
  },
  // Oráculo y Estrategias de Campo
  {
    id: 'oraculo', label: 'Sabemos por Quién Vas a Votar', sub: 'Oráculo Predictivo · 94.8% Certeza',
    cat: 'voto', x: 0.78, y: 0.24, r: 22,
    metrica: '94.8% Precisión · 542 Secciones',
    detalle: 'Nosotros sabemos por quién vas a votar: Modelo de inferencia psicográfica y territorial que cruza comportamiento en redes sociales, histórico de casilla y demografía por AGEB.',
    agente: 'CE-Oráculo-Voto'
  },
  {
    id: 'campo', label: 'Estrategias de Campo Activadas', sub: '128 Brigadas · 13 Municipios',
    cat: 'campo', x: 0.82, y: 0.52, r: 20,
    metrica: '128 Brigadas · 980 Operadores',
    detalle: 'Estrategias de campo activadas automáticamente por los agentes cuando se detecta variación en intención de voto o conversación digital en una sección.',
    agente: 'CE-Campo-Táctico'
  },
  {
    id: 'micro', label: 'Micro-Targeting por AGEB', sub: 'Segmentación Psicográfica',
    cat: 'voto', x: 0.66, y: 0.16, r: 16,
    metrica: '2,274 Sitios · 13 Municipios',
    detalle: 'Personalización de narrativa por colonia y rango de edad sabiendo qué tema mueve a cada elector.',
    agente: 'CE-MicroTarget'
  },
  {
    id: 'padron', label: '542 Secciones · Lista Nominal', sub: '702,182 Electores Mapeados',
    cat: 'voto', x: 0.76, y: 0.78, r: 17,
    metrica: '1,230 Casillas · Cobertura 98.4%',
    detalle: 'Cruces seccionales completos con resultados históricos, metas de movilización y defensa de actas.',
    agente: 'CE-Sentinel-Casillas'
  },
  // Redes Sociales en Tiempo Real
  {
    id: 'tiktok', label: 'TikTok · Viralidad Joven', sub: '412K Interacciones · 94% Positivo',
    cat: 'redes', x: 0.16, y: 0.44, r: 19,
    metrica: '980K Alcance · #VotaCampeche',
    detalle: 'Construye en tiempo real la elección: Videos orgánicos sin guion generando 94% de sentimiento positivo en votantes de 18 a 34 años.',
    agente: 'CE-SocialPulse'
  },
  {
    id: 'facebook', label: 'Facebook · Comunidades', sub: '1.8M Alcance · Colonias y Ejidos',
    cat: 'redes', x: 0.14, y: 0.66, r: 18,
    metrica: '245K Interacciones · 72% Positivo',
    detalle: 'Red dominante en familias y cabeceras municipales de Campeche, Carmen y Champotón. Alimenta directamente la predicción de voto.',
    agente: 'CE-SocialPulse'
  },
  {
    id: 'whatsapp', label: 'WhatsApp Territorial', sub: '340 Grupos Vecinales Activos',
    cat: 'campo', x: 0.56, y: 0.84, r: 18,
    metrica: '340 Grupos · Conversión Directa',
    detalle: 'Red de mensajería hiper-local que conecta las estrategias de campo activadas con los líderes de manzana.',
    agente: 'CE-WhatsApp-Territorio'
  },
  {
    id: 'instagram', label: 'Instagram & Reels', sub: '720K Alcance · 74% Positivo',
    cat: 'redes', x: 0.28, y: 0.78, r: 16,
    metrica: '186K Interacciones · #FuturoCAM',
    detalle: 'Pulso visual de campaña en zonas urbanas de Campeche Capital y Ciudad del Carmen.',
    agente: 'CE-SocialPulse'
  },
  {
    id: 'x_red', label: 'X / Debate & Contra-Bots', sub: 'Contención de Narrativa Activa',
    cat: 'redes', x: 0.30, y: 0.32, r: 15,
    metrica: '99.2% Bots Neutralizados',
    detalle: 'Monitoreo de líderes de opinión, periodistas y neutralización automática de campañas negras.',
    agente: 'CE-Enjambre-Digital'
  },
  // Agentes Fake / Muestra destacados en el grafo
  {
    id: 'ag_node_1', label: 'Agente CE-Grafo-Neural', sub: 'Modo Muestra · Fake Agent',
    cat: 'agentes', x: 0.48, y: 0.26, r: 16,
    metrica: '1,842 Nodos · 4,610 Relaciones',
    detalle: 'Agente autónomo en modo muestra que descubre correlaciones ocultas entre quejas en redes sociales y cambios en intención de voto.',
    agente: 'CE-Grafo-Neural'
  },
  {
    id: 'ag_node_2', label: 'Agente CE-MonitorSol', sub: '20 Emisoras Radio/TV en Vivo',
    cat: 'agentes', x: 0.40, y: 0.68, r: 15,
    metrica: 'Share of Voice 48.5%',
    detalle: 'Agente en modo muestra que transcribe radio y televisión local en tiempo real y lo une al grafo de conversación social.',
    agente: 'CE-MonitorSol-Audio'
  },
  {
    id: 'ag_node_3', label: 'Agente CE-Forense-Actas', sub: 'Auditoría Seccional Preventiva',
    cat: 'agentes', x: 0.64, y: 0.64, r: 15,
    metrica: 'Sección 0142 & 0084 en Foco',
    detalle: 'Agente en modo muestra que vigila anomalías estadísticas y activa alertas jurídicas preventivas.',
    agente: 'CE-Forense-Actas'
  }
];

const ENLACES_GRAFO_CE = [
  ['srv', 'core'], ['srv', 'ingesta'], ['ingesta', 'core'], ['ingesta', 'ag_node_1'],
  ['core', 'oraculo'], ['core', 'campo'], ['core', 'tiktok'], ['core', 'facebook'],
  ['core', 'whatsapp'], ['core', 'ag_node_1'], ['core', 'ag_node_2'], ['core', 'ag_node_3'],
  ['tiktok', 'oraculo'], ['facebook', 'oraculo'], ['instagram', 'core'], ['x_red', 'core'],
  ['x_red', 'ag_node_1'], ['oraculo', 'campo'], ['oraculo', 'micro'], ['oraculo', 'padron'],
  ['micro', 'tiktok'], ['micro', 'instagram'], ['campo', 'whatsapp'], ['campo', 'padron'],
  ['whatsapp', 'facebook'], ['ag_node_2', 'facebook'], ['ag_node_3', 'padron'], ['ag_node_3', 'campo']
];

function montarGrafoConocimiento() {
  const box = document.getElementById('ce-grafo-conocimiento-box');
  if (!box || box.dataset.mounted === '1') return;
  box.dataset.mounted = '1';

  box.innerHTML = `
    <!-- Banner Superior de Estado en Tiempo Real -->
    <div class="ce-banner-eleccion" style="margin-bottom:var(--space-md);">
      <div style="display:flex; align-items:flex-start; gap:10px;">
        <span class="ce-dot-online" style="margin-top:5px;"></span>
        <div>
          <div style="font-size:0.68rem; font-family:var(--font-mono); text-transform:uppercase; color:var(--status-success); font-weight:700;">Salud del Sistema · Servidores Activos</div>
          <strong style="font-size:0.95rem; color:var(--text-heading);">12/12 Servidores GPU Activos (99.98%)</strong>
          <div style="font-size:0.76rem; color:var(--text-body); margin-top:2px;">Latencia 8ms · Ingesta en vivo desde que se abre Cerebro Electoral.</div>
        </div>
      </div>
      <div style="display:flex; align-items:flex-start; gap:10px;">
        <span class="ce-dot-cyan" style="margin-top:5px;"></span>
        <div>
          <div style="font-size:0.68rem; font-family:var(--font-mono); text-transform:uppercase; color:var(--accent-cyan); font-weight:700;">Pulso de Redes Sociales</div>
          <strong style="font-size:0.95rem; color:var(--text-heading);">Construye en Tiempo Real la Elección</strong>
          <div style="font-size:0.76rem; color:var(--text-body); margin-top:2px;">+47.2K interacciones/h en TikTok, FB, IG, X y WhatsApp moldeando la contienda.</div>
        </div>
      </div>
      <div style="display:flex; align-items:flex-start; gap:10px;">
        <span class="ce-dot-coral" style="margin-top:5px;"></span>
        <div>
          <div style="font-size:0.68rem; font-family:var(--font-mono); text-transform:uppercase; color:var(--accent-coral); font-weight:700;">Estrategias de Campo Activadas</div>
          <strong style="font-size:0.95rem; color:var(--text-heading);">Nosotros Sabemos por Quién Vas a Votar</strong>
          <div style="font-size:0.76rem; color:var(--text-body); margin-top:2px;">94.8% certeza predictiva en 542 secciones · 128 brigadas territoriales activas.</div>
        </div>
      </div>
    </div>

    <!-- Layout del Grafo Interactivo + Inspector -->
    <div class="ce-kg-layout">
      <div class="ce-kg-canvas-wrap" id="ce-kg-wrap">
        <canvas class="ce-kg-canvas" id="ce-kg-canvas"></canvas>

        <div class="ce-kg-hud-top">
          <div class="ce-kg-filters" id="ce-kg-filters">
            <button type="button" class="ce-kg-filter-btn ce-kg-filter-btn--active" data-cat="todos">Todos los Nodos (15)</button>
            <button type="button" class="ce-kg-filter-btn" data-cat="redes">Redes Sociales</button>
            <button type="button" class="ce-kg-filter-btn" data-cat="voto">Sabemos por Quién Vas a Votar</button>
            <button type="button" class="ce-kg-filter-btn" data-cat="campo">Estrategias de Campo</button>
            <button type="button" class="ce-kg-filter-btn" data-cat="salud">Servidores Activos</button>
            <button type="button" class="ce-kg-filter-btn" data-cat="agentes">Agentes Fake (Muestra)</button>
          </div>
          <button type="button" class="ce-kg-filter-btn" id="ce-kg-trigger-toast" style="border-color:var(--accent-cyan); color:var(--accent-cyan);">
            ⚡ Lanzar Alerta de Redes en Vivo
          </button>
        </div>

        <div class="ce-kg-hud-bottom">
          <div class="ce-kg-legend">
            <span class="ce-kg-legend-item"><span class="ce-kg-legend-dot" style="background:var(--status-success);"></span>Servidores Activos / Salud</span>
            <span class="ce-kg-legend-item"><span class="ce-kg-legend-dot" style="background:var(--accent-purple);"></span>Redes Sociales (Tiempo Real)</span>
            <span class="ce-kg-legend-item"><span class="ce-kg-legend-dot" style="background:var(--accent-coral);"></span>Oráculo: Sabemos por quién vas a votar</span>
            <span class="ce-kg-legend-item"><span class="ce-kg-legend-dot" style="background:var(--accent-warm);"></span>Estrategias de Campo</span>
            <span class="ce-kg-legend-item"><span class="ce-kg-legend-dot" style="background:var(--accent-cyan);"></span>Agentes IA (Modo Muestra)</span>
          </div>
        </div>
      </div>

      <aside class="ce-kg-inspector" id="ce-kg-inspector" aria-live="polite"></aside>
    </div>

    <!-- Catálogo de Agentes en Modo Muestra ('Fake') Integrados al Grafo -->
    <div style="margin-top:var(--space-lg);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:var(--space-sm);">
        <div>
          <h3 class="text-h3" style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="cpu" class="icon-sm" style="color:var(--accent-cyan);"></i>
            Ecosistema de 12 Agentes Integrados en Modo Muestra (Simulación en Tiempo Real)
          </h3>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Agentes autónomos en modo demostración ('fake') conectados al Grafo de Conocimiento, redes sociales, salud de servidores y operación de campo. Haz clic en cualquier agente para disparar su alerta emergente.
          </p>
        </div>
        <span class="badge badge--success">12 Agentes Activos · Modo Muestra</span>
      </div>

      <div class="ce-agent-grid" id="ce-agents-catalog-grid">
        ${CE_AGENTES_MUESTRA.map((a, idx) => `
          <article class="ce-agent-card" data-agent-idx="${idx}" style="cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <span style="font-family:var(--font-mono); font-size:0.74rem; font-weight:700; color:${a.color}; display:inline-flex; align-items:center; gap:5px;">
                <i data-lucide="${a.icono}" class="icon-xs"></i> [${a.codigo}]
              </span>
              <span class="badge" style="font-size:0.62rem; background:var(--velo-08); color:var(--text-heading);">${a.estado}</span>
            </div>
            <strong style="font-size:0.88rem; color:var(--text-heading);">${a.nombre}</strong>
            <p style="font-size:0.75rem; color:var(--text-body); line-height:1.4; margin:0;">${a.rol}</p>
            <div style="background:var(--panel-fondo-tenue); border-left:2px solid ${a.color}; padding:6px 8px; border-radius:4px; font-size:0.71rem; color:var(--text-heading);">
              ${a.accionVivo}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.66rem; color:var(--text-muted); font-family:var(--font-mono); padding-top:4px; border-top:1px solid var(--velo-05);">
              <span>${a.servidor}</span>
              <span style="color:var(--accent-cyan);">${a.precision}</span>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Conectar click en tarjetas de agentes para lanzar notificación emergente inmediata
  box.querySelectorAll('.ce-agent-card').forEach((card) => {
    card.addEventListener('click', () => {
      const a = CE_AGENTES_MUESTRA[Number(card.dataset.agentIdx)];
      if (!a) return;
      toast({
        tipo: a.categoria === 'salud' ? 'salud' : a.categoria === 'redes' ? 'redes' : a.categoria === 'voto' ? 'voto' : a.categoria === 'campo' ? 'campo' : 'grafo',
        tag: `${a.estado} · ${a.servidor}`,
        titulo: `${a.nombre} [${a.codigo}]`,
        texto: a.accionVivo,
        agente: `${a.codigo} · Modo Muestra`,
        enlace: '#ce-grafo-conocimiento-box',
        enlaceTexto: 'Sincronizado en Grafo'
      });
    });
  });

  const btnToast = document.getElementById('ce-kg-trigger-toast');
  if (btnToast) {
    btnToast.addEventListener('click', () => {
      if (window.dispararRafagaAlertas) window.dispararRafagaAlertas();
    });
  }

  iniciarCanvasGrafo();
}

function iniciarCanvasGrafo() {
  const canvas = document.getElementById('ce-kg-canvas');
  const wrap = document.getElementById('ce-kg-wrap');
  const inspector = document.getElementById('ce-kg-inspector');
  if (!canvas || !wrap || !inspector) return;

  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;

  const PALETA = {
    salud:   token('--status-success', '#4ade80'),   // color-ok: fallback de canvas
    redes:   token('--accent-purple', '#8b5cf6'),    // color-ok: fallback de canvas
    voto:    token('--accent-coral', '#ff3d6e'),     // color-ok: fallback de canvas
    campo:   token('--accent-warm', '#ffb020'),      // color-ok: fallback de canvas
    agentes: token('--accent-cyan', '#22e0ff'),      // color-ok: fallback de canvas
    texto:   token('--text-heading', '#ffffff'),     // color-ok: fallback de canvas
    muted:   token('--text-muted', '#7d889e'),       // color-ok: fallback de canvas
    bg:      token('--mapa-bg', '#03060d'),          // color-ok: fallback de canvas
  };

  let W = wrap.clientWidth || 760;
  let H = wrap.clientHeight || 540;
  let dpr = window.devicePixelRatio || 1;

  const nodos = NODOS_GRAFO_CE.map((n, i) => ({
    ...n,
    px: n.x * W,
    py: n.y * H,
    vx: 0,
    vy: 0,
    fase: i * 0.7
  }));

  function resize() {
    W = wrap.clientWidth || 760;
    H = wrap.clientHeight || 540;
    dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    nodos.forEach((n) => {
      if (!n.arrastrado) {
        n.px = n.x * W;
        n.py = n.y * H;
      }
    });
  }
  resize();
  window.addEventListener('resize', resize);

  let seleccionado = nodos[0];
  let hoverNodo = null;
  let arrastrando = null;
  let filtroCat = 'todos';

  function pintarInspector(n) {
    if (!n) return;
    const conectados = ENLACES_GRAFO_CE
      .filter(([a, b]) => a === n.id || b === n.id)
      .map(([a, b]) => nodos.find((x) => x.id === (a === n.id ? b : a)))
      .filter(Boolean);

    inspector.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <span class="badge" style="background:var(--cyan-tinte-sm); color:${PALETA[n.cat] || 'var(--accent-cyan)'}; border:1px solid ${PALETA[n.cat] || 'var(--accent-cyan)'}; text-transform:uppercase;">
          Nodo · ${n.cat}
        </span>
        <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--status-success);">● EN VIVO</span>
      </div>
      <h4 style="font-size:1.05rem; color:var(--text-heading); margin:4px 0 0; font-family:var(--font-heading);">${n.label}</h4>
      <div style="font-size:0.76rem; color:var(--accent-cyan); font-weight:600;">${n.sub}</div>
      <p style="font-size:0.8rem; color:var(--text-body); line-height:1.5; margin:6px 0;">${n.detalle}</p>

      <div style="background:var(--panel-fondo); border:1px solid var(--glass-border); border-radius:var(--radius-sm); padding:8px 10px; display:flex; flex-direction:column; gap:4px; font-size:0.74rem;">
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Agente Responsable:</span><strong style="color:var(--accent-cyan); font-family:var(--font-mono);">[${n.agente}]</strong></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Telemetría:</span><strong style="color:var(--text-heading);">${n.metrica}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Estado de Servidor:</span><strong style="color:var(--status-success);">Activo · Sincronizado</strong></div>
      </div>

      <div style="margin-top:6px;">
        <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); font-weight:700; margin-bottom:6px;">
          Relaciones Activas en el Grafo (${conectados.length})
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          ${conectados.map((c) => `
            <button type="button" data-jump-node="${c.id}" style="text-align:left; background:var(--velo-05); border:1px solid var(--glass-border); border-radius:6px; padding:6px 8px; color:var(--text-heading); font-size:0.74rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
              <span><strong style="color:${PALETA[c.cat]};">●</strong> ${c.label}</span>
              <span style="font-size:0.65rem; color:var(--text-muted);">${c.sub.slice(0, 22)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <button type="button" id="btn-emitir-nodo-alerta" class="btn-primary" style="margin-top:auto; width:100%; justify-content:center; font-size:0.75rem; padding:8px;">
        Emitir Notificación Emergente de este Nodo
      </button>
    `;

    inspector.querySelectorAll('[data-jump-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dest = nodos.find((x) => x.id === btn.dataset.jumpNode);
        if (dest) {
          seleccionado = dest;
          pintarInspector(dest);
        }
      });
    });

    const btnEmit = document.getElementById('btn-emitir-nodo-alerta');
    if (btnEmit) {
      btnEmit.addEventListener('click', () => {
        toast({
          tipo: n.cat === 'agentes' ? 'grafo' : n.cat,
          tag: `GRAFO DE CONOCIMIENTO · ${n.agente}`,
          titulo: `${n.label} — ${n.metrica}`,
          texto: n.detalle,
          agente: `${n.agente} · Modo Muestra`,
          enlace: '#ce-grafo-conocimiento-box',
          enlaceTexto: 'Nodo Activo'
        });
      });
    }
  }

  pintarInspector(seleccionado);

  // Filtros de categoría
  document.querySelectorAll('#ce-kg-filters .ce-kg-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ce-kg-filters .ce-kg-filter-btn').forEach((b) => b.classList.remove('ce-kg-filter-btn--active'));
      btn.classList.add('ce-kg-filter-btn--active');
      filtroCat = btn.dataset.cat || 'todos';
    });
  });

  // Interacción de ratón en el canvas
  function nodoEnPunto(mx, my) {
    for (let i = nodos.length - 1; i >= 0; i--) {
      const n = nodos[i];
      if (Math.hypot(mx - n.px, my - n.py) <= n.r + 8) return n;
    }
    return null;
  }

  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    if (arrastrando) {
      arrastrando.px = Math.max(30, Math.min(W - 30, mx));
      arrastrando.py = Math.max(50, Math.min(H - 50, my));
      arrastrando.arrastrado = true;
      return;
    }
    hoverNodo = nodoEnPunto(mx, my);
    canvas.style.cursor = hoverNodo ? 'pointer' : 'grab';
  });

  canvas.addEventListener('mousedown', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const n = nodoEnPunto(ev.clientX - rect.left, ev.clientY - rect.top);
    if (n) {
      arrastrando = n;
      seleccionado = n;
      pintarInspector(n);
    }
  });

  window.addEventListener('mouseup', () => { arrastrando = null; });

  // Loop de animación con pulsos viajando por las aristas
  let t0 = performance.now();
  function frame(now) {
    const dt = (now - t0) / 1000;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Retícula sutil de fondo
    ctx.strokeStyle = token('--grafica-grid', 'rgba(255, 255, 255, 0.06)'); // color-ok: fallback de canvas
    ctx.lineWidth = 1;
    for (let gx = 40; gx < W; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 40; gy < H; gy += 48) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Movimiento orgánico leve
    nodos.forEach((n) => {
      if (n !== arrastrando && !n.arrastrado) {
        n.px = n.x * W + Math.sin(dt * 1.1 + n.fase) * 4;
        n.py = n.y * H + Math.cos(dt * 0.9 + n.fase) * 4;
      }
    });

    // Dibujar aristas y paquetes de datos en tiempo real
    ENLACES_GRAFO_CE.forEach(([idA, idB], idx) => {
      const a = nodos.find((x) => x.id === idA);
      const b = nodos.find((x) => x.id === idB);
      if (!a || !b) return;

      const visible = filtroCat === 'todos' || a.cat === filtroCat || b.cat === filtroCat;
      const esSel = seleccionado && (seleccionado.id === a.id || seleccionado.id === b.id);

      ctx.save();
      ctx.globalAlpha = !visible ? 0.12 : esSel ? 0.85 : 0.35;
      ctx.strokeStyle = esSel ? (PALETA[seleccionado.cat] || PALETA.agentes) : PALETA.muted;
      ctx.lineWidth = esSel ? 2.2 : 1.1;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();

      // Pulso luminoso viajando por la arista (simula datos en tiempo real)
      if (visible) {
        const prog = ((dt * 0.55 + idx * 0.17) % 1);
        const px = a.px + (b.px - a.px) * prog;
        const py = a.py + (b.py - a.py) * prog;
        ctx.fillStyle = PALETA[a.cat] || PALETA.agentes;
        ctx.beginPath();
        ctx.arc(px, py, esSel ? 3.2 : 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Dibujar nodos
    nodos.forEach((n) => {
      const visible = filtroCat === 'todos' || n.cat === filtroCat || n.id === 'core';
      const esSel = seleccionado && seleccionado.id === n.id;
      const esHov = hoverNodo && hoverNodo.id === n.id;
      const col = PALETA[n.cat] || PALETA.agentes;

      ctx.save();
      ctx.globalAlpha = visible ? 1 : 0.2;

      // Halo pulsante
      const pulsoR = n.r + 5 + Math.sin(dt * 2.5 + n.fase) * 3;
      ctx.beginPath();
      ctx.arc(n.px, n.py, pulsoR, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.globalAlpha = visible ? (esSel ? 0.55 : 0.22) : 0.05;
      ctx.lineWidth = esSel ? 2.5 : 1.2;
      ctx.stroke();

      // Círculo principal
      ctx.globalAlpha = visible ? 1 : 0.22;
      ctx.beginPath();
      ctx.arc(n.px, n.py, n.r, 0, Math.PI * 2);
      ctx.fillStyle = PALETA.bg;
      ctx.fill();
      ctx.lineWidth = esSel || esHov ? 3 : 2;
      ctx.strokeStyle = col;
      ctx.stroke();

      // Núcleo interior de color
      ctx.beginPath();
      ctx.arc(n.px, n.py, Math.max(4, n.r * 0.42), 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // Etiqueta
      ctx.font = `${esSel || n.id === 'core' ? '700 11.5px' : '600 10.5px'} Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3;
      ctx.strokeStyle = PALETA.bg;
      ctx.strokeText(n.label, n.px, n.py + n.r + 5);
      ctx.fillStyle = PALETA.texto;
      ctx.fillText(n.label, n.px, n.py + n.r + 5);

      ctx.restore();
    });

    ctx.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.montarGrafoConocimiento = montarGrafoConocimiento;


/* ════════════════════════════════════════════
   ARRANQUE COMÚN
   ════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderSubnav();
  renderAuthPill();
  initEmergingAlertsOnOpen();
  montarGrafoConocimiento();
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
