/* Vista: Fuentes y trazabilidad.

   Esta página estaba escrita a mano y citaba un solo archivo —el mock que
   murió en la Fase 2— mientras el sistema servía veintitrés. Ahora se genera
   de la metadata de cada archivo publicado, así que no puede quedarse vieja
   sin que se note: si un pipeline deja de declarar su fuente, aparece aquí
   en la lista de faltantes. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;

  document.addEventListener('DOMContentLoaded', () => {
    fetch('data/fuentes.json')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(pintar)
      .catch((err) => {
        console.error('fuentes:', err);
        document.getElementById('contenido').innerHTML =
          '<p class="text-small">No se pudo cargar el manifiesto de fuentes.</p>';
      });
  });

  const kb = (b) => (b < 1024 ? b + ' B' : Math.round(b / 1024) + ' KB');

  function pintar(d) {
    const m = d.metadata;
    const conFalta = d.archivos.filter((a) => a.falta_declarar.length);
    const porFamilia = {};
    d.archivos.forEach((a) => {
      (porFamilia[a.familia] = porFamilia[a.familia] || []).push(a);
    });

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('calculo', { detalle: 'generado de la metadata de cada archivo' });

    document.getElementById('contenido').innerHTML = `

      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="database"></i> Todo lo que el sistema sirve
        </h3>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Archivos publicados', String(m.total_archivos), 'calculo')}
          ${T.cifra('Peso total', kb(m.total_bytes), 'calculo')}
          ${T.cifra('Pipelines', String(m.pipelines.length), 'calculo')}
          ${T.cifra('Con algo sin declarar', String(m.archivos_con_faltantes),
            'calculo', { detalle: 'de ' + m.total_archivos })}
        </div>
        <p class="panel__nota">
          <strong>Por qué se genera y no se escribe.</strong>
          ${T.escapar(m.por_que_generado)}
        </p>
      </section>

      ${Object.entries(m.familias).filter(([f]) => porFamilia[f]).map(([f, et]) => `
        <section class="panel">
          <h3 class="text-h3 panel__titulo">
            <i data-lucide="folder"></i> ${T.escapar(et)}
            <span class="badge badge--neutral">${porFamilia[f].length} archivos ·
              ${kb(porFamilia[f].reduce((a, x) => a + x.bytes, 0))}</span>
          </h3>
          <div class="tabla-caja" style="margin-top:var(--space-md)">
            <table class="tabla tabla--compacta">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Fuente declarada</th>
                  <th class="num">Corte</th>
                  <th>Procedencia</th>
                  <th>Generado por</th>
                  <th class="num">Peso</th>
                </tr>
              </thead>
              <tbody>
                ${porFamilia[f].sort((a, b) => b.bytes - a.bytes).map((a) => `
                  <tr${a.falta_declarar.length ? ' class="fila--atenuada"' : ''}>
                    <td><strong>${T.escapar(a.archivo.split('/').pop())}</strong>
                      ${a.que_es ? `<br><span class="text-small">${
                        T.escapar(a.que_es.slice(0, 110))}</span>` : ''}</td>
                    <td class="text-small">${a.fuente
                      ? T.escapar(a.fuente)
                      : '<em>no declarada</em>'}</td>
                    <td class="num">${a.fecha_corte
                      ? T.escapar(a.fecha_corte)
                      : '<span class="text-small">—</span>'}</td>
                    <td>${a.procedencia
                      ? P.badge(a.procedencia, { compacto: true })
                      : '<span class="text-small">—</span>'}</td>
                    <td class="text-small">${a.generado_por
                      ? T.escapar(a.generado_por.split('/').pop())
                      : '<em>captura manual</em>'}</td>
                    <td class="num">${kb(a.bytes)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </section>`).join('')}

      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="clipboard-list"></i> Lo que falta declarar
          <span class="badge badge--warn">${conFalta.length} de ${m.total_archivos}</span>
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          ${T.escapar(m.lo_que_no_hace)} Este listado es la auditoría del propio
          sistema sobre sí mismo: cada línea es un pipeline al que le falta
          declarar algo.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr><th>Archivo</th><th>No declara</th></tr>
            </thead>
            <tbody>
              ${conFalta.map((a) => `
                <tr>
                  <td>${T.escapar(a.archivo)}</td>
                  <td class="text-small">${a.falta_declarar.map(T.escapar).join(' · ')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Un campo declarado como <code>null</code> —por ejemplo la fecha de
          corte del catálogo CCT, que la SEP no publica— <strong>no</strong>
          cuenta como faltante: es una respuesta, no un hueco.
        </p>
      </section>

      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="terminal"></i> Los pipelines
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Cada uno lee su crudo de <code>backend/datalab/uploads/</code> y
          escribe en <code>frontend/data/</code>. Todos traen
          <code>--autocomprobar</code>.
        </p>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${m.pipelines.map((p) => {
            const salidas = d.archivos.filter(
              (a) => a.generado_por && a.generado_por.endsWith(p));
            return `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>${T.escapar(p)}</strong>
                <span class="badge">${salidas.length}</span>
              </header>
              <p class="tarjeta__texto text-small">${salidas.length
                ? salidas.map((s) => T.escapar(s.archivo)).join('<br>')
                : '<em>no publica archivo propio</em>'}</p>
            </article>`;
          }).join('')}
        </div>
        ${m.fuera_de_la_capa_servida.length ? `
          <p class="panel__nota">
            <strong>Fuera de la capa servida:</strong>
            ${m.fuera_de_la_capa_servida.map(T.escapar).join(', ')}. Queda
            listado para que su presencia sea visible, no omitido.
          </p>` : ''}
        ${P.pie({
          fuente: 'Metadata declarada por cada pipeline',
          fechaCorte: null,
          metodologia: T.escapar(m.como_se_lee_la_fuente),
          confianza: 'alta',
          cobertura: `${m.total_archivos} archivos · ${m.pipelines.length} pipelines`,
        })}
      </section>
    `;

    P.iconos();
    if (window.lucide) window.lucide.createIcons();
  }
})();
