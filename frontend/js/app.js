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
});

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
  { prefix: '[CE-Medios]', text: 'Monitoreando Share of Voice en prensa local...', color: '#a78bfa' },
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
