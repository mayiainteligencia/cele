/* ============================================
   CEREBRO ELECTORAL — COMPONENTE DE MAPA
   ============================================
   Un solo mapa reutilizable en todos los módulos.

     const mapa = CerebroMapa.crear('#mi-mapa', {
       capas: ['limite', 'escuelas'],
       panelCapas: true,
       choropleth: 'participacion',
     });

   Opciones:
     centro        [lat, lon]. Default: centro de Campeche.
     zoom          número. Default: 7.
     capas         ids visibles al inicio. Default: ['limite'].
     panelCapas    muestra el control de capas. Default: true.
     choropleth    id de variable municipal, o null.
     puntos        GeoJSON propio que sustituye a 'escuelas'.
     alSeleccionar callback(props, capaId) al hacer clic.

   Métodos:
     mapa.alternarCapa(id, visible)
     mapa.setChoropleth(idVariable | null)
     mapa.irA(cveMun)
     mapa.destruir()

   Depende de Leaflet 1.9 (CDN) y de los tokens de colors.css.
   ============================================ */

(function (global) {
  'use strict';

  const RUTA_DATOS = 'data/geo/';
  const CENTRO_CAMPECHE = [18.85, -90.4];

  // Lee un token CSS para que el mapa siga la paleta sin duplicar colores.
  const token = (nombre) =>
    getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();


  /* ════════════════════════════════════════════
     CATÁLOGO DE CAPAS

     'disponible' = hay archivo en data/geo/.
     'pendiente'  = la capa existe en el contrato pero
                    todavía no tenemos el insumo. Se
                    registra igual, con checkbox inhabilitado
                    y la fuente de donde hay que obtenerla.
                    NO se inventan polígonos.
     ════════════════════════════════════════════ */

  const CATALOGO = [
    {
      categoria: 'Marco geográfico',
      capas: [
        {
          id: 'limite',
          etiqueta: 'Límite estatal',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'limite_estatal.geojson',
          claveGeo: 'cvegeo',
          nombre: 'nombre',
        },
        {
          id: 'municipios',
          etiqueta: 'Municipios',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'municipios.geojson',
          claveGeo: 'cve_mun',
          nombre: 'nombre',
        },
        {
          id: 'localidades',
          etiqueta: 'Localidades (urbanas y rurales)',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'localidades.geojson',
          claveGeo: 'cvegeo',
          nombre: 'nombre',
          ficha: [['ambito', 'Ámbito']],
        },
        {
          id: 'ageb_urbanas',
          etiqueta: 'AGEB urbanas',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'ageb_urbanas.geojson',
          claveGeo: 'cvegeo',
          nombre: 'cvegeo',
          ficha: [['cve_ageb', 'Clave AGEB'], ['cve_loc', 'Localidad']],
        },
        {
          id: 'ageb_rurales',
          etiqueta: 'AGEB rurales',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'ageb_rurales.geojson',
          claveGeo: 'cvegeo',
          nombre: 'cvegeo',
          ficha: [['cve_ageb', 'Clave AGEB']],
        },
      ],
    },
    {
      categoria: 'Cartografía electoral',
      capas: [
        {
          id: 'distritos_federales',
          etiqueta: 'Distritos federales',
          estado: 'pendiente',
          origen: 'Cartografía Electoral INE',
        },
        {
          id: 'distritos_locales',
          etiqueta: 'Distritos locales',
          estado: 'pendiente',
          origen: 'Cartografía Electoral INE / IEEC',
        },
        {
          id: 'secciones',
          etiqueta: 'Secciones electorales',
          estado: 'pendiente',
          origen: 'Cartografía Electoral INE',
        },
      ],
    },
    {
      categoria: 'Casillas y ubicaciones',
      capas: [
        {
          id: 'escuelas',
          etiqueta: 'Escuelas (ubicaciones potenciales)',
          estado: 'disponible',
          tipo: 'puntos',
          archivo: 'escuelas_campeche.geojson',
          claveGeo: 'cct',
          nombre: 'nombre_centro_trabajo',
          // Campos que se muestran en la ficha emergente.
          ficha: [
            ['nivel', 'Nivel'],
            ['servicio', 'Servicio'],
            ['sostenimiento', 'Sostenimiento'],
            ['nombre_turno', 'Turno'],
            ['nombre_municipio', 'Municipio'],
            ['nombre_localidad', 'Localidad'],
            ['domicilio_completo', 'Domicilio'],
            ['alumnos_total', 'Alumnado'],
            ['docentes_total', 'Docentes'],
            ['aulas_existentes', 'Aulas existentes'],
            ['aulas_en_uso', 'Aulas en uso'],
          ],
        },
        {
          id: 'casillas_historicas',
          etiqueta: 'Casillas históricas',
          estado: 'pendiente',
          origen: 'Encartes INE de procesos anteriores',
        },
        {
          id: 'casillas_vigentes',
          etiqueta: 'Casillas aprobadas 2027',
          estado: 'pendiente',
          origen: 'Pendiente de aprobación oficial del INE',
        },
      ],
    },
    {
      categoria: 'Contexto',
      capas: [
        {
          id: 'estados_vecinos',
          etiqueta: 'Estados vecinos',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: '../../estados/states.geojson',
          claveGeo: 'state_code',
          nombre: 'state_name',
          bajoDemanda: true, // 361 KB: solo se carga si se enciende
        },
        // Urbano/rural no es capa aparte: viene como `ambito` en localidades.
      ],
    },
  ];

  const TODAS = CATALOGO.flatMap((g) => g.capas);
  const buscarCapa = (id) => TODAS.find((c) => c.id === id);


  /* ════════════════════════════════════════════
     VARIABLES DE COLOREADO (choropleth)

     Los valores municipales los inyecta cada módulo
     vía CerebroMapa.registrarVariable(). Aquí solo
     vive el contrato: qué variable, cómo se formatea
     y de dónde salió.
     ════════════════════════════════════════════ */

  const VARIABLES = {};

  function registrarVariable(id, def) {
    // def: { etiqueta, valores: {cve_mun: number}, formato, fuente,
    //        fechaCorte, procedencia, escala: 'secuencial'|'divergente' }
    VARIABLES[id] = Object.assign({ escala: 'secuencial', formato: (v) => v }, def);
  }


  /* ════════════════════════════════════════════
     UTILIDADES
     ════════════════════════════════════════════ */

  function escapar(v) {
    if (v === null || v === undefined || v === '') return '—';
    return String(v).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  function rampa(escala) {
    return escala === 'divergente'
      ? ['--div-neg-fuerte', '--div-neg', '--div-centro', '--div-pos', '--div-pos-fuerte'].map(token)
      : ['--escala-1', '--escala-2', '--escala-3', '--escala-4', '--escala-5', '--escala-6'].map(token);
  }

  // Cortes de igual amplitud. Con 13 municipios los cuantiles dejan
  // cubetas de un solo elemento; la amplitud fija se lee mejor en la leyenda.
  function cortes(valores, n) {
    const v = valores.filter((x) => typeof x === 'number' && !isNaN(x));
    if (!v.length) return null;
    const min = Math.min(...v);
    const max = Math.max(...v);
    if (min === max) return { min, max, paso: 0 };
    return { min, max, paso: (max - min) / n };
  }

  function cubeta(valor, c, n) {
    if (!c || c.paso === 0) return 0;
    return Math.min(n - 1, Math.floor((valor - c.min) / c.paso));
  }


  /* ════════════════════════════════════════════
     FICHA EMERGENTE

     Regla transversal 1: ninguna cifra sin fuente y
     fecha de corte. El popup siempre cierra con ese
     bloque, incluso cuando la fuente no declara fecha.
     ════════════════════════════════════════════ */

  function ficha(props, capa, extra) {
    const titulo = escapar(props[capa.nombre] || props[capa.claveGeo]);
    const clave = escapar(props[capa.claveGeo]);

    let filas = '';
    (capa.ficha || []).forEach(([campo, etiqueta]) => {
      if (props[campo] === undefined) return;
      filas += `<tr><th>${escapar(etiqueta)}</th><td>${escapar(props[campo])}</td></tr>`;
    });

    if (extra) filas += extra;

    // Estatus de ubicación: una escuela registrada NO es una casilla futura.
    let aviso = '';
    if (props.estatus_ubicacion) {
      const leyenda = {
        potencial: 'Ubicación potencial. No aprobada como casilla.',
        historica: 'Alojó casilla en un proceso anterior.',
        aprobada: 'Aprobada por el INE en el proceso vigente.',
      }[props.estatus_ubicacion] || props.estatus_ubicacion;
      aviso = `<p class="mapa-ficha__aviso">${escapar(leyenda)}</p>`;
    }

    return `
      <div class="mapa-ficha">
        <h4 class="mapa-ficha__titulo">${titulo}</h4>
        <p class="mapa-ficha__clave">${clave}</p>
        ${aviso}
        ${filas ? `<table class="mapa-ficha__tabla"><tbody>${filas}</tbody></table>` : ''}
        <dl class="mapa-ficha__meta">
          <dt>Fuente</dt><dd>${escapar(props.fuente || capa.origen)}</dd>
          <dt>Fecha de corte</dt>
          <dd>${props.fecha_corte ? escapar(props.fecha_corte) : 'no declarada por la fuente'}</dd>
        </dl>
      </div>`;
  }


  /* ════════════════════════════════════════════
     COMPONENTE
     ════════════════════════════════════════════ */

  function crear(contenedor, opciones) {
    const el = typeof contenedor === 'string'
      ? document.querySelector(contenedor)
      : contenedor;
    if (!el) throw new Error('CerebroMapa: contenedor no encontrado: ' + contenedor);
    if (!global.L) throw new Error('CerebroMapa: falta Leaflet.');

    const cfg = Object.assign({
      centro: CENTRO_CAMPECHE,
      zoom: 7,
      capas: ['limite'],
      panelCapas: true,
      choropleth: null,
      puntos: null,
      alSeleccionar: null,
    }, opciones || {});

    el.classList.add('mapa');
    const lienzo = document.createElement('div');
    lienzo.className = 'mapa__lienzo';
    el.appendChild(lienzo);

    const map = L.map(lienzo, {
      center: cfg.centro,
      zoom: cfg.zoom,
      zoomControl: false,
      attributionControl: false,
      // Campeche es casi cuadrado y los contenedores son anchos y bajos.
      // Con zoomSnap entero, fitBounds tiene que bajar un nivel completo y
      // el estado queda flotando en medio del Golfo. El cuarto de nivel
      // deja el encuadre pegado al polígono.
      zoomSnap: 0.25,
      zoomDelta: 0.5,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

    // Tiles oscuros: el OSM estándar pelea con la paleta.
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &middot; &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    // 2,274 puntos en SVG arrastran el navegador; canvas no.
    const lienzoPuntos = L.canvas({ padding: 0.4 });

    const capasLeaflet = {};   // id -> LayerGroup
    const datos = {};          // id -> GeoJSON crudo
    const cargando = {};       // id -> Promise
    let choroplethActual = cfg.choropleth;
    let capaChoropleth = null;
    let seleccionado = null;

    // El contenedor casi siempre nace con tamaño 0 dentro de un grid, así que
    // el primer fitBounds encuadra contra una caja que no es la definitiva.
    // Se guarda el encuadre y se reaplica en cada resize, hasta que el usuario
    // mueva el mapa: a partir de ahí manda él.
    let encuadre = null;
    let libre = false;
    L.DomEvent.on(lienzo, 'mousedown wheel touchstart', () => { libre = true; });

    /* ── Carga de datos ── */

    function cargar(id) {
      if (datos[id]) return Promise.resolve(datos[id]);
      if (cargando[id]) return cargando[id];
      const capa = buscarCapa(id);
      if (!capa || capa.estado !== 'disponible') return Promise.resolve(null);

      cargando[id] = fetch(RUTA_DATOS + capa.archivo)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} al cargar ${capa.archivo}`);
          return r.json();
        })
        .then((json) => { datos[id] = json; return json; })
        .catch((err) => {
          console.error('CerebroMapa:', err);
          avisar(`No se pudo cargar la capa "${capa.etiqueta}".`);
          return null;
        });
      return cargando[id];
    }

    /* ── Construcción de capas ── */

    function construir(id, json) {
      const capa = buscarCapa(id);

      if (capa.tipo === 'puntos') {
        return L.geoJSON(json, {
          renderer: lienzoPuntos,
          pointToLayer: (f, latlng) =>
            L.circleMarker(latlng, {
              radius: 3.5,
              fillColor: token('--mapa-punto'),
              color: token('--mapa-punto-borde'),
              weight: 0.75,
              fillOpacity: 0.85,
            }),
          onEachFeature: (f, lyr) => enlazar(f, lyr, capa),
        });
      }

      return L.geoJSON(json, {
        style: () => ({
          color: token('--mapa-limite'),
          weight: 1.5,
          fillColor: token('--mapa-limite'),
          fillOpacity: 0.05,
        }),
        onEachFeature: (f, lyr) => enlazar(f, lyr, capa),
      });
    }

    function enlazar(feature, layer, capa) {
      layer.bindPopup(() => ficha(feature.properties, capa), {
        className: 'mapa-popup',
        maxWidth: 320,
        autoPanPadding: [24, 24],
      });
      layer.on('click', () => {
        resaltar(layer);
        if (cfg.alSeleccionar) cfg.alSeleccionar(feature.properties, capa.id);
      });
    }

    function resaltar(layer) {
      if (seleccionado && seleccionado.setStyle) {
        seleccionado.setStyle({ color: token('--mapa-punto-borde'), weight: 0.75 });
      }
      if (layer.setStyle) {
        layer.setStyle({ color: token('--mapa-seleccion'), weight: 2 });
        if (layer.bringToFront) layer.bringToFront();
      }
      seleccionado = layer;
    }

    /* ── Encendido / apagado ── */

    function alternarCapa(id, visible) {
      const capa = buscarCapa(id);
      if (!capa || capa.estado !== 'disponible') return Promise.resolve();

      if (!visible) {
        if (capasLeaflet[id]) map.removeLayer(capasLeaflet[id]);
        return Promise.resolve();
      }

      if (capasLeaflet[id]) {
        capasLeaflet[id].addTo(map);
        return Promise.resolve();
      }

      el.classList.add('mapa--cargando');
      return cargar(id).then((json) => {
        el.classList.remove('mapa--cargando');
        if (!json) return;
        capasLeaflet[id] = construir(id, json).addTo(map);
        if (id === 'limite') {
          encuadre = capasLeaflet[id].getBounds();
          if (!libre) map.fitBounds(encuadre, { padding: [24, 24] });
        }
      });
    }

    /* ── Choropleth municipal ──
       Pinta los 13 polígonos del Marco Geoestadístico
       INEGI según la variable registrada. Los municipios
       sin dato se rayan en vez de pintarse: un hueco
       visible se lee distinto de un valor bajo.

       Las cabeceras ya no se usan para colorear; siguen
       vivas para irA() y para centrar la vista. */

    let cabeceras = null;

    function cargarCabeceras() {
      if (cabeceras) return Promise.resolve(cabeceras);
      return fetch(RUTA_DATOS + 'cabeceras_municipales.geojson')
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} al cargar cabeceras`);
          return r.json();
        })
        .then((json) => {
          cabeceras = {};
          json.features.forEach((f) => {
            const [lon, lat] = f.geometry.coordinates;
            cabeceras[f.properties.cve_mun] = {
              lon, lat,
              nombre: f.properties.nombre_municipio,
              cabecera: f.properties.cabecera,
            };
          });
          return cabeceras;
        })
        .catch((err) => {
          console.error('CerebroMapa:', err);
          avisar('No se pudieron cargar las cabeceras municipales.');
          return (cabeceras = {});
        });
    }

    function setChoropleth(idVariable) {
      choroplethActual = idVariable;

      if (capaChoropleth) { map.removeLayer(capaChoropleth); capaChoropleth = null; }
      if (!idVariable) { pintarLeyenda(null); return Promise.resolve(); }

      const v = VARIABLES[idVariable];
      if (!v) { console.warn('CerebroMapa: variable no registrada:', idVariable); return Promise.resolve(); }

      return cargar('municipios').then((jsonGeo) => {
        if (!jsonGeo) return;
        const vals = Object.values(v.valores).filter((x) => typeof x === 'number');
        const c = cortes(vals, 6);
        const colores = rampa(v.escala);

        capaChoropleth = L.geoJSON(jsonGeo, {
          style: (feature) => {
            const cve = feature.properties.cve_mun || feature.properties.cvegeo;
            const valor = v.valores[cve] ?? v.valores[cve?.slice(-3)];
            const sinDato = typeof valor !== 'number';
            const color = sinDato
              ? token('--mapa-pendiente')
              : colores[cubeta(valor, c, colores.length)];
            return {
              fillColor: color,
              weight: 1.5,
              opacity: 0.9,
              color: token('--mapa-limite'),
              fillOpacity: sinDato ? 0.2 : 0.65,
            };
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const cve = props.cve_mun || props.cvegeo;
            const valor = v.valores[cve] ?? v.valores[cve?.slice(-3)];
            const sinDato = typeof valor !== 'number';

            layer.bindPopup(
              ficha(
                {
                  nombre_municipio: props.nombre || props.NOMGEO,
                  cve_mun: cve,
                  fuente: v.fuente || props.fuente,
                  fecha_corte: v.fechaCorte || props.fecha_corte,
                },
                { claveGeo: 'cve_mun', nombre: 'nombre_municipio', ficha: [] },
                `<tr><th>${escapar(v.etiqueta)}</th><td><strong>${
                  sinDato ? 'información insuficiente' : escapar(v.formato(valor))
                }</strong></td></tr>` +
                (v.procedencia
                  ? `<tr><th>Naturaleza</th><td>${escapar(v.procedencia)}</td></tr>`
                  : '')
              ),
              { className: 'mapa-popup', maxWidth: 320 }
            );

            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({ weight: 3, color: token('--mapa-seleccion'), fillOpacity: 0.8 });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                  l.bringToFront();
                }
              },
              mouseout: (e) => {
                if (capaChoropleth) capaChoropleth.resetStyle(e.target);
              },
              click: () => {
                if (cfg.alSeleccionar) cfg.alSeleccionar(props, 'choropleth');
              },
            });
          },
        });

        capaChoropleth.addTo(map);
        pintarLeyenda(v, c, colores);
      });
    }

    /* ── Leyenda ── */

    const leyenda = document.createElement('div');
    leyenda.className = 'mapa-leyenda';
    el.appendChild(leyenda);

    function pintarLeyenda(v, c, colores) {
      if (!v) { leyenda.hidden = true; leyenda.innerHTML = ''; return; }
      leyenda.hidden = false;

      let escalones = '';
      if (c && c.paso > 0) {
        colores.forEach((color, i) => {
          const desde = c.min + c.paso * i;
          escalones += `<li><span class="mapa-leyenda__chip" style="background:${color}"></span>${
            escapar(v.formato(Math.round(desde * 10) / 10))
          }</li>`;
        });
      }
      escalones += `<li><span class="mapa-leyenda__chip mapa-leyenda__chip--nulo"></span>Información insuficiente</li>`;

      leyenda.innerHTML = `
        <h5 class="mapa-leyenda__titulo">${escapar(v.etiqueta)}</h5>
        <ul class="mapa-leyenda__escala">${escalones}</ul>
        <p class="mapa-leyenda__fuente">
          ${escapar(v.fuente || '—')} &middot;
          corte ${v.fechaCorte ? escapar(v.fechaCorte) : 'no declarado'}
        </p>`;
    }

    /* ── Panel de capas ── */

    function panel() {
      const cont = document.createElement('div');
      cont.className = 'mapa-panel';

      const grupos = CATALOGO.map((g) => {
        const items = g.capas.map((c) => {
          const pendiente = c.estado === 'pendiente';
          const activa = cfg.capas.includes(c.id);
          return `
            <li class="mapa-panel__item${pendiente ? ' mapa-panel__item--pendiente' : ''}">
              <label>
                <input type="checkbox" data-capa="${c.id}"
                       ${activa && !pendiente ? 'checked' : ''}
                       ${pendiente ? 'disabled' : ''}>
                <span>${escapar(c.etiqueta)}</span>
              </label>
              ${pendiente
                ? `<span class="mapa-panel__pendiente" title="${escapar(c.origen)}">pendiente de insumo</span>`
                : ''}
            </li>`;
        }).join('');
        return `
          <section class="mapa-panel__grupo">
            <h5 class="mapa-panel__categoria">${escapar(g.categoria)}</h5>
            <ul>${items}</ul>
          </section>`;
      }).join('');

      cont.innerHTML = `
        <button class="mapa-panel__toggle" type="button" aria-expanded="false">
          <i data-lucide="layers"></i><span>Capas</span>
        </button>
        <div class="mapa-panel__cuerpo" hidden>
          ${grupos}
          <p class="mapa-panel__nota">
            Las capas marcadas como pendientes están declaradas en el contrato de
            datos pero todavía no tienen archivo. No se dibujan geometrías simuladas.
          </p>
        </div>`;

      const toggle = cont.querySelector('.mapa-panel__toggle');
      const cuerpo = cont.querySelector('.mapa-panel__cuerpo');
      toggle.addEventListener('click', () => {
        const abierto = !cuerpo.hidden;
        cuerpo.hidden = abierto;
        toggle.setAttribute('aria-expanded', String(!abierto));
      });

      cont.querySelectorAll('input[data-capa]').forEach((chk) => {
        chk.addEventListener('change', () => alternarCapa(chk.dataset.capa, chk.checked));
      });

      // Leaflet se queda con los eventos de rueda y arrastre si no se le frena.
      L.DomEvent.disableClickPropagation(cont);
      L.DomEvent.disableScrollPropagation(cont);

      el.appendChild(cont);
      if (global.lucide) global.lucide.createIcons();
    }

    /* ── Avisos ── */

    function avisar(mensaje) {
      let caja = el.querySelector('.mapa-aviso');
      if (!caja) {
        caja = document.createElement('div');
        caja.className = 'mapa-aviso';
        caja.setAttribute('role', 'status');
        el.appendChild(caja);
      }
      caja.textContent = mensaje;
    }

    /* ── Arranque ── */

    if (cfg.panelCapas) panel();
    pintarLeyenda(null);

    const inicial = cfg.capas
      .filter((id) => { const c = buscarCapa(id); return c && c.estado === 'disponible'; })
      .map((id) => alternarCapa(id, true));

    Promise.all(inicial).then(() => {
      if (choroplethActual) setChoropleth(choroplethActual);
    });

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (encuadre && !libre) map.fitBounds(encuadre, { padding: [24, 24] });
    });
    ro.observe(lienzo);

    return {
      leaflet: map,
      alternarCapa,
      setChoropleth,
      irA(cveMun) {
        return cargarCabeceras().then((centros) => {
          const p = centros[cveMun];
          if (p) { libre = true; map.setView([p.lat, p.lon], 11); }
        });
      },
      destruir() {
        ro.disconnect();
        map.remove();
        el.innerHTML = '';
      },
    };
  }

  global.CerebroMapa = {
    crear, registrarVariable, CATALOGO, RUTA_DATOS,
    // Puras, expuestas para mapa.prueba.js. No las uses desde la UI.
    _internos: { cortes, cubeta, escapar, ficha },
  };
})(window);
