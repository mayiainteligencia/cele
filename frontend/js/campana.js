/* ============================================
   CEREBRO ELECTORAL — CAMPAÑA.JS
   ============================================
   Motor dinámico del dashboard de Inteligencia
   de Campaña. Contadores animados, feed en vivo,
   datos reales de la plataforma, desglose social.
   ============================================ */

/* ════════════════════════════════════════════
   DATA — Datos coherentes de campaña
   ════════════════════════════════════════════ */
const DATA_CAMPANA = {
  agentes_activos: 8,
  
  /* ── Módulo 1: Coordinación ── */
  coordinacion: {
    equipos_activos: 128,
    coordinaciones: 32,
    cobertura_pct: 87,
    municipios_cubiertos: 11,
    municipios_total: 13
  },

  /* ── Módulo 2: Imagen ── */
  imagen: {
    positiva_pct: 68,
    neutra_pct: 22,
    negativa_pct: 10,
    cambio_pct: 4,
    por_plataforma: {
      facebook:  { positiva: 72, neutra: 20, negativa: 8 },
      instagram: { positiva: 74, neutra: 18, negativa: 8 },
      tiktok:    { positiva: 65, neutra: 20, negativa: 15 },
      twitter:   { positiva: 58, neutra: 25, negativa: 17 },
      youtube:   { positiva: 71, neutra: 22, negativa: 7 }
    }
  },

  /* ── Módulo 3: Comunicación — desglose social ── */
  comunicacion: {
    alcance_total: 4200000,
    alcance_cambio_pct: 12,
    interacciones_total: 730000,
    interacciones_cambio_pct: 18,
    redes: [
      {
        id: 'facebook',
        nombre: 'Facebook',
        color: '#1877f2',
        alcance: 1800000,
        interacciones: 245000,
        engagement_pct: 13.6,
        trending: '#CampecheDecide',
        seguidores: 128500,
        posts_semana: 42
      },
      {
        id: 'tiktok',
        nombre: 'TikTok',
        color: '#ff0050',
        alcance: 980000,
        interacciones: 412000,
        engagement_pct: 42.0,
        trending: '#VotaCampeche',
        seguidores: 67200,
        posts_semana: 28
      },
      {
        id: 'instagram',
        nombre: 'Instagram',
        color: '#e1306c',
        alcance: 720000,
        interacciones: 186000,
        engagement_pct: 25.8,
        trending: '#FuturoCAM',
        seguidores: 94300,
        posts_semana: 35
      },
      {
        id: 'twitter',
        nombre: 'X',
        color: '#a8b3c0',
        alcance: 480000,
        interacciones: 89000,
        engagement_pct: 18.5,
        trending: '#DebateCampeche',
        seguidores: 45600,
        posts_semana: 67
      },
      {
        id: 'youtube',
        nombre: 'YouTube',
        color: '#ff0000',
        alcance: 220000,
        interacciones: 45000,
        engagement_pct: 20.4,
        trending: 'Propuestas 2027',
        seguidores: 18900,
        posts_semana: 8
      }
    ],
    sparkline_24h: [35, 42, 58, 45, 62, 78, 91, 85, 72, 88, 95, 100]
  },

  /* ── Módulo 4: Operación ── */
  operacion: {
    en_tiempo_pct: 92,
    eventos: { actual: 124, total: 130 },
    brigadas: { actual: 980, total: 1000 },
    entregas_pct: 95
  },

  /* ── Módulo 5: Logística ── */
  logistica: {
    distribucion: { actual: 52, total: 55 },
    en_transito_pct: 78,
    cobertura_pct: 96,
    zonas: [
      { nombre: 'Norte', status: 'completo' },
      { nombre: 'Centro', status: 'completo' },
      { nombre: 'Sur', status: 'en_transito' },
      { nombre: 'Costa', status: 'completo' }
    ]
  },

  /* ── Módulo 6: Medios ── */
  medios: {
    cobertura_pct: 68,
    negativa_pct: 10,
    neutral_pct: 22,
    temas: [
      { nombre: 'Propuestas', pct: 28, fuente: 'digital' },
      { nombre: 'Liderazgo', pct: 24, fuente: 'radio' },
      { nombre: 'Resultados', pct: 18, fuente: 'prensa' },
      { nombre: 'Seguridad', pct: 16, fuente: 'digital' },
      { nombre: 'Economía', pct: 14, fuente: 'radio' }
    ]
  },

  /* ── Feed de actividad simulado ── */
  feed: [
    { agente: 'CE-Sentinel', accion: 'Escaneo de 142 secciones completado', icon: 'shield-check', time: '2 min' },
    { agente: 'CE-Medios',   accion: 'Análisis de sentimiento en TikTok actualizado', icon: 'bar-chart-2', time: '5 min' },
    { agente: 'CE-Forense',  accion: 'Auditoría de actas Champotón §0142', icon: 'search', time: '8 min' },
    { agente: 'CE-Encuestas',accion: 'Nuevo tracking Demoscopia integrado', icon: 'trending-up', time: '12 min' },
    { agente: 'CE-Logística', accion: '3 envíos zona Sur confirmados', icon: 'truck', time: '15 min' },
    { agente: 'CE-Imagen',   accion: 'Monitoreo Instagram: +2.4K menciones hoy', icon: 'instagram', time: '18 min' },
    { agente: 'CE-Sentinel', accion: 'Alerta: actividad anómala en Seybaplaya', icon: 'alert-triangle', time: '22 min' },
    { agente: 'CE-Medios',   accion: 'Facebook Ads: CTR 3.2% (+0.4pp)', icon: 'facebook', time: '25 min' },
  ]
};


