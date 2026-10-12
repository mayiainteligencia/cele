/* Vista: Análisis de discursos.

   Reemplaza la terminal:
     python evaluar_discurso.py Campeche discurso.txt   (x3)
     python comparar_discursos.py Campeche discurso discurso_b discurso_c

   Hoy todo es simulado (discursos.mock.js). El único punto de contacto con el
   backend es window.evaluarDiscursos(entidad, discursos): cuando exista
   POST /api/discursos/evaluar, se cambia el cuerpo de esa función y nada más.

   Dos métricas que NO se mezclan:
   · Cobertura de la conversación (noticias): % de las notas que caen en los
     temas que toca el discurso.
   · Cobertura ponderada ENVIPE: mezcla 70 % peso relativo en ENVIPE + 30 %
     noticias. El peso relativo NO es el % de ENVIPE: la pregunta admite varias
     respuestas y se normaliza sobre la suma de menciones. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const esc = T.escapar;
  const $ = (id) => document.getElementById(id);
  const pct = (v) => `${Math.round(v * 100)} %`;

  const ETAPAS = [
    { id: 'noticias', nombre: 'Cargar noticias' },
    { id: 'temas',    nombre: 'Agrupar temas' },
    { id: 'envipe',   nombre: 'Cruzar con ENVIPE' },
    { id: 'evaluar',  nombre: 'Evaluar cada discurso' },
    { id: 'comparar', nombre: 'Comparar' },
  ];
  const LECTURAS = {
    sin_contraste: 'Sin contraste: ENVIPE no mide este tema',
    amplificado: 'Amplificado por medios (coyuntura)',
    silencioso: 'Tema silencioso: preocupa más de lo que sale en medios',
    confirmado: 'Confirmado por encuesta y medios',
  };
  const MAX_TXT = 200 * 1024;   // un .txt de discurso no pasa de unos KB

  /* ════════════════════════════════════════════
     API — único punto que cambia al conectar el backend
     ════════════════════════════════════════════
     alProgreso({ etapa, estado: 'curso'|'listo', datos }) es opcional: sin él la
     vista igual se arma con lo que devuelve la promesa. */

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const pausa = () => espera(1000 + Math.random() * 1000);   // 1–2 s por etapa

  window.evaluarDiscursos = async function evaluarDiscursos(entidad, discursos, alProgreso = () => {}) {
    // ponytail: mock con delays. Backend: return (await fetch('/api/discursos/evaluar', { method: 'POST',
    //   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entidad, discursos }) })).json()
    const R = window.DISCURSOS_MOCK.resultado;
    if (entidad !== R.entidad) throw new Error(`Aún no hay datos para ${entidad}.`);

    alProgreso({ etapa: 'noticias', estado: 'curso' });
    await pausa();
    alProgreso({ etapa: 'noticias', estado: 'listo', datos: { notas: R.totalNotas, fecha: R.fechaNotas, municipios: R.municipios } });

    alProgreso({ etapa: 'temas', estado: 'curso' });
    await pausa();
    alProgreso({ etapa: 'temas', estado: 'listo', datos: { temas: R.temas } });

    alProgreso({ etapa: 'envipe', estado: 'curso' });
    await pausa();
    alProgreso({ etapa: 'envipe', estado: 'listo', datos: { categorias: R.categorias } });

    const evaluados = discursos.map((d, i) => ({ nombre: d.nombre, ...R.discursos[i] }));
    for (let i = 0; i < evaluados.length; i++) {
      alProgreso({ etapa: 'evaluar', estado: 'curso', datos: { i, total: evaluados.length } });
      await pausa();
      alProgreso({ etapa: 'evaluar', estado: i === evaluados.length - 1 ? 'listo' : 'curso',
        datos: { i, total: evaluados.length, discurso: evaluados[i] } });
    }

    alProgreso({ etapa: 'comparar', estado: 'curso' });
    await pausa();
    alProgreso({ etapa: 'comparar', estado: 'listo' });
    return { ...R, discursos: evaluados };
  };

  /* ════════════════════════════════════════════
     FORMULARIO
     ════════════════════════════════════════════ */

  const LETRAS = ['A', 'B', 'C'];
  const EJEMPLOS = [
    'Pueblo de Campeche: hoy celebramos las obras históricas que traen bienestar, turismo y empleos, con respeto a nuestra selva y a nuestros pescadores.',
    'Hoy no vengo a dar un discurso de fiesta. Vengo a estar con ustedes mientras el ciclón pone a prueba a nuestro estado. Primero, la seguridad de la gente.',
    'Mi solidaridad con las familias del ciclón. También sé que les preocupan la salud, la seguridad, el empleo, las escuelas y el costo de la luz. Vine a escuchar.',
  ];

  function pintarForm() {
    $('disc-form').innerHTML = LETRAS.map((l, i) => `
      <div class="tarjeta" style="display:flex; flex-direction:column; gap:10px;">
        <label class="disc-campo">Nombre del discurso ${l}
          <input type="text" id="nombre-${i}" value="Discurso ${l}" maxlength="60">
        </label>
        <label class="disc-campo">Texto
          <textarea id="texto-${i}" placeholder="Pega aquí el discurso…"></textarea>
        </label>
        <div class="disc-campo">…o sube un archivo .txt
          <label class="disc-drop" id="drop-${i}" tabindex="0">
            <input type="file" id="archivo-${i}" accept=".txt,text/plain" hidden>
            <i data-lucide="upload"></i>
            <span class="disc-drop__txt" id="drop-txt-${i}"><strong>Elegir archivo</strong> o arrastrarlo aquí</span>
          </label>
        </div>
      </div>`).join('');

    LETRAS.forEach((_, i) => {
      const zona = $(`drop-${i}`);
      $(`archivo-${i}`).addEventListener('change', (ev) => leerArchivo(i, ev.target.files[0]));
      zona.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); $(`archivo-${i}`).click(); } });
      ['dragenter', 'dragover'].forEach((t) => zona.addEventListener(t, (ev) => { ev.preventDefault(); zona.classList.add('disc-drop--sobre'); }));
      ['dragleave', 'drop'].forEach((t) => zona.addEventListener(t, (ev) => { ev.preventDefault(); zona.classList.remove('disc-drop--sobre'); }));
      zona.addEventListener('drop', (ev) => leerArchivo(i, ev.dataTransfer.files[0]));
    });
  }

  async function leerArchivo(i, f) {
    if (!f) return;
    if (!/\.txt$/i.test(f.name) && f.type !== 'text/plain') return errorForm(`"${f.name}" no es un .txt.`);
    if (f.size > MAX_TXT) return errorForm(`"${f.name}" pesa más de ${MAX_TXT / 1024} KB; un discurso no debería.`);
    try {
      $(`texto-${i}`).value = await f.text();
      if ($(`nombre-${i}`).value.startsWith('Discurso ')) $(`nombre-${i}`).value = f.name.replace(/\.txt$/i, '');
      $(`drop-txt-${i}`).innerHTML = `<strong>${esc(f.name)}</strong> · ${Math.max(1, Math.round(f.size / 1024))} KB`;
      $(`drop-${i}`).classList.add('disc-drop--listo');
      errorForm('');
    } catch (err) {
      errorForm(`No se pudo leer "${f.name}".`);
    }
  }

  function errorForm(msg) { $('form-error').textContent = msg; }

  function leerForm() {
    return LETRAS.map((l, i) => ({
      nombre: $(`nombre-${i}`).value.trim() || `Discurso ${l}`,
      texto: $(`texto-${i}`).value.trim(),
    })).filter((d) => d.texto.length > 0);
  }

  /* ════════════════════════════════════════════
     ETAPAS
     ════════════════════════════════════════════ */

  const estadoEtapa = {};   // id -> { estado, detalle }

  function pintarEtapas() {
    $('etapas').innerHTML = ETAPAS.map((e) => {
      const s = estadoEtapa[e.id] || { estado: 'pendiente' };
      const icono = s.estado === 'listo' ? 'check' : s.estado === 'error' ? 'x' : '';
      const txt = { pendiente: 'Pendiente', curso: 'En curso…', listo: 'Listo', error: 'Error' }[s.estado];
      return `<li class="etapa etapa--${s.estado}">
        <span class="etapa__icono">${icono ? `<i data-lucide="${icono}"></i>` : ''}</span>
        <span><strong>${e.nombre}</strong><span class="etapa__estado">${txt}${s.detalle ? ' · ' + esc(s.detalle) : ''}</span></span>
      </li>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
  }

  function poner(id, estado, detalle) {
    estadoEtapa[id] = { estado, detalle };
    pintarEtapas();
  }

  /* ════════════════════════════════════════════
     GRAFO (force-graph: el motor que envuelve react-force-graph-2d)
     ════════════════════════════════════════════ */

  let grafo = null;
  let nodos = [];
  let enlaces = [];
  let seleccion = null;
  let hover = null;
  let analizando = false;     // mientras corre el proceso, una banda de barrido recorre el mapa
  let mapaNacio = 0;
  let mapa = null;            // contornos de los municipios en coordenadas del grafo
  let datos = { temas: [], categorias: [], discursos: [], municipios: [], totalNotas: 0, pesoEncuesta: 0.7 };
  const colores = {};
  const prueba = document.createElement('canvas').getContext('2d');   // para saber en qué municipio se hizo clic

  function leerColores() {
    const css = getComputedStyle(document.documentElement);
    const v = (n, d) => css.getPropertyValue(n).trim() || d;
    colores.tema = v('--serie-1', '#8b5cf6');
    colores.envipe = v('--serie-4', '#ffb020');
    colores.discurso = v('--serie-3', '#b6f03c');
    colores.municipio = '#ffffff';
    colores.aviso = v('--sev-media', '#f5c518');
    colores.texto = '#e8ecf5';
  }

  /* ── Mapa de Campeche: el mismo municipios.geojson del mapa maestro, en líneas blancas ── */
  function cargarMapa() {
    if (mapa) return Promise.resolve(mapa);
    return fetch('data/geo/municipios.geojson').then((r) => {
      if (!r.ok) throw new Error(`${r.status} al cargar el mapa de municipios`);
      return r.json();
    }).then((g) => {
      const anillos = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]));
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      g.features.forEach((f) => anillos(f).forEach((r) => r.forEach(([x, y]) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      })));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const ANCHO = 1000;                                   // el estado mide 1000 unidades de ancho: los nodos, mucho menos
      const kx = ANCHO / ((maxX - minX) * Math.cos(cy * Math.PI / 180));
      const proy = ([lon, lat]) => [(lon - cx) * Math.cos(cy * Math.PI / 180) * kx, -(lat - cy) * kx];
      const todo = new Path2D();
      const munis = new Map();
      g.features.forEach((f) => {
        const path = new Path2D();
        let mejor = { area: -1 };
        anillos(f).forEach((ring) => {
          const paso = Math.max(1, Math.ceil(ring.length / 350));             // el contorno costero trae miles de puntos
          const pts = ring.filter((_, i) => i % paso === 0 || i === ring.length - 1).map(proy);
          pts.forEach(([x, y], i) => { (i ? path.lineTo(x, y) : path.moveTo(x, y)); });
          path.closePath();
          let A = 0, X = 0, Y = 0;                                               // centroide del anillo (fórmula del polígono)
          for (let i = 0; i < pts.length - 1; i++) {
            const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], c = x0 * y1 - x1 * y0;
            A += c; X += (x0 + x1) * c; Y += (y0 + y1) * c;
          }
          if (Math.abs(A) > mejor.area) mejor = { area: Math.abs(A), x: X / (3 * A), y: Y / (3 * A) };
        });
        todo.addPath(path);
        munis.set(f.properties.cve_mun, { cve: f.properties.cve_mun, nombre: f.properties.nombre, path, x: mejor.x, y: mejor.y });
      });
      mapa = { munis, todo, ancho: ANCHO, alto: (maxY - minY) * kx, izq: -ANCHO / 2 };
      return mapa;
    });
  }

  const nodoPorId = (id) => nodos.find((n) => n.id === id);
  // Bolitas chicas: se pueden acercar y elegir una por una.
  const radio = (n) => (n.tipo === 'tema' ? 2.5 + Math.sqrt(n.notas) * 1.3
    : n.tipo === 'envipe' ? 2.5 + Math.sqrt(n.pct) * 0.95
    : n.tipo === 'municipio' ? 3.5 + Math.sqrt(n.total) * 0.9 : 8);

  /** Fondo: municipios en líneas blancas, con relleno según cuánto se dispara en cada uno. */
  function dibujarMapa(ctx, escala) {
    if (!mapa) return;
    const ahora = performance.now();
    ctx.save();
    ctx.globalAlpha = Math.min(1, (ahora - mapaNacio) / 800);
    mapa.munis.forEach((m) => {
      const nodo = nodoPorId('m' + m.cve);
      const act = nodo ? Math.min(1, nodo.total / 14) : 0;
      ctx.fillStyle = seleccion === 'm' + m.cve ? 'rgba(182, 240, 60, 0.20)' : `rgba(139, 92, 246, ${0.03 + 0.20 * act})`;
      ctx.fill(m.path);
    });
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8 / escala;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    mapa.munis.forEach((m) => ctx.stroke(m.path));
    if (analizando) {                                       // barrido: "analizando" el estado
      ctx.save();
      ctx.clip(mapa.todo);
      const x = mapa.izq + (((ahora / 2400) % 1.3) - 0.15) * mapa.ancho;
      const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
      g.addColorStop(0, 'rgba(34, 224, 255, 0)');
      g.addColorStop(0.5, 'rgba(34, 224, 255, 0.34)');
      g.addColorStop(1, 'rgba(34, 224, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 70, -400, 140, 800);
      ctx.restore();
    }
    ctx.restore();
  }

  function dibujar(n, ctx, escala) {
    const ahora = performance.now();
    const t = Math.max(0, Math.min(1, (ahora - n.nacio) / 450));
    const k = 1 - Math.pow(1 - t, 3);                      // aparece creciendo
    const r = radio(n) * k;
    const atenuado = seleccion && !vecino(n.id);
    ctx.globalAlpha = (atenuado ? 0.45 : 1) * k;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    if (n.tipo === 'municipio') {                          // anillo blanco con punto: "sensor" del municipio
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.lineWidth = 1.8 / escala;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(1.5, r * 0.4), 0, 2 * Math.PI);
      ctx.fillStyle = n.total ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.fill();
    } else {
      ctx.fillStyle = colores[n.tipo];
      ctx.fill();
    }
    if (n.pulso && ahora >= n.pulso && ahora - n.pulso < 1000) {               // un tema se dispara en este municipio
      const p = (ahora - n.pulso) / 1000;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + p * 26, 0, 2 * Math.PI);
      ctx.lineWidth = 2 / escala;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - p)})`;
      ctx.stroke();
    }
    if (n.marca) {                                          // sin contraste / no cubierto por medios
      ctx.beginPath();
      ctx.setLineDash([3 / escala, 3 / escala]);
      ctx.lineWidth = 1.6 / escala;
      ctx.strokeStyle = colores.aviso;
      ctx.arc(n.x, n.y, r + 4, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (seleccion === n.id) {
      ctx.beginPath();
      ctx.lineWidth = 2 / escala;
      ctx.strokeStyle = '#fff';
      ctx.arc(n.x, n.y, r + (n.marca ? 7 : 3.5), 0, 2 * Math.PI);
      ctx.stroke();
    }
    // Etiquetas: municipios siempre; el resto al acercar, al pasar el cursor o al elegir el nodo o sus vecinos;
    // los temas grandes también, para orientarse.
    const verEtiqueta = n.tipo === 'municipio' || escala > 1.5 || hover === n.id || seleccion === n.id
      || (seleccion && vecino(n.id)) || (n.tipo === 'tema' && n.notas >= 10) || n.tipo === 'discurso';
    if (!verEtiqueta) { ctx.globalAlpha = 1; return; }
    const completo = window.CEi18n ? CEi18n.tr(n.nombre) : n.nombre;
    const lim = n.tipo === 'municipio' ? 20 : (seleccion === n.id || hover === n.id) ? 44 : 22;   // los nombres largos sólo completos al elegirlos
    const nombre = completo.length > lim ? completo.slice(0, lim - 1) + '…' : completo;
    ctx.font = `${n.tipo === 'municipio' ? '600 ' : ''}${(n.tipo === 'municipio' ? 9 : 10) / escala}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5 / escala;                           // contorno negro: se lee sobre las líneas blancas
    ctx.strokeStyle = '#000';
    ctx.strokeText(nombre, n.x, n.y + r + (n.marca ? 7 : 3));
    ctx.fillStyle = n.tipo === 'municipio' ? '#fff' : colores.texto;
    ctx.fillText(nombre, n.x, n.y + r + (n.marca ? 7 : 3));
    ctx.globalAlpha = 1;
  }

  /* Foco: al elegir un nodo se enciende lo suyo y el resto queda tenue.
     n1 = vecinos directos. n2 = (sólo si es un municipio) lo que sigue de sus temas: discursos y categorías ENVIPE,
     para leer la historia municipio → tema → discurso en un clic. */
  let foco = { n1: new Set(), n2: new Set() };

  function fijar(id) {
    seleccion = id;
    foco = { n1: new Set(), n2: new Set() };
    if (!id) return;
    enlaces.forEach((l) => { if (l.de === id) foco.n1.add(l.a); if (l.a === id) foco.n1.add(l.de); });
    const sel = nodoPorId(id);
    if (sel && sel.tipo === 'municipio') {
      enlaces.forEach((l) => {
        if (foco.n1.has(l.de) || foco.n1.has(l.a)) [l.de, l.a].forEach((x) => { if (x !== id && !foco.n1.has(x)) foco.n2.add(x); });
      });
    }
  }

  const vecino = (id) => id === seleccion || foco.n1.has(id) || foco.n2.has(id);

  /** 2 = conexión del nodo elegido, 1 = segundo nivel del municipio elegido, 0 = el resto. */
  function nivel(l) {
    if (!seleccion) return 0;
    if (l.de === seleccion || l.a === seleccion) return 2;
    return foco.n2.size && ((foco.n1.has(l.de) && foco.n2.has(l.a)) || (foco.n1.has(l.a) && foco.n2.has(l.de))) ? 1 : 0;
  }

  const RGB = { toca: '182, 240, 60', cruce: '255, 176, 32', real: '255, 255, 255', sim: '80, 220, 255' };
  const clave = (l) => (l.tipo === 'toca' ? 'toca' : l.tipo === 'dispara' ? (l.real ? 'real' : 'sim') : 'cruce');
  function colorEnlace(l) {
    const v = nivel(l);
    // Sin elección el mapa queda en calma; mientras corre el proceso se ve cómo se van encendiendo las conexiones.
    const alfa = v === 2 ? 1 : v === 1 ? 0.7 : (seleccion ? 0.26 : analizando ? 0.5 : 0.34);   // el resto sigue visible; lo elegido destaca
    return `rgba(${RGB[clave(l)]}, ${alfa})`;
  }

  function elegir(n) {
    fijar(n.id);
    $('detalle').innerHTML = detalle(n);
    if (window.lucide) lucide.createIcons();
  }

  /** Todo el estado a la vista y centrado, con aire alrededor. Después la vista es del usuario: no se re-encuadra sola. */
  function vistaInicial() {
    const caja = $('grafo-caja');
    const k = Math.min(caja.clientWidth / (mapa.ancho * 1.12), caja.clientHeight / (mapa.alto * 1.12));
    grafo.width(caja.clientWidth).height(caja.clientHeight).centerAt(0, 0, 0).zoom(k, 0);
  }

  function crearGrafo() {
    const caja = $('grafo-caja');
    leerColores();
    grafo = ForceGraph()(caja)
      .width(caja.clientWidth).height(caja.clientHeight)
      .backgroundColor('#000')
      .nodeId('id')
      .autoPauseRedraw(false)                               // aparición, barrido y pulsos necesitan redibujar
      .onRenderFramePre(dibujarMapa)
      .nodeCanvasObject(dibujar)
      .nodePointerAreaPaint((n, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(radio(n) + 4, 9), 0, 2 * Math.PI);   // zona de clic más grande que la bolita
        ctx.fill();
      })
      .onNodeHover((n) => { hover = n ? n.id : null; $('grafo-caja').style.cursor = n ? 'pointer' : ''; })
      .linkColor(colorEnlace)
      .linkWidth((l) => {
        const base = l.tipo === 'toca' ? 1.6 : l.tipo === 'dispara' ? 0.9 + Math.min(2.2, Math.sqrt(l.n) * 0.7) : 0.9;
        return nivel(l) === 2 ? base + 1.2 : base * 0.7;
      })
      .linkLineDash((l) => (l.tipo === 'dispara' && !l.real ? [4, 3] : null))   // punteada = simulado
      .linkDirectionalArrowLength((l) => (l.tipo === 'toca' && (!seleccion || nivel(l) > 0) ? 4.5 : 0))
      .linkDirectionalArrowRelPos(1)
      .onNodeClick(elegir)
      .onBackgroundClick((ev) => {
        const { x, y } = grafo.screen2GraphCoords(ev.offsetX, ev.offsetY);
        const dentro = mapa && [...mapa.munis.values()].find((m) => prueba.isPointInPath(m.path, x, y));
        const n = dentro && nodoPorId('m' + dentro.cve);
        if (n) elegir(n); else fijar(null);
      });
    grafo.d3Force('charge').strength(-520).distanceMax(520);   // alcance corto: los nodos sin aristas no salen despedidos
    // Gravedad suave hacia el centro del estado: los nodos libres (p. ej. categorías ENVIPE sin tema) no se van lejos del mapa.
    grafo.d3Force('gravedad', (alfa) => nodos.forEach((n) => { if (n.fx == null) { n.vx -= n.x * 0.02 * alfa; n.vy -= n.y * 0.02 * alfa; } }));
    grafo.d3Force('link').distance((l) => (l.tipo === 'toca' ? 170 : l.tipo === 'dispara' ? 110 : 100));
    if (window.ResizeObserver) {
      new ResizeObserver(() => grafo.width(caja.clientWidth).height(caja.clientHeight)).observe(caja);
    }
  }

  function limpiarGrafo() {
    nodos = []; enlaces = []; fijar(null);
    datos = { temas: [], categorias: [], discursos: [], municipios: [], totalNotas: 0, pesoEncuesta: 0.7 };
    if (grafo) grafo.graphData({ nodes: [], links: [] });
    $('grafo-vacio').hidden = false;
    $('detalle').innerHTML = '<p class="text-small">Haz clic en un nodo o en un municipio para ver su detalle. Arrastra para mover; rueda o pellizco para acercar.</p>';
  }

  /** Agrega un nodo (y sus aristas) si no existe aún. Los ya presentes no se tocan: conservan su posición.
      `retraso` escalona la aparición sin retrasar el alta, para que las aristas siempre encuentren su extremo. */
  function agregar(nodo, aristas = [], retraso = 0) {
    if (nodos.some((n) => n.id === nodo.id)) return;
    const ahora = performance.now();
    nodos.push({ ...nodo, nacio: ahora + retraso });
    aristas.forEach((a) => {
      if (enlaces.some((l) => l.de === a.de && l.a === a.a)) return;
      enlaces.push({ ...a, source: a.de, target: a.a });
      if (a.tipo === 'dispara') { const m = nodoPorId(a.a); if (m) m.pulso = ahora + retraso; }
    });
    $('grafo-vacio').hidden = true;
    grafo.graphData({ nodes: nodos, links: enlaces });
  }

  const escalonado = (items, ms = 140) => items.forEach((fn, i) => fn(i * ms));

  const total = (m) => m.dispara.reduce((a, d) => a + d.n, 0);
  const nodoMun = (m) => {
    const g = mapa.munis.get(m.cve);
    return { id: m.id, tipo: 'municipio', nombre: m.nombre, total: total(m), fx: g.x, fy: g.y, x: g.x, y: g.y };
  };
  const nodoTema = (t) => ({ id: t.id, tipo: 'tema', nombre: t.nombre, notas: t.notas, marca: t.lectura === 'sin_contraste' ? 'sin_contraste' : null });
  const aristasTema = (t) => datos.municipios.flatMap((m) => m.dispara.filter((d) => d.tema === t.id)
    .map((d) => ({ de: t.id, a: m.id, tipo: 'dispara', n: d.n, real: d.real })));
  const nodoCat = (c) => ({ id: c.id, tipo: 'envipe', nombre: c.nombre, pct: c.pct, marca: c.temas.length ? null : 'no_cubierto' });
  const aristasCat = (c) => c.temas.map((tid) => ({ de: tid, a: c.id, tipo: 'cruce' }));
  const nodoDisc = (d, i) => ({ id: `d${i}`, tipo: 'discurso', nombre: d.nombre });
  const aristasDisc = (d, i) => d.toca.map((tid) => ({ de: `d${i}`, a: tid, tipo: 'toca' }));

  /* ════════════════════════════════════════════
     DETALLE DEL NODO
     ════════════════════════════════════════════ */

  const tema = (id) => datos.temas.find((t) => t.id === id);
  const cat = (id) => datos.categorias.find((c) => c.id === id);
  const lista = (items) => (items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '');
  const dato = (k, v) => `<div class="dato"><span>${k}</span><span>${v}</span></div>`;

  function detalleMunicipio(n) {
    const m = datos.municipios.find((x) => x.id === n.id);
    const filas = m.dispara.map((d) => `${esc(tema(d.tema).nombre)} — ${d.n} ${d.real ? (d.n === 1 ? 'titular' : 'titulares') : (d.n === 1 ? 'nota' : 'notas')}`);
    const porDiscurso = datos.discursos.map((d) => {
      const dis = m.dispara.filter((x) => d.toca.includes(x.tema));
      const faltan = m.dispara.filter((x) => !d.toca.includes(x.tema)).map((x) => esc(tema(x.tema).nombre));
      return `<li><strong>${esc(d.nombre)}</strong>: toca ${dis.length} de ${m.dispara.length}${faltan.length ? '. Le falta: ' + faltan.join('; ') : ''}</li>`;
    });
    return `<span class="badge" style="background:#fff; color:#000;">Municipio</span>
      <h4>${esc(m.nombre)}</h4>
      ${dato('Lista nominal 2024', T.num(m.listaNominal))}
      ${dato('Ganó en 2024', esc(m.ganador2024))}
      ${dato('Margen 2024', `${m.margen2024} pp`)}
      ${dato('Participación 2024', `${m.participacion2024} %`)}
      <strong>Titulares de la semana que lo nombran (${m.titulares.length})</strong>
      ${m.titulares.length ? lista(m.titulares.map((x) => `<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.titulo)}</a>`)) : '<p>Ninguno: casi todas las notas dicen “Campeche” por el estado.</p>'}
      <strong>Temas que se disparan aquí</strong>${lista(filas)}
      <strong>Qué cubre cada discurso aquí</strong>${porDiscurso.length ? `<ul>${porDiscurso.join('')}</ul>` : '<p>Aún sin discursos evaluados.</p>'}
      <p class="nota">Datos electorales: IEEC, cómputos distritales 2024. Notas: monitoreo de medios de la semana.</p>`;
  }

  function detalle(n) {
    if (n.tipo === 'municipio') return detalleMunicipio(n);
    if (n.tipo === 'tema') {
      const t = tema(n.id);
      const cats = t.categorias.map((id) => `${esc(cat(id).nombre)} · ${cat(id).pct} %`);
      const quienes = datos.discursos.filter((d) => d.toca.includes(t.id)).map((d) => esc(d.nombre));
      return `<span class="badge badge--info">Tema de noticias</span>
        <h4>${esc(t.nombre)}</h4>
        ${dato('Notas', `${t.notas} de ${datos.totalNotas} (${pct(t.notas / datos.totalNotas)})`)}
        ${dato('Tono', esc(t.tono))}
        ${dato('Confianza', esc(t.confianza))}
        ${dato('Peso relativo en ENVIPE', t.categorias.length ? pct(t.pesoEncuesta) : '—')}
        <p style="margin-top:8px;">${t.lectura === 'sin_contraste' ? '<span class="badge badge--warn">Sin contraste</span> ' : ''}${esc(LECTURAS[t.lectura])}</p>
        <strong>Categorías de ENVIPE</strong>
        ${cats.length ? lista(cats) : '<p>Ninguna: ENVIPE no pregunta por este tema.</p>'}
        <strong>Discursos que lo tocan</strong>
        ${quienes.length ? lista(quienes) : '<p>Ninguno (hasta ahora).</p>'}
        <p class="nota">El peso relativo se normaliza sobre la suma de menciones de ENVIPE; no es el % que reporta la encuesta.</p>`;
    }
    if (n.tipo === 'envipe') {
      const c = cat(n.id);
      const ts = c.temas.map((id) => esc(tema(id).nombre));
      return `<span class="badge badge--warn" style="background:var(--sev-media-bg);">Categoría ENVIPE</span>
        <h4>${esc(c.nombre)}</h4>
        ${dato('% de ENVIPE', `${c.pct} %`)}
        <p style="margin-top:8px;">${c.temas.length ? '<strong>Temas de noticias relacionados</strong>' + lista(ts)
          : '<span class="badge badge--warn">No cubierto por medios</span> Ninguna nota de la semana toca este problema.'}</p>
        <p class="nota">${esc(window.DISCURSOS_MOCK.resultado.fuenteEncuesta)}. Cada persona puede mencionar varios problemas: los % no suman 100.</p>`;
    }
    const i = Number(n.id.slice(1));
    const d = datos.discursos[i];
    return `<span class="badge" style="background:var(--velo-08);">Discurso</span>
      <h4>${esc(d.nombre)}</h4>
      ${dato('Toca', `${d.toca.length} de ${datos.temas.length} temas`)}
      ${dato('Cobertura de la conversación (noticias)', pct(d.coberturaNoticias))}
      ${dato('Cobertura ponderada ENVIPE', pct(d.coberturaPonderada))}
      <strong>Temas que toca</strong>${lista(d.toca.map((id) => esc(tema(id).nombre)))}
      <strong>Frases de riesgo (${d.frases.length})</strong>
      ${lista(d.frases.map((f) => `“${esc(f.frase)}” — ${esc(f.motivo)}`))}`;
  }

  /* ════════════════════════════════════════════
     TABLA FINAL
     ════════════════════════════════════════════ */

  function pintarTabla(res) {
    const corto = (id) => esc(tema(id).nombre.split(',')[0].split(' y ')[0]);
    $('panel-tabla').innerHTML = `
      <h3 class="text-h3 panel__titulo"><i data-lucide="columns-3"></i> Comparación de discursos</h3>
      <div class="tabla-caja">
        <table class="tabla tabla-disc">
          <thead><tr>
            <th>Discurso</th><th>Temas tocados</th>
            <th>Cobertura de la conversación (noticias)</th>
            <th>Cobertura ponderada ENVIPE</th>
            <th>Frases de riesgo</th>
          </tr></thead>
          <tbody>${res.discursos.map((d) => `<tr>
            <td><strong>${esc(d.nombre)}</strong></td>
            <td><div class="metrica"><strong>${d.toca.length} de ${res.temas.length}</strong>
              <span class="chips">${d.toca.map((id) => `<span class="badge">${corto(id)}</span>`).join('')}</span></div></td>
            <td>${T.barra(d.coberturaNoticias * 100, 100, pct(d.coberturaNoticias))}</td>
            <td>${T.barra(d.coberturaPonderada * 100, 100, pct(d.coberturaPonderada))}</td>
            <td><details><summary>${d.frases.length}</summary>${lista(d.frases.map((f) => `“${esc(f.frase)}” — ${esc(f.motivo)}`))}</details></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="panel__nota"><strong>Son dos métricas distintas.</strong> Cobertura de la conversación (noticias): % de las ${res.totalNotas} notas
      que pertenecen a los temas que toca el discurso. Cobertura ponderada ENVIPE: mezcla ${Math.round(res.pesoEncuesta * 100)} % del peso relativo
      en ENVIPE y ${Math.round((1 - res.pesoEncuesta) * 100)} % de las notas; un tema que preocupa a la gente pesa aunque casi no salga en medios.</p>`;
    $('panel-tabla').hidden = false;
    if (window.lucide) lucide.createIcons();
  }

  /* ════════════════════════════════════════════
     EJECUCIÓN
     ════════════════════════════════════════════ */

  let corriendo = false;

  function alProgreso({ etapa, estado, datos: d }) {
    if (etapa === 'noticias') {
      if (d && d.municipios) {
        datos.municipios = d.municipios;
        escalonado(d.municipios.map((m) => (ms) => agregar(nodoMun(m), [], ms)), 110);
      }
      poner(etapa, estado, d && `${d.notas} notas del ${d.fecha}`);
    } else if (etapa === 'temas') {
      if (d) {
        datos.temas = d.temas;
        escalonado(d.temas.map((t) => (ms) => agregar(nodoTema(t), aristasTema(t), ms)));
      }
      poner(etapa, estado, d && `${d.temas.length} temas`);
    } else if (etapa === 'envipe') {
      if (d) {
        datos.categorias = d.categorias;
        escalonado(d.categorias.map((c) => (ms) => agregar(nodoCat(c), aristasCat(c), ms)));
      }
      poner(etapa, estado, d && `${d.categorias.length} categorías`);
    } else if (etapa === 'evaluar') {
      if (d && d.discurso) {
        datos.discursos[d.i] = d.discurso;
        agregar(nodoDisc(d.discurso, d.i), aristasDisc(d.discurso, d.i));
      }
      poner(etapa, estado, d && `${Math.min(d.i + (d.discurso ? 1 : 0), d.total)}/${d.total}`);
    } else {
      poner(etapa, estado);
    }
  }

  /** Cierra lo que no llegó por eventos (p. ej. un backend sin progreso) con el resultado final. */
  function reconciliar(res) {
    datos = { temas: res.temas, categorias: res.categorias, discursos: res.discursos, municipios: res.municipios, totalNotas: res.totalNotas, pesoEncuesta: res.pesoEncuesta };
    res.municipios.forEach((m) => agregar(nodoMun(m)));
    res.temas.forEach((t) => agregar(nodoTema(t), aristasTema(t)));
    res.categorias.forEach((c) => agregar(nodoCat(c), aristasCat(c)));
    res.discursos.forEach((d, i) => agregar(nodoDisc(d, i), aristasDisc(d, i)));
    ETAPAS.forEach((e) => { if ((estadoEtapa[e.id] || {}).estado !== 'listo') poner(e.id, 'listo'); });
  }

  async function ejecutar(entidad, discursos) {
    corriendo = true;
    const btn = $('btn-evaluar');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-circle" style="animation:spin 0.8s linear infinite;"></i> Evaluando…';
    $('proceso-error').textContent = '';
    $('panel-tabla').hidden = true;
    $('panel-etapas').hidden = false;
    $('panel-grafo').hidden = false;
    if (!grafo) crearGrafo();
    limpiarGrafo();
    ETAPAS.forEach((e) => { estadoEtapa[e.id] = { estado: 'pendiente' }; });
    pintarEtapas();
    $('panel-etapas').scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      await cargarMapa();
      mapaNacio = performance.now();
      analizando = true;
      $('grafo-vacio').hidden = true;
      vistaInicial();
      const res = await window.evaluarDiscursos(entidad, discursos, alProgreso);
      reconciliar(res);
      pintarTabla(res);
    } catch (err) {
      console.error('discursos:', err);
      const enCurso = ETAPAS.find((e) => (estadoEtapa[e.id] || {}).estado === 'curso') || ETAPAS.find((e) => (estadoEtapa[e.id] || {}).estado === 'pendiente');
      if (enCurso) poner(enCurso.id, 'error');
      $('proceso-error').textContent = `No se pudo completar la evaluación: ${err.message || 'error desconocido'}. Puedes intentarlo de nuevo.`;
    } finally {
      analizando = false;
      corriendo = false;
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play"></i> Evaluar discursos';
      if (window.lucide) lucide.createIcons();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    pintarForm();
    $('cabecera-pills').innerHTML = P.badge('dato', { fuente: 'Monitoreo de medios + ENVIPE 2026', detalle: 'Campeche' });
    $('leyenda').innerHTML = [
      ['#fff', 'Municipio (líneas blancas = límites del estado)', 'leyenda-punto--blanco'], ['var(--serie-1)', 'Tema de noticias', ''],
      ['var(--serie-4)', 'Categoría ENVIPE', ''], ['var(--serie-3)', 'Discurso', ''],
      ['', 'Anillo punteado: tema sin contraste en ENVIPE, o categoría no cubierta por medios', 'leyenda-punto--anillo'],
      ['', 'Línea blanca: titulares que nombran el municipio · cian punteada: tema que se dispara en el municipio · ámbar: cruce con ENVIPE · verde con flecha: el discurso toca el tema', 'leyenda-punto--linea'],
    ].map(([c, t, k]) => `<span class="leyenda-item"><span class="leyenda-punto ${k}" ${c ? `style="background:${c}"` : ''}></span>${t}</span>`).join('');
    $('btn-ejemplo').addEventListener('click', () => {
      LETRAS.forEach((_, i) => { $(`texto-${i}`).value = EJEMPLOS[i]; });
      errorForm('');
    });
    $('form-discursos').addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (corriendo) return;
      const discursos = leerForm();
      if (!discursos.length) return errorForm('Pega o sube al menos un discurso para evaluar.');
      const corto = discursos.find((d) => d.texto.length < 20);
      if (corto) return errorForm(`"${corto.nombre}" es muy corto para evaluarse (mínimo 20 caracteres).`);
      errorForm('');
      ejecutar($('entidad').value, discursos);
    });
    if (window.lucide) lucide.createIcons();
  });
})();
