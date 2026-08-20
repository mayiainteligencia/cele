/* Vista: Demografía y lista nominal.

   Regla de la spec: población y características socioeconómicas son del
   INEGI; lista nominal, secciones, casillas y resultados son del INE/IEEC.
   No se mezclan en la misma cifra. Van en dos bloques separados, con su
   propia cabecera de origen, y el único número que los cruza está marcado
   como CÁLCULO.

   Lo que falta se dice en una nota, no se rellena: el desglose de población
   por municipio no está cargado, así que la tabla municipal no lleva
   columna de población. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      T.cargar(),
      E.cargar(),
      // El agregado por municipio lo precalcula build_censo.py: son 13
      // números. Bajar los 2 MB del geojson para contarlos era la deuda
      // número uno del proyecto.
      fetch('data/censo/cct_por_municipio.json').then((r) => r.json()),
    ]).then(([ctx, elec, cct]) => {
      const escuelas = {};
      const alumnado = {};
      Object.entries(cct.municipios).forEach(([k, m]) => {
        escuelas[k] = m.planteles;
        alumnado[k] = m.alumnos;
      });

      const todos = Object.values(elec.municipios)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun))
        .map((m) => Object.assign({}, m, {
          escuelas_cct: escuelas[m.cve_mun] || 0,
          alumnado_cct: alumnado[m.cve_mun] || 0,
        }));

      const datos = { municipios: todos, ctx: ctx, cct: cct.metadata };
      const vista = Object.assign({}, datos);
      vista.municipios = T.conectarFiltros(datos, (mun) => {
        vista.municipios = mun;
        pintar(vista);
      });
      pintar(vista);
    }).catch((err) => {
      console.error('demografia:', err);
      document.getElementById('contenido').innerHTML =
        '<p class="text-small">No se pudieron cargar los datos demográficos.</p>';
    });
  });

  function pintar(d) {
    const mun = d.municipios;
    const g = d.ctx.inegi;
    const ine = d.ctx.ine;

    const suma = (f) => mun.reduce((a, m) => a + f(m), 0);
    const lista = suma((m) => m.lista_nominal);
    const escuelas = suma((m) => m.escuelas_cct);
    const alumnado = suma((m) => m.alumnado_cct);
    const casillas = suma((m) => (m.casillas_tipo ? m.casillas_tipo.total : 0));
    const secciones = suma((m) => (m.casillas_tipo ? m.casillas_tipo.secciones_con_casilla : 0));
    const maxLista = Math.max(...mun.map((m) => m.lista_nominal));

    // Sólo se muestra contra la población estatal si están los 13 municipios:
    // comparar la lista de un municipio contra la población del estado no
    // significa nada.
    const estatal = mun.length === 13;

    document.getElementById('aviso').innerHTML = '';

    document.getElementById('cabecera-pills').innerHTML =
      '<span class="badge badge--info">INEGI y INE separados</span>' +
      P.badge('dato', { fuente: g.fuente, fechaCorte: g.fecha_corte });

    document.getElementById('contenido').innerHTML = `

      <div class="rejilla-2">

        <!-- ── Bloque INEGI ── -->
        <section class="panel panel--inegi">
          <h3 class="text-h3 panel__titulo">
            <i data-lucide="users-round"></i> Demografía
            <span class="badge badge--neutral">Origen: INEGI</span>
          </h3>
          <div class="rejilla-tarjetas">
            ${T.cifra('Población estatal', T.num(g.poblacion_total), 'dato',
              { fuente: g.fuente, fechaCorte: g.fecha_corte })}
            ${T.cifra('Edad mediana', g.edad_mediana + ' años', 'dato',
              { fuente: g.fuente, fechaCorte: g.fecha_corte })}
            ${T.cifra('Densidad', g.densidad_hab_km2 + ' hab/km²', 'dato',
              { detalle: 'densidad baja', fuente: g.fuente })}
            ${T.cifra('Habla lengua indígena', T.pct(g.lengua_indigena_pct, 2), 'dato',
              { detalle: 'población de 3 años o más', fuente: g.fuente })}
          </div>

          <div style="margin-top:var(--space-md)">
            ${T.cinta({
              [`Mujeres ${T.pct(g.mujeres / g.poblacion_total * 100)}`]:
                Math.round(g.mujeres / g.poblacion_total * 1000) / 10,
              [`Hombres ${T.pct(g.hombres / g.poblacion_total * 100)}`]:
                Math.round(g.hombres / g.poblacion_total * 1000) / 10,
            }, T.tokens(['--serie-6', '--serie-1']))}
          </div>

          <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>Más poblado</strong>
                <span class="badge badge--neutral">${T.pct(g.extremos.mas_poblado.pct_estatal)}</span>
              </header>
              <p class="tarjeta__texto">
                <strong>${T.escapar(g.extremos.mas_poblado.nombre)}</strong> —
                ${T.num(g.extremos.mas_poblado.poblacion)} habitantes.
                Casi un tercio del estado en un solo municipio.
              </p>
            </article>
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>Menos poblado</strong>
                <span class="badge badge--neutral">${T.pct(g.extremos.menos_poblado.pct_estatal)}</span>
              </header>
              <p class="tarjeta__texto">
                <strong>${T.escapar(g.extremos.menos_poblado.nombre)}</strong> —
                ${T.num(g.extremos.menos_poblado.poblacion)} habitantes.
                Entre el mayor y el menor hay una razón de 34 a 1.
              </p>
            </article>
          </div>

          <p class="panel__nota">
            ${T.escapar(g.pendiente)}
          </p>
          ${P.pie({
            fuente: g.fuente,
            fechaCorte: g.fecha_corte,
            cobertura: 'Entidad 04 · geografía municipal del Marco Geoestadístico 2024',
          })}
        </section>

        <!-- ── Bloque INE ── -->
        <section class="panel panel--ine">
          <h3 class="text-h3 panel__titulo">
            <i data-lucide="vote"></i> Padrón y lista nominal
            <span class="badge badge--success">Origen: INE / IEEC</span>
          </h3>
          <div class="rejilla-tarjetas">
            ${T.cifra('Lista nominal', T.num(ine.lista_nominal), 'dato',
              { fuente: ine.fuente, fechaCorte: ine.fecha_corte })}
            ${T.cifra('Secciones con casilla', T.num(secciones), 'dato',
              { fuente: 'INE — Encarte 2024', fechaCorte: '2024-06' })}
            ${T.cifra('Casillas instaladas 2024', T.num(casillas), 'dato',
              { fuente: 'INE — Encarte 2024', fechaCorte: '2024-06' })}
            ${T.cifra('Distritos', ine.distritos_federales + ' fed · ' + ine.distritos_locales + ' loc',
              'dato', { fuente: ine.fuente })}
          </div>

          <div style="margin-top:var(--space-md)">
            ${T.cinta({
              [`Mujeres ${T.pct(ine.mujeres / ine.lista_nominal * 100)}`]:
                Math.round(ine.mujeres / ine.lista_nominal * 1000) / 10,
              [`Hombres ${T.pct(ine.hombres / ine.lista_nominal * 100)}`]:
                Math.round(ine.hombres / ine.lista_nominal * 1000) / 10,
            }, T.tokens(['--serie-6', '--serie-1']))}
          </div>

          <p class="panel__nota">
            La lista nominal está más feminizada que la población: 51.2 % contra
            50.8 %. No es un error de captura — las mujeres tramitan y renuevan
            credencial en mayor proporción.
          </p>
          <p class="panel__nota">${T.escapar(ine.nota_lista_nominal)}</p>
          ${P.pie({
            fuente: ine.fuente + ' · Encarte y cómputos 2024',
            fechaCorte: ine.fecha_corte,
            cobertura: '13 municipios · 21 distritos locales',
          })}
        </section>
      </div>

      <!-- ── Cruce de las dos fuentes ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="git-compare"></i> El único cruce
        </h3>
        <div class="rejilla-tarjetas">
          ${T.cifra('Cobertura de lista', T.pct(ine.lista_nominal / g.poblacion_total * 100), 'calculo',
            { detalle: 'lista nominal INE ÷ población INEGI', confianza: 'media' })}
          ${T.cifra('Población no en lista', T.num(g.poblacion_total - ine.lista_nominal), 'calculo',
            { detalle: 'incluye menores de 18' })}
          ${T.cifra('Electores por casilla', T.num(Math.round(ine.lista_nominal / casillas)), 'calculo',
            { detalle: 'lista nominal ÷ casillas 2024' })}
        </div>
        <p class="panel__nota">
          Estas tres cifras cruzan INEGI con INE y por eso van marcadas como
          cálculo, no como dato. Y los cortes no coinciden: la población es del
          Censo 2020 y la lista nominal es de 2024. La cobertura real es más
          baja que la que sale de dividir, porque el denominador tiene cuatro
          años menos de crecimiento.
        </p>
      </section>

      <!-- ── Infraestructura CCT ── -->
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
          El catálogo CCT no declara fecha de corte, así que no se le inventa una.
          Un plantel con dos turnos cuenta como dos registros y un solo sitio
          físico: para hablar de casillas se usan los 1,482 sitios, no los 2,274
          registros.
        </p>
        ${P.pie({
          fuente: 'SEP — Catálogo de Centros de Trabajo',
          fechaCorte: null,
          cobertura: '2,274 registros en 13 municipios',
        })}
      </section>

      <!-- ── Tabla municipal ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="table"></i> Detalle por municipio</h3>
        ${T.exportar('demografía y lista nominal por municipio')}
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th class="num">Lista nominal <span class="badge badge--success">INE</span></th>
                <th>Peso en el estado</th>
                <th class="num">Secciones <span class="badge badge--success">INE</span></th>
                <th class="num">Casillas 2024 <span class="badge badge--success">INE</span></th>
                <th class="num">Participación 2024 <span class="badge badge--success">IEEC</span></th>
                <th class="num">Escuelas <span class="badge badge--neutral">SEP</span></th>
                <th class="num">Alumnado <span class="badge badge--neutral">SEP</span></th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong>
                      <span class="text-small"> ${T.escapar(m.cve_mun)}</span></td>
                  <td class="num">${T.num(m.lista_nominal)}</td>
                  <td>${T.barra(m.lista_nominal, maxLista,
                        estatal ? T.pct(m.lista_nominal / lista * 100) : T.num(m.lista_nominal))}</td>
                  <td class="num">${T.num(m.casillas_tipo ? m.casillas_tipo.secciones_con_casilla : null)}</td>
                  <td class="num">${T.num(m.casillas_tipo ? m.casillas_tipo.total : null)}</td>
                  <td class="num">${T.pct(m.participacion)}</td>
                  <td class="num">${T.num(m.escuelas_cct)}</td>
                  <td class="num">${T.num(m.alumnado_cct)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <td class="num">${T.num(lista)}</td>
                <td></td>
                <td class="num">${T.num(secciones)}</td>
                <td class="num">${T.num(casillas)}</td>
                <td class="num">${T.pct(suma((m) => m.total) / lista * 100)}</td>
                <td class="num">${T.num(escuelas)}</td>
                <td class="num">${T.num(alumnado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="panel__nota">
          No hay columna de población: el desglose municipal del Censo no está
          cargado y no se sustituye por un reparto proporcional. Las columnas
          llevan su origen en la cabecera porque la lista nominal y la
          infraestructura educativa no vienen de la misma fuente, y compararlas
          sin decirlo sería un error de lectura.
        </p>
        ${P.pie({
          fuente: 'INE — Encarte 2024 · IEEC — cómputos distritales 2024 · SEP — Catálogo CCT',
          fechaCorte: '2024-06',
          cobertura: '13 municipios',
        })}
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
