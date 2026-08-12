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
