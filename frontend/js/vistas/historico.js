/* Vista: Histórico electoral y proyección 2027.

   Dos cosas distintas, separadas a propósito:

   El histórico es pasado registrado. 2024 sale de los cómputos del IEEC que
   procesa el pipeline; 2021 se captura del cómputo estatal de gubernatura.

   La proyección es un modelo. Regla dura de la spec: NUNCA se presenta como
   certeza. Todo porcentaje proyectado sale de Territorio.intervalo(), que
   imprime el central junto con su rango. No hay una sola ruta en este
   archivo que pinte un central solo. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([T.cargar(), E.cargar(), E.cargarProyeccion(),
                 E.cargarDiputaciones()])
      .then(([ctx, elec, proyeccion, dip]) => {
      const todos = Object.values(elec.municipios)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun));
      const datos = {
        municipios: todos,
        historico: ctx.historico,
        proyeccion: ctx.proyeccion_2027,
        // `simulacion` y `sensibilidad` son las claves del archivo; el
        // cargador genérico ya no las renombra.
        sim: proyeccion.simulacion,
        sensibilidad: proyeccion.sensibilidad,
        metaProyeccion: proyeccion.meta,
        dip: dip,
        meta: elec.meta,
      };
      const vista = Object.assign({}, datos);
      vista.municipios = T.conectarFiltros(datos, (mun) => {
        vista.municipios = mun;
        pintar(vista);
      });
      pintar(vista);
    }).catch((err) => {
      console.error('historico:', err);
      document.getElementById('contenido').innerHTML =
        '<p class="text-small">No se pudieron cargar los resultados históricos.</p>';
    });
  });

  const color = (bloque) => `var(${window.Electoral.color(bloque)})`;

  /* Integración del Congreso. Es DATO oficial —transcrito del acuerdo
     CG/116/2024 del IEEC— y no un cálculo nuestro. Nuestro cálculo aparece
     como comprobación cruzada, que es un papel distinto: no aporta el
     número, aporta confianza en que la fórmula está bien implementada. */
  function panelCongreso(dip) {
    if (!dip) return '';
    const o = dip.oficial;
    const x = dip.comprobacion_cruzada;
    const lim = dip.limites;
    const filas = Object.entries(o.partidos)
      .filter(([, v]) => v.mr || v.rp)
      .sort((a, b) => (b[1].mr + b[1].rp) - (a[1].mr + a[1].rp));
    const maxTot = filas[0][1].mr + filas[0][1].rp;

    return `
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="landmark"></i> Integración del Congreso — LXV Legislatura
          ${P.badge('dato', { fuente: `IEEC — Acuerdo ${o.acuerdo}`,
                              fechaCorte: '2024-09' })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          ${T.num(dip.metadata.reglas.escanos_mr)} diputaciones de mayoría
          relativa y ${T.num(dip.metadata.reglas.escanos_rp)} de representación
          proporcional, conforme al artículo
          ${dip.metadata.reglas.articulo_integracion} de la Ley de
          Instituciones. El reparto de RP no lo calculamos nosotros: está
          transcrito del acuerdo ${T.escapar(o.acuerdo)}, emitido tras las
          sentencias del Tribunal Electoral del Estado.
        </p>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Partido</th>
                <th class="num">MR</th>
                <th class="num">Directa</th>
                <th class="num">Cociente</th>
                <th class="num">Resto</th>
                <th class="num">RP</th>
                <th class="num">Total</th>
                <th>Peso en el Congreso</th>
              </tr>
            </thead>
            <tbody>
              ${filas.map(([p, v]) => `
                <tr>
                  <td><strong>${T.escapar(p)}</strong>
                      <span class="text-small">${T.pct(v.votos / o.votacion_valida_emitida * 100)}</span></td>
                  <td class="num">${v.mr}</td>
                  <td class="num">${v.directa}</td>
                  <td class="num">${v.cociente}</td>
                  <td class="num">${v.resto}</td>
                  <td class="num">${v.rp}</td>
                  <td class="num"><strong>${v.mr + v.rp}</strong></td>
                  <td>${T.barra(v.mr + v.rp, maxTot, String(v.mr + v.rp))}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <td class="num">${o.mr_total}</td>
                <td class="num">${filas.reduce((a, [, v]) => a + v.directa, 0)}</td>
                <td class="num">${filas.reduce((a, [, v]) => a + v.cociente, 0)}</td>
                <td class="num">${filas.reduce((a, [, v]) => a + v.resto, 0)}</td>
                <td class="num">${o.rp_total}</td>
                <td class="num"><strong>${dip.total_escanos}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="panel__nota">
          <strong>El orden del reparto importa.</strong> El artículo 573 asigna
          primero <em>una</em> diputación directa a cada partido que superó el
          ${dip.metadata.reglas.umbral_pct}% de la votación válida emitida —
          ${filas.filter(([, v]) => v.directa).length} partidos, ${
            filas.reduce((a, [, v]) => a + v.directa, 0)} escaños—, y sólo
          después reparte las ${o.diputaciones_pendientes_tras_directa}
          restantes por cociente natural y resto mayor. El cociente
          (${T.num(o.cociente_natural)}) se calcula sobre las pendientes, no
          sobre las ${dip.metadata.reglas.escanos_rp}.
        </p>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Límites constitucionales
        </h4>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla tabla--compacta">
            <thead>
              <tr>
                <th>Partido</th>
                <th class="num">% votación</th>
                <th class="num">% del Congreso</th>
                <th class="num">Tope (+8)</th>
                <th class="num">Piso (−8)</th>
                <th>¿Rebasa?</th>
              </tr>
            </thead>
            <tbody>
              ${lim.detalle.map((f) => `
                <tr>
                  <td><strong>${T.escapar(f.partido)}</strong></td>
                  <td class="num">${T.pct(f.pct_vee)}</td>
                  <td class="num">${T.pct(f.pct_congreso)}</td>
                  <td class="num">${T.pct(f.tope_pct)}</td>
                  <td class="num">${T.pct(f.piso_pct)}</td>
                  <td>${f.excede_tope || f.bajo_piso || f.excede_21
                    ? '<strong>sí</strong>' : 'no'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Ningún partido rebasa los tres límites del artículo 575. El más
          cercano al tope es MORENA. Esta comprobación sólo es posible porque
          el acuerdo atribuye los triunfos de mayoría <em>por partido</em>: los
          cómputos los dan por bloque de coalición, y con eso solo no se puede
          hacer la prueba.
        </p>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Comprobación cruzada
        </h4>
        <p class="tarjeta__texto" style="max-width:78ch">
          La misma fórmula, aplicada a nuestros archivos de cómputo, reparte
          las ${dip.metadata.reglas.escanos_rp} diputaciones
          <strong>${x.reparto_rp_coincide ? 'igual' : 'distinto'}</strong> que
          el acuerdo — y eso que parte de cifras distintas: nuestros archivos
          son previos a las sentencias y dan
          ${T.num(x.vve_calculada)} votos válidos contra los
          ${T.num(x.vve_oficial)} del acuerdo,
          ${T.num(Math.abs(x.diferencia_votos))} menos por los recuentos.
          Que el reparto salga igual partiendo de datos distintos es lo que
          dice que la fórmula está bien implementada.
        </p>
        ${P.pie({
          fuente: `IEEC — Acuerdo ${o.acuerdo}, ${o.sesion}`,
          fechaCorte: '2024-09',
          metodologia: `${dip.metadata.reglas.formula}. Umbral ${
            dip.metadata.reglas.umbral_pct}% sobre ${dip.metadata.reglas.umbral_base} `
            + `(art. ${dip.metadata.reglas.articulo_umbral}); cociente sobre ${
            dip.metadata.reglas.cociente_base} entre ${dip.metadata.reglas.cociente_divisor}.`,
          cobertura: `${dip.total_escanos} diputaciones`,
          confianza: 'alta',
        })}
      </section>`;
  }

  function pintar(d) {
    const mun = d.municipios;
    const proy = d.proyeccion;
    const sim = d.sim;
    const sens = d.sensibilidad;
    const g2021 = d.historico.procesos.find((p) => p.anio === 2021);

    // ── Agregado de 2024 ──
    // La suma y el ganador salen de Electoral.agregar(): es la misma función
    // que usa el resumen estatal de cartografia.html. Dos páginas que
    // respondan "quién ganó" con código propio acaban dando números distintos.
    const ag = E.agregar(mun);
    const { bloques, partidos, orden, ordenPartidos,
            validos, nulos, total, lista } = ag;
    const participacion = ag.participacion;

    // clave de contendiente -> bloque que lo integra, según metadata.bloques
    // del pipeline. No se re-deduce aquí: la agrupación ya la decidió
    // build_electoral.py y duplicarla es invitarla a divergir.
    const bloqueDe = {};
    Object.entries(d.meta.bloques || {}).forEach(([b, def]) => {
      (def.integra || []).forEach((c) => { bloqueDe[c] = b; });
    });
    const nombrePartido = {};
    (d.meta.partidos || []).forEach((p) => { nombrePartido[p.clave] = p.nombre; });

    document.getElementById('aviso').innerHTML = '';

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('dato', { detalle: '2021 y 2024', fuente: 'IEEC', fechaCorte: '2024-06' }) +
      P.badge('estimacion', {
        detalle: `Monte Carlo, ${T.num(sim.iteraciones)} iteraciones`,
        confianza: proy.confianza,
        fuente: d.metaProyeccion.fuente_base,
        fechaCorte: d.metaProyeccion.fecha_corte,
      });

    document.getElementById('contenido').innerHTML = `

      <!-- ════ PASADO REGISTRADO ════ -->

      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="history"></i> Resultado de 2024
          <span class="badge badge--neutral">Pasado registrado</span>
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Diputaciones locales de mayoría relativa, cómputos distritales del
          IEEC. ${T.num(mun.length)} ${mun.length === 1 ? 'municipio' : 'municipios'},
          ${T.num(validos)} votos válidos.
        </p>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Participación', T.pct(participacion), 'calculo',
            { detalle: 'votación total ÷ lista nominal' })}
          ${T.cifra('Abstención', T.pct(100 - participacion), 'calculo',
            { detalle: '100 − participación' })}
          ${T.cifra('Voto nulo', T.pct(nulos / total * 100), 'calculo',
            { detalle: 'nulos ÷ votación total' })}
          ${T.cifra('Lista nominal', T.num(lista), 'dato',
            { fuente: 'Actas de cómputo IEEC', fechaCorte: '2024-06' })}
        </div>

        <div style="margin-top:var(--space-md)">
          ${T.cinta(Object.fromEntries(orden.slice(0, 5).map(([b, v]) =>
            [E.etiqueta(b), Math.round(v / validos * 1000) / 10])),
            orden.slice(0, 5).map(([b]) => color(b)))}
        </div>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fuerza</th>
                <th class="num">Votos</th>
                <th class="num">% de válidos</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              ${orden.map(([b, v]) => `
                <tr>
                  <td><span class="punto-color" style="background:${color(b)}"></span>
                      <strong>${T.escapar(E.etiqueta(b))}</strong></td>
                  <td class="num">${T.num(v)}</td>
                  <td class="num">${T.pct(v / validos * 100)}</td>
                  <td>${T.barra(v, orden[0][1], T.pct(v / validos * 100))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Cada fuerza suma el voto del partido y el de sus coaliciones. Leer sólo
          la columna del partido subestima su votación: en 2024 el voto por
          PT-PVEM-Morena en una sola marca fue mayor que el de los tres por
          separado.
        </p>
        ${P.pie({
          fuente: d.meta.fuente,
          fechaCorte: d.meta.fecha_corte,
          metodologia: 'Suma de los resultados seccionales, agrupados por bloque de coalición',
          confianza: 'alta',
        })}
      </section>

      <!-- ── Voto por contendiente ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="list-ordered"></i> Votos por partido y coalición
          ${P.badge('dato', { fuente: 'IEEC', fechaCorte: d.meta.fecha_corte })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Las ${T.num(ordenPartidos.length)} opciones tal como aparecieron en la
          boleta. Las combinaciones (PT-PVEM-Morena, PRI-PRD…) son marcas
          propias: el elector cruzó varios emblemas a la vez y ese voto no
          pertenece a ninguno de los partidos por separado. Por eso se listan
          aquí como opción y arriba se suman a su bloque.
        </p>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Contendiente</th>
                <th>Cuenta para</th>
                <th class="num">Votos</th>
                <th class="num">% de válidos</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              ${ordenPartidos.map(([c, v]) => `
                <tr>
                  <td><span class="punto-color" style="background:${color(bloqueDe[c])}"></span>
                      <strong>${T.escapar(c)}</strong>
                      <span class="text-small">${T.escapar(nombrePartido[c] || '')}</span></td>
                  <td class="text-small">${T.escapar(E.etiqueta(bloqueDe[c]))}</td>
                  <td class="num">${T.num(v)}</td>
                  <td class="num">${T.pct(v / validos * 100)}</td>
                  <td>${T.barra(v, ordenPartidos[0][1], T.pct(v / validos * 100))}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th colspan="2">Suma de contendientes</th>
                <th class="num">${T.num(ordenPartidos.reduce((a, [, v]) => a + v, 0))}</th>
                <th class="num">${T.pct(100)}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="panel__nota">
          La suma de los contendientes es exactamente la votación válida
          (${T.num(validos)}). Es la misma comprobación que hace
          <code>verificar()</code> en el pipeline antes de publicar: si no
          cuadrara, el archivo no se habría generado.
        </p>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">Por municipio</h4>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla tabla--compacta">
            <thead>
              <tr>
                <th>Municipio</th>
                ${ordenPartidos.map(([c]) => `<th class="num" title="${
                  T.escapar(nombrePartido[c] || c)}">${T.escapar(c)}</th>`).join('')}
                <th class="num">Válidos</th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong></td>
                  ${ordenPartidos.map(([c]) =>
                    `<td class="num">${T.num(m.votos[c] || 0)}</td>`).join('')}
                  <td class="num"><strong>${T.num(m.validos)}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${P.pie({
          fuente: d.meta.fuente,
          fechaCorte: d.meta.fecha_corte,
          metodologia: 'Suma de los resultados seccionales por contendiente. '
            + 'El partido de cada columna se identificó en el pipeline por el '
            + 'md5 de su emblema, no por la posición de la columna.',
          cobertura: d.meta.cobertura,
          confianza: 'alta',
        })}
      </section>

      ${panelCongreso(d.dip)}

      <!-- ── 2021 ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="git-branch"></i> Antes: gubernatura 2021
          <span class="badge badge--neutral">Pasado registrado</span>
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">${T.escapar(g2021.titular)}</p>

        <div style="margin-top:var(--space-md)">
          ${T.cinta(Object.fromEntries(g2021.resultados.map((r) => [r.etiqueta, r.pct])),
            g2021.resultados.map((r) => color(r.bloque)))}
        </div>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${g2021.resultados.map((r) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong style="color:${color(r.bloque)}">${T.escapar(r.etiqueta)}</strong>
                <span class="badge">${T.pct(r.pct)}</span>
              </header>
              <p class="tarjeta__texto">${T.escapar(r.candidatura)}</p>
            </article>`).join('')}
        </div>

        <p class="panel__nota">${T.escapar(g2021.nota)} ${T.escapar(d.historico.lectura)}</p>
        ${P.pie({ fuente: g2021.fuente, fechaCorte: g2021.fecha_corte, confianza: 'alta' })}
      </section>


      <!-- ════ MODELO ════ -->

      <section class="panel panel--proyeccion">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="trending-up"></i> Proyección ${proy.cargo} 2027
          ${P.badge('estimacion', {
            detalle: `Monte Carlo · ${T.num(sim.iteraciones)} iteraciones`,
            confianza: proy.confianza,
          })}
        </h3>

        <div class="aviso-simulado aviso-simulado--modelo">
          <i data-lucide="info"></i>
          <span><strong>Esto es un modelo, no un resultado.</strong>
          ${T.escapar(proy.advertencia)}</span>
        </div>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fuerza</th>
                <th>Rol</th>
                <th class="num">Intervalo estimado</th>
                <th class="num">Prob. de victoria</th>
                <th>Rango</th>
              </tr>
            </thead>
            <tbody>
              ${sim.fuerzas.map((s) => {
                // El análisis cualitativo (rol, figuras) sigue viniendo del
                // contexto capturado; los NÚMEROS vienen de la simulación. Los
                // rangos escritos a mano se retiraron: tener dos cifras para la
                // misma pregunta en la misma página es la forma más rápida de
                // que nadie se crea ninguna.
                const q = (proy.fuerzas || []).find((f) => f.bloque === s.bloque) || {};
                return `
                <tr>
                  <td><span class="punto-color" style="background:${color(s.bloque)}"></span>
                      <strong>${T.escapar(q.etiqueta || E.etiqueta(s.bloque))}</strong></td>
                  <td class="text-small">${T.escapar(q.rol || '—')}</td>
                  <td class="num">${T.intervalo(s.p50, s.p5, s.p95)}</td>
                  <td class="num">${T.pct(s.prob_victoria, 1)}</td>
                  <td>${T.barra(s.prob_victoria, 100, T.pct(s.prob_victoria, 1))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${proy.fuerzas.map((f) => {
            const s = sim.fuerzas.find((x) => x.bloque === f.bloque);
            return `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong style="color:${color(f.bloque)}">${T.escapar(f.etiqueta)}</strong>
                ${s ? `<span class="badge">${T.pct(s.p5, 0)} – ${T.pct(s.p95, 0)}</span>` : ''}
              </header>
              <p class="tarjeta__texto">${T.escapar(f.analisis)}</p>
              ${f.figuras.length ? `<p class="text-small">Figuras mencionadas:
                ${f.figuras.map(T.escapar).join(' · ')}</p>` : ''}
            </article>`;
          }).join('')}
        </div>

        <p class="panel__nota">
          <strong>La variable crítica.</strong> ${T.escapar(proy.variable_critica)}
        </p>

        <!-- ── Cuánto de esto es dato y cuánto es supuesto ── -->
        <h4 class="text-label" style="margin-top:var(--space-md)">
          Sensibilidad al supuesto de dispersión
        </h4>
        <p class="tarjeta__texto" style="max-width:78ch">
          La <strong>media</strong> de la simulación es el resultado real de
          2024. La <strong>dispersión</strong> no: sólo hay una transición
          observada (2021→2024) y con n=1 no se estima una varianza, se supone.
          Esta tabla corre el mismo modelo con distintos supuestos de σ para
          que se vea cuánto de la conclusión viene del dato y cuánto del
          supuesto.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla tabla--compacta">
            <thead>
              <tr>
                <th>σ del líder</th>
                ${sim.fuerzas.slice(0, 3).map((s) =>
                  `<th class="num">${T.escapar(E.etiqueta(s.bloque))}</th>`).join('')}
                <th class="num">Intervalo del líder</th>
              </tr>
            </thead>
            <tbody>
              ${sens.map((e) => `
                <tr${e.sigma_lider_pp === sim.sigma_lider_pp ? ' class="fila--activa"' : ''}>
                  <td><strong>${e.sigma_lider_pp} pp</strong>${
                    e.sigma_lider_pp === sim.sigma_lider_pp
                      ? ' <span class="text-small">(publicado)</span>' : ''}</td>
                  ${sim.fuerzas.slice(0, 3).map((s) =>
                    `<td class="num">${T.pct(e.prob_victoria[s.bloque], 1)}</td>`).join('')}
                  <td class="num">${e.p5_p95_lider[0]}–${e.p5_p95_lider[1]}%</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Entre el escenario más estable y el más volátil, la probabilidad de
          victoria del favorito va de
          ${T.pct(sens[0].prob_victoria[sim.fuerzas[0].bloque], 1)} a
          ${T.pct(sens[sens.length - 1].prob_victoria[sim.fuerzas[0].bloque], 1)}.
          Esa diferencia no sale de ningún dato: sale de cuánto se supone que
          puede moverse el electorado en tres años.
        </p>

        <h4 class="text-label" style="margin-top:var(--space-md)">Supuestos del modelo</h4>
        <ul class="lista-supuestos">
          ${proy.supuestos.map((s) => `<li>${T.escapar(s)}</li>`).join('')}
        </ul>

        ${P.pie({
          fuente: d.metaProyeccion.fuente_base,
          fechaCorte: d.metaProyeccion.fecha_corte,
          // El método completo, no "modelo propio": cuántas iteraciones, qué
          // distribución, qué semilla y qué intervalo se está enseñando. Sin
          // esto, "Estimación" es una etiqueta sin contenido.
          metodologia: `${d.metaProyeccion.metodo}, semilla ${sim.semilla}. `
            + `${d.metaProyeccion.distribucion} `
            + `El intervalo publicado es P5–P95 (90% de las iteraciones); `
            + `σ del bloque líder ${sim.sigma_lider_pp} pp `
            + `(κ Dirichlet ${sim.kappa_dirichlet}). `
            + `Error de Monte Carlo sobre la probabilidad: ±${sim.error_montecarlo_pp} pp.`,
          confianza: proy.confianza,
          cobertura: 'Entidad 04 · jornada del 6 de junio de 2027',
        })}
      </section>

      <!-- ── Del pasado al modelo ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="git-compare"></i> Qué cambia entre lo medido y lo proyectado
        </h3>
        <div class="tabla-caja">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fuerza</th>
                <th class="num">2021 gubernatura</th>
                <th class="num">2024 dip. locales</th>
                <th class="num">2027 proyectado</th>
              </tr>
            </thead>
            <tbody>
              ${proy.fuerzas.map((f) => {
                const h = g2021.resultados.find((r) => r.bloque === f.bloque);
                const v = bloques[f.bloque];
                return `
                <tr>
                  <td><span class="punto-color" style="background:${color(f.bloque)}"></span>
                      <strong>${T.escapar(f.etiqueta)}</strong></td>
                  <td class="num">${h ? T.pct(h.pct) : '—'}</td>
                  <td class="num">${v ? T.pct(v / validos * 100) : '—'}</td>
                  <td class="num">${T.intervalo((f.pct_bajo + f.pct_alto) / 2, f.pct_bajo, f.pct_alto)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Las tres columnas no son comparables sin cuidado: 2021 es gubernatura,
          2024 es diputaciones locales y 2027 es una estimación de gubernatura.
          Un cargo distinto mueve la participación y el voto diferenciado. La
          tabla sirve para ver la tendencia, no para restar columnas.
        </p>
        ${P.leyenda()}
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
