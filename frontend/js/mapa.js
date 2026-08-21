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
          etiqueta: 'Distritos federales (2)',
          queElige: 'Elige diputaciones al Congreso de la Unión.',
          origen: 'INE — Cartografía electoral (SIGE8), corte 2026-02',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'distritos_federales.geojson',
          claveGeo: 'numero',
          nombre: 'etiqueta',
          // Los 2 federales son la división más gruesa: línea sólida y ancha.
          // Ámbar: el matiz más cálido de los tres, para que la división
          // mayor se lea primero.
          trazo: { color: '--serie-4', grosor: 3.5, relleno: 0.04 },
          bajoDemanda: true, // 471 KB
        },
        {
          id: 'distritos_locales',
          etiqueta: 'Distritos locales (21)',
          queElige: 'Elige diputaciones al Congreso del Estado de Campeche.',
          origen: 'INE — Cartografía electoral (SIGE8), corte 2026-02',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'distritos_locales.geojson',
          claveGeo: 'numero',
          nombre: 'etiqueta',
          // 21 locales: la rejilla más fina, en guion corto para que no compita
          // con el trazo federal cuando ambos están encendidos. Cian, en el
          // extremo frío opuesto al ámbar federal.
          trazo: { color: '--serie-2', grosor: 1.75, guion: '5,4', relleno: 0.03 },
          bajoDemanda: true, // 596 KB
        },
        {
          id: 'distritos_judiciales',
          etiqueta: 'Distrito judicial electoral (1, todo el estado)',
          queElige: 'Demarcación para la elección de cargos judiciales. '
                  + 'No tiene partido asociado: la boleta judicial no lleva '
                  + 'afiliación partidista.',
          origen: 'INE — Cartografía electoral (SIGE8), corte 2026-02',
          estado: 'disponible',
          tipo: 'poligono',
          archivo: 'distritos_judiciales.geojson',
          claveGeo: 'numero',
          nombre: 'etiqueta',
          // El circuito lo publica fichaDistrito junto al resto del bloque
          // judicial; declararlo también aquí lo imprimía dos veces.
          // OJO: el distrito judicial 1 ES Campeche entero — el 58 % de sus
          // vértices caen a menos de 500 m del límite estatal (medido contra
          // limite_estatal.geojson). Con un trazo fino y sin relleno se
          // dibujaba exactamente encima del contorno del estado, que ya está
          // pintado, y el usuario veía "no pasó nada" al encender la capa.
          //
          // Por eso: punteado ancho —que no se confunde con el sólido federal
          // ni con el guion corto local— y un tinte apenas perceptible que
          // confirma que la capa respondió al clic. Rosa, el tercer matiz.
          trazo: { color: '--serie-6', grosor: 4, guion: '1,9', relleno: 0.05 },
          bajoDemanda: true, // 442 KB
        },
        {
          // El endpoint del INE responde "en qué distrito cae esta sección",
          // no "qué forma tiene". La jerarquía sección->distrito->municipio sí
          // se tiene (data/electoral/secciones_catalogo_2026.json); el polígono
          // no. Sin él la sección no se puede pintar como superficie.
          id: 'secciones',
          etiqueta: 'Secciones electorales',
          estado: 'pendiente',
          origen: 'Shapefile del Marco Geográfico Electoral (INE). El endpoint '
                + 'público no publica geometría de sección.',
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
          id: 'casillas_2024',
          etiqueta: 'Casillas instaladas 2024',
          estado: 'disponible',
          tipo: 'puntos',
          archivo: 'casillas_2024.geojson',
          claveGeo: 'seccion',
          nombre: 'inmueble',
          // Ámbar y más grande que la escuela: aquí sí se votó.
          punto: {
            color: '--mapa-casilla',
            // El sitio con seis urnas pesa distinto que el de una. El radio
            // crece con la raíz para que un extremo no tape el municipio.
            radio: (p) => 4 + Math.sqrt(p.n_casillas || 1) * 1.6,
          },
          ficha: [
            ['seccion', 'Sección'],
            ['casillas', 'Casillas'],
            ['tipos', 'Tipos'],
            ['nombre_municipio', 'Municipio'],
            ['nombre_localidad', 'Localidad'],
            ['distrito_local', 'Distrito local'],
            ['ubicacion', 'Domicilio'],
            ['nombre_cct', 'Plantel CCT'],
            ['cct', 'Clave CCT'],
          ],
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

    // Qué se elige en esta demarcación. Las tres se dibujan igual y se
    // superponen sobre el mismo territorio; sin esto no hay forma de saber
    // que responden a tres elecciones distintas.
    let queElige = '';
    if (capa.queElige) {
      queElige = `<p class="mapa-ficha__quelige">${escapar(capa.queElige)}</p>`;
    }

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
        ${queElige}
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
      fichaExtra: null,
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

    // 2,274 puntos en SVG arrastran el navegador; canvas no. Cada capa de
    // puntos vive en su propio panel para poder apilarlas (las casillas por
    // encima de las escuelas) y para darle a cada una su entrada animada.
    const PANES = { escuelas: 420, casillas_2024: 440 };

    function panePuntos(id) {
      const nombre = 'ce-' + id;
      if (!map.getPane(nombre)) {
        const p = map.createPane(nombre);
        p.style.zIndex = String(PANES[id] || 430);
        p.classList.add('mapa-pane-puntos');
      }
      return nombre;
    }

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
        const punto = capa.punto || {};
        const color = token(punto.color || '--mapa-punto');
        const radio = typeof punto.radio === 'function'
          ? punto.radio
          : () => punto.radio || 3.5;
        const pane = panePuntos(id);

        // `pane` va DENTRO de pointToLayer, no en las opciones de L.geoJSON:
        // cuando se define pointToLayer, Leaflet no le hereda sus opciones al
        // marcador que uno construye (geometryToLayer sólo las pasa con
        // `markersInheritOptions`). Ponerlo arriba dejaba el panel vacío y los
        // puntos caían en el overlayPane mezclados con los polígonos: el
        // municipio se pintaba encima y se comía el clic del punto.
        //
        // Y van en SVG, no en canvas. Un canvas es un rectángulo opaco a los
        // eventos: atrapa también los clics que caen entre punto y punto, y
        // entonces el polígono de abajo ya no puede responder. En SVG sólo el
        // círculo dibujado captura —Leaflet deja el <svg> con
        // pointer-events:none— así que el clic en el vacío atraviesa hasta el
        // municipio, que es justo lo que se espera del mapa.
        //
        // El techo: 2,274 escuelas son 2,274 nodos en el DOM. Si algún día
        // arrastra, lo que toca es agrupar (clustering) por zoom, no volver al
        // canvas: eso devolvería el problema del clic.

        return L.geoJSON(json, {
          pointToLayer: (f, latlng) =>
            L.circleMarker(latlng, {
              pane,
              radius: radio(f.properties),
              fillColor: color,
              color: token('--mapa-punto-borde'),
              // El borde también es área de clic: con 0.75 px el punto de una
              // sola casilla era casi imposible de atinar.
              weight: 1.5,
              fillOpacity: 0.85,
            }),
          onEachFeature: (f, lyr) => enlazar(f, lyr, capa),
        });
      }

      // Cada capa de polígono puede traer su propio trazo. Antes todas
      // compartían --mapa-limite: con distrito federal y local encendidos a la
      // vez, las dos rejillas se dibujaban idénticas y no había forma de saber
      // qué línea era de quién. El color viene de la paleta de series, que
      // existe justamente para distinguir categorías sin ordenarlas.
      const tr = capa.trazo || {};
      const linea = token(tr.color || '--mapa-limite');

      // `colorFeature` deja que el módulo tiña cada polígono según algo que el
      // mapa no tiene por qué conocer —quién ganó ahí, por ejemplo—. Devuelve
      // un token o null; null significa "sin dato", y entonces la capa se
      // queda con su trazo normal en vez de pintarse de un color inventado.
      const teñir = (f) => {
        if (!cfg.colorFeature) return null;
        const tok = cfg.colorFeature(f.properties || {}, capa.id);
        return tok ? token(tok) : null;
      };

      return L.geoJSON(json, {
        style: (f) => ({
          color: teñir(f) || linea,
          weight: tr.grosor || 1.5,
          // El guion distingue por FORMA, no sólo por color: dos capas
          // encendidas se separan aunque el usuario no distinga los tonos.
          dashArray: tr.guion || null,
          fillColor: teñir(f) || linea,
          // Un polígono teñido sube su relleno: es el color lo que comunica,
          // no la línea. Sin tinte se respeta el relleno declarado en la capa.
          fillOpacity: teñir(f) ? 0.45
                     : tr.relleno === undefined ? 0.05 : tr.relleno,
          // Leaflet simplifica cada trazo al dibujarlo (Douglas-Peucker) y su
          // `smoothFactor` por defecto es 1.0 ≈ 1 px de tolerancia. Sobre una
          // costa como la de Campeche eso recorta entrantes visibles y el
          // distrito se ve aplanado contra el mapa oficial del INE — aunque el
          // dato guardado tenga los 1 955 vértices exactos que da la API.
          // 0.4 conserva el detalle sin volver el render pesado.
          smoothFactor: 0.4,
        }),
        onEachFeature: (f, lyr) => enlazar(f, lyr, capa),
      });
    }

    /* ── Ficha ──
       No es un popup anclado. Un popup se abre pegado al punto y Leaflet
       recorre el mapa para que quepa: el punto que acabas de clicar se va de
       su sitio y pierdes la referencia de dónde estabas. La ficha vive fija
       en una esquina del mapa, así que al abrirla el mapa no se mueve ni un
       pixel. Lo que marca de qué punto habla es el anillo de selección. */

    const panelFicha = document.createElement('aside');
    panelFicha.className = 'mapa-ficha-panel';
    panelFicha.hidden = true;
    panelFicha.setAttribute('aria-live', 'polite');
    el.appendChild(panelFicha);
    L.DomEvent.disableClickPropagation(panelFicha);
    L.DomEvent.disableScrollPropagation(panelFicha);

    function cerrarFicha() {
      panelFicha.hidden = true;
      panelFicha.innerHTML = '';
      resaltar(null);
    }

    function mostrarFicha(html) {
      panelFicha.innerHTML =
        `<button type="button" class="mapa-ficha-panel__cerrar" aria-label="Cerrar ficha">&times;</button>` +
        html;
      panelFicha.hidden = false;
      panelFicha.scrollTop = 0;
      panelFicha.querySelector('.mapa-ficha-panel__cerrar')
        .addEventListener('click', cerrarFicha);
    }

    map.on('click', cerrarFicha);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !panelFicha.hidden) cerrarFicha();
    });


    /* ── Bloque "Conoce tu distrito", formato INE ──
       La página oficial del INE responde a un punto con tres bloques idénticos
       en forma: clave de entidad + número de distrito, uno por cada división.
       Se reproduce ese formato porque es el que la gente ya reconoce de
       cartografia.ine.mx, y porque hace explícito que son tres divisiones
       distintas sobre el mismo territorio, no una jerarquía.

       El número NO se saca de una tabla nuestra: se resuelve por geometría,
       preguntando qué polígono descargado del INE contiene al punto clicado.
       Si ninguno lo contiene —o la capa no se pudo cargar— se dice que falta
       el dato. Nunca se rellena con un número plausible. */

    const DIVISIONES = [
      ['distritos_federales', 'Distrito federal'],
      ['distritos_locales',   'Distrito local'],
      ['distritos_judiciales', 'Distrito judicial'],
    ];

    // Rayo horizontal, con paridad por anillo: un anillo interior (hueco)
    // invierte la pertenencia, que es justo lo que necesita un distrito con
    // enclaves. Sirve para Polygon y MultiPolygon.
    function dentroAnillo(pt, anillo) {
      let dentro = false;
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        const [xi, yi] = anillo[i];
        const [xj, yj] = anillo[j];
        if ((yi > pt[1]) !== (yj > pt[1]) &&
            pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
      }
      return dentro;
    }

    function dentro(pt, geom) {
      const polis = geom.type === 'Polygon' ? [geom.coordinates]
                  : geom.type === 'MultiPolygon' ? geom.coordinates : [];
      for (const anillos of polis) {
        if (!anillos.length || !dentroAnillo(pt, anillos[0])) continue;
        // Está dentro del contorno; queda fuera si cae en un hueco.
        let enHueco = false;
        for (let k = 1; k < anillos.length; k++) {
          if (dentroAnillo(pt, anillos[k])) { enHueco = true; break; }
        }
        if (!enHueco) return true;
      }
      return false;
    }

    function bloqueINE(latlng) {
      const pt = [latlng.lng, latlng.lat];
      const filas = DIVISIONES.map(([id, etiqueta]) => {
        const json = datos[id];
        let valor;
        if (!json) {
          valor = '<em>capa sin cargar</em>';
        } else {
          const hit = (json.features || []).find((f) => f.geometry && dentro(pt, f.geometry));
          valor = hit ? escapar(hit.properties.numero) : '<em>falta ese dato</em>';
        }
        return `
          <div class="mapa-ine__bloque">
            <span class="mapa-ine__par"><span>Clave de entidad:</span> <strong>4</strong></span>
            <span class="mapa-ine__par"><span>${escapar(etiqueta)}:</span> <strong>${valor}</strong></span>
          </div>`;
      }).join('');

      return `
        <section class="mapa-ine">
          <h5 class="mapa-ine__titulo">Conoce tu distrito</h5>
          ${filas}
          <p class="mapa-ine__nota">
            Resuelto contra los polígonos del INE (SIGE8, corte 2026-02)
            preguntando cuál contiene este punto. Enciende la capa para que su
            división se pueda resolver.
          </p>
        </section>`;
    }

    function enlazar(feature, layer, capa) {
      // fichaExtra deja que el módulo cuelgue filas propias sin que el mapa
      // tenga que saber de resultados electorales.
      layer.on('click', (ev) => {
        L.DomEvent.stop(ev);   // que el clic del mapa no cierre lo que abrimos
        resaltar(layer);
        const extra = cfg.fichaExtra
          ? cfg.fichaExtra(feature.properties, capa.id) : '';
        const ine = capa.id.startsWith('distritos_') && ev.latlng
          ? bloqueINE(ev.latlng) : '';
        mostrarFicha(ficha(feature.properties, capa, extra) + ine);
        if (cfg.alSeleccionar) cfg.alSeleccionar(feature.properties, capa.id);
      });
    }

    function resaltar(layer) {
      if (seleccionado && seleccionado.setStyle) {
        seleccionado.setStyle(seleccionado._ceEstilo || {});
      }
      seleccionado = null;
      if (!layer || !layer.setStyle) return;

      // Se guarda el estilo previo en vez de reponer uno fijo: el punto de
      // casillas y el polígono de municipios no comparten grosor ni color.
      layer._ceEstilo = layer._ceEstilo || {
        color: layer.options.color,
        weight: layer.options.weight,
        radius: layer.options.radius,
      };
      // El punto seleccionado también crece: con 5 px de radio, un cambio de
      // color solo no se encuentra en un mapa con 415 puntos iguales.
      layer.setStyle(Object.assign(
        { color: token('--mapa-seleccion'), weight: 3 },
        layer._ceEstilo.radius ? { radius: layer._ceEstilo.radius + 4 } : {}
      ));
      if (layer.bringToFront) layer.bringToFront();
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
        // Una variable categórica (quién ganó) no tiene escala: cada clase
        // trae su color. Mezclarla con una rampa secuencial sugeriría un
        // orden entre partidos que no existe.
        const cat = v.categorias || null;
        const vals = Object.values(v.valores).filter((x) => typeof x === 'number');
        const c = cat ? null : cortes(vals, 6);
        const colores = cat ? null : rampa(v.escala);
        const sinValor = (x) => (cat ? !cat[x] : typeof x !== 'number');

        capaChoropleth = L.geoJSON(jsonGeo, {
          style: (feature) => {
            const cve = feature.properties.cve_mun || feature.properties.cvegeo;
            const valor = v.valores[cve] ?? v.valores[cve?.slice(-3)];
            const sinDato = sinValor(valor);
            const color = sinDato
              ? token('--mapa-pendiente')
              : (cat ? token(cat[valor].color) : colores[cubeta(valor, c, colores.length)]);
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
            const sinDato = sinValor(valor);

            const fichaHtml = ficha(
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
                : '') +
              // El choropleth también recibe fichaExtra. Sin esto, hacer clic
              // en un municipio daba una ficha distinta según si había o no un
              // coloreado activo: con coloreado sólo salía la variable pintada,
              // y se perdían las filas que cuelgan los módulos.
              (cfg.fichaExtra ? cfg.fichaExtra({ ...props, cve_mun: cve }, 'choropleth') : '')
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
              click: (e) => {
                L.DomEvent.stop(e);
                mostrarFicha(fichaHtml);
                if (cfg.alSeleccionar) cfg.alSeleccionar(props, 'choropleth');
              },
            });
          },
        });

        capaChoropleth.addTo(map);
        pintarLeyenda(v, c, colores, cat);
      });
    }

    /* ── Leyenda ── */

    const leyenda = document.createElement('div');
    leyenda.className = 'mapa-leyenda';
    el.appendChild(leyenda);

    function pintarLeyenda(v, c, colores, cat) {
      if (!v) { leyenda.hidden = true; leyenda.innerHTML = ''; return; }
      leyenda.hidden = false;

      let escalones = '';
      if (cat) {
        // Sólo las clases que de verdad aparecen: una leyenda con ocho
        // partidos donde el mapa pinta tres se lee como si faltaran datos.
        const presentes = new Set(Object.values(v.valores));
        Object.entries(cat)
          .filter(([clave]) => presentes.has(clave))
          .forEach(([, def]) => {
            escalones += `<li><span class="mapa-leyenda__chip" style="background:${
              token(def.color)}"></span>${escapar(def.etiqueta)}</li>`;
          });
      } else if (c && c.paso > 0) {
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
          // Muestra de trazo: la misma línea que se dibuja en el mapa, para
          // que el panel sea la leyenda y no haya que adivinar qué capa es
          // cada rejilla cuando hay varias encendidas.
          const muestra = c.trazo
            ? `<span class="mapa-panel__trazo" aria-hidden="true" style="
                 border-top:${c.trazo.grosor || 1.5}px ${
                   c.trazo.guion ? 'dashed' : 'solid'} var(${c.trazo.color})"></span>`
            : '';
          return `
            <li class="mapa-panel__item${pendiente ? ' mapa-panel__item--pendiente' : ''}">
              <label>
                <input type="checkbox" data-capa="${c.id}"
                       ${activa && !pendiente ? 'checked' : ''}
                       ${pendiente ? 'disabled' : ''}>
                ${muestra}<span>${escapar(c.etiqueta)}</span>
              </label>
              ${c.queElige
                ? `<p class="mapa-panel__quelige">${escapar(c.queElige)}</p>`
                : ''}
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
