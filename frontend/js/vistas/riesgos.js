/* Vista: Grafo de riesgos — fiscalización externa por municipio.

   Dos advertencias que van en pantalla y no sólo en el código:

   1. Una observación de auditoría NO es una sanción. Un pliego de
      observaciones inicia un procedimiento; no lo resuelve. El conteo no dice
      que haya habido un daño ni quién lo causó.

   2. Esto NO es gasto de campaña. Es fiscalización sobre el ejercicio de
      recursos públicos municipales, que es otra cosa aunque las dos sean
      dinero. Por eso vive aquí y no en Finanzas. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  document.addEventListener('DOMContentLoaded', () => {
    E.cargarAuditoria().then(pintar).catch((err) => {
      console.error('riesgos:', err);
      document.getElementById('auditoria').innerHTML =
        '<p class="text-small">No se pudieron cargar los datos de fiscalización.</p>';
    });
  });

  const TIPOS = {
    ayuntamiento: 'Ayuntamiento',
    organismo_municipal: 'Organismo municipal (DIF, agua potable)',
    estatal: 'Entidad estatal',
  };

  function pintar(d) {
    const m = d.meta;
    const mun = Object.values(d.por_municipio)
      .sort((a, b) => b.observaciones - a.observaciones);
    const total = mun.reduce((a, x) => a + x.observaciones, 0);
    const maxObs = mun.length ? mun[0].observaciones : 1;

    document.getElementById('auditoria').innerHTML = `
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="file-search"></i> Fiscalización externa por municipio
          ${P.badge('dato', { fuente: m.fuente, fechaCorte: m.fecha_corte })}
        </h3>

        <div class="aviso-simulado">
          <i data-lucide="scale"></i>
          <span><strong>Una observación no es una sanción, ni una
          sentencia.</strong> Un pliego de observaciones inicia un
          procedimiento; no lo resuelve. El conteo no dice que haya habido un
          daño, y menos aún quién lo causó.</span>
        </div>

        <p class="tarjeta__texto" style="max-width:78ch">
          ${T.num(total)} observaciones sobre entidades municipales en las
          cuentas públicas de ${T.escapar(m.cuentas_publicas.join(' y ')
            .replace(/Cuentas Públicas /g, ''))}.
          ${T.escapar(m.no_es_gasto_de_campana)}
        </p>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th class="num">Observaciones</th>
                <th class="num">Ayuntamiento</th>
                <th class="num">Organismos</th>
                <th class="num">Entidades</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((x) => `
                <tr>
                  <td><strong>${T.escapar(x.nombre)}</strong>
                      <span class="text-small">${T.escapar(x.cve_mun)}</span></td>
                  <td class="num"><strong>${x.observaciones}</strong></td>
                  <td class="num">${x.por_tipo.ayuntamiento || 0}</td>
                  <td class="num">${x.por_tipo.organismo_municipal || 0}</td>
                  <td class="num">${x.entidades.length}</td>
                  <td>${T.barra(x.observaciones, maxObs, String(x.observaciones))}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th>Total municipal</th>
                <td class="num"><strong>${T.num(total)}</strong></td>
                <td class="num">${m.conteo_por_tipo.ayuntamiento || 0}</td>
                <td class="num">${m.conteo_por_tipo.organismo_municipal || 0}</td>
                <td class="num"></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="panel__nota">
          <strong>El conteo no ordena por gravedad.</strong> Una observación
          sobre un municipio chico pesa distinto que sobre uno grande, y una
          observación de trámite pesa distinto que una de fondo. Esta tabla
          cuenta expedientes, no mide daño: para eso hay que leer cada uno.
        </p>

        <p class="panel__nota">
          <strong>Cómo se asigna el municipio.</strong>
          ${T.escapar(m.clasificacion)} ${T.escapar(m.cruce)}
          Las ${m.conteo_por_tipo.estatal} observaciones sobre entidades
          estatales quedan fuera del reparto municipal.
        </p>

        ${P.pie({
          fuente: m.fuente,
          fechaCorte: m.fecha_corte,
          metodologia: 'Conteo de observaciones por entidad fiscalizada, '
            + 'clasificadas por tipo de entidad y agregadas al municipio por '
            + 'nombre normalizado. Descarga con TLS verificado: '
            + m.tls.solucion,
          cobertura: `${m.cuentas_publicas.join(' · ')} · ${mun.length} municipios`,
          confianza: 'alta',
        })}
      </section>

      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="circle-slash"></i> Fuentes que no se pudieron usar
        </h3>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${Object.entries(m.vias_descartadas).map(([k, v]) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>${T.escapar(k.replace(/_/g, ' '))}</strong>
                <span class="badge badge--warn">no disponible</span>
              </header>
              <p class="tarjeta__texto">${T.escapar(v)}</p>
            </article>`).join('')}
        </div>
        <p class="panel__nota">
          <strong>El certificado de ASECAM está incompleto.</strong>
          ${T.escapar(m.tls.problema)} ${T.escapar(m.tls.solucion)}
          ${T.escapar(m.tls.lo_que_no_se_hizo)}
        </p>
      </section>
    `;

    P.iconos();
    if (window.lucide) window.lucide.createIcons();
  }
})();
