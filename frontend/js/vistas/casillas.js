/* Vista: Casillas por tipo INE.
   Básica, Contigua, Extraordinaria y Especial — la nomenclatura oficial.
   "Casilla normal" no existe en la normativa y no debe aparecer en la UI. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;

  const TIPOS = [
    { k: 'basica', nombre: 'Básica',
      def: 'Una por sección electoral. Es la casilla base del proceso.' },
    { k: 'contigua', nombre: 'Contigua',
      def: 'Se instala por cada 750 electores que exceden los primeros 750 de la sección.' },
    { k: 'extraordinaria', nombre: 'Extraordinaria',
      def: 'Cuando las condiciones geográficas, de infraestructura o socioculturales dificultan que los electores lleguen a la casilla de su sección.' },
    { k: 'especial', nombre: 'Especial',
      def: 'Para electores en tránsito fuera de su sección. Se fijan por distrito, no por municipio.' },
  ];

  document.addEventListener('DOMContentLoaded', () => {
    T.cargar().then((d) => {
      const vista = Object.assign({}, d);
      vista.municipios = T.conectarFiltros(d, (mun) => {
        vista.municipios = mun;
        pintar(vista);
      });
      pintar(vista);
    }).catch(() => {});
  });

  function pintar(d) {
    const mun = d.municipios;
    const tot = {};
    TIPOS.forEach((t) => { tot[t.k] = mun.reduce((a, m) => a + m.casillas[t.k], 0); });
    const totalGeneral = Object.values(tot).reduce((a, b) => a + b, 0);
    const listaNominal = mun.reduce((a, m) => a + m.lista_nominal, 0);
    const secciones = mun.reduce((a, m) => a + m.secciones, 0);

    document.getElementById('aviso').innerHTML = T.avisoSimulado(
      'La lista nominal, las secciones y el número de casillas son sintéticos: ' +
      'el INE no ha publicado los insumos del proceso 2027.'
    );

    document.getElementById('cabecera-pills').innerHTML =
      '<span class="badge badge--warn">2027 pendiente de aprobación oficial</span>' +
      P.badge('simulado');

    const colores = T.tokens(['--serie-1', '--serie-2', '--serie-4', '--serie-3']);

    document.getElementById('contenido').innerHTML = `

      <!-- Resumen estatal -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="vote"></i> Integración estatal</h3>
        <div class="rejilla-tarjetas">
          ${T.cifra('Casillas totales', T.num(totalGeneral), 'estimacion',
            { detalle: 'proceso comparable', confianza: 'baja' })}
          ${T.cifra('Secciones electorales', T.num(secciones), 'simulado')}
          ${T.cifra('Lista nominal', T.num(listaNominal), 'simulado')}
          ${T.cifra('Electores por casilla', T.num(Math.round(listaNominal / totalGeneral)), 'calculo',
            { detalle: 'lista nominal ÷ casillas' })}
        </div>

        <div style="margin-top:var(--space-md)">
          ${T.cinta(Object.fromEntries(TIPOS.map((t) =>
            [t.nombre, Math.round(tot[t.k] / totalGeneral * 1000) / 10])), colores)}
        </div>

        <p class="panel__nota">
          La distribución sigue las reglas de integración del INE: una básica por
          sección y una contigua por cada 750 electores excedentes. Las especiales
          se determinan por distrito y por eso se concentran en las dos ciudades.
        </p>
        ${P.leyenda(true)}
      </section>

      <!-- Definiciones -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="book-open"></i> Los cuatro tipos</h3>
        <div class="rejilla-tarjetas">
          ${TIPOS.map((t, i) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>${t.nombre}</strong>
                <span class="badge" style="color:${colores[i]}">${T.num(tot[t.k])}</span>
              </header>
              <p class="tarjeta__texto">${t.def}</p>
            </article>`).join('')}
        </div>
        <p class="panel__nota">
          Nomenclatura oficial del INE. El término "casilla normal" no existe en
          la normativa y no se usa en esta plataforma.
        </p>
      </section>

      <!-- Detalle municipal -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="table"></i> Detalle por municipio</h3>
        ${T.exportar('casillas por municipio')}
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th class="num">Lista nominal</th>
                <th class="num">Secciones</th>
                ${TIPOS.map((t) => `<th class="num">${t.nombre}</th>`).join('')}
                <th class="num">Total</th>
                <th class="num">Electores/casilla</th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong>
                      <span class="text-small"> ${T.escapar(m.cve_mun)}</span></td>
                  <td class="num">${T.num(m.lista_nominal)}</td>
                  <td class="num">${T.num(m.secciones)}</td>
                  ${TIPOS.map((t) => `<td class="num">${T.num(m.casillas[t.k])}</td>`).join('')}
                  <td class="num"><strong>${T.num(m.casillas.total)}</strong></td>
                  <td class="num">${T.num(Math.round(m.lista_nominal / m.casillas.total))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${P.pie({
          fuente: 'Cálculo sobre datos simulados. Universo municipal: INEGI Marco Geoestadístico 2024',
          fechaCorte: null,
          metodologia: 'Reglas de integración de casillas del INE aplicadas a una lista nominal sintética',
          confianza: 'baja',
        })}
      </section>

      <!-- 2027 -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="calendar-clock"></i> Proceso 2027</h3>
        <div class="aviso-simulado">
          <i data-lucide="alert-triangle"></i>
          <span><strong>Pendiente de aprobación oficial.</strong> El número y la
          ubicación de casillas de 2027 no existen todavía: dependen de los acuerdos
          del Consejo General del INE y del encarte del proceso. Las cifras de un
          proceso anterior <em>no</em> se reutilizan aquí como si fueran las de 2027.</span>
        </div>
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
