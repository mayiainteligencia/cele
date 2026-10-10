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
    alProgreso({ etapa: 'noticias', estado: 'listo', datos: { notas: R.totalNotas, fecha: R.fechaNotas } });

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
        <label class="disc-campo">…o sube un archivo .txt
          <input type="file" id="archivo-${i}" accept=".txt,text/plain">
        </label>
      </div>`).join('');

    LETRAS.forEach((_, i) => {
      $(`archivo-${i}`).addEventListener('change', async (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        if (!/\.txt$/i.test(f.name) && f.type !== 'text/plain') return errorForm(`"${f.name}" no es un .txt.`);
        if (f.size > MAX_TXT) return errorForm(`"${f.name}" pesa más de ${MAX_TXT / 1024} KB; un discurso no debería.`);
        try {
          $(`texto-${i}`).value = await f.text();
          if ($(`nombre-${i}`).value.startsWith('Discurso ')) $(`nombre-${i}`).value = f.name.replace(/\.txt$/i, '');
          errorForm('');
        } catch (err) {
          errorForm(`No se pudo leer "${f.name}".`);
        }
      });
    });
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
  let ajuste = null;
  let datos = { temas: [], categorias: [], discursos: [], totalNotas: 0, pesoEncuesta: 0.7 };
  const colores = {};

  function leerColores() {
    const css = getComputedStyle(document.documentElement);
    const v = (n, d) => css.getPropertyValue(n).trim() || d;
    colores.tema = v('--serie-1', '#5b9dff');
    colores.envipe = v('--serie-4', '#f5a524');
    colores.discurso = v('--serie-3', '#a78bfa');
    colores.aviso = v('--sev-media', '#f5c518');
    colores.texto = v('--text-body', '#c8d0e0');
    colores.enlace = v('--glass-border-hover', 'rgba(255,255,255,.25)');
  }

  const radio = (n) => (n.tipo === 'tema' ? 4 + Math.sqrt(n.notas) * 2.2
    : n.tipo === 'envipe' ? 4 + Math.sqrt(n.pct) * 1.6 : 13);

  function dibujar(n, ctx, escala) {
    const t = Math.min(1, (performance.now() - n.nacio) / 450);
    const k = 1 - Math.pow(1 - t, 3);                      // aparece creciendo
    const r = radio(n) * k;
    const atenuado = seleccion && !vecino(n.id);
    ctx.globalAlpha = (atenuado ? 0.22 : 1) * k;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = colores[n.tipo];
    ctx.fill();
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
      ctx.arc(n.x, n.y, r + (n.marca ? 7 : 3), 0, 2 * Math.PI);
      ctx.stroke();
    }
    const completo = window.CEi18n ? CEi18n.tr(n.nombre) : n.nombre;
    const nombre = completo.length > 26 ? completo.slice(0, 24) + '…' : completo;
    ctx.font = `${11 / escala}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colores.texto;
    ctx.fillText(nombre, n.x, n.y + r + (n.marca ? 7 : 3));
    ctx.globalAlpha = 1;
  }

  function vecino(id) {
    return id === seleccion || enlaces.some((l) => {
      const a = l.de, b = l.a;
      return (a === seleccion && b === id) || (b === seleccion && a === id);
    });
  }

  function crearGrafo() {
    const caja = $('grafo-caja');
    leerColores();
    grafo = ForceGraph()(caja)
      .width(caja.clientWidth).height(caja.clientHeight)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeId('id')
      .autoPauseRedraw(false)                               // la animación de aparición necesita redibujar
      .nodeCanvasObject(dibujar)
      .nodePointerAreaPaint((n, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radio(n) + 4, 0, 2 * Math.PI);
        ctx.fill();
      })
      .linkColor((l) => (l.tipo === 'toca' ? colores.discurso : colores.enlace))
      .linkWidth((l) => (l.tipo === 'toca' ? 1.6 : 1))
      .linkDirectionalArrowLength((l) => (l.tipo === 'toca' ? 6 : 0))
      .linkDirectionalArrowRelPos(1)
      .onNodeClick((n) => { seleccion = n.id; $('detalle').innerHTML = detalle(n); if (window.lucide) lucide.createIcons(); })
      .onBackgroundClick(() => { seleccion = null; });
    grafo.d3Force('charge').strength(-220).distanceMax(240);   // alcance corto: los nodos sin aristas no salen despedidos
    grafo.d3Force('link').distance((l) => (l.tipo === 'toca' ? 100 : 70));
    grafo.onEngineStop(() => grafo.zoomToFit(400, 50));
    if (window.ResizeObserver) {
      new ResizeObserver(() => grafo.width(caja.clientWidth).height(caja.clientHeight)).observe(caja);
    }
  }

  function limpiarGrafo() {
    nodos = []; enlaces = []; seleccion = null;
    datos = { temas: [], categorias: [], discursos: [], totalNotas: 0, pesoEncuesta: 0.7 };
    if (grafo) grafo.graphData({ nodes: [], links: [] });
    $('grafo-vacio').hidden = false;
    $('detalle').innerHTML = '<p class="text-small">Haz clic en un nodo para ver su detalle. Arrastra para moverlo; rueda o pellizco para acercar.</p>';
  }

  /** Agrega un nodo (y sus aristas) si no existe aún. Los ya presentes no se tocan: conservan su posición. */
  function agregar(nodo, aristas = []) {
    if (nodos.some((n) => n.id === nodo.id)) return;
    nodos.push({ ...nodo, nacio: performance.now() });
    aristas.forEach((a) => { if (!enlaces.some((l) => l.de === a.de && l.a === a.a)) enlaces.push({ ...a, source: a.de, target: a.a }); });
    $('grafo-vacio').hidden = true;
    grafo.graphData({ nodes: nodos, links: enlaces });
    clearTimeout(ajuste);
    ajuste = setTimeout(() => grafo.zoomToFit(500, 50), 700);   // mantiene todo el mapa a la vista
  }

  /** Mete los nodos de uno en uno para que se vea cómo se arma el mapa. */
  function escalonado(items, ms = 140) {
    items.forEach((fn, i) => setTimeout(fn, i * ms));
  }

  const nodoTema = (t) => ({ id: t.id, tipo: 'tema', nombre: t.nombre, notas: t.notas, marca: t.lectura === 'sin_contraste' ? 'sin_contraste' : null });
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

  function detalle(n) {
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
      <h3 class="text-h3 panel__titulo"><i data-lucide="columns-3"></i> Comparación de discursos ${P.badge('simulado')}</h3>
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
      poner(etapa, estado, d && `${d.notas} notas del ${d.fecha}`);
    } else if (etapa === 'temas') {
      if (d) {
        datos.temas = d.temas;
        escalonado(d.temas.map((t) => () => agregar(nodoTema(t))));
      }
      poner(etapa, estado, d && `${d.temas.length} temas`);
    } else if (etapa === 'envipe') {
      if (d) {
        datos.categorias = d.categorias;
        escalonado(d.categorias.map((c) => () => agregar(nodoCat(c), aristasCat(c))));
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
    datos = { temas: res.temas, categorias: res.categorias, discursos: res.discursos, totalNotas: res.totalNotas, pesoEncuesta: res.pesoEncuesta };
    res.temas.forEach((t) => agregar(nodoTema(t)));
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
      const res = await window.evaluarDiscursos(entidad, discursos, alProgreso);
      reconciliar(res);
      pintarTabla(res);
    } catch (err) {
      console.error('discursos:', err);
      const enCurso = ETAPAS.find((e) => (estadoEtapa[e.id] || {}).estado === 'curso') || ETAPAS.find((e) => (estadoEtapa[e.id] || {}).estado === 'pendiente');
      if (enCurso) poner(enCurso.id, 'error');
      $('proceso-error').textContent = `No se pudo completar la evaluación: ${err.message || 'error desconocido'}. Puedes intentarlo de nuevo.`;
    } finally {
      corriendo = false;
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play"></i> Evaluar discursos';
      if (window.lucide) lucide.createIcons();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    pintarForm();
    $('cabecera-pills').innerHTML = P.badge('simulado');
    $('leyenda').innerHTML = [
      ['var(--serie-1)', 'Tema de noticias', ''], ['var(--serie-4)', 'Categoría ENVIPE', ''], ['var(--serie-3)', 'Discurso', ''],
      ['', 'Anillo punteado: tema sin contraste en ENVIPE, o categoría no cubierta por medios', 'leyenda-punto--anillo'],
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
