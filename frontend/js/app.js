/* ============================================
   CEREBRO ELECTORAL — APP.JS
   ============================================
   Lógica del Centro de Mando Ejecutivo.
   Carga indicadores, vincula el mapa interactivo
   y sincroniza el riel de 13 municipios.
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initExecutiveMap();
  initSubnav();
  initBackgroundMonitoring();
  renderPredictiveDiagnostics();
});

/* ════════════════════════════════════════════
   DIAGNÓSTICO PREDICTIVO — 13 MUNICIPIOS
   Motor de inteligencia electoral de CE-Estratégico.
   Cada municipio tiene un escenario probabilístico,
   una ventaja estimada en puntos porcentuales (pp)
   y una recomendación de acción concreta.
   ════════════════════════════════════════════ */

const MUNICIPIOS_PREDICCION = [
  {
    clave: '04001', nombre: 'Calkiní',
    escenario: 'riesgo',
    ventaja: -3.1,
    participacion_hist: 61.2,
    razon: 'Participación históricamente baja y voto dividido en 2021.',
    accion: 'Reforzar representantes en 8 casillas críticas y activar brigada de movilización.',
    agente: 'CE-Sentinel-1',
  },
  {
    clave: '04002', nombre: 'Campeche',
    escenario: 'competitivo',
    ventaja: +2.8,
    participacion_hist: 66.4,
    razon: 'Capital con electorado urbano dividido. Alta presencia mediática.',
    accion: 'Mantener cobertura total de casillas urbanas. Reforzar difusión en colonias norte.',
    agente: 'CE-Medios',
  },
  {
    clave: '04003', nombre: 'Carmen',
    escenario: 'competitivo',
    ventaja: +1.4,
    participacion_hist: 58.9,
    razon: 'El municipio más grande. Alta movilidad y diversidad de voto.',
    accion: 'Activar 12 representantes adicionales en Ciudad del Carmen sur.',
    agente: 'CE-Sentinel-2',
  },
  {
    clave: '04004', nombre: 'Champotón',
    escenario: 'riesgo',
    ventaja: -4.7,
    participacion_hist: 64.1,
    razon: 'Forensia detectó anomalías en Sección 0142. Oposición con base territorial fuerte.',
    accion: 'Auditoría preventiva de actas. Movilización en comunidades rurales urgente.',
    agente: 'CE-Forense',
  },
  {
    clave: '04005', nombre: 'Hecelchakán',
    escenario: 'favorable',
    ventaja: +8.3,
    participacion_hist: 62.8,
    razon: 'Voto histórico consolidado. Baja competencia en últimos 2 procesos.',
    accion: 'Mantener presencia mínima y asegurar cobertura completa de casillas.',
    agente: 'CE-Encuestas',
  },
  {
    clave: '04006', nombre: 'Hopelchén',
    escenario: 'favorable',
    ventaja: +11.2,
    participacion_hist: 59.3,
    razon: 'Ventaja sólida en encuestas. Comunidades indígenas con voto estructurado.',
    accion: 'Asegurar logística en zonas remotas. Representantes bilingües prioritarios.',
    agente: 'CE-Sentinel-1',
  },
  {
    clave: '04007', nombre: 'Palizada',
    escenario: 'favorable',
    ventaja: +7.6,
    participacion_hist: 68.1,
    razon: 'Municipio pequeño con alta participación y voto histórico sólido.',
    accion: 'Cobertura garantizada. Monitorear Sección 0084 por anomalía previa de votos nulos.',
    agente: 'CE-Forense',
  },
  {
    clave: '04008', nombre: 'Tenabo',
    escenario: 'favorable',
    ventaja: +9.1,
    participacion_hist: 63.5,
    razon: 'Municipio pequeño con ventaja histórica consistente desde 2018.',
    accion: 'Solo supervisión estándar. Sin intervención adicional requerida.',
    agente: 'CE-Encuestas',
  },
  {
    clave: '04009', nombre: 'Escárcega',
    escenario: 'competitivo',
    ventaja: +3.2,
    participacion_hist: 60.7,
    razon: 'Municipio en crecimiento demográfico. Voto joven no definido.',
    accion: 'Campaña de activación en polígonos de nueva densidad poblacional.',
    agente: 'CE-Medios',
  },
  {
    clave: '04010', nombre: 'Calakmul',
    escenario: 'favorable',
    ventaja: +14.8,
    participacion_hist: 55.4,
    razon: 'Región rural con voto leal. Baja competencia de oposición registrada.',
    accion: 'Asegurar acceso a casillas en comunidades ejidales remotas.',
    agente: 'CE-Sentinel-1',
  },
  {
    clave: '04011', nombre: 'Candelaria',
    escenario: 'competitivo',
    ventaja: +0.9,
    participacion_hist: 61.8,
    razon: 'Margen menor a 1pp. Definirá la contienda en escenario cerrado.',
    accion: 'PRIORIDAD ALTA: Desplegar brigadas de movilización y activar red de contacto.',
    agente: 'CE-Estratégico',
  },
  {
    clave: '04012', nombre: 'Seybaplaya',
    escenario: 'riesgo',
    ventaja: -2.3,
    participacion_hist: 66.2,
    razon: 'Municipio nuevo independiente. Base de datos de padrón aún en consolidación.',
    accion: 'Validar padrón nominal actualizado. Representantes asignados en revisión.',
    agente: 'CE-Forense',
  },
  {
    clave: '04013', nombre: 'Dzitbalché',
    escenario: 'competitivo',
    ventaja: +4.1,
    participacion_hist: 63.0,
    razon: 'Municipio nuevo. Encuesta local favorece pero con margen de error elevado.',
    accion: 'Reforzar datos de padrón y asignar representante general coordinador.',
    agente: 'CE-Encuestas',
  },
];

