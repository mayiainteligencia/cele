/* Vista: Encuestas — tracking de Demoscopia 2025-2026.

   Tres cosas que esta pantalla tiene que dejar claras, porque el dato de
   origen las impone:

   1. La serie es TRANSCRIPCIÓN MANUAL, no descarga oficial. Verificada
      aritméticamente, pero eso no verifica el origen. Badge propio.

   2. Una parte del movimiento mes a mes NO es cambio de opinión: es error
      de muestreo. Para el líder, la desviación observada es MENOR que el
      error esperado — su serie es indistinguible de una línea plana. Se
      dice con esas palabras.

   3. El indeciso no es un partido. Se excluye del denominador para el voto
      efectivo, y eso es CÁLCULO, no dato. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  document.addEventListener('DOMContentLoaded', () => {
    E.cargarEncuestas().then(pintar).catch((err) => {
      console.error('encuestas:', err);
      document.getElementById('contenido').innerHTML =
        '<p class="text-small">No se pudieron cargar las encuestas.</p>';
    });
  });

  const color = (b) => `var(${E.color(b)})`;

  function pintar(d) {
    const m = d.meta;
    const ult = d.voto_efectivo[d.voto_efectivo.length - 1];
    const sig = d.sigma_recomendada;
    const conSenal = Object.entries(d.fuerzas).filter(([, f]) => f.hay_senal);

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('dato', {
        detalle: `${m.meses} meses · muestra ${T.num(m.muestra)}`,
        fuente: m.casa, fechaCorte: m.fecha_corte,
      }) +
      P.badge('calculo', { detalle: 'voto efectivo, sin indecisos' });

    document.getElementById('contenido').innerHTML = `

      <!-- ── Advertencia de procedencia ── -->
      <section class="panel">
        <div class="aviso-simulado">
          <i data-lucide="clipboard-pen"></i>
          <span><strong>Transcripción manual.</strong>
          ${T.escapar(m.advertencia_procedencia)}</span>
        </div>
      </section>

      <!-- ── La encuesta ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="bar-chart-3"></i> Intención de voto para gubernatura
          ${P.badge('dato', { fuente: m.casa, fechaCorte: m.fecha_corte })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          ${T.escapar(m.metodo)}
        </p>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Muestra', T.num(m.muestra) + ' personas', 'dato',
            { fuente: m.casa })}
          ${T.cifra('Margen de error', '± ' + m.margen_error_declarado_pp + ' pp',
            'dato', { detalle: m.confianza_pct + '% de confianza' })}
          ${T.cifra('Meses de serie', String(m.meses), 'dato',
            { detalle: m.periodo })}
          ${T.cifra('Efecto de diseño', m.efecto_diseno_implicito + '×', 'calculo',
            { detalle: 'MoE declarada ÷ MoE de muestreo aleatorio simple' })}
        </div>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Último corte, voto efectivo
        </h4>
        <p class="tarjeta__texto" style="max-width:78ch">
          Sin los ${T.pct(ult.no_decide)} que aún no deciden. El indeciso no es
          una fuerza: se saca del denominador, no se reparte entre partidos.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Bloque</th>
                <th>Se compone de</th>
                <th class="num">Bruto</th>
                <th class="num">Voto efectivo</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(m.mapa_bloques).map((b) => `
                <tr>
                  <td><span class="punto-color" style="background:${color(b)}"></span>
                      <strong>${T.escapar(E.etiqueta(b))}</strong></td>
                  <td class="text-small">${T.escapar(m.mapa_bloques[b].join(' + '))}</td>
                  <td class="num">${T.pct(ult.bruto[b])}</td>
                  <td class="num"><strong>${T.pct(ult.efectivo[b])}</strong></td>
                  <td>${T.barra(ult.efectivo[b], 100, T.pct(ult.efectivo[b]))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          <strong>El mapeo importa.</strong> ${T.escapar(m.supuesto_coalicion)}
        </p>
      </section>

      <!-- ── Movimiento real contra ruido ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="activity"></i> ¿Cuánto de este movimiento es real?
          ${P.badge('calculo', { detalle: 'descomposición de varianza' })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Cada mes es una muestra distinta de ${T.num(m.muestra)} personas, así
          que una parte de lo que se mueve entre meses no es cambio de opinión:
          es error de muestreo. Restando la varianza esperada del muestreo a la
          observada queda lo que sí es señal.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fuerza</th>
                <th class="num">Media</th>
                <th class="num">± error</th>
                <th class="num">sd observada</th>
                <th class="num">sd de muestreo</th>
                <th class="num">sd real</th>
                <th>Lectura</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(d.fuerzas).map(([k, f]) => `
                <tr>
                  <td><strong>${T.escapar(k)}</strong>${
                    f.es_partido ? '' : ' <span class="text-small">(no es partido)</span>'}</td>
                  <td class="num">${T.pct(f.media)}</td>
                  <td class="num">± ${f.margen_error_pp}</td>
                  <td class="num">${f.sd_observada}</td>
                  <td class="num">${f.sd_muestreo}</td>
                  <td class="num"><strong>${f.sd_real}</strong></td>
                  <td class="text-small">${f.hay_senal
                    ? 'movimiento real'
                    : '<em>indistinguible de una serie plana</em>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          De ${Object.keys(d.fuerzas).length} categorías, sólo
          ${conSenal.length} tienen movimiento por encima del ruido:
          ${conSenal.map(([k]) => T.escapar(k)).join(', ')}. La del líder no
          está entre ellas — su desviación observada es <em>menor</em> que el
          error de muestreo esperado. Lo que sí es real y direccional es la
          deriva: el líder cae ${Math.abs(d.fuerzas.morena.deriva_18m)} pp y MC
          sube ${Math.abs(d.fuerzas.mc.deriva_18m)} pp entre los primeros y los
          últimos tres meses.
        </p>
        ${P.pie({
          fuente: m.casa, fechaCorte: m.fecha_corte, metodologia: m.metodo,
          cobertura: m.periodo, confianza: 'media',
        })}
      </section>

      <!-- ── Margen de error y tamaño de muestra ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="ruler"></i> Qué compra una muestra más grande
          ${P.badge('calculo', { detalle: 'margen al 95%' })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          ${T.escapar(d.margen_por_tamano_muestra.que_es)}
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th class="num">Tamaño de muestra</th>
                <th class="num">Margen en p=50%</th>
                <th class="num">Margen para el líder</th>
                <th>Comparación</th>
              </tr>
            </thead>
            <tbody>
              ${d.margen_por_tamano_muestra.escala.map((e) => `
                <tr${e.n === m.muestra ? ' class="fila--activa"' : ''}>
                  <td class="num"><strong>${T.num(e.n)}</strong>${
                    e.n === m.muestra ? ' <span class="text-small">(esta encuesta)</span>' : ''}</td>
                  <td class="num">± ${e.margen_pp} pp</td>
                  <td class="num">± ${e.margen_lider_pp} pp</td>
                  <td>${T.barra(e.margen_pp, d.margen_por_tamano_muestra.escala[0].margen_pp,
                    '± ' + e.margen_pp)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          El margen va como 1÷√n: para partirlo a la mitad hay que
          <strong>cuadruplicar</strong> la muestra. Pasar de ${T.num(m.muestra)}
          a ${T.num(m.muestra * 4)} personas baja el margen de
          ± ${m.margen_error_declarado_pp} a
          ± ${(m.margen_error_declarado_pp / 2).toFixed(2)} pp, y cuesta cuatro
          veces más. Ése es el rendimiento decreciente que hay que decidir si
          se paga.
        </p>
      </section>

      <!-- ── Lo que esto le da al modelo ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="sigma"></i> Lo que esta serie le aporta a la proyección
          ${P.badge('calculo', { detalle: 'σ del modelo' })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Hasta antes de esta serie, la dispersión de la proyección 2027 era un
          <strong>supuesto</strong>: estaba anclada en una sola transición
          observada (2021→2024) y con n=1 no se estima una varianza. Con 19
          meses de tracking se calcula, y por tres caminos independientes.
        </p>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${Object.entries(sig.estimaciones).map(([k, v]) => T.cifra(
            k.replace(/_/g, ' '), v + ' pp', 'calculo')).join('')}
          ${T.cifra('σ que usa el modelo', sig.recomendado_pp + ' pp', 'calculo',
            { detalle: 'promedio de las tres' })}
        </div>
        <p class="panel__nota">
          Que tres formas distintas de preguntar lo mismo caigan entre
          ${sig.minimo} y ${sig.maximo} pp es lo que da confianza en el rango.
          Si divergieran, promediarlas escondería el desacuerdo — por eso las
          tres se publican. ${T.escapar(sig.sustituye_a)}
        </p>
        ${P.pie({
          fuente: m.casa,
          fechaCorte: m.fecha_corte,
          metodologia: 'Descomposición de varianza (observada − muestreo) y '
            + 'tres estimaciones de deriva. ' + T.escapar(sig.criterio),
          confianza: 'media',
          cobertura: m.periodo,
        })}
      </section>
    `;

    P.iconos();
    if (window.lucide) window.lucide.createIcons();
  }
})();
