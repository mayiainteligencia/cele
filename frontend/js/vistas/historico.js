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
    Promise.all([T.cargar(), E.cargar()]).then(([ctx, elec]) => {
      const todos = Object.values(elec.municipios)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun));
      const datos = {
        municipios: todos,
        historico: ctx.historico,
        proyeccion: ctx.proyeccion_2027,
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

  function pintar(d) {
    const mun = d.municipios;
    const proy = d.proyeccion;
    const g2021 = d.historico.procesos.find((p) => p.anio === 2021);

    // ── Agregado estatal de 2024, desde los cómputos ──
    const bloques = {};
    let validos = 0, nulos = 0, total = 0, lista = 0;
    mun.forEach((m) => {
      Object.entries(m.bloques).forEach(([b, v]) => {
        bloques[b] = (bloques[b] || 0) + v;
      });
      validos += m.validos; nulos += m.nulos; total += m.total; lista += m.lista_nominal;
    });
    const orden = Object.entries(bloques)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const participacion = lista ? total / lista * 100 : 0;

    document.getElementById('aviso').innerHTML = '';

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('dato', { detalle: '2021 y 2024', fuente: 'IEEC', fechaCorte: '2024-06' }) +
      P.badge('estimacion', { detalle: 'proyección con intervalo', confianza: proy.confianza });

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
          ${P.badge('estimacion', { confianza: proy.confianza })}
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
              ${proy.fuerzas.map((f) => {
                const centro = (f.pct_bajo + f.pct_alto) / 2;
                return `
                <tr>
                  <td><span class="punto-color" style="background:${color(f.bloque)}"></span>
                      <strong>${T.escapar(f.etiqueta)}</strong></td>
                  <td class="text-small">${T.escapar(f.rol)}</td>
                  <td class="num">${T.intervalo(centro, f.pct_bajo, f.pct_alto)}</td>
                  <td class="num">${T.pct(f.prob_victoria, 0)}</td>
                  <td>${T.barra(f.prob_victoria, 100, T.pct(f.prob_victoria, 0))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${proy.fuerzas.map((f) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong style="color:${color(f.bloque)}">${T.escapar(f.etiqueta)}</strong>
                <span class="badge">${T.pct(f.pct_bajo, 0)} – ${T.pct(f.pct_alto, 0)}</span>
              </header>
              <p class="tarjeta__texto">${T.escapar(f.analisis)}</p>
              ${f.figuras.length ? `<p class="text-small">Figuras mencionadas:
                ${f.figuras.map(T.escapar).join(' · ')}</p>` : ''}
            </article>`).join('')}
        </div>

        <p class="panel__nota">
          <strong>La variable crítica.</strong> ${T.escapar(proy.variable_critica)}
        </p>

        <h4 class="text-label" style="margin-top:var(--space-md)">Supuestos del modelo</h4>
        <ul class="lista-supuestos">
          ${proy.supuestos.map((s) => `<li>${T.escapar(s)}</li>`).join('')}
        </ul>

        ${P.pie({
          fuente: proy.fuente,
          fechaCorte: proy.fecha_corte,
          metodologia: proy.metodologia,
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
