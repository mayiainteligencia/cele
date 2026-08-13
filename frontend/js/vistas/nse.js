/* Vista: Nivel socioeconómico.

   La spec exige distinguir cuatro cosas que suelen confundirse:
     1. indicadores observados del INEGI
     2. índices públicos de marginación (CONAPO)
     3. NSE estimado por metodología propia   <- lo único que hay aquí
     4. NSE AMAI, que requiere licencia       <- no está y no se simula

   Toda estimación muestra metodología, fecha, confianza y cobertura. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;

  const ORIGENES = [
    { titulo: 'Indicadores observados', fuente: 'INEGI — Censo de Población y Vivienda',
      estado: 'pendiente',
      texto: 'Vivienda, escolaridad, servicios y ocupación medidos directamente. No están cargados.' },
    { titulo: 'Índice de marginación', fuente: 'CONAPO',
      estado: 'pendiente',
      texto: 'Índice público a nivel municipal y por localidad. No está cargado.' },
    { titulo: 'NSE estimado propio', fuente: 'Modelo interno',
      estado: 'presente',
      texto: 'Lo que se muestra en esta pantalla. Estimación sobre un proxy de ruralidad derivado del catálogo CCT.' },
    { titulo: 'NSE AMAI', fuente: 'AMAI — requiere licencia',
      estado: 'sin-licencia',
      texto: 'La regla AMAI 2022 es propietaria. No se usa ni se aproxima: sin licencia, no se publica.' },
  ];

  document.addEventListener('DOMContentLoaded', () => {
    T.cargar().then(pintar).catch(() => {});
  });

  function pintar(d) {
    const mun = d.municipios;
    const cortes = d.nse_cortes;
    const colores = T.tokens(T.COLORES_ESCALA.concat(['--serie-7']));

    // Distribución estatal: promedio ponderado por población.
    const poblacion = mun.reduce((a, m) => a + m.poblacion, 0);
    const estatal = {};
    cortes.forEach((c) => {
      estatal[c] = Math.round(
        mun.reduce((a, m) => a + m.nse[c] * m.poblacion, 0) / poblacion * 10
      ) / 10;
    });

    document.getElementById('aviso').innerHTML = T.avisoSimulado(
      'La distribución socioeconómica es una estimación de demostración construida ' +
      'sobre un proxy de ruralidad, no sobre datos de ingreso ni de vivienda.'
    );

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('estimacion', { confianza: 'baja' }) + P.badge('simulado');

    document.getElementById('contenido').innerHTML = `

      <!-- De dónde puede venir un NSE -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="git-branch"></i> Cuatro orígenes distintos</h3>
        <div class="rejilla-tarjetas">
          ${ORIGENES.map((o) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>${o.titulo}</strong>
                ${o.estado === 'presente' ? P.badge('estimacion')
                  : o.estado === 'sin-licencia' ? '<span class="badge badge--danger">Sin licencia</span>'
                  : '<span class="badge badge--warn">Pendiente</span>'}
              </header>
              <p class="tarjeta__texto">${o.texto}</p>
              ${P.pie({ fuente: o.fuente })}
            </article>`).join('')}
        </div>
        <p class="panel__nota">
          Mezclar estos cuatro en una sola cifra es el error más común al hablar de
          nivel socioeconómico. Aquí sólo el tercero tiene datos, y va etiquetado
          como estimación en todas las tablas.
        </p>
      </section>

      <!-- Distribución estatal -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="layers-3"></i> Distribución estatal estimada</h3>
        ${T.cinta(estatal, colores)}
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${cortes.map((c, i) => `
            <div class="cifra">
              <span class="cifra__valor">${estatal[c].toFixed(1)} %</span>
              <span class="cifra__etiqueta">
                <span class="punto-escala" style="background:${colores[i]}"></span>
                Nivel ${T.escapar(c)}
              </span>
            </div>`).join('')}
        </div>
        ${P.pie({
          fuente: 'Modelo interno de demostración',
          fechaCorte: null,
          metodologia: 'Distribución sintética modulada por un índice de ruralidad derivado de la proporción de planteles CONAFE y comunitarios del catálogo CCT. Ponderación estatal por población simulada.',
          confianza: 'baja',
          cobertura: '13 de 13 municipios',
        })}
      </section>

      <!-- Detalle municipal -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="table"></i> Detalle por municipio</h3>
        ${T.exportar('NSE por municipio')}
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th class="num">Ruralidad</th>
                ${cortes.map((c) => `<th class="num">${T.escapar(c)}</th>`).join('')}
                <th style="min-width:180px">Distribución</th>
                <th>Procedencia</th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong>
                      <span class="text-small"> ${T.escapar(m.cve_mun)}</span></td>
                  <td class="num">${T.pct(m.indice_ruralidad * 100)}</td>
                  ${cortes.map((c) => `<td class="num">${m.nse[c].toFixed(1)}</td>`).join('')}
                  <td>${T.cinta(m.nse, colores)}</td>
                  <td>${P.badge('estimacion', { compacto: true, confianza: 'baja' })}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          El índice de ruralidad sí se calcula sobre datos reales: es la proporción
          de planteles CONAFE y de servicio comunitario sobre el total de registros
          CCT del municipio. Es un proxy, no una medición de ingreso.
        </p>
        ${P.leyenda(true)}
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
