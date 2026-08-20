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
    Promise.all([T.cargar(), E.cargar(), E.cargarCorrelaciones()])
      .then(([ctx, elec, corr]) => {
      const todos = Object.values(elec.municipios)
        .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun));
      const datos = { municipios: todos, nse: ctx.nse, corr: corr };
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

  /* Correlaciones. La pieza central no son los coeficientes: son los
     intervalos. Un r de 0.48 con n=12 tiene un intervalo que incluye el cero,
     así que enseñarlo sin su rango sería exactamente el error que esta parte
     del sistema existe para no cometer. Por eso ninguna tabla imprime un r
     suelto: siempre va con su IC y con la marca de si cruza cero. */
  function panelCorrelaciones(c) {
    if (!c) return '';
    const m = c.meta;
    const fila = (x) => `
      <tr${x.incluye_cero ? ' class="fila--atenuada"' : ''}>
        <td>${T.escapar(x.etiqueta)}</td>
        <td class="num">${x.n}</td>
        <td class="num"><strong>${x.r > 0 ? '+' : ''}${x.r}</strong></td>
        <td class="num">${x.ic95 ? `[${x.ic95[0]}, ${x.ic95[1]}]` : '—'}</td>
        <td>${x.incluye_cero
          ? '<strong>incluye el cero</strong>'
          : 'no incluye el cero'}</td>
      </tr>`;
    const cab = `
      <thead>
        <tr>
          <th>Variables cruzadas</th>
          <th class="num">n</th>
          <th class="num">r</th>
          <th class="num">IC 95%</th>
          <th>Lectura</th>
        </tr>
      </thead>`;

    return `
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="git-compare-arrows"></i> Correlaciones
          ${P.badge('inferencia', { detalle: 'variables agregadas' })}
        </h3>

        <div class="aviso-simulado">
          <i data-lucide="users-round"></i>
          <span><strong>Esto describe territorios, no personas.</strong>
          ${T.escapar(m.falacia_ecologica)}</span>
        </div>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Por sección · ${T.num(c.seccion.correlaciones[0].n)} observaciones
        </h4>
        <p class="tarjeta__texto" style="max-width:78ch">
          Con este número de unidades los intervalos se cierran y el
          coeficiente se puede leer.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">${cab}
            <tbody>${c.seccion.correlaciones.map(fila).join('')}</tbody>
          </table>
        </div>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Participación por tipo de sección
        </h4>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr><th>Tipo</th><th class="num">Secciones</th>
                  <th class="num">Participación media</th><th class="num">IC 95%</th></tr>
            </thead>
            <tbody>
              ${c.seccion.participacion_por_tipo.grupos.map((g) => `
                <tr>
                  <td><strong>${T.escapar(g.grupo)}</strong></td>
                  <td class="num">${g.n}</td>
                  <td class="num">${T.pct(g.media)}</td>
                  <td class="num">[${g.ic95[0]}, ${g.ic95[1]}]</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          ${T.escapar(c.seccion.participacion_por_tipo.nota)} Dos medias con
          intervalos que se solapan no son dos medias distintas.
        </p>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Por municipio · ${T.num(c.municipal.correlaciones[0].n)} observaciones
        </h4>
        <p class="tarjeta__texto" style="max-width:78ch">
          ${T.escapar(c.municipal.advertencias.n_pequeno)}
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">${cab}
            <tbody>${c.municipal.correlaciones.map(fila).join('')}</tbody>
          </table>
        </div>
        <p class="panel__nota">
          <strong>Cuánto pesa un solo municipio.</strong>
          ${c.municipal.correlaciones.filter((x) => x.jackknife).map((x) =>
            `Quitar ${T.escapar(x.jackknife.municipio || '—')} mueve
             «${T.escapar(x.etiqueta.toLowerCase())}» en
             ${x.jackknife.maximo_cambio} puntos de r`).slice(0, 2).join('; ')}.
          Con doce unidades, una sola puede sostener la correlación entera.
        </p>
        <p class="panel__nota">
          ${T.escapar(c.municipal.advertencias.calkini_contaminado)}
          ${T.escapar(c.municipal.advertencias.desfase_temporal)}
        </p>

        <h4 class="text-h3" style="margin-top:var(--space-lg)">
          Nivel socioeconómico
        </h4>
        <div class="aviso-simulado">
          <i data-lucide="circle-slash"></i>
          <span><strong>No hay correlación con ingreso.</strong>
          ${T.escapar(c.nse.por_que_no_hay_correlacion)}</span>
        </div>
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr><th>Tipología</th><th class="num">Municipios</th>
                  <th class="num">Participación media</th><th class="num">IC 95%</th>
                  <th>Rasgo</th></tr>
            </thead>
            <tbody>
              ${c.nse.grupos.map((g) => `
                <tr>
                  <td><strong>${T.escapar(g.etiqueta)}</strong></td>
                  <td class="num">${g.n}</td>
                  <td class="num">${T.pct(g.participacion_media)}</td>
                  <td class="num">${g.ic95 ? `[${g.ic95[0]}, ${g.ic95[1]}]` : '—'}</td>
                  <td class="text-small">${T.escapar(g.rasgo)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">${T.escapar(c.nse.advertencia_grupos)}</p>

        ${P.pie({
          fuente: Object.values(m.fuentes).filter(Boolean).join(' · '),
          fechaCorte: m.fecha_corte,
          metodologia: `Coeficiente de ${m.metodo.coeficiente}. `
            + `${m.metodo.intervalo} ${m.metodo.jackknife} `
            + `Una correlación no es causalidad: ${m.no_es_causalidad}`,
          confianza: 'baja',
          cobertura: `${c.seccion.correlaciones[0].n} secciones · `
            + `${c.municipal.correlaciones[0].n} municipios`,
        })}
      </section>`;
  }

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

      ${panelCorrelaciones(d.corr)}
    `;

    P.iconos();
    T.conectarExportar();
    if (window.lucide) window.lucide.createIcons();
  }
})();
