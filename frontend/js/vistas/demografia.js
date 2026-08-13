/* Vista: Demografía y lista nominal.

   Regla de la spec: población y características socioeconómicas son del
   INEGI; lista nominal, secciones, casillas y resultados son del INE/IEEC.
   No se mezclan en la misma cifra. Aquí van en dos bloques separados, con
   su propia cabecera de origen, y el único número que los cruza está
   marcado como CÁLCULO. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;

  document.addEventListener('DOMContentLoaded', () => {
    T.cargar().then(pintar).catch(() => {});
  });

  function pintar(d) {
    const mun = d.municipios;
    const poblacion = mun.reduce((a, m) => a + m.poblacion, 0);
    const lista = mun.reduce((a, m) => a + m.lista_nominal, 0);
    const escuelas = mun.reduce((a, m) => a + m.escuelas_cct, 0);
    const alumnado = mun.reduce((a, m) => a + m.alumnado_cct, 0);
    const maxPob = Math.max(...mun.map((m) => m.poblacion));

    document.getElementById('aviso').innerHTML = T.avisoSimulado(
      'La población y la lista nominal son sintéticas: el reparto entre municipios ' +
      'sigue la proporción del alumnado CCT real y el total se ancla a un orden de ' +
      'magnitud plausible.'
    );

    document.getElementById('cabecera-pills').innerHTML =
      '<span class="badge badge--info">INEGI y INE separados</span>' + P.badge('simulado');

    document.getElementById('contenido').innerHTML = `

      <div class="rejilla-2">

        <!-- ── Bloque INEGI ── -->
        <section class="panel panel--inegi">
          <h3 class="text-h3 panel__titulo">
            <i data-lucide="users-round"></i> Demografía
            <span class="badge badge--neutral">Origen: INEGI</span>
          </h3>
          <div class="rejilla-tarjetas">
            ${T.cifra('Población estatal', T.num(poblacion), 'simulado')}
            ${T.cifra('Municipios', '13', 'dato',
              { fuente: 'INEGI Marco Geoestadístico 2024', fechaCorte: '2024-08' })}
            ${T.cifra('Localidades amanzanadas', '511', 'dato',
              { fuente: 'INEGI Marco Geoestadístico 2024', fechaCorte: '2024-08' })}
            ${T.cifra('AGEB', '723', 'dato',
              { detalle: '473 urbanas · 250 rurales',
                fuente: 'INEGI Marco Geoestadístico 2024', fechaCorte: '2024-08' })}
          </div>
          <p class="panel__nota">
            El universo geográfico es real y verificado. La cifra de población es
            de demostración: el Censo no está cargado todavía.
          </p>
          ${P.pie({
            fuente: 'INEGI — Marco Geoestadístico 2024 (geografía) · simulación propia (población)',
            fechaCorte: '2024-08',
            cobertura: '13 municipios',
          })}
        </section>

        <!-- ── Bloque INE ── -->
        <section class="panel panel--ine">
          <h3 class="text-h3 panel__titulo">
            <i data-lucide="vote"></i> Padrón y lista nominal
            <span class="badge badge--warn">Origen: INE — pendiente</span>
          </h3>
          <div class="rejilla-tarjetas">
            ${T.cifra('Lista nominal', T.num(lista), 'simulado')}
            ${T.cifra('Secciones electorales', T.num(mun.reduce((a, m) => a + m.secciones, 0)), 'simulado')}
            ${T.cifra('Casillas', T.num(mun.reduce((a, m) => a + m.casillas.total, 0)), 'simulado')}
            ${T.cifra('Cobertura de lista', T.pct(lista / poblacion * 100), 'calculo',
              { detalle: 'lista ÷ población' })}
          </div>
          <p class="panel__nota">
            Ninguna cifra de este bloque proviene del INE todavía. El acceso al
            portal está en gestión; cuando llegue, estas tarjetas cambian de
            <em>Simulado</em> a <em>Dato</em> sin tocar el componente.
          </p>
          ${P.pie({
            fuente: 'Pendiente — INE / IEEC',
            fechaCorte: null,
            metodologia: 'Lista nominal simulada como 66–72 % de la población sintética',
            confianza: 'baja',
          })}
        </section>
      </div>

      <!-- ── Lo que sí es real ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="school"></i> Infraestructura educativa
          <span class="badge badge--success">Origen: SEP</span>
        </h3>
        <div class="rejilla-tarjetas">
          ${T.cifra('Registros CCT', T.num(escuelas), 'dato',
            { fuente: 'SEP — Catálogo de Centros de Trabajo' })}
          ${T.cifra('Sitios físicos', '1,482', 'calculo',
            { detalle: 'coordenadas únicas', fuente: 'SEP — CCT' })}
          ${T.cifra('Alumnado registrado', T.num(alumnado), 'dato',
            { fuente: 'SEP — Catálogo de Centros de Trabajo' })}
          ${T.cifra('Alumnado por plantel', T.num(Math.round(alumnado / escuelas)), 'calculo',
            { detalle: 'alumnado ÷ registros' })}
        </div>
        <p class="panel__nota">
          Este bloque sí sale de una fuente. El catálogo CCT no declara fecha de
          corte, así que no se le inventa una. Un plantel con dos turnos cuenta
          como dos registros y un solo sitio físico: para hablar de casillas se
          usan los 1,482 sitios, no los 2,274 registros.
        </p>
        ${P.pie({
          fuente: 'SEP — Catálogo de Centros de Trabajo, vía Google My Maps',
          fechaCorte: null,
          cobertura: '2,274 registros en 13 municipios',
        })}
      </section>

      <!-- ── Tabla municipal ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="table"></i> Detalle por municipio</h3>
        ${T.exportar('demografía por municipio')}
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th>Cabecera</th>
                <th class="num">Población <span class="badge badge--neutral">INEGI</span></th>
                <th>Distribución</th>
                <th class="num">Lista nominal <span class="badge badge--warn">INE</span></th>
                <th class="num">Cobertura</th>
                <th class="num">Escuelas <span class="badge badge--success">SEP</span></th>
                <th class="num">Alumnado <span class="badge badge--success">SEP</span></th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong>
                      <span class="text-small"> ${T.escapar(m.cve_mun)}</span></td>
                  <td>${T.escapar(m.cabecera)}</td>
                  <td class="num">${T.num(m.poblacion)}</td>
                  <td>${T.barra(m.poblacion, maxPob, T.pct(m.poblacion / poblacion * 100))}</td>
                  <td class="num">${T.num(m.lista_nominal)}</td>
                  <td class="num">${T.pct(m.lista_nominal / m.poblacion * 100)}</td>
                  <td class="num">${T.num(m.escuelas_cct)}</td>
                  <td class="num">${T.num(m.alumnado_cct)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Las columnas llevan su origen en la cabecera a propósito: población e
          infraestructura no vienen de la misma fuente que la lista nominal, y
          sumarlas o compararlas sin decirlo sería un error de lectura.
        </p>
        ${P.leyenda(true)}
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
