/* Vista: Nivel socioeconómico.

   Esto es una ESTIMACIÓN propia, y así se presenta en cada pantalla. No es
   el NSE de la AMAI —esa metodología está registrada y requiere licencia—
   ni son los indicadores observados del INEGI. Por eso los niveles se
   llaman "alto / medio / bajo" y no A/B, C+, C.

   Regla dura: ningún nivel se imprime como un número solo. Todos salen con
   su rango, que es lo que el modelo realmente produce.

   El modelo no baja a nivel municipio. En vez de inventar un porcentaje por
   municipio, se publica la tipología cualitativa, marcada como inferencia. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([T.cargar(), E.cargar()]).then(([ctx, elec]) => {
      const todos = Object.values(elec.municipios)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun));
      const datos = { municipios: todos, nse: ctx.nse };
      const vista = Object.assign({}, datos);
      vista.municipios = T.conectarFiltros(datos, (mun) => {
        vista.municipios = mun;
        pintar(vista);
      });
      pintar(vista);
    }).catch((err) => {
      console.error('nse:', err);
      document.getElementById('contenido').innerHTML =
        '<p class="text-small">No se pudo cargar la estimación socioeconómica.</p>';
    });
  });

  function pintar(d) {
    const n = d.nse;
    const mun = d.municipios;
    const porClave = {};
    mun.forEach((m) => { porClave[m.cve_mun] = m; });

    document.getElementById('aviso').innerHTML = '';

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('estimacion', {
        detalle: 'con intervalo',
        confianza: n.confianza,
        fuente: n.fuente,
        fechaCorte: n.fecha_corte,
      });

    const colores = T.tokens(n.niveles.map((x) => x.color));
    // La cinta usa el centro del rango sólo para repartir el ancho; el número
    // que se lee siempre es el intervalo.
    const centro = (x) => (x.pct_bajo + x.pct_alto) / 2;

    document.getElementById('contenido').innerHTML = `

      <!-- ── Qué es y qué no es ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="layers-3"></i> Estimación de nivel socioeconómico
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Campeche tiene dos economías encima del mismo mapa: la petrolera y
          burocrática de Ciudad del Carmen y la capital, y la agrícola e informal
          del resto. Cualquier promedio estatal esconde esa partición, así que
          aquí van primero los rangos y luego lo que los produce.
        </p>

        <div style="margin-top:var(--space-md)">
          ${T.cinta(Object.fromEntries(n.niveles.map((x) =>
            [x.etiqueta, Math.round(centro(x) * 10) / 10])), colores)}
        </div>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${n.niveles.map((x, i) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong style="color:${colores[i]}">${T.escapar(x.etiqueta)}</strong>
                <span class="badge">${T.intervalo(centro(x), x.pct_bajo, x.pct_alto)}</span>
              </header>
              <p class="tarjeta__texto">${T.escapar(x.perfil)}</p>
              <dl class="proc-pie">
                <dt>Vivienda</dt><dd>${T.escapar(x.vivienda)}</dd>
                <dt>Dónde</dt><dd>${T.escapar(x.donde)}</dd>
              </dl>
            </article>`).join('')}
        </div>

        <p class="panel__nota">
          Los tres rangos se leen como rangos: el central que pinta la cinta
          existe sólo para repartir el ancho de la barra. Sumar los extremos
          bajos da 95 % y los altos 105 %, que es justo lo que significa que
          esto es una estimación y no un conteo.
        </p>
        ${P.pie({
          fuente: n.fuente,
          fechaCorte: n.fecha_corte,
          metodologia: n.metodologia,
          confianza: n.confianza,
          cobertura: 'Entidad 04',
        })}
      </section>

      <!-- ── Qué mueve la estimación ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="sliders-horizontal"></i> Los tres factores que la determinan
        </h3>
        <div class="rejilla-tarjetas">
          ${n.factores.map((f) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza"><strong>${T.escapar(f.titulo)}</strong></header>
              <p class="tarjeta__texto">${T.escapar(f.texto)}</p>
            </article>`).join('')}
        </div>
        <p class="panel__nota">
          Si alguno de estos tres se mueve —cae el precio del crudo, se recorta
          el presupuesto estatal— la distribución se recorre y hay que volver a
          estimar. Un rango vigente hoy no es un rango vigente siempre.
        </p>
      </section>

      <!-- ── Tipología municipal ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="map-pin"></i> Perfil económico por municipio
          ${P.badge('inferencia')}
        </h3>
        <div class="tabla-caja">
          <table class="tabla">
            <thead>
              <tr>
                <th>Perfil</th>
                <th>Municipios</th>
                <th>Rasgo dominante</th>
                <th class="num">Lista nominal</th>
                <th class="num">Participación 2024</th>
              </tr>
            </thead>
            <tbody>
              ${n.tipologia_municipal.grupos.map((g) => {
                const ms = g.municipios.map((c) => porClave[c]).filter(Boolean);
                if (!ms.length) return '';
                const ln = ms.reduce((a, m) => a + m.lista_nominal, 0);
                const votos = ms.reduce((a, m) => a + m.total, 0);
                return `
                <tr>
                  <td><strong>${T.escapar(g.etiqueta)}</strong></td>
                  <td>${ms.map((m) => T.escapar(m.nombre)).join(', ')}</td>
                  <td class="text-small">${T.escapar(g.rasgo)}</td>
                  <td class="num">${T.num(ln)}</td>
                  <td class="num">${T.pct(votos / ln * 100)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          ${T.escapar(n.tipologia_municipal.nota)}
          La lista nominal y la participación de las dos últimas columnas sí son
          dato del INE y del IEEC: se ponen aquí para que el perfil se pueda
          contrastar contra algo medido, no para validarlo.
        </p>
        ${P.pie({
          fuente: n.fuente + ' · Lista nominal y participación: INE / IEEC 2024',
          fechaCorte: n.fecha_corte,
          metodologia: 'Clasificación cualitativa por perfil económico dominante',
          confianza: 'media',
        })}
      </section>

      <!-- ── Lo que esto no es ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo"><i data-lucide="shield-alert"></i> Alcance</h3>
        <div class="rejilla-tarjetas">
          <article class="tarjeta">
            <header class="tarjeta__cabeza"><strong>No es NSE AMAI</strong></header>
            <p class="tarjeta__texto">
              La regla AMAI está registrada y requiere licencia. Por eso los
              niveles de aquí no se llaman A/B, C+, C, D+, D, E: usar esas
              etiquetas implicaría haber aplicado esa metodología.
            </p>
          </article>
          <article class="tarjeta">
            <header class="tarjeta__cabeza"><strong>No son datos del INEGI</strong></header>
            <p class="tarjeta__texto">
              El INEGI publica indicadores observados —ingreso, ocupación,
              servicios en la vivienda— y esos entran como insumo. La
              clasificación en niveles es propia y el INEGI no la avala.
            </p>
          </article>
          <article class="tarjeta">
            <header class="tarjeta__cabeza"><strong>No baja a sección</strong></header>
            <p class="tarjeta__texto">
              El modelo estima a escala estatal y agrupa municipios por perfil.
              Un NSE por sección electoral requiere el cruce con AGEB del Censo,
              que todavía no está cargado.
            </p>
          </article>
        </div>
        ${P.leyenda()}
      </section>
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