/* ════════════════════════════════════════════
   SOCIAL ICONS — SVGs inline por plataforma
   ════════════════════════════════════════════ */
const SOCIAL_ICONS = {
  facebook: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.17v-3.4a4.85 4.85 0 01-3-.56h3v0z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
};

/* Iconos de fuente de medios */
const FUENTE_ICONS = {
  digital: '📱',
  radio: '📻',
  prensa: '📰',
  tv: '📺'
};


/* ════════════════════════════════════════════
   INIT — Punto de entrada
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initCounters();
  initProgressBars();
  initDonutAnimations();
  initSocialGrid();
  initSparklines();
  initCenterHub();
  initFeedRotation();
  initScenarios();
  initAlerts();
  initMediaBars();
});


/* ════════════════════════════════════════════
   CONTADORES ANIMADOS — count-up con easing
   ════════════════════════════════════════════ */
function animateCounter(el, target, duration = 1200, prefix = '', suffix = '') {
  const start = 0;
  const startTime = performance.now();
  el.classList.add('counting');

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = Math.floor(start + (target - start) * eased);
    el.textContent = prefix + formatNumber(current) + suffix;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = prefix + formatNumber(target) + suffix;
      el.classList.remove('counting');
    }
  }
  requestAnimationFrame(update);
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' mil';
  return n.toLocaleString('es-MX');
}

function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = '1';
        const target = parseInt(entry.target.dataset.target, 10);
        const suffix = entry.target.dataset.suffix || '';
        const prefix = entry.target.dataset.prefix || '';
        const duration = parseInt(entry.target.dataset.duration || '1200', 10);
        animateCounter(entry.target, target, duration, prefix, suffix);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.counter-animate').forEach(el => observer.observe(el));
}


/* ════════════════════════════════════════════
   BARRAS DE PROGRESO — Animadas al entrar
   ════════════════════════════════════════════ */
function initProgressBars() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target.querySelector('.progress-bar-animated__fill');
        if (fill && !fill.dataset.animated) {
          fill.dataset.animated = '1';
          const targetWidth = fill.dataset.width || '0%';
          requestAnimationFrame(() => {
            fill.style.width = targetWidth;
          });
        }
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.progress-bar-animated').forEach(el => observer.observe(el));
}


/* ════════════════════════════════════════════
   DONUT ANIMATIONS — Dibujar al entrar
   ════════════════════════════════════════════ */
function initDonutAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = '1';
        const gradient = entry.target.dataset.gradient;
        if (gradient) {
          // Start from 0 and animate to target
          entry.target.style.background = `conic-gradient(${gradient.replace(/\d+%/g, '0%')})`;
          requestAnimationFrame(() => {
            entry.target.style.background = `conic-gradient(${gradient})`;
          });
        }
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.donut-chart[data-gradient]').forEach(el => observer.observe(el));
}


/* ════════════════════════════════════════════
   SOCIAL GRID — Desglose por red social
   ════════════════════════════════════════════ */
function initSocialGrid() {
  const container = document.getElementById('social-grid');
  if (!container) return;

  const redes = DATA_CAMPANA.comunicacion.redes;
  const maxEngagement = Math.max(...redes.map(r => r.engagement_pct));

  container.innerHTML = redes.map(red => `
    <div class="social-card" title="${red.nombre}: ${formatNumber(red.interacciones)} interacciones">
      <div class="social-card__icon" style="color:${red.color};">
        ${SOCIAL_ICONS[red.id] || ''}
      </div>
      <span class="social-card__name">${red.nombre}</span>
      <span class="social-card__reach counter-animate" 
            data-target="${red.alcance}" 
            data-duration="1400">0</span>
      <div class="social-card__engagement">
        <div class="social-card__engagement-fill" 
             data-width="${(red.engagement_pct / maxEngagement * 100).toFixed(0)}%"
             style="background:${red.color};"></div>
      </div>
      <span class="social-card__hashtag">${red.trending}</span>
    </div>
  `).join('');

  // Re-init counters and progress for newly created elements
  setTimeout(() => {
    initCounters();
    // Animate engagement bars
    container.querySelectorAll('.social-card__engagement-fill').forEach(fill => {
      const targetWidth = fill.dataset.width;
      setTimeout(() => {
        fill.style.width = targetWidth;
      }, 400);
    });
  }, 100);
}


