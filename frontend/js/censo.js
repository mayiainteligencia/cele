/* ============================================
   CEREBRO ELECTORAL — CENSO 2020
   ============================================
   Única puerta a la población del Censo de Población
   y Vivienda 2020 (ITER del INEGI).

     Censo.cargar().then((d) => { d.municipios; d.localidades; })
     Censo.registrarVariables(d)   // choropleths municipales
     Censo.ficha(d)                // filas para la ficha del mapa

   Lo produce backend/datalab/pipeline/build_censo.py.

   Tres reglas que este módulo hace cumplir, y que existen
   porque el dato de origen las impone:

   1. `null` NO es cero. El INEGI suprime el desglose de
      1,978 localidades para proteger su confidencialidad.
      Una cifra suprimida se pinta como "no disponible",
      nunca como 0 ni como hueco en blanco.

   2. Dzitbalché no tiene cifra de 2020. Se erigió en
      municipio en 2021, después del Censo. Se declara.

   3. Calkiní 2020 INCLUYE a Dzitbalché. Comparar ese
      número con el Calkiní electoral de 2024 —que ya no
      lo incluye— es comparar dos territorios distintos.
      La ficha lo advierte donde toca.
   ============================================ */

(function (global) {
  'use strict';

  const RUTA = 'data/censo/poblacion_2020.json';

  /* El orden es el del desglose que se pide en pantalla: primero el total,
     luego sexo, luego los tres cortes de edad. La procedencia de cada campo
     la decide el pipeline y se lee de metadata: aquí no se re-declara, para
     que las dos no puedan divergir. */
  const CAMPOS = [
    { k: 'poblacion_total', etiqueta: 'Población total' },
    { k: 'mujeres',         etiqueta: 'Mujeres' },
    { k: 'hombres',         etiqueta: 'Hombres' },
    { k: 'mayores_18',      etiqueta: 'Mayores de 18' },
    { k: 'menores_18',      etiqueta: 'Menores de 18' },
    { k: 'mayores_50',      etiqueta: 'Mayores de 50' },
  ];

  let cache = null;

  function cargar() {
    if (cache) return cache;
    cache = fetch(RUTA)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} al cargar ${RUTA}`);
        return r.json();
      })
      .then((j) => ({
        municipios: j.municipios,
        localidades: j.localidades,
        meta: j.metadata,
      }))
      .catch((err) => {
        console.error('Censo:', err);
        cache = null;
        throw err;
      });
    return cache;
  }

  const num = (v) => (v === null || v === undefined
    ? 'no disponible' : v.toLocaleString('es-MX'));

  const esc = (s) => String(s === null || s === undefined ? '—' : s)
    .replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── Variables de coloreado ──
     Sólo municipales: el choropleth de CerebroMapa colorea la capa de
     municipios, no la de localidades. La localidad se consulta por su ficha.

     Dzitbalché queda fuera de `valores` a propósito. El mapa ya sabe pintar
     de gris lo que no tiene valor y escribir "información insuficiente";
     meterlo con un 0 lo pintaría como el municipio más despoblado del
     estado, que es una afirmación falsa. */

  function registrarVariables(d) {
    const M = global.CerebroMapa.registrarVariable;
    CAMPOS.forEach((c) => {
      const valores = {};
      Object.entries(d.municipios).forEach(([cve, m]) => {
        if (typeof m[c.k] === 'number') valores[cve] = m[c.k];
      });
      M('censo_' + c.k, {
        etiqueta: c.etiqueta + ' (Censo 2020)',
        valores: valores,
        escala: 'secuencial',
        formato: (v) => v.toLocaleString('es-MX') + ' hab.',
        fuente: d.meta.fuente,
        fechaCorte: d.meta.fecha_corte,
        procedencia: d.meta.procedencia_por_campo[c.k] === 'dato'
          ? 'Dato del Censo, tal como lo publica el ITER'
          : d.meta.derivaciones[c.k],
      });
    });
  }

  /* ── Filas para la ficha del mapa ──
     Sirve a las tres capas que pueden representar un lugar: municipios,
     localidades y el propio choropleth. Cada una encuentra su registro por
     la clave que le corresponde. */

  function ficha(d) {
    return function (props, capaId) {
      const esMunicipio = (capaId === 'municipios' || capaId === 'choropleth')
        && props.cve_mun;
      let reg = null;
      let nivel = '';

      if (capaId === 'localidades' && props.cvegeo) {
        reg = d.localidades[props.cvegeo];
        nivel = 'la localidad';
      } else if (esMunicipio) {
        reg = d.municipios[props.cve_mun];
        nivel = 'el municipio';
      }

      if (!reg) {
        /* Distinguir "esta capa no lleva censo" de "esta capa sí lleva, pero
           este lugar no tiene dato". Lo segundo hay que decirlo. */
        if (esMunicipio && props.cve_mun === '04013') {
          return '<tr><th colspan="2" class="mapa-ficha__sub">Censo 2020</th></tr>'
            + '<tr><td colspan="2">Dzitbalché se erigió en municipio en 2021, '
            + 'después del Censo. No tiene cifra municipal de 2020: su población '
            + 'está contada dentro de Calkiní.</td></tr>';
        }
        if (capaId === 'localidades' && props.cvegeo) {
          return '<tr><th colspan="2" class="mapa-ficha__sub">Censo 2020</th></tr>'
            + '<tr><td colspan="2">Localidad sin dato en el Censo 2020: no '
            + 'existía en ese corte.</td></tr>';
        }
        return '';
      }

      const filas = CAMPOS.map((c) => {
        const v = reg[c.k];
        const pct = (typeof v === 'number' && reg.poblacion_total
          && c.k !== 'poblacion_total')
          ? ' <span class="text-small">'
            + (v / reg.poblacion_total * 100).toFixed(1) + '%</span>'
          : '';
        return '<tr><th>' + esc(c.etiqueta) + '</th><td>'
          + (v === null ? '<em>no disponible</em>' : num(v)) + pct + '</td></tr>';
      }).join('');

      let aviso = '';
      if (reg.motivo_sin_desglose) {
        aviso += '<tr><td colspan="2" class="text-small">'
          + esc(reg.motivo_sin_desglose)
          + '. El total sí se publica; el desglose no.</td></tr>';
      }
      if (reg.clave_censo_2020) {
        aviso += '<tr><td colspan="2" class="text-small">'
          + esc(reg.nota) + '</td></tr>';
      }
      if (nivel === 'el municipio' && props.cve_mun === '04001') {
        aviso += '<tr><td colspan="2" class="text-small">Esta cifra de 2020 '
          + 'incluye el territorio que en 2021 se separó como municipio de '
          + 'Dzitbalché. No es comparable con el Calkiní electoral de 2024.'
          + '</td></tr>';
      }

      return '<tr><th colspan="2" class="mapa-ficha__sub">Censo 2020 en '
        + esc(nivel) + '</th></tr>' + filas + aviso;
    };
  }

  global.Censo = { cargar, registrarVariables, ficha, CAMPOS, num };
})(window);
