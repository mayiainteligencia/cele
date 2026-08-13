/* Vista: Histórico electoral y proyección 2027.

   Regla dura de la spec: la proyección NUNCA se presenta como certeza.
   Todo porcentaje proyectado sale de Territorio.intervalo(), que imprime
   el central junto con su rango. No hay una sola ruta en este archivo que
   pinte un central solo.

   El histórico va separado visualmente de la proyección: uno es pasado
   registrado, la otra es modelo. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;

  document.addEventListener('DOMContentLoaded', () => {
    T.cargar().then(pintar).catch(() => {});
  });

  function pintar(d) {
    const mun = d.municipios;
    const anios = mun[0].historico.map((h) => h.anio);
    let anioSel = anios[anios.length - 1];
    let escenarioSel = 'base';

    const colorPartido = {};
    const paleta = T.tokens(['--serie-5', '--serie-1', '--serie-4', '--serie-2',
                             '--serie-6', '--serie-3', '--serie-7']);
    d.partidos.forEach((p, i) => { colorPartido[p] = paleta[i]; });

    document.getElementById('aviso').innerHTML = T.avisoSimulado(
      'Los resultados históricos y la proyección son sintéticos. No corresponden a ' +
      'ningún proceso electoral real de Campeche.'
    );

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('estimacion', { detalle: 'proyección con intervalo' }) + P.badge('simulado');

    document.getElementById('contenido').innerHTML = `
      <section class="panel" id="p-historico"></section>
      <section class="panel" id="p-proyeccion"></section>
      <section class="panel" id="p-tabla"></section>
    `;

    function hist(m) { return m.historico.find((h) => h.anio === anioSel); }

    /* ── Histórico ── */
    function pintarHistorico() {
      const total = mun.length;
      const porGanador = {};
      mun.forEach((m) => {
        const g = hist(m).ganador;
        porGanador[g] = (porGanador[g] || 0) + 1;
      });
      const partMedia = mun.reduce((a, m) => a + hist(m).participacion, 0) / total;
      const nulosMedia = mun.reduce((a, m) => a + hist(m).nulos, 0) / total;

      document.getElementById('p-historico').innerHTML = `
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="history"></i> Histórico electoral
          <span class="badge badge--neutral">Pasado registrado</span>
        </h3>

        <div class="subnav-bar" role="group" aria-label="Año del proceso">
          ${anios.map((a) => `
            <button class="subnav-btn${a === anioSel ? ' subnav-btn--active' : ''}" data-anio="${a}">
              <span>${a}</span>
            </button>`).join('')}
        </div>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Participación media', T.pct(partMedia), 'calculo',
            { detalle: 'media simple de 13 municipios' })}
          ${T.cifra('Abstencionismo', T.pct(100 - partMedia), 'calculo',
            { detalle: '100 − participación' })}
          ${T.cifra('Votos nulos', T.pct(nulosMedia), 'calculo',
            { detalle: 'media de 13 municipios' })}
          ${T.cifra('Municipios ganados', Object.entries(porGanador)
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => `${n} ${p}`).slice(0, 1).join(''), 'simulado')}
        </div>

        <div style="margin-top:var(--space-md)">
          ${T.cinta(Object.fromEntries(Object.entries(porGanador)
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => [p, Math.round(n / total * 1000) / 10])),
            Object.entries(porGanador).sort((a, b) => b[1] - a[1]).map(([p]) => colorPartido[p]))}
        </div>
        <p class="panel__nota">Reparto de las 13 presidencias municipales en ${anioSel}.</p>
      `;

      document.querySelectorAll('[data-anio]').forEach((b) => {
        b.addEventListener('click', () => {
          anioSel = Number(b.dataset.anio);
          pintarHistorico();
          pintarTabla();
        });
      });
    }

    /* ── Proyección ── */
    function pintarProyeccion() {
      // Agregado estatal: promedio ponderado por lista nominal.
      const listaTot = mun.reduce((a, m) => a + m.lista_nominal, 0);
      const agg = {};
      d.partidos.forEach((p) => {
        let c = 0, b = 0, al = 0;
        mun.forEach((m) => {
          const f = m.proyeccion_2027.partidos.find((x) => x.partido === p);
          const w = m.lista_nominal / listaTot;
          c += f.pct_central * w; b += f.ic_bajo * w; al += f.ic_alto * w;
        });
        agg[p] = { central: c, bajo: b, alto: al };
      });
      const orden = Object.entries(agg).sort((a, b) => b[1].central - a[1].central);
      const puntero = orden[0];
      const segundo = orden[1];
      const margen = puntero[1].central - segundo[1].central;
      // Si los intervalos se traslapan, no hay ganador distinguible.
      const empateTecnico = puntero[1].bajo < segundo[1].alto;

      const escenarios = ['base', 'alta_participacion', 'baja_participacion', 'con_alianza'];
      const et = mun[0].proyeccion_2027.escenarios;

      document.getElementById('p-proyeccion').innerHTML = `
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="trending-up"></i> Proyección 2027
          ${P.badge('estimacion', { confianza: empateTecnico ? 'baja' : 'media' })}
        </h3>

        <div class="aviso-simulado">
          <i data-lucide="alert-triangle"></i>
          <span><strong>Esto no es un pronóstico.</strong> Es una distribución de
          probabilidad con incertidumbre. El valor central no significa nada sin su
          intervalo, y por eso nunca se muestra solo.
          ${empateTecnico
            ? '<strong> Los intervalos de primero y segundo se traslapan: no hay puntero distinguible.</strong>'
            : ''}</span>
        </div>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Partido</th>
                <th style="min-width:200px">Porcentaje esperado con intervalo</th>
                <th class="num">Amplitud</th>
              </tr>
            </thead>
            <tbody>
              ${orden.map(([p, v]) => `
                <tr>
                  <td><span class="badge" style="color:${colorPartido[p]}">${T.escapar(p)}</span></td>
                  <td>${T.intervalo(v.central, v.bajo, v.alto)}</td>
                  <td class="num">±${((v.alto - v.bajo) / 2).toFixed(1)} pp</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <h4 class="text-h3 panel__titulo" style="margin-top:var(--space-lg)">
          <i data-lucide="git-fork"></i> Escenarios
        </h4>
        <div class="subnav-bar" role="group" aria-label="Escenario">
          ${escenarios.map((e) => `
            <button class="subnav-btn${e === escenarioSel ? ' subnav-btn--active' : ''}" data-esc="${e}">
              <span>${T.escapar(et[e].etiqueta)}</span>
            </button>`).join('')}
        </div>
        <div class="rejilla-tarjetas" id="esc-detalle" style="margin-top:var(--space-md)"></div>

        ${P.pie({
          fuente: 'Modelo de demostración sobre resultados simulados',
          fechaCorte: null,
          metodologia: 'Central por continuidad del último proceso más ruido gaussiano; ' +
                       'intervalo de amplitud 3.5–7.5 pp; agregado estatal ponderado por lista nominal. ' +
                       'Probabilidad de victoria por softmax sobre el central.',
          confianza: empateTecnico ? 'baja' : 'media',
          cobertura: '13 de 13 municipios',
        })}
      `;

      function pintarEscenario() {
        // El escenario se promedia entre municipios para el agregado estatal.
        const part = mun.reduce((a, m) => a + m.proyeccion_2027.escenarios[escenarioSel].participacion, 0) / mun.length;
        const punteros = {};
        mun.forEach((m) => {
          const p = m.proyeccion_2027.escenarios[escenarioSel].puntero;
          punteros[p] = (punteros[p] || 0) + 1;
        });
        const lider = Object.entries(punteros).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('esc-detalle').innerHTML = `
          ${T.cifra('Participación supuesta', T.pct(part), 'estimacion')}
          ${T.cifra('Municipios con puntero', `${lider[1]} de 13`, 'estimacion',
            { detalle: lider[0] })}
          ${T.cifra('Margen estatal', T.intervalo(margen, Math.max(0, margen - 4), margen + 4, ' pp'), 'estimacion')}
          ${T.cifra('Confianza', empateTecnico ? 'Baja' : 'Media', 'inferencia',
            { detalle: empateTecnico ? 'intervalos traslapados' : 'margen distinguible' })}
        `;
        P.iconos();
        if (window.lucide) window.lucide.createIcons();
      }

      document.querySelectorAll('[data-esc]').forEach((b) => {
        b.addEventListener('click', () => {
          escenarioSel = b.dataset.esc;
          pintarProyeccion();
        });
      });
      pintarEscenario();
    }

    /* ── Tabla municipal: la que pide la spec ── */
    function pintarTabla() {
      document.getElementById('p-tabla').innerHTML = `
        <h3 class="text-h3 panel__titulo"><i data-lucide="table"></i> Detalle por municipio</h3>
        ${T.exportar('histórico y proyección')}
        <div class="tabla-caja" style="margin-top:var(--space-sm)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th>Ganador ${anioSel}</th>
                <th class="num">% ganador</th>
                <th>Segundo lugar</th>
                <th class="num">% segundo</th>
                <th class="num">Margen</th>
                <th class="num">Participación</th>
                <th style="min-width:190px">Proyección 2027</th>
                <th>Confianza</th>
              </tr>
            </thead>
            <tbody>
              ${mun.map((m) => {
                const h = hist(m);
                const pr = m.proyeccion_2027;
                const top = pr.partidos[0];
                const insuf = pr.informacion_insuficiente;
                return `
                <tr>
                  <td><strong>${T.escapar(m.nombre)}</strong>
                      <span class="text-small"> ${T.escapar(m.cve_mun)}</span></td>
                  <td><span class="badge" style="color:${colorPartido[h.ganador]}">${T.escapar(h.ganador)}</span></td>
                  <td class="num">${h.pct_ganador.toFixed(1)}</td>
                  <td><span class="badge" style="color:${colorPartido[h.segundo]}">${T.escapar(h.segundo)}</span></td>
                  <td class="num">${h.pct_segundo.toFixed(1)}</td>
                  <td class="num">${h.margen.toFixed(1)}</td>
                  <td class="num">${h.participacion.toFixed(1)}</td>
                  <td>
                    ${insuf
                      ? '<span class="badge badge--warn">Información insuficiente</span>'
                      : `<span class="badge" style="color:${colorPartido[top.partido]}">${T.escapar(top.partido)}</span>
                         ${T.intervalo(top.pct_central, top.ic_bajo, top.ic_alto)}`}
                  </td>
                  <td>${P.badge('estimacion', { compacto: true, confianza: pr.confianza })}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          Las columnas de la izquierda son resultado registrado; la de proyección es
          modelo. Los municipios marcados como <em>información insuficiente</em> tienen
          un margen proyectado por debajo de 2.5 puntos: ahí el modelo no distingue
          ganador y decirlo es más honesto que pintar uno.
        </p>
        ${P.leyenda(true)}
      `;
      P.iconos();
      T.conectarExportar();
      if (window.lucide) window.lucide.createIcons();
    }

    pintarHistorico();
    pintarProyeccion();
    pintarTabla();
    P.iconos();
    if (window.lucide) window.lucide.createIcons();
  }
})();