const ESCENARIO_CFG = {
  favorable:   { color: 'var(--status-success)', bg: 'var(--proc-recomendacion-bg)',   border: 'var(--proc-recomendacion-bg)',   label: 'Favorable',   icon: 'trending-up' },
  competitivo: { color: 'var(--sev-media)', bg: 'var(--sev-media-bg)',   border: 'var(--sev-media-bg)',   label: 'Competitivo', icon: 'minus' },
  riesgo:      { color: 'var(--sev-critica)', bg: 'var(--sev-critica-bg)',   border: 'var(--sev-critica-bg)',   label: 'En Riesgo',   icon: 'trending-down' },
};

const RECOMENDACIONES_GLOBALES = [
  { prioridad: 'ALTA',   icon: 'alert-triangle', color: 'var(--sev-critica)', texto: 'Auditar actas de Champotón Sec. 0142 antes del día D.' },
  { prioridad: 'ALTA',   icon: 'alert-triangle', color: 'var(--sev-critica)', texto: 'Movilización urgente en Candelaria — margen <1pp.' },
  { prioridad: 'MEDIA',  icon: 'map-pin',         color: 'var(--sev-media)', texto: 'Asignar representante coordinador en Seybaplaya.' },
  { prioridad: 'MEDIA',  icon: 'users',           color: 'var(--sev-media)', texto: 'Reforzar brigadas en Calkiní — 8 casillas críticas.' },
  { prioridad: 'NORMAL', icon: 'check-circle-2',  color: 'var(--status-success)', texto: 'Mantener cobertura estándar en 6 municipios favorables.' },
];

