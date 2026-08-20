/* ============================================
   CEREBRO ELECTORAL — RESULTADOS 2024
   ============================================
   Única puerta a los resultados del Proceso Electoral
   Local 2023-2024 (diputaciones locales de MR).

     Electoral.cargar().then((d) => { d.secciones; d.municipios; })
     Electoral.registrarVariables(d)   // choropleths del mapa
     Electoral.fichaSeccion(props, capaId)
     Electoral.color(bloque)

   Los archivos los produce
   frontend/data/electoral/build_electoral.py a partir de los
   cómputos del IEEC y del encarte del INE.

   Lo que este módulo NO hace: proyectar 2027. El resultado de
   2024 es pasado registrado. Quien quiera proyectar, que lo
   marque como estimación y ponga su intervalo.
   ============================================ */

(function (global) {
  'use strict';

  const RUTA = 'data/electoral/';

  // Bloques tal como los agrupa el pipeline. El orden es el de la boleta.
  const BLOQUES = {
    PAN:       { etiqueta: 'PAN',                 color: '--partido-pan' },
    'PRI-PRD': { etiqueta: 'PRI-PRD',             color: '--bloque-pri-prd' },
    MC:        { etiqueta: 'Movimiento Ciudadano', color: '--partido-mc' },
    SHH:       { etiqueta: 'PT-PVEM-Morena',      color: '--bloque-shh' },
    PES:       { etiqueta: 'PES Campeche',        color: '--partido-pes' },
    CL:        { etiqueta: 'Campeche Libre',      color: '--partido-otro' },
    EDC:       { etiqueta: 'Espacio Democrático', color: '--partido-otro' },
    MLC:       { etiqueta: 'Movimiento Laborista', color: '--partido-otro' },
  };

  let cache = null;

  function cargar() {
    if (cache) return cache;
    cache = Promise.all([
      fetch(RUTA + 'resultados_municipio_2024.json').then((r) => r.json()),
      fetch(RUTA + 'resultados_seccion_2024.json').then((r) => r.json()),
    ]).then(([mun, sec]) => ({
      municipios: mun.municipios,
      secciones: sec.secciones,
      meta: mun.metadata,
      metaSeccion: sec.metadata,
    })).catch((err) => {
      console.error('Electoral:', err);
      cache = null;
      throw err;
    });
    return cache;
  }

  /* ── Cargadores ──
     Seis archivos distintos se pedían con seis funciones idénticas: fetch,
     comprobar `ok`, renombrar `metadata` a `meta`, cachear la promesa y
     reportar el error. Ninguna se veía mal por separado; juntas eran ciento
     cuarenta líneas repetidas. Se cachea la PROMESA y no el resultado, para
     que dos vistas que piden lo mismo a la vez compartan una sola descarga. */

  const cacheArchivos = {};

  function cargador(archivo, etiqueta) {
    return function () {
      if (cacheArchivos[archivo]) return cacheArchivos[archivo];
      cacheArchivos[archivo] = fetch(RUTA + archivo)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} al cargar ${etiqueta}`);
          return r.json();
        })
        .then((j) => Object.assign({}, j, { meta: j.metadata }))
        .catch((err) => {
          console.error(`Electoral ${etiqueta}:`, err);
          delete cacheArchivos[archivo];   // que un fallo no deje la promesa rota en caché
          throw err;
        });
      return cacheArchivos[archivo];
    };
  }

  const cargarCatalogo = cargador('secciones_catalogo_2026.json',
                                  'el catálogo de secciones');
  const cargarProyeccion = cargador('proyeccion_2027.json', 'la proyección 2027');
  const cargarEncuestas = cargador('encuestas_2026.json', 'las encuestas');
  const cargarDiputaciones = cargador('diputaciones_2024.json', 'las diputaciones');
  const cargarForensia = cargador('forensia_2024.json', 'la forensia');
  const cargarCorrelaciones = cargador('correlaciones_2024.json', 'las correlaciones');
  const cargarAuditoria = cargador('auditoria.json', 'la auditoría');

  /* ── Competitividad y margen de riesgo ──

     El margen ya está en el dato: lo calcula el pipeline. Lo que falta es
     traducirlo a una lectura operativa — "¿este municipio está en juego?" —
     y eso exige un umbral. El umbral es una decisión, así que va escrito.

     EL CRITERIO, Y POR QUÉ ÉSTE

     Para que cambie el ganador no hace falta mover el margen entero: basta
     que se desplace la MITAD, porque cada voto que cambia de manos resta a
     uno y suma al otro. Con un margen de 9 pp, un desplazamiento de 4.5 pp
     empata la elección.

         swing necesario para voltear = margen ÷ 2

     ¿Y cuánto es "mucho" para un desplazamiento? Hasta la Fase 4 habría sido
     otra cifra inventada. Ya no: el tracking de Demoscopia mide cuánto se
     mueve el reparto en la práctica (σ ≈ 4.5 pp). Así que los cortes se
     expresan en unidades de esa volatilidad observada, no en números redondos
     elegidos a ojo:

         swing necesario ≤ 1σ   ->  en riesgo   (margen ≤ 2σ ≈  9 pp)
         swing necesario ≤ 2σ   ->  vigilar     (margen ≤ 4σ ≈ 18 pp)
         más                    ->  seguro

     Que esos cortes caigan cerca del 5/10/20 que usa la literatura electoral
     es una comprobación de sanidad, no el origen del criterio.

     DOS LÍMITES QUE HAY QUE DECIR

     1. σ se midió sobre el reparto ESTATAL. Un municipio chico se mueve más
        que el estado, así que aplicárselo tal cual es conservador: puede
        clasificar como "seguro" algo que localmente no lo es.
     2. Es competitividad de 2024, no un pronóstico de 2027. Dice dónde estuvo
        cerca la última vez, no dónde va a estar cerca la próxima. */

  const SIGMA_POR_DEFECTO = 4.5;

  const COMPETITIVIDAD = {
    riesgo:  { etiqueta: 'En riesgo',    color: '--serie-6', sigmas: 1 },
    vigilar: { etiqueta: 'Vigilar',      color: '--serie-4', sigmas: 2 },
    seguro:  { etiqueta: 'Seguro',       color: '--serie-5', sigmas: Infinity },
  };

  /** Puntos que tendrían que desplazarse para que cambie el ganador. */
  function swingNecesario(margen) {
    return margen / 2;
  }

  /** Clasifica un margen. `sigma` viene de las encuestas si están cargadas. */
  function competitividad(margen, sigma) {
    const s = sigma || SIGMA_POR_DEFECTO;
    const swing = swingNecesario(margen);
    if (swing <= s) return 'riesgo';
    if (swing <= 2 * s) return 'vigilar';
    return 'seguro';
  }

  /** Los cortes en puntos porcentuales, para poder enseñarlos. */
  function umbrales(sigma) {
    const s = sigma || SIGMA_POR_DEFECTO;
    return { sigma: s, riesgo: 2 * s, vigilar: 4 * s };
  }

  /* ── Proporcionalidad normativa de casillas ──
     LGIPE art. 253: una casilla por cada 750 electores de la lista nominal
     de la sección, o fracción. Mínimo una por sección.

     Verificado contra 2024: reproduce exacto las casillas instaladas en 517
     de 542 secciones (95%) y NUNCA queda por encima de lo instalado. Las 25
     que exceden lo hacen por extraordinarias y especiales, que la fórmula no
     predice porque no dependen del padrón sino de la geografía y del voto en
     tránsito. */

  const ELECTORES_POR_CASILLA = 750;

  function casillasNormativas(listaNominal) {
    return Math.max(1, Math.ceil(listaNominal / ELECTORES_POR_CASILLA));
  }

  /* Agrega las secciones por el distrito que diga `campo`, sumando lo real y
     lo normativo en el mismo paso. `distritoDe` traduce sección -> distrito;
     una sección que no cruce se acumula aparte y se declara, no se descarta. */

  function porDistrito(secciones, distritoDe) {
    const dist = {};
    const huerfanas = [];

    Object.entries(secciones).forEach(([sec, r]) => {
      const d = distritoDe(sec, r);
      if (d === null || d === undefined) { huerfanas.push(sec); return; }
      const g = dist[d] || (dist[d] = {
        distrito: d, secciones: 0, lista_nominal: 0,
        casillas: 0, normativas: 0, votaron: 0,
      });
      g.secciones += 1;
      g.lista_nominal += r.lista_nominal;
      g.casillas += r.casillas;
      g.normativas += casillasNormativas(r.lista_nominal);
      g.votaron += r.total;
    });

    const filas = Object.values(dist).sort((a, b) => a.distrito - b.distrito);
    filas.forEach((g) => {
      g.diferencia = g.casillas - g.normativas;
      g.electores_por_casilla = g.casillas ? g.lista_nominal / g.casillas : 0;
      g.electores_por_seccion = g.secciones ? g.lista_nominal / g.secciones : 0;
      g.participacion = g.lista_nominal ? g.votaron / g.lista_nominal * 100 : 0;
    });
    return { filas, huerfanas };
  }

  function color(bloque) {
    const def = BLOQUES[bloque];
    return def ? def.color : '--partido-otro';
  }

  function etiqueta(bloque) {
    const def = BLOQUES[bloque];
    return def ? def.etiqueta : bloque;
  }

  const pct = (v) => (v === null || v === undefined ? '—' : v.toFixed(1) + '%');
  const num = (v) => (v || 0).toLocaleString('es-MX');

  /* ── Variables de coloreado ──
     Todas son DATO o CÁLCULO sobre dato: ninguna es modelo.
     Se registran juntas para que un módulo pueda ofrecerlas
     sin volver a saber cómo se calculan. */

  function registrarVariables(d) {
    const M = CerebroMapa.registrarVariable;
    const comun = {
      fuente: d.meta.fuente,
      fechaCorte: d.meta.fecha_corte,
    };
    const porMunicipio = (fn) => {
      const o = {};
      Object.entries(d.municipios).forEach(([cve, m]) => { o[cve] = fn(m); });
      return o;
    };

    M('ganador_2024', Object.assign({
      etiqueta: 'Fuerza ganadora 2024',
      valores: porMunicipio((m) => m.ganador),
      categorias: BLOQUES,
      formato: etiqueta,
      procedencia: 'Dato de cómputo, agregado por municipio',
    }, comun));

    M('participacion_2024', Object.assign({
      etiqueta: 'Participación 2024',
      valores: porMunicipio((m) => m.participacion),
      formato: (v) => pct(v),
      procedencia: 'Cálculo: votación total ÷ lista nominal',
    }, comun));

    M('margen_2024', Object.assign({
      etiqueta: 'Margen de victoria 2024',
      valores: porMunicipio((m) => m.margen),
      formato: (v) => v.toFixed(1) + ' pp',
      procedencia: 'Cálculo: 1° − 2° lugar sobre votos válidos',
    }, comun));

    M('nulos_2024', Object.assign({
      etiqueta: 'Voto nulo 2024',
      valores: porMunicipio((m) => m.nulos_pct),
      formato: (v) => pct(v),
      procedencia: 'Cálculo: votos nulos ÷ votación total',
    }, comun));

    // Competitividad: CÁLCULO sobre el margen, no dato. Es categórica, así
    // que no lleva rampa secuencial — "en riesgo" y "seguro" no están en una
    // escala, son clases.
    M('competitividad_2024', Object.assign({
      etiqueta: 'Competitividad 2024',
      valores: porMunicipio((m) => competitividad(m.margen, d.sigma)),
      categorias: COMPETITIVIDAD,
      formato: (c) => (COMPETITIVIDAD[c] || {}).etiqueta || c,
      procedencia: 'Cálculo: el margen se traduce al desplazamiento que haría '
        + 'falta para voltear el resultado (margen ÷ 2), y ese desplazamiento '
        + 'se compara con la volatilidad medida en el tracking de encuestas',
    }, comun));

    M('lista_nominal_2024', Object.assign({
      etiqueta: 'Lista nominal 2024',
      valores: porMunicipio((m) => m.lista_nominal),
      formato: (v) => num(v) + ' electores',
      procedencia: 'Dato del cómputo distrital',
    }, comun));
  }

  /* ── Agregado de un conjunto de municipios ──
     Lo usan historico.html (estatal o filtrado) y cartografia.html
     (resumen del estado). Replica lo que hace rematar() en el pipeline:
     el ganador se decide sobre el BLOQUE, no sobre el partido suelto.
     Vive aquí y no en cada página para que las dos no puedan dar
     números distintos para la misma pregunta. */

  function agregar(municipios) {
    const bloques = {};
    const partidos = {};
    let validos = 0, nulos = 0, total = 0, lista = 0, casillas = 0, secciones = 0;

    municipios.forEach((m) => {
      Object.entries(m.bloques).forEach(([b, v]) => {
        bloques[b] = (bloques[b] || 0) + v;
      });
      // Los 16 contendientes tal como estuvieron en la boleta. Es otra
      // pregunta que la del bloque: "cuánto sacó el PVEM" no es "cuánto
      // sacó el bloque en el que iba el PVEM".
      Object.entries(m.votos).forEach(([c, v]) => {
        partidos[c] = (partidos[c] || 0) + v;
      });
      validos += m.validos; nulos += m.nulos; total += m.total;
      lista += m.lista_nominal; casillas += m.casillas; secciones += m.secciones;
    });

    const orden = Object.entries(bloques).filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const ordenPartidos = Object.entries(partidos).filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const primero = orden[0] || ['', 0];
    const segundo = orden[1] || ['', 0];

    return {
      municipios, bloques, partidos, orden, ordenPartidos,
      validos, nulos, total, lista, casillas, secciones,
      ganador: primero[0],
      ganador_votos: primero[1],
      segundo: segundo[0],
      margen: validos ? (primero[1] - segundo[1]) / validos * 100 : 0,
      participacion: lista ? total / lista * 100 : 0,
      nulos_pct: total ? nulos / total * 100 : 0,
    };
  }

  /* Cuántos municipios ganó cada fuerza. Es la lectura de "quién ganó dónde"
     que no se puede sacar del agregado: ganar el estado por votos y ganar más
     municipios son cosas distintas. */
  function municipiosPorGanador(municipios) {
    const por = {};
    municipios.forEach((m) => {
      (por[m.ganador] = por[m.ganador] || []).push(m);
    });
    return Object.entries(por)
      .map(([b, ms]) => [b, ms.sort((a, x) => x.margen - a.margen)])
      .sort((a, b) => b[1].length - a[1].length);
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const puntoDe = (b) => `<span class="punto-color" style="background:var(${color(b)})"></span>`;

  const puntoComp = (margen, sigma) => {
    const c = COMPETITIVIDAD[competitividad(margen, sigma)] || {};
    return `<span class="punto-color" style="background:var(${c.color})"></span>`;
  };

  /* ── Filas extra para la ficha del mapa: municipio ──
     El registro municipal YA trae ganador, segundo y margen calculados por el
     pipeline. Aquí no se recalcula ninguno: sólo se leen. */

  function fichaMunicipio(d) {
    return function (props, capaId) {
      if (capaId !== 'municipios' && capaId !== 'choropleth') return '';
      const m = d.municipios[props.cve_mun];
      if (!m) return '';

      const contendientes = Object.entries(m.votos)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

      return `
        <tr><th colspan="2" class="mapa-ficha__sub">Resultado 2024 en el municipio</th></tr>
        <tr><th>Ganó</th><td>${puntoDe(m.ganador)}${esc(etiqueta(m.ganador))}</td></tr>
        <tr><th>Margen</th><td>${m.margen.toFixed(1)} pp sobre ${
          esc(etiqueta(m.segundo))}</td></tr>
        <tr><th>Competitividad</th><td>${puntoComp(m.margen, d.sigma)}${
          esc((COMPETITIVIDAD[competitividad(m.margen, d.sigma)] || {}).etiqueta)}</td></tr>
        <tr><th>Riesgo de vuelco</th><td>bastan <strong>${
          swingNecesario(m.margen).toFixed(1)} pp</strong> de desplazamiento</td></tr>
        <tr><th>Participación</th><td>${pct(m.participacion)}</td></tr>
        <tr><th>Lista nominal</th><td>${num(m.lista_nominal)}</td></tr>
        <tr><th>Votos válidos</th><td>${num(m.validos)}</td></tr>
        <tr><th>Voto nulo</th><td>${pct(m.nulos_pct)}</td></tr>
        <tr><th>Casillas</th><td>${num(m.casillas)} en ${num(m.secciones)} secciones</td></tr>
        <tr><th colspan="2" class="mapa-ficha__sub">Los ${
          contendientes.length} contendientes</th></tr>
        ${contendientes.map(([c, v]) => `
          <tr><th>${esc(c)}</th><td>${num(v)} · ${
            pct(v / m.validos * 100)}</td></tr>`).join('')}`;
    };
  }

  /* ── Filas extra para la ficha del mapa ──
     Se le pasa a CerebroMapa.crear({ fichaExtra }). Devuelve <tr>
     y por eso escapa aquí mismo: la sección viene de un archivo. */

  function fichaSeccion(d) {
    return function (props, capaId) {
      const sec = capaId === 'casillas_2024' && props.seccion
        ? d.secciones[String(props.seccion)]
        : null;
      if (!sec) return '';

      const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

      return `
        <tr><th colspan="2" class="mapa-ficha__sub">Resultado 2024 en la sección</th></tr>
        <tr><th>Ganó</th><td><span class="punto-color" style="background:var(${
          color(sec.ganador)})"></span>${esc(etiqueta(sec.ganador))}</td></tr>
        <tr><th>Margen</th><td>${sec.margen.toFixed(1)} pp sobre ${
          esc(etiqueta(sec.segundo))}</td></tr>
        <tr><th>Participación</th><td>${pct(sec.participacion)}</td></tr>
        <tr><th>Lista nominal</th><td>${num(sec.lista_nominal)}</td></tr>
        <tr><th>Voto nulo</th><td>${pct(sec.nulos_pct)}</td></tr>`;
    };
  }

  global.Electoral = {
    cargar, cargarCatalogo, cargarProyeccion, cargarEncuestas,
    cargarDiputaciones, cargarForensia, cargarCorrelaciones,
    cargarAuditoria, registrarVariables, fichaSeccion, fichaMunicipio,
    agregar, municipiosPorGanador,
    casillasNormativas, porDistrito, ELECTORES_POR_CASILLA,
    competitividad, swingNecesario, umbrales, COMPETITIVIDAD,
    color, etiqueta, pct, num, BLOQUES,
  };
})(window);