/* ════════════════════════════════════════════
   SPARKLINES — Mini gráficas CSS
   ════════════════════════════════════════════ */
function initSparklines() {
  const container = document.getElementById('sparkline-24h');
  if (!container) return;

  const data = DATA_CAMPANA.comunicacion.sparkline_24h;
  const max = Math.max(...data);

  container.innerHTML = data.map((val, i) => {
    const height = (val / max * 100).toFixed(0);
    return `<div class="sparkline__bar" style="height:0%" data-height="${height}%"></div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    container.querySelectorAll('.sparkline__bar').forEach((bar, i) => {
      setTimeout(() => {
        bar.style.height = bar.dataset.height;
      }, i * 60);
    });
  }, 300);
}


/* ════════════════════════════════════════════
   CENTER HUB — Reloj en vivo + feed
   ════════════════════════════════════════════ */
function initCenterHub() {
  const clockEl = document.getElementById('center-clock');
  const dateEl = document.getElementById('center-date');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
}


/* ════════════════════════════════════════════
   FEED ROTATIVO — Actividad del sistema
   ════════════════════════════════════════════ */
function initFeedRotation() {
  const container = document.getElementById('feed-container');
  if (!container) return;

  const items = DATA_CAMPANA.feed;
  let currentIndex = 0;

  function showItem(index) {
    const existing = container.querySelector('.feed-item');
    if (existing) {
      existing.classList.add('exiting');
      setTimeout(() => existing.remove(), 400);
    }

    const item = items[index];
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `
      <i data-lucide="${item.icon}" style="width:12px; height:12px; color:var(--accent-cyan); flex-shrink:0;"></i>
      <span style="color:var(--accent-cyan); font-weight:600;">[${item.agente}]</span>
      <span>${item.accion}</span>
      <span style="margin-left:auto; opacity:0.5;">hace ${item.time}</span>
    `;
    container.appendChild(el);
    if (window.lucide) lucide.createIcons({ nodes: [el] });
  }

  showItem(0);
  setInterval(() => {
    currentIndex = (currentIndex + 1) % items.length;
    showItem(currentIndex);
  }, 5000);
}


/* ════════════════════════════════════════════
   ESCENARIOS — Datos reales de la simulación
   ════════════════════════════════════════════ */
async function initScenarios() {
  const container = document.getElementById('escenarios-bars');
  if (!container) return;

  let fuerzas;
  try {
    const resp = await fetch('data/electoral/proyeccion_2027.json');
    const data = await resp.json();
    fuerzas = data.simulacion.fuerzas
      .filter(f => f.prob_victoria > 0 || f.base_2024 > 10)
      .slice(0, 3);
  } catch (e) {
    // Fallback data
    fuerzas = [
      { bloque: 'SHH', media: 46.5, prob_victoria: 97.8 },
      { bloque: 'MC', media: 30.5, prob_victoria: 2.2 },
      { bloque: 'PRI-PRD', media: 12.5, prob_victoria: 0.0 }
    ];
  }

  const BLOQUE_CFG = {
    'SHH':     { label: 'Morena+', color: 'var(--partido-morena)' },
    'MC':      { label: 'MC',      color: 'var(--partido-mc)' },
    'PRI-PRD': { label: 'PRI-PAN', color: 'var(--partido-pri)' },
    'PAN':     { label: 'PAN',     color: 'var(--partido-pan)' },
    'CL':      { label: 'Otros',   color: 'var(--partido-otro)' },
    'OTROS':   { label: 'Otros',   color: 'var(--partido-otro)' }
  };

  const maxPct = Math.max(...fuerzas.map(f => f.media));

  container.innerHTML = fuerzas.map(f => {
    const cfg = BLOQUE_CFG[f.bloque] || { label: f.bloque, color: 'var(--text-muted)' };
    const barWidth = (f.media / maxPct * 100).toFixed(0);
    return `
      <div class="scenario-bar">
        <span class="scenario-bar__label">
          <span style="color:${cfg.color};">●</span> ${cfg.label}
        </span>
        <div class="scenario-bar__track">
          <div class="scenario-bar__fill" data-width="${barWidth}%" style="background:${cfg.color};"></div>
        </div>
        <span class="scenario-bar__pct">${f.media.toFixed(1)}%</span>
      </div>
    `;
  }).join('');

  // Prob victoria
  const probEl = document.getElementById('escenario-prob');
  if (probEl && fuerzas[0]) {
    const cfg = BLOQUE_CFG[fuerzas[0].bloque];
    probEl.innerHTML = `<span style="font-size:0.6rem; color:var(--text-muted);">Prob. victoria</span>
      <span style="font-size:1rem; font-weight:800; color:${cfg.color};">${fuerzas[0].prob_victoria}%</span>
      <span style="font-size:0.55rem; color:var(--text-muted);">${cfg.label}</span>`;
  }

  // Animate bars
  setTimeout(() => {
    container.querySelectorAll('.scenario-bar__fill').forEach(fill => {
      fill.style.width = fill.dataset.width;
    });
  }, 400);
}


/* ════════════════════════════════════════════
   ALERTAS — Con datos reales de municipios
   ════════════════════════════════════════════ */
function initAlerts() {
  const container = document.getElementById('alertas-container');
  if (!container) return;

  const alertas = [
    {
      titulo: 'Riesgo en Champotón, Calkiní y Seybaplaya',
      detalle: 'Ventaja negativa vs oposición. Movilización urgente.',
      severidad: 'critica',
      icon: 'alert-triangle',
      color: 'var(--status-error)',
      time: 'Hace 8 min',
      agente: 'CE-Sentinel'
    },
    {
      titulo: 'Sentimiento negativo ↑ en X/Twitter',
      detalle: 'Hashtag #CampecheExige trending local. Monitoreo activo.',
      severidad: 'alta',
      icon: 'alert-circle',
      color: 'var(--accent-warm)',
      time: 'Hace 22 min',
      agente: 'CE-Medios'
    },
    {
      titulo: 'Oportunidad: Candelaria margen <1pp',
      detalle: 'Activación de brigada puede definir municipio.',
      severidad: 'info',
      icon: 'info',
      color: 'var(--accent-blue)',
      time: 'Hace 35 min',
      agente: 'CE-Estratégico'
    }
  ];

  container.innerHTML = alertas.map(a => {
    const pulseClass = a.severidad === 'critica' ? 'pulse-alert' : 
                       a.severidad === 'alta' ? 'pulse-alert pulse-alert--warning' : 
                       'pulse-alert pulse-alert--info';
    return `
      <div class="${pulseClass}" style="display:flex; gap:10px; padding:6px 0;">
        <i data-lucide="${a.icon}" style="color:${a.color}; width:16px; flex-shrink:0; margin-top:1px;"></i>
        <div style="min-width:0; flex:1;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
            <span style="font-size:0.72rem; font-weight:700; color:var(--text-heading);">${a.titulo}</span>
            <span class="sev-badge sev-badge--${a.severidad}">${a.severidad}</span>
          </div>
          <div style="font-size:0.62rem; color:var(--text-body); line-height:1.3;">${a.detalle}</div>
          <div class="alert-time">
            <span style="color:var(--accent-cyan);">[${a.agente}]</span> · ${a.time}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}


/* ════════════════════════════════════════════
   MEDIA BARS — Temas mencionados animados
   ════════════════════════════════════════════ */
function initMediaBars() {
  const container = document.getElementById('media-temas');
  if (!container) return;

  const temas = DATA_CAMPANA.medios.temas;
  const maxPct = Math.max(...temas.map(t => t.pct));

  container.innerHTML = temas.slice(0, 4).map((t, i) => {
    const fuenteIcon = FUENTE_ICONS[t.fuente] || '📄';
    const barWidth = (t.pct / maxPct * 100).toFixed(0);
    return `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:0.65rem; color:var(--text-muted); min-width:12px;">${fuenteIcon}</span>
        <span style="font-size:0.65rem; color:var(--text-body); min-width:60px;">${t.nombre}</span>
        <div style="flex:1; height:5px; background:var(--panel-fondo-alto); border-radius:3px; overflow:hidden;">
          <div class="media-bar-fill" data-width="${barWidth}%" style="height:100%; width:0; background:var(--accent-cyan); border-radius:3px; transition:width 1.2s cubic-bezier(0.22,1,0.36,1);"></div>
        </div>
        <span style="font-size:0.7rem; font-weight:700; color:var(--text-heading); min-width:28px; text-align:right;">${t.pct}%</span>
      </div>
    `;
  }).join('');

  // Animate
  setTimeout(() => {
    container.querySelectorAll('.media-bar-fill').forEach(fill => {
      fill.style.width = fill.dataset.width;
    });
  }, 600);
}