function renderPredictiveDiagnostics() {
  const grid = document.getElementById('mun-prediccion-grid');
  if (!grid) return;

  const counts = { favorable: 0, competitivo: 0, riesgo: 0 };
  const munEnRiesgo = [];

  grid.innerHTML = MUNICIPIOS_PREDICCION.map(m => {
    const cfg = ESCENARIO_CFG[m.escenario];
    counts[m.escenario]++;
    if (m.escenario === 'riesgo') munEnRiesgo.push(m.nombre);

    const signo = m.ventaja > 0 ? '+' : '';
    return `
      <div style="
        background:${cfg.bg}; border:1px solid ${cfg.border};
        border-radius:var(--radius-xs); padding:10px 12px;
        display:flex; flex-direction:column; gap:4px;
        cursor:default; transition:transform 0.2s;
      " title="${m.accion}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.82rem; color:var(--text-heading);">${m.nombre}</strong>
          <span style="font-size:0.68rem; background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; padding:2px 7px; border-radius:4px; font-weight:700;">${cfg.label}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <i data-lucide="${cfg.icon}" style="color:${cfg.color}; width:13px; height:13px; flex-shrink:0;"></i>
          <span style="font-size:0.78rem; font-weight:700; color:${cfg.color};">${signo}${m.ventaja}pp</span>
          <span style="font-size:0.7rem; color:var(--text-muted);">vs. oposición</span>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); line-height:1.3;">${m.razon}</div>
        <div style="font-size:0.68rem; color:var(--text-muted); padding-top:2px; border-top:1px solid var(--velo-05);">
          <span style="color:${cfg.color};">[${m.agente}]</span> ${m.accion.substring(0, 55)}…
        </div>
      </div>`;
  }).join('');

  // Contadores del resumen
  const cF = document.getElementById('cnt-favorable');
  const cC = document.getElementById('cnt-competitivo');
  const cR = document.getElementById('cnt-riesgo');
  const accion = document.getElementById('accion-resumen');
  const alertaTexto = document.getElementById('alerta-agente-texto');
  const panelAlerta = document.getElementById('panel-alerta-agente');

  if (cF) cF.textContent = counts.favorable;
  if (cC) cC.textContent = counts.competitivo;
  if (cR) cR.textContent = counts.riesgo;

  if (accion) {
    if (counts.riesgo >= 3) {
      accion.textContent = `Intervención urgente en ${counts.riesgo} municipios en riesgo`;
    } else if (counts.riesgo > 0) {
      accion.textContent = `Refuerzo focalizado en ${munEnRiesgo.join(' y ')}`;
    } else {
      accion.textContent = 'Sin intervención urgente requerida';
    }
  }

  if (alertaTexto && panelAlerta) {
    const texto = munEnRiesgo.length > 0
      ? `<strong>${munEnRiesgo.length} municipios en zona de riesgo:</strong> ${munEnRiesgo.join(', ')}. El modelo estima una ventaja negativa sobre la oposición en estas zonas. Se requieren acciones de movilización y cobertura territorial inmediata.`
      : 'Todos los municipios en escenario neutro o favorable. Mantener supervisión estándar.';
    alertaTexto.innerHTML = texto;
    if (munEnRiesgo.length === 0) {
      panelAlerta.style.borderLeftColor = 'var(--status-success)';
      panelAlerta.querySelector('i').style.color = 'var(--status-success)';
      panelAlerta.querySelector('strong').style.color = 'var(--status-success)';
    }
  }

  // Recomendaciones
  const listaRec = document.getElementById('lista-recomendaciones');
  if (listaRec) {
    listaRec.innerHTML = RECOMENDACIONES_GLOBALES.map(r => `
      <div style="display:flex; gap:8px; align-items:flex-start; padding:6px 8px; background:var(--panel-fondo-tenue); border-radius:6px;">
        <i data-lucide="${r.icon}" style="color:${r.color}; width:13px; height:13px; flex-shrink:0; margin-top:2px;"></i>
        <div style="min-width:0;">
          <span style="font-size:0.65rem; font-weight:700; color:${r.color}; text-transform:uppercase;">${r.prioridad}</span>
          <div style="font-size:0.75rem; color:var(--text-body); line-height:1.35;">${r.texto}</div>
        </div>
      </div>
    `).join('');
  }

  if (window.lucide) lucide.createIcons();
}


