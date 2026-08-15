/* Vista: Casillas por tipo INE.
   Básica, Contigua, Extraordinaria y Especial — la nomenclatura oficial.
   "Casilla normal" no existe en la normativa y no debe aparecer en la UI.

   Las cifras salen del encarte del proceso 2023-2024: son las casillas que
   se instalaron, no una estimación. La lista nominal y la participación
   vienen de los cómputos del IEEC.

   Lo que 2024 NO dice es cuántas casillas habrá en 2027: eso depende de
   acuerdos del INE que todavía no existen. El panel de 2027 se queda
   vacío a propósito. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

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

  const FUENTE = 'INE — Encarte del Proceso Electoral Federal 2023-2024';
  const CORTE = '2024-06';

  document.addEventListener('DOMContentLoaded', () => {
    E.cargar().then((d) => {
      // conectarFiltros espera { municipios: [...] } con cve_mun y nombre.
      const todos = Object.values(d.municipios)
        .filter((m) => m.casillas_tipo)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun));

      const datos = { municipios: todos, meta: d.meta };
      const vista = Object.assign({}, datos);
      vista.municipios = T.conectarFiltros(datos, (mun) => {
        vista.municipios = mun;
        pintar(vista);
      });
      pintar(vista);
    }).catch((err) => {
      console.error('casillas:', err);
      document.getElementById('contenido').innerHTML =
        '<p class="text-small">No se pudieron cargar los datos de casillas.</p>';
    });
  });

  function pintar(d) {
    const mun = d.municipios;
    const suma = (f) => mun.reduce((a, m) => a + f(m), 0);

    const tot = {};
    TIPOS.forEach((t) => { tot[t.k] = suma((m) => m.casillas_tipo[t.k]); });
    const totalGeneral = suma((m) => m.casillas_tipo.total);
    const sitios = suma((m) => m.casillas_tipo.sitios);
    const listaNominal = suma((m) => m.lista_nominal);
    const secciones = suma((m) => m.casillas_tipo.secciones_con_casilla);
    const votaron = suma((m) => m.total);

    document.getElementById('aviso').innerHTML = '';

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('dato', { fuente: FUENTE, fechaCorte: CORTE }) +
      '<span class="badge badge--warn">2027 pendiente de aprobación oficial</span>';

    const colores = T.tokens(['--serie-1', '--serie-2', '--serie-4', '--serie-3']);
    const maxTotal = Math.max(...mun.map((m) => m.casillas_tipo.total));

    document.getElementById('contenido').innerHTML = `

      <!-- Resumen estatal -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="vote"></i> Integración instalada en 2024
        </h3>
        <div class="rejilla-tarjetas">
          ${T.cifra('Casillas instaladas', T.num(totalGeneral), 'dato',
            { fuente: FUENTE, fechaCorte: CORTE })}
          ${T.cifra('Sitios físicos', T.num(sitios), 'calculo',
            { detalle: 'domicilios distintos' })}
          ${T.cifra('Secciones con casilla', T.num(secciones), 'dato',
            { fuente: FUENTE, fechaCorte: CORTE })}
          ${T.cifra('Electores por casilla', T.num(Math.round(listaNominal / totalGeneral)), 'calculo',
            { detalle: 'lista nominal ÷ casillas' })}
        </div>

        <div style="margin-top:var(--space-md)">
          ${T.cinta(Object.fromEntries(TIPOS.map((t) =>
            [t.nombre, Math.round(tot[t.k] / totalGeneral * 1000) / 10])), colores)}
        </div>

        <p class="panel__nota">
          Una casilla no es un edificio: ${T.num(totalGeneral)} casillas se
          instalaron en ${T.num(sitios)} domicilios, porque la sección con
          muchos electores concentra varias contiguas en el mismo inmueble.
          De esos sitios, ${T.num(415)} pudieron ubicarse en el mapa cruzando
          el nombre del inmueble contra el catálogo CCT; los ${T.num(sitios - 415)}
          restantes no cruzaron y no se dibujan.
        </p>
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
          la normativa y no se usa en esta plataforma. El tipo se lee de la clave
          que trae el encarte: <code>B1</code>, <code>C1</code>, <code>E1</code>,
          <code>S1</code>.
        </p>
      </section>

      <!-- Detalle municipal -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="table"></i> Detalle por municipio</h3>
        ${T.exportar('casillas por municipio 2024')}
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th class="num">Lista nominal</th>
                <th class="num">Secciones</th>
                ${TIPOS.map((t) => `<th class="num">${t.nombre}</th>`).join('')}
                <th class="num">Total</th>
                <th class="num">Sitios</th>
                <th class="num">Electores/casilla</th>
                <th class="num">Participación</th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => {
                const c = m.casillas_tipo;
                return `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong>
                      <span class="text-small"> ${T.escapar(m.cve_mun)}</span></td>
                  <td class="num">${T.num(m.lista_nominal)}</td>
                  <td class="num">${T.num(c.secciones_con_casilla)}</td>
                  ${TIPOS.map((t) => `<td class="num">${T.num(c[t.k])}</td>`).join('')}
                  <td class="num">${T.barra(c.total, maxTotal, T.num(c.total))}</td>
                  <td class="num">${T.num(c.sitios)}</td>
                  <td class="num">${T.num(Math.round(m.lista_nominal / c.total))}</td>
                  <td class="num">${T.pct(m.participacion)}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th>Total estatal</th>
                <td class="num">${T.num(listaNominal)}</td>
                <td class="num">${T.num(secciones)}</td>
                ${TIPOS.map((t) => `<td class="num">${T.num(tot[t.k])}</td>`).join('')}
                <td class="num"><strong>${T.num(totalGeneral)}</strong></td>
                <td class="num">${T.num(sitios)}</td>
                <td class="num">${T.num(Math.round(listaNominal / totalGeneral))}</td>
                <td class="num">${T.pct(votaron / listaNominal * 100)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ${P.pie({
          fuente: FUENTE + ' · Lista nominal y participación: IEEC, cómputos distritales 2024',
          fechaCorte: CORTE,
          metodologia: 'Conteo directo de las casillas del encarte, clasificadas por la letra de su clave y agregadas por municipio',
          confianza: 'alta',
          cobertura: '13 municipios, 1,230 casillas',
        })}
      </section>

      <!-- 2027 -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="calendar-clock"></i> Proceso 2027</h3>
        <div class="aviso-simulado">
          <i data-lucide="alert-triangle"></i>
          <span><strong>Pendiente de aprobación oficial.</strong> El número y la
          ubicación de casillas de 2027 no existen todavía: dependen de los acuerdos
          del Consejo General del INE y del encarte del proceso. Lo de arriba es
          <em>2024</em>, y se publica como tal. Las cifras de un proceso anterior
          <em>no</em> se reutilizan aquí como si fueran las de 2027.</span>
        </div>
        <p class="panel__nota">
          Lo que 2024 sí permite anticipar es el orden de magnitud y dónde se
          concentra la operación: dos de cada tres casillas del estado están en
          Campeche y Carmen.
        </p>
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
