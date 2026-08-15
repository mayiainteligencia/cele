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

    M('lista_nominal_2024', Object.assign({
      etiqueta: 'Lista nominal 2024',
      valores: porMunicipio((m) => m.lista_nominal),
      formato: (v) => num(v) + ' electores',
      procedencia: 'Dato del cómputo distrital',
    }, comun));
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
    cargar, registrarVariables, fichaSeccion,
    color, etiqueta, pct, num, BLOQUES,
  };
})(window);