function initExecutiveMap() {
  const elMapa = document.getElementById('mapa-ejecutivo');
  if (!elMapa || typeof CerebroMapa === 'undefined') return;

  // Carga los datos de las escuelas para registrar variables de choropleth
  fetch('data/geo/escuelas_campeche.geojson')
    .then((r) => r.json())
    .then((json) => {
      const escuelas = {};
      const alumnado = {};

      json.features.forEach((f) => {
        const k = f.properties.cve_mun;
        if (!k) return;
        escuelas[k] = (escuelas[k] || 0) + 1;
        alumnado[k] = (alumnado[k] || 0) + (f.properties.alumnos_total || 0);
      });

      CerebroMapa.registrarVariable('escuelas_por_municipio', {
        etiqueta: 'Escuelas CCT por Municipio',
        valores: escuelas,
        formato: (v) => v.toLocaleString('es-MX') + ' escuelas',
        fuente: json.metadata?.fuente || 'SEP — Catálogo de Centros de Trabajo',
        fechaCorte: json.metadata?.fecha_corte || '2024',
        procedencia: 'Cálculo sobre catálogo CCT SEP Campeche',
      });

      CerebroMapa.registrarVariable('alumnado', {
        etiqueta: 'Alumnado Registrado',
        valores: alumnado,
        formato: (v) => v.toLocaleString('es-MX') + ' alumnos',
        fuente: json.metadata?.fuente || 'SEP — Catálogo de Centros de Trabajo',
        fechaCorte: json.metadata?.fecha_corte || '2024',
        procedencia: 'Cálculo sobre catálogo CCT SEP Campeche',
      });

      // Crear el mapa interactivo principal
      const mapa = CerebroMapa.crear('#mapa-ejecutivo', {
        capas: ['municipios', 'escuelas'],
        panelCapas: true,
        choropleth: null,
      });

      window.__mapa = mapa;

      // Eventos de botones de choropleth
      document.getElementById('btn-colorear-escuelas')?.addEventListener('click', () => {
        mapa.setChoropleth('escuelas_por_municipio');
      });
      document.getElementById('btn-colorear-alumnado')?.addEventListener('click', () => {
        mapa.setChoropleth('alumnado');
      });

      // Cargar lista de 13 municipios en el riel lateral
      fetch('data/geo/municipios.geojson')
        .then((r) => r.json())
        .then((munGeo) => {
          const listaEl = document.getElementById('lista-municipios');
          if (!listaEl) return;

          const munOrdenados = munGeo.features
            .map((f) => f.properties)
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

          listaEl.innerHTML = munOrdenados
            .map((m) => {
              const cve = m.cve_mun || m.cvegeo;
              const nEscuelas = escuelas[cve] || escuelas[cve?.slice(-3)] || 0;
              const nAlumnos = alumnado[cve] || alumnado[cve?.slice(-3)] || 0;

              return `
                <div class="mun-item" data-cve="${cve}">
                  <div class="mun-item__info">
                    <span class="mun-item__nombre">${m.nombre}</span>
                    <span class="mun-item__meta">Clave ${cve} &middot; ${nEscuelas} inmuebles</span>
                  </div>
                  <span class="mun-item__badge">${nAlumnos > 0 ? nAlumnos.toLocaleString('es-MX') + ' alum.' : 'Cabecera'}</span>
                </div>`;
            })
            .join('');

          // Evento click en cada municipio para enfocarlo en el mapa
          listaEl.querySelectorAll('.mun-item').forEach((item) => {
            item.addEventListener('click', () => {
              const cve = item.dataset.cve;
              mapa.irA(cve);
            });
          });
        });
    });
}

