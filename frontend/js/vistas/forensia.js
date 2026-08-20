/* Vista: Forensia — desviaciones estadísticas por sección, 2024.

   El encargo de esta pantalla es incómodo y por eso las reglas van escritas:
   señala secciones que se apartan de sus comparables, y eso NO es una
   acusación. Tres decisiones que sostienen esa distinción:

   1. El rojo no se puede alcanzar por estadística. Sólo lo enciende una
      resolución del Tribunal. Está cerrado en el pipeline, no aquí.

   2. El copy de cada nivel describe lo que se midió, no lo que podría
      significar. Nada de "riesgo", "irregularidad" ni "acción jurídica"
      colgando de un umbral.

   3. Lo que no se puede medir se dice. No hay datos de PREP, así que el
      indicador de divergencia PREP vs cómputos no existe — antes esta página
      lo mostraba con cifras inventadas. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  document.addEventListener('DOMContentLoaded', () => {
    E.cargarForensia().then(pintar).catch((err) => {
      console.error('forensia:', err);
      document.getElementById('contenido').innerHTML =
        '<p class="text-small">No se pudieron cargar los datos de forensia.</p>';
    });
  });

  function pintar(d) {
    const m = d.meta;
    const N = m.niveles;
    const cal = m.calibracion_verdad_terreno;
    const total = d.secciones.length;
    const orden = ['rojo', 'naranja', 'amarillo', 'verde'];
    const marcadas = d.secciones
      .filter((s) => s.nivel !== 'verde')
      .sort((a, b) => (a.nivel === 'rojo' ? -1 : b.nivel === 'rojo' ? 1 : 0)
        || b.z_max - a.z_max);

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('calculo', { detalle: 'z robusto por estrato de tamaño',
                           fuente: m.fuente, fechaCorte: m.fecha_corte }) +
      P.badge('dato', { detalle: 'sentencias del TEEC' });

    document.getElementById('contenido').innerHTML = `

      <!-- ── Lo que esto no es ── -->
      <section class="panel">
        <div class="aviso-simulado">
          <i data-lucide="scale"></i>
          <span><strong>Una desviación estadística no es una acusación.</strong>
          No implica irregularidad, y menos aún intención. En
          ${T.num(total)} secciones, varias decenas caen lejos de la mediana
          por azar. El nivel rojo <em>no se puede alcanzar por
          estadística</em>: sólo lo enciende una resolución del Tribunal.</span>
        </div>
      </section>

      <!-- ── Semáforo ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="traffic-cone"></i> Semáforo de ${T.num(total)} secciones
          ${P.badge('calculo', { detalle: m.metodo.estadistico })}
        </h3>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${orden.map((n) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong style="color:var(${N[n].color})">${T.escapar(N[n].etiqueta)}</strong>
                <span class="badge">${T.num(d.conteo[n])}</span>
              </header>
              <p class="tarjeta__texto">${T.escapar(N[n].descripcion)}</p>
            </article>`).join('')}
        </div>
        <p class="panel__nota">
          ${T.pct(d.conteo.verde / total * 100)} de las secciones caen donde
          caen sus comparables. Que unas decenas queden fuera es lo esperado en
          un universo de ${T.num(total)}: no es un hallazgo, es la forma de una
          distribución.
        </p>
      </section>

      <!-- ── El criterio ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="ruler"></i> De dónde salen los umbrales
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          Ningún corte es un número redondo elegido a ojo: todos salen de la
          distribución real de las ${T.num(total)} secciones.
        </p>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Estratificación', m.metodo.estratificacion, 'calculo',
            { detalle: 'se compara cada sección con las de su tamaño' })}
          ${T.cifra('Estadístico', 'mediana + MAD', 'calculo',
            { detalle: m.metodo.estadistico })}
          ${T.cifra('Corte amarillo', '|z| ≥ ' + m.metodo.cortes.amarillo, 'calculo')}
          ${T.cifra('Corte naranja', '|z| ≥ ' + m.metodo.cortes.naranja, 'calculo')}
        </div>
        <p class="panel__nota">
          <strong>Por qué estratificar.</strong> ${T.escapar(m.metodo.por_que_estratificar)}
        </p>
        <p class="panel__nota">
          <strong>Por qué mediana y MAD.</strong> ${T.escapar(m.metodo.por_que_mad)}
        </p>
        <p class="panel__nota">
          <strong>Por qué esos cortes.</strong> ${T.escapar(m.metodo.por_que_esos_cortes)}
        </p>
      </section>

      <!-- ── Calibración contra las sentencias ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="gavel"></i> Contraste con las sentencias del Tribunal
          ${P.badge('dato', { detalle: 'TEEC/JIN/DIP/1, 2 y 5/2024' })}
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          El Tribunal anuló casillas en tres distritos. Eran el caso de prueba
          natural: si el detector no las marca, el umbral está mal. El resultado
          fue otro, y vale la pena leerlo entero.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Sección</th>
                <th>Situación en los datos</th>
                <th class="num">|z| máx</th>
                <th>¿La marcaría el detector?</th>
              </tr>
            </thead>
            <tbody>
              ${cal.secciones_citadas_en_sentencias.map((s) => {
                const det = cal.detalle.find((x) => x.seccion === s);
                return `
                <tr>
                  <td><strong>${T.escapar(s)}</strong></td>
                  <td class="text-small">${det
                    ? 'con resultado publicado'
                    : '<em>sin resultado publicado — sus votos se anularon</em>'}</td>
                  <td class="num">${det ? det.z_max : '—'}</td>
                  <td>${det
                    ? (det.seria_atipica_por_estadistica ? 'sí' : '<strong>no</strong>')
                    : 'no puede: no hay datos'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">${T.escapar(cal.lectura)}</p>
        <p class="panel__nota">${T.escapar(cal.consecuencia_de_diseno)}</p>
      </section>

      <!-- ── Las marcadas ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="list-filter"></i> Secciones fuera de lo esperado
          <span class="badge badge--neutral">${T.num(marcadas.length)} de ${T.num(total)}</span>
        </h3>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla tabla--compacta">
            <thead>
              <tr>
                <th>Sección</th>
                <th class="num">DL</th>
                <th class="num">Estrato</th>
                <th class="num">Lista nominal</th>
                <th class="num">Participación</th>
                <th class="num">Voto nulo</th>
                <th class="num">1er lugar</th>
                <th class="num">|z| máx</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              ${marcadas.map((s) => `
                <tr>
                  <td><strong>${T.escapar(s.seccion)}</strong></td>
                  <td class="num">${s.distrito_local ?? '—'}</td>
                  <td class="num">Q${s.estrato}</td>
                  <td class="num">${T.num(s.lista_nominal)}</td>
                  <td class="num">${T.pct(s.valores.participacion)}</td>
                  <td class="num">${T.pct(s.valores.nulos_pct)}</td>
                  <td class="num">${T.pct(s.valores.pct_ganador)}</td>
                  <td class="num"><strong>${s.z_max}</strong></td>
                  <td><span class="punto-color" style="background:var(${
                    N[s.nivel].color})"></span>${T.escapar(N[s.nivel].etiqueta)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${m.secciones_sin_votacion.length ? `
          <p class="panel__nota">
            <strong>Sin votación registrada:
            ${m.secciones_sin_votacion.map(T.escapar).join(', ')}.</strong>
            ${T.escapar(m.nota_sin_votacion)}
          </p>` : ''}
        <p class="panel__nota">
          El |z| máximo es la mayor de las tres distancias, no una puntuación de
          gravedad. Una sección con voto nulo alto y una con participación baja
          pueden tener el mismo número y no tener nada que ver entre sí.
        </p>
      </section>

      <!-- ── Lo que no se mide ── -->
      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="circle-slash"></i> Lo que este análisis no incluye
        </h3>
        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${Object.entries(m.no_medido).map(([k, v]) => `
            <article class="tarjeta">
              <header class="tarjeta__cabeza">
                <strong>${T.escapar(k.replace(/_/g, ' '))}</strong>
                <span class="badge badge--warn">no disponible</span>
              </header>
              <p class="tarjeta__texto">${T.escapar(v)}</p>
            </article>`).join('')}
        </div>
        <p class="panel__nota">
          Esta página mostraba antes una "divergencia PREP vs cómputos" con
          cifras que no salían de ningún archivo. Se retiró: es el indicador más
          útil para esto, y por eso queda pedido en vez de simulado.
        </p>
        ${P.pie({
          fuente: m.fuente,
          fechaCorte: m.fecha_corte,
          metodologia: `${m.metodo.estadistico}, estratificado en `
            + `${m.metodo.estratificacion}. Cortes en |z| ${m.metodo.cortes.amarillo} `
            + `y ${m.metodo.cortes.naranja}. El nivel rojo sólo lo activa una `
            + `resolución del Tribunal, nunca el estadístico.`,
          cobertura: `${T.num(total)} secciones con resultado en 2024`,
          confianza: 'media',
        })}
      </section>
    `;

    P.iconos();
    if (window.lucide) window.lucide.createIcons();
  }
})();
