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
    Promise.all([E.cargar(), E.cargarCatalogo()]).then(([d, cat]) => {
      // conectarFiltros espera { municipios: [...] } con cve_mun y nombre.
      const todos = Object.values(d.municipios)
        .filter((m) => m.casillas_tipo)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun));

      const datos = { municipios: todos, meta: d.meta,
                      secciones: d.secciones, catalogo: cat };
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

      <!-- Proporcionalidad por distrito -->
      ${panelDistritos(d)}

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

  /* ── Proporcionalidad por distrito ──

     La tabla de arriba agrupa por municipio, que es una aproximación: el
     municipio no es la unidad con la que el INE reparte casillas. La unidad es
     la SECCIÓN, y las secciones se agrupan en distritos. Este panel ancla el
     cálculo a los distritos reales — los locales del propio cómputo, los
     federales del catálogo cartográfico del INE que trajo la Fase 1.

     El municipio no desaparece: sigue siendo la unidad de operación. Pero para
     preguntar si el reparto de casillas es proporcional al padrón, el distrito
     es la unidad correcta. */

  function panelDistritos(d) {
    if (!d.secciones) return '';

    const local = E.porDistrito(d.secciones, (s, r) => r.distrito_local);
    const federal = E.porDistrito(d.secciones,
      (s) => (d.catalogo.secciones[s] ? d.catalogo.secciones[s].distrito_federal : null));

    const tot = (f) => f.filas.reduce((a, g) => ({
      secciones: a.secciones + g.secciones,
      lista_nominal: a.lista_nominal + g.lista_nominal,
      normativas: a.normativas + g.normativas,
      casillas: a.casillas + g.casillas,
    }), { secciones: 0, lista_nominal: 0, normativas: 0, casillas: 0 });

    const tl = tot(local);
    const exactos = local.filas.filter((g) => g.diferencia === 0).length;
    const maxLN = Math.max(...local.filas.map((g) => g.lista_nominal));

    const fila = (g, etiqueta) => `
      <tr>
        <td><strong>${T.escapar(etiqueta)}</strong></td>
        <td class="num">${T.num(g.secciones)}</td>
        <td class="num">${T.barra(g.lista_nominal, maxLN, T.num(g.lista_nominal))}</td>
        <td class="num">${T.num(Math.round(g.electores_por_seccion))}</td>
        <td class="num">${T.num(g.normativas)}</td>
        <td class="num"><strong>${T.num(g.casillas)}</strong></td>
        <td class="num">${g.diferencia === 0 ? '—' : (g.diferencia > 0 ? '+' : '') + g.diferencia}</td>
        <td class="num">${T.num(Math.round(g.electores_por_casilla))}</td>
        <td class="num">${T.pct(g.participacion)}</td>
      </tr>`;

    const cabecera = `
      <thead>
        <tr>
          <th>Distrito</th>
          <th class="num">Secciones</th>
          <th class="num">Lista nominal</th>
          <th class="num">Electores/sección</th>
          <th class="num">Casillas normativas</th>
          <th class="num">Instaladas</th>
          <th class="num">Dif.</th>
          <th class="num">Electores/casilla</th>
          <th class="num">Participación</th>
        </tr>
      </thead>`;

    return `
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="scale"></i> Proporcionalidad de casillas por distrito
          ${P.badge('calculo', { detalle: 'LGIPE art. 253' })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          La ley reparte casillas por <strong>lista nominal de la sección</strong>,
          no por población ni por municipio: una casilla por cada
          ${E.ELECTORES_POR_CASILLA} electores o fracción, mínimo una por sección.
          Aquí esa cuenta se ancla a los distritos reales — los locales salen del
          cómputo, los federales del catálogo cartográfico del INE.
        </p>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Casillas normativas', T.num(tl.normativas), 'calculo',
            { detalle: 'suma de ⌈lista nominal ÷ ' + E.ELECTORES_POR_CASILLA + '⌉ por sección' })}
          ${T.cifra('Instaladas en 2024', T.num(tl.casillas), 'dato',
            { fuente: FUENTE, fechaCorte: CORTE })}
          ${T.cifra('Diferencia', (tl.casillas - tl.normativas > 0 ? '+' : '')
            + T.num(tl.casillas - tl.normativas), 'calculo',
            { detalle: 'instaladas − normativas' })}
          ${T.cifra('Distritos exactos', exactos + ' de ' + local.filas.length, 'calculo',
            { detalle: 'sin desviación respecto a la norma' })}
        </div>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">Distritos locales</h4>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla tabla--compacta">
            ${cabecera}
            <tbody>${local.filas.map((g) => fila(g, 'Distrito local ' + g.distrito)).join('')}</tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <td class="num">${T.num(tl.secciones)}</td>
                <td class="num">${T.num(tl.lista_nominal)}</td>
                <td class="num">${T.num(Math.round(tl.lista_nominal / tl.secciones))}</td>
                <td class="num">${T.num(tl.normativas)}</td>
                <td class="num"><strong>${T.num(tl.casillas)}</strong></td>
                <td class="num">${tl.casillas - tl.normativas > 0 ? '+' : ''}${tl.casillas - tl.normativas}</td>
                <td class="num">${T.num(Math.round(tl.lista_nominal / tl.casillas))}</td>
                <td class="num"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">Distritos federales</h4>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla tabla--compacta">
            ${cabecera}
            <tbody>${federal.filas.map((g) => fila(g, 'Distrito federal ' + g.distrito)).join('')}</tbody>
          </table>
        </div>
        ${federal.huerfanas.length ? `
          <p class="panel__nota">
            <strong>${federal.huerfanas.length} secciones quedan fuera del corte
            federal:</strong> ${T.escapar(federal.huerfanas.join(', '))}. Tienen
            resultado en 2024 pero no aparecen en el catálogo del INE de 2026 —
            unas desaparecieron por reseccionalización y otras nunca fueron
            territoriales (voto anticipado y en el extranjero). Se declaran aquí
            en vez de repartirse entre los dos distritos.
          </p>` : ''}

        <p class="panel__nota">
          <strong>Lo que esta cuenta no dice.</strong> La fórmula predice bien el
          <em>total</em> de casillas de una sección —reproduce exacto 517 de 542
          en 2024, y nunca queda por encima de lo instalado— pero no predice el
          <em>tipo</em>. El excedente sobre la norma no es error: son casillas
          extraordinarias, que se instalan donde la geografía impide llegar a la
          casilla de la sección, y especiales, para electores en tránsito.
          Ninguna de las dos depende del tamaño del padrón, así que ninguna sale
          de esta división.
        </p>
        ${P.pie({
          fuente: 'Lista nominal y casillas: IEEC, cómputos distritales 2024. '
            + 'Distritos federales: INE, catálogos cartográficos febrero 2026',
          fechaCorte: CORTE,
          metodologia: 'LGIPE art. 253: una casilla por cada '
            + E.ELECTORES_POR_CASILLA + ' electores de la lista nominal seccional '
            + 'o fracción, mínimo una por sección. Se calcula por sección y se '
            + 'suma por distrito; calcularlo sobre el total del distrito daría '
            + 'menos casillas, porque perdería el redondeo de cada sección.',
          confianza: 'alta',
          cobertura: local.filas.length + ' distritos locales · '
            + federal.filas.length + ' distritos federales',
        })}
      </section>`;
  }
})();