function initSubnav() {
  document.querySelectorAll('.subnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subnav-btn').forEach((b) => b.classList.remove('subnav-btn--active'));
      btn.classList.add('subnav-btn--active');

      const view = btn.dataset.view;
      if (view === 'fuentes') {
        document.getElementById('seccion-trazabilidad')?.scrollIntoView({ behavior: 'smooth' });
      } else if (view === 'mapa') {
        document.getElementById('mapa-ejecutivo')?.scrollIntoView({ behavior: 'smooth' });
      } else if (view === 'municipios') {
        document.getElementById('lista-municipios')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function initScrollAnimations() {
  const fadeElements = document.querySelectorAll('.fade-in');
  if (!fadeElements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  fadeElements.forEach((el) => observer.observe(el));
}

/* ════════════════════════════════════════════
   BACKGROUND MONITORING AGENTS SIMULATOR
   ════════════════════════════════════════════ */

const LOGS_AGENTES = [
  { prefix: '[CE-Sentinel-1]', text: 'Escaneando participación electoral en Calkiní...', color: 'var(--accent-cyan)' },
  { prefix: '[CE-Forense]', text: 'Analizando actas de Champotón...', color: 'var(--accent-blue)' },
  { prefix: '[CE-Finanzas]', text: 'Auditoría presupuestal al 100%...', color: 'var(--accent-warm)' },
  { prefix: '[CE-Sentinel-2]', text: 'Verificando firmas de Seybaplaya...', color: 'var(--accent-cyan)' },
  { prefix: '[CE-Medios]', text: 'Monitoreando Share of Voice en prensa local...', color: 'var(--accent-purple)' },
  { prefix: '[CE-Forense-2]', text: 'Escaneo de anomalías en Sección 0142 completado.', color: 'var(--accent-blue)' },
  { prefix: '[CE-Finanzas]', text: 'Validando comprobantes de gastos de campaña...', color: 'var(--accent-warm)' },
  { prefix: '[CE-Sentinel-1]', text: 'Analizando cobertura de representantes de casilla...', color: 'var(--accent-cyan)' },
];

const NOTIFICACIONES_AGENTES = [
  { tipo: 'alerta', titulo: 'Alerta Forense [CE-Forense-3]', texto: 'Participación inusual del 87% detectada en Champotón (Sección 0142). Solicitando verificación de actas.' },
  { tipo: 'medios', titulo: 'Monitoreo de Medios [CE-Medios-7]', texto: 'Detección de pico de sentimiento positivo (+4.2%) tras mitin del candidato en Seybaplaya.' },
  { tipo: 'finanzas', titulo: 'Copiloto Financiero [CE-Finanzas-2]', texto: 'Logística de Calkiní conciliada. Comprobantes fiscales cargados correctamente.' },
  { tipo: 'decision', titulo: 'Sala de Decisiones [CE-Sentinel-1]', texto: 'Recomendación de reubicación de representante en Dzitbalché por mayor volumen electoral.' },
  { tipo: 'alerta', titulo: 'Alerta Forense [CE-Forense-2]', texto: 'Porcentaje atípico de votos nulos (6.2%) detectado en Palizada (Sección 0084).' }
];

function initBackgroundMonitoring() {
  const feedEl = document.getElementById('live-agents-feed');
  
  if (feedEl) {
    let logIndex = 0;
    // Llenar inicialmente
    feedEl.innerHTML = '';
    for(let i=0; i<3; i++) {
      const log = LOGS_AGENTES[i];
      const div = document.createElement('div');
      div.innerHTML = `<span style="color:${log.color};">${log.prefix}</span> ${log.text}`;
      feedEl.appendChild(div);
    }
    logIndex = 3;

    setInterval(() => {
      const log = LOGS_AGENTES[logIndex];
      const div = document.createElement('div');
      div.style.opacity = '0';
      div.style.transform = 'translateY(10px)';
      div.style.transition = 'all 0.4s ease';
      div.innerHTML = `<span style="color:${log.color};">${log.prefix}</span> ${log.text}`;
      
      feedEl.appendChild(div);
      if (feedEl.children.length > 4) {
        feedEl.removeChild(feedEl.firstChild);
      }
      
      setTimeout(() => {
        div.style.opacity = '1';
        div.style.transform = 'translateY(0)';
      }, 50);

      logIndex = (logIndex + 1) % LOGS_AGENTES.length;
    }, 4500);
  }

  // Lanzar alertas del copiloto a través de Toasts cada 14 segundos
  let toastIndex = 0;
  setInterval(() => {
    if (typeof toast === 'function') {
      const alert = NOTIFICACIONES_AGENTES[toastIndex];
      toast({
        tipo: alert.tipo,
        titulo: alert.titulo,
        texto: alert.texto,
        duracion: 8000
      });
      toastIndex = (toastIndex + 1) % NOTIFICACIONES_AGENTES.length;
    }
  }, 14000);
}


/* ════════════════════════════════════════════
   CE — NAMESPACE GLOBAL
   ════════════════════════════════════════════
   Cinco páginas llamaban CE.initAgents() y CE no
   existía en ningún archivo: venía de un js/agents.js
   que nunca se escribió y que daba 404. El resultado
   era un ReferenceError que mataba el resto del
   manejador de DOMContentLoaded de esas páginas.

   En medios.html eso dejaba la página inerte: no
   corría checkBackend, ni renderEmisoras, ni
   bindEvents — el botón "Iniciar Monitoreo" no
   hacía nada.

   La consola de agentes ya la levanta
   initBackgroundMonitoring() en el arranque, así que
   aquí solo se expone la fachada que esas páginas
   esperan, con guarda para no montar dos veces.
   ════════════════════════════════════════════ */

window.CE = window.CE || {
  _montado: false,

  /** @param {string|null} pagina  id de la página, para telemetría futura */
  initAgents(pagina) {
    if (this._montado) return;
    this._montado = true;
    this.pagina = pagina || document.body.dataset.page || null;
    // initBackgroundMonitoring() ya corrió en el DOMContentLoaded de este
    // archivo. Si alguna página lo llama antes de tiempo, se cubre aquí.
    if (!document.getElementById('live-agents-feed')) return;
  },

  toast(t) {
    if (typeof toast === 'function') toast(t);
  },

  /* ── Tinta del hero contra el fondo ──
     El fondo del home es un video en movimiento: en el mismo segundo,
     detrás del título pasa el espacio negro y el borde iluminado del
     planeta. Cualquier color fijo se pierde en uno de los dos.

     Se mide la luminancia del fotograma detrás de CADA bloque de texto,
     no del hero completo: el título y el contador están en franjas
     distintas de la imagen y un promedio único le daría a los dos el
     color equivocado. Al que le toca fondo claro se le pone la clase
     `sobre-claro`; el color lo decide el CSS.

     No hay red ni librería: un canvas de 24x12 y una media ponderada.
     Si el video no está listo se usa el poster, y si tampoco, se deja
     el modo oscuro, que es el que ya tenía la página. */
  contrasteHero(selectores, respaldo) {
    const lista = (Array.isArray(selectores) ? selectores : [selectores || '.hero__content'])
      .map((s) => document.querySelector(s))
      .filter(Boolean);
    const escenario = document.querySelector('.bg-stage');
    if (!lista.length || !escenario) return;

    const video = escenario.querySelector('.bg-stage__video');
    const poster = new Image();
    // El mismo fotograma que declara el <video poster>. Se puede sustituir
    // para probar el umbral con una imagen de luminancia conocida.
    poster.src = respaldo || 'assets/images/earth.png';

    const lienzo = document.createElement('canvas');
    lienzo.width = 24;
    lienzo.height = 12;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });

    // Umbral con histéresis por bloque: el video oscila alrededor del
    // medio y sin esta banda muerta el texto parpadearía entre negro y
    // blanco.
    const claro = lista.map(() => false);

    function fuente() {
      if (video && video.readyState >= 2 && !video.paused) {
        return { el: video, w: video.videoWidth, h: video.videoHeight };
      }
      if (poster.complete && poster.naturalWidth) {
        return { el: poster, w: poster.naturalWidth, h: poster.naturalHeight };
      }
      return null;
    }

    /** Luminancia media (0-1) del fotograma detrás de una caja, o null. */
    function luminancia(caja, src) {
      const vw = escenario.clientWidth;
      const vh = escenario.clientHeight;

      // object-fit: cover — la imagen se escala al mayor de los dos lados
      // y se recorta centrada. Sin deshacer ese recorte se mediría el
      // pixel equivocado.
      const escala = Math.max(vw / src.w, vh / src.h);
      const sx = (caja.left - (vw - src.w * escala) / 2) / escala;
      const sy = (caja.top - (vh - src.h * escala) / 2) / escala;
      const sw = caja.width / escala;
      const sh = caja.height / escala;
      if (sw <= 0 || sh <= 0) return null;

      try {
        ctx.drawImage(src.el,
          Math.max(0, sx), Math.max(0, sy),
          Math.min(sw, src.w), Math.min(sh, src.h),
          0, 0, lienzo.width, lienzo.height);
      } catch (e) {
        return null;   // fotograma no decodificable todavía
      }

      const px = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
      let suma = 0;
      for (let i = 0; i < px.length; i += 4) {
        suma += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      }
      return suma / (px.length / 4);
    }

    function medir() {
      const src = fuente();
      if (!src || !src.w) return;

      lista.forEach((el, i) => {
        if (el.hidden || !el.offsetParent) return;
        const lum = luminancia(el.getBoundingClientRect(), src);
        if (lum === null) return;

        const nuevo = claro[i] ? lum > 0.42 : lum > 0.58;
        if (nuevo !== claro[i]) {
          claro[i] = nuevo;
          el.classList.toggle('sobre-claro', nuevo);
        }
      });
    }

    medir();
    // 3 Hz: el video es lento y medir cada fotograma sería quemar CPU
    // para decidir lo mismo.
    const pulso = setInterval(medir, 320);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(pulso);
    });
  },

  /* ── Cuenta regresiva a la jornada electoral ──
     Domingo 6 de junio de 2027, primer domingo de junio, como manda el
     artículo 24 de la LGIPE. Arranca en el instante en que se abre la
     página: no hay fecha de inicio fija ni barra de progreso, porque
     "cuánto llevamos" depende de qué proceso creas que ya empezó.

     La hora se fija en zona de Campeche (UTC-6, sin horario de verano
     desde 2022). Sin ella, alguien en otro huso vería otro número. */
  cuentaRegresiva(contenedor) {
    const el = typeof contenedor === 'string'
      ? document.querySelector(contenedor) : contenedor;
    if (!el) return;

    const JORNADA = new Date('2027-06-06T08:00:00-06:00');
    const campos = ['dias', 'horas', 'minutos', 'segundos'];

    const pintar = () => {
      let resto = Math.max(0, JORNADA - new Date());
      if (!resto) {
        el.innerHTML = '<p class="cuenta__jornada">Hoy es la jornada electoral.</p>';
        return true;   // deja de latir
      }

      const s = Math.floor(resto / 1000);
      const v = {
        dias: Math.floor(s / 86400),
        horas: Math.floor(s / 3600) % 24,
        minutos: Math.floor(s / 60) % 60,
        segundos: s % 60,
      };

      campos.forEach((k) => {
        const caja = el.querySelector(`[data-cuenta="${k}"]`);
        if (!caja) return;
        const txt = k === 'dias' ? String(v[k]) : String(v[k]).padStart(2, '0');
        if (caja.textContent !== txt) caja.textContent = txt;
      });
      return false;
    };

    if (pintar()) return;
    const latido = setInterval(() => { if (pintar()) clearInterval(latido); }, 1000);
  },
};
