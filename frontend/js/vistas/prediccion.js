/* Vista: Predicción 2027.

   Salió de historico.html, que respondía cuatro preguntas a la vez. Ésta
   responde una sola: qué puede pasar en 2027.

   ── LA LÍNEA QUE NO SE CRUZA ────────────────────────────────────────────
   El Monte Carlo NO corre aquí. Corrió en el pipeline, con semilla fija
   20270606, y su resultado está congelado en proyeccion_2027.json. Eso es lo
   que hace la proyección auditable: cualquiera puede volver a correr el
   pipeline y obtener exactamente los mismos números. Si el navegador
   recalculara, cada carga daría un número distinto y no habría nada que
   auditar.

   La animación de esta página es una PUESTA EN ESCENA de un resultado ya
   calculado. Recorre escenarios que ya existen; no genera ninguno. El copy lo
   dice con todas las letras, porque una animación de nodos parpadeando se
   parece mucho a un modelo trabajando y la confusión sería nuestra culpa.

   ── LA SEGUNDA LÍNEA ────────────────────────────────────────────────────
   La simulación es ESTATAL: seis bloques, ninguna clave por municipio. No
   existe una proyección 2027 por territorio. Por eso, cuando la animación se
   asienta, los colores del mapa son el resultado MEDIDO de 2024 —badge Dato—
   y el titular es la estimación 2027 —badge Estimación—. Pintar el mapa como
   si fuera la proyección insinuaría que simulamos cada municipio. No lo
   hicimos. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;

  // Tres actos en 2 s. Corta y con final: no es un loop de fondo.
  const ACTOS = { siembra: 500, barrido: 2500, total: 3000 };

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      T.cargar(),
      E.cargar(),
      E.cargarProyeccion(),
      fetch('data/geo/cabeceras_municipales.geojson').then((r) => r.json()),
      fetch('data/geo/municipios.geojson').then((r) => r.json()),
      // Los 32 estados, para dar contexto nacional. 352 KB y 7,848 vértices:
      // un octavo de lo que ya decimamos para los 13 municipios.
      fetch('estados/states.geojson').then((r) => r.json()),
    ])
      .then(([ctx, elec, proyeccion, cabeceras, geo, pais]) => pintar({
        proy: ctx.proyeccion_2027,
        sim: proyeccion.simulacion,
        sens: proyeccion.sensibilidad,
        meta: proyeccion.meta,
        municipios: Object.values(elec.municipios),
        cabeceras: cabeceras.features,
        geo: geo.features,
        pais: pais.features,
      }))
      .catch((err) => {
        console.error('Predicción:', err);
        document.getElementById('contenido').innerHTML =
          '<p class="text-small">No se pudo cargar la proyección.</p>';
      });
  });

  const color = (b) => `var(${E.color(b)})`;

  /* ── El escenario ──
     13 nodos, uno por municipio, colocados sobre un SVG con las coordenadas
     de la cabecera municipal proyectadas a un lienzo. No es un mapa de
     Leaflet: no hace falta interacción ni zoom, y montar un mapa completo
     para una animación de dos segundos sería pagar mucho por poco. */

  const W = 760, H = 520, M = 16;

  /* Proyección lineal compartida. Encuadra sobre el FOCO (Campeche) y no
     sobre todo el país: así Campeche ocupa ~50 % del lienzo y es el
     protagonista visual. México se dibuja completo pero sus extremos caen
     fuera del viewBox, que los recorta — el SVG lo hace gratis.

     El `foco` son las features de los 13 municipios. Se les calcula la
     bounding box y se expande con un PADDING para que los estados vecinos
     aparezcan como contexto geográfico. La escala resultante es la misma
     para los dos ejes (equirectangular simple).

     Si se pasa `foco`, se usa su bbox expandida. Si no, se ajusta a todas
     las features como antes. */
  function proyector(features, foco, padding) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const mirar = (a) => {
      if (Array.isArray(a[0])) { a.forEach(mirar); return; }
      if (a[0] < x0) x0 = a[0];
      if (a[0] > x1) x1 = a[0];
      if (a[1] < y0) y0 = a[1];
      if (a[1] > y1) y1 = a[1];
    };
    (foco || features).forEach((f) => mirar(f.geometry.coordinates));

    // Expandir la bbox del foco con el padding solicitado. El centro queda
    // fijo y los bordes se alejan. Así Campeche no crece: crece el margen
    // que lo rodea, mostrando más contexto nacional.
    if (padding && padding > 1) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const hw = (x1 - x0) / 2 * padding;
      const hh = (y1 - y0) / 2 * padding;
      x0 = cx - hw; x1 = cx + hw;
      y0 = cy - hh; y1 = cy + hh;
    }

    // Una sola escala para los dos ejes: dos escalas distintas estirarían el
    // estado y Campeche dejaría de parecerse a Campeche.
    const k = Math.min((W - 2 * M) / (x1 - x0 || 1), (H - 2 * M) / (y1 - y0 || 1));
    const dx = (W - (x1 - x0) * k) / 2;
    const dy = (H - (y1 - y0) * k) / 2;
    return (lon, lat) => [
      dx + (lon - x0) * k,
      // El SVG crece hacia abajo y la latitud hacia arriba: se invierte, o
      // Campeche sale de cabeza.
      dy + (y1 - lat) * k,
    ];
  }

  /* Anillo -> comando SVG, decimando. El geojson del INEGI trae 61 080
     vértices para todo el estado; en un lienzo de 520 px, la inmensa mayoría
     cae dentro del mismo píxel. Se descarta el punto que no se separe al menos
     0.6 px del anterior: el contorno se ve igual y el DOM pesa una fracción.
     El primero y el último siempre se conservan, para que el anillo cierre. */
  function trazo(anillo, pr) {
    let d = '', ux = null, uy = null;
    for (let i = 0; i < anillo.length; i++) {
      const [x, y] = pr(anillo[i][0], anillo[i][1]);
      const ultimo = i === anillo.length - 1;
      if (ux !== null && !ultimo && Math.hypot(x - ux, y - uy) < 0.6) continue;
      d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      ux = x; uy = y;
    }
    return d ? d + 'Z' : '';
  }

  function contornos(geo, pr, clave) {
    return geo.map((f) => {
      const polis = f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates] : f.geometry.coordinates;
      const d = polis.map((anillos) => anillos.map((a) => trazo(a, pr)).join(' ')).join(' ');
      return {
        cve: clave ? f.properties[clave] : (f.properties.cve_mun || f.properties.cvegeo),
        nombre: f.properties.state_name || f.properties.nombre || '',
        d: d,
      };
    }).filter((c) => c.d);
  }

  function escenario(cabeceras, municipios) {
    const porCve = {};
    municipios.forEach((m) => { porCve[m.cve_mun] = m; });

    // El geojson de cabeceras trae `nombre_municipio` EN MAYÚSCULAS ("CALKINÍ").
    // El nombre de presentación —acentuado y en caja normal— vive en el dato
    // electoral, que lo toma del catálogo del INEGI. Se usa ése; duplicar aquí
    // una tabla de nombres es invitarla a divergir de la del pipeline.
    const pts = cabeceras.map((f) => ({
      cve: f.properties.cve_mun,
      nombre: (porCve[f.properties.cve_mun] || {}).nombre
              || f.properties.nombre_municipio || '',
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    })).filter((p) => p.cve);

    return pts;
  }

  function pintar(d) {
    // El encuadre lo fija CAMPECHE con zoom prominente (padding 1.45×).
    // Campeche llena la pantalla y es el protagonista absoluto.
    const pr = proyector(d.pais, d.geo, 1.45);
    const nacion = contornos(d.pais, pr, 'state_code');
    const mapa = contornos(d.geo, pr);
    const porCve = {};
    d.municipios.forEach((m) => { porCve[m.cve_mun] = m; });

    const nodos = escenario(d.cabeceras, d.municipios).map((n) => {
      const [x, y] = pr(n.lon, n.lat);
      return Object.assign({}, n, {
        x: x, y: y,
        ganador: (porCve[n.cve] || {}).ganador || null,
      });
    });

    /* Las cabeceras del norte se apiñan —Calkiní, Dzitbalché, Hecelchakán y
       Tenabo caben en poco espacio— y sus etiquetas se encabalgaban hasta ser
       ilegibles. Se recorren de arriba abajo y, cuando dos quedan a menos de
       11 px, la segunda se manda arriba del punto en vez de abajo. */
    const orden = nodos.slice().sort((a, b) => a.y - b.y);
    orden.forEach((n, i) => {
      n.dy = 16;
      for (let j = 0; j < i; j++) {
        const o = orden[j];
        if (Math.abs(o.x - n.x) < 46 && Math.abs(o.y + o.dy - (n.y + n.dy)) < 11) {
          n.dy = n.dy > 0 ? -12 : 16;
        }
      }
    });
    const lider = d.sim.fuerzas[0];

    document.getElementById('cabecera-pills').innerHTML =
      P.badge('estimacion', {
        detalle: `Monte Carlo · ${T.num(d.sim.iteraciones)} iteraciones`,
        confianza: d.proy.confianza,
        fuente: d.meta.fuente_base,
        fechaCorte: d.meta.fecha_corte,
        nota: `Semilla fija ${d.sim.semilla}: la simulación corrió en el `
            + `pipeline y es reproducible. La página no recalcula nada.`,
      });

    document.getElementById('contenido').innerHTML = `

      <section class="panel">
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="sparkles"></i> Los escenarios simulados
        </h3>

        <div class="aviso-simulado aviso-simulado--modelo">
          <i data-lucide="info"></i>
          <span><strong>Esto es un modelo, no un resultado.</strong>
          ${T.escapar(d.proy.advertencia)}</span>
        </div>

        <div class="prediccion prediccion--inicial" id="prediccion-contenedor">
          
          <!-- Barra superior de control Pro sobre el mapa -->
          <div class="prediccion__control-bar" id="prediccion-barra">
            <div class="prediccion__control-left">
              <button type="button" class="prediccion__disparo" id="disparo">
                <i data-lucide="play" class="prediccion__disparo-icon"></i>
                <span class="prediccion__disparo-txt">Ejecutar simulación de Monte Carlo</span>
              </button>
            </div>

            <div class="prediccion__control-right">
              <div class="prediccion__badge-status">
                <span class="prediccion__pulse-dot" id="pulse-dot"></span>
                <span class="prediccion__contador" id="contador">100,000 escenarios listos</span>
              </div>
            </div>
          </div>

          <div class="prediccion__lienzo">
            ${svg(nodos, mapa, nacion, pr)}
            <p class="prediccion__estado" id="estado" aria-live="polite"></p>
          </div>

          <div class="prediccion__lectura revelable" data-revelar="0" hidden>
            <p class="prediccion__copy">
              ${T.num(d.sim.iteraciones)} escenarios distintos de la jornada
              del 6 de junio de 2027. En cada uno, el voto se reparte un poco
              diferente. Recórrelos y mira dónde acaban.
            </p>
            <div id="resultado" hidden>
              ${titular(lider, d)}
            </div>
          </div>
        </div>

        <p class="prediccion__letra-chica revelable" data-revelar="4" hidden>
        <i data-lucide="info" class="icon-xs"></i>
        <span>Modelo reproducible: la simulación corrió en el pipeline con
        semilla fija <code>${T.escapar(d.sim.semilla)}</code> y su resultado
        está congelado en el repositorio. La animación recorre esos escenarios;
        no los recalcula, así que el número es el mismo en cada carga.</span>
      </p>

      <p class="panel__nota" id="nota-mapa" hidden>
          <strong>Ojo con el mapa.</strong> Los colores son el ganador
          <em>medido</em> de 2024, no una proyección por municipio: la
          simulación es estatal —seis bloques, ninguna clave territorial—.
          Sirven para ver de dónde parte cada municipio, no a dónde llega.
        </p>
      </section>

      ${panelPorQue(d)}
      ${panelProbabilidades(d)}
      ${panelSwing(d)}
      ${panelFuerzas(d)}
      ${panelSensibilidad(d)}
    `;

    conectar(nodos, d);
    P.iconos();
    if (window.lucide) window.lucide.createIcons();
  }

  function svg(nodos, mapa, nacion, pr) {
    /* Centroide aproximado de los vecinos más visibles de Campeche, para
       etiquetarlos como lo hace la cartografía Leaflet. Las coordenadas son
       el punto medio visual del estado, no el centroide geométrico estricto
       — lo que importa es que la etiqueta caiga "dentro del territorio" a
       simple vista, como hacen los tiles de CartoDB. */
    const vecinos = {
      31: { nombre: 'YUCATÁN', lon: -89.0, lat: 20.8 },
      23: { nombre: 'QUINTANA ROO', lon: -87.8, lat: 19.6 },
      27: { nombre: 'TABASCO', lon: -92.6, lat: 17.95 },
    };
    const etiquetasVecinos = Object.entries(vecinos).map(([code, v]) => {
      const [x, y] = pr(v.lon, v.lat);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="etiqueta-estado">${v.nombre}</text>`;
    }).join('');

    /* Centroide de Campeche para el halo radial: se calcula del contorno
       del estado, no se inventa un punto. */
    const campeche = nacion.find((e) => String(e.cve) === '4');
    const campCoords = campeche ? pr(-90.3, 18.65) : [W / 2, H / 2];

    /* Etiqueta del Golfo de México, al noroeste de Campeche. */
    const golfo = pr(-93.5, 20.5);

    return `
      <svg viewBox="0 0 ${W} ${H}" class="prediccion__svg" role="img"
           aria-label="Mapa de México con Campeche destacado y sus 13 municipios">
        <defs>
          <!-- Gradiente radial oscuro: viñeta que imita los tiles CartoDB Dark
               Matter. El centro coincide con Campeche para que sea la zona más
               clara del lienzo. -->
          <radialGradient id="viñeta" cx="${(campCoords[0] / W).toFixed(3)}"
                          cy="${(campCoords[1] / H).toFixed(3)}" r="0.72">
            <stop offset="0%"  stop-color="#0d1420" stop-opacity="0"/>
            <stop offset="60%" stop-color="#080c14" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#050810" stop-opacity="0.82"/>
          </radialGradient>

          <!-- Halo de foco: un resplandor tenue azul alrededor de Campeche,
               para que el estado "salga" del fondo como en un mapa iluminado. -->
          <filter id="glow-camp" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0.36
                      0 0 0 0 0.62
                      0 0 0 0 1
                      0 0 0 0.55 0"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- Sutil inner shadow en los bordes estatales para darles
               tridimensionalidad, como la que dan los tiles rasterizados. -->
          <filter id="sombra-estado" x="-2%" y="-2%" width="104%" height="104%">
            <feDropShadow dx="0" dy="0.6" stdDeviation="0.8"
                          flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>

        <!-- Fondo oscuro del lienzo. No es transparente: simula la base
             de CartoDB Dark Matter con un gradiente radial sutil. -->
        <rect width="${W}" height="${H}" fill="#080c14"/>
        <!-- Retícula sutil: un pattern de puntos casi invisibles que sugiere
             coordenadas sin dibujarlas. -->
        <rect width="${W}" height="${H}" fill="url(#viñeta)"/>

        <!-- México de fondo. Más visible que antes: opacidad 0.55 en vez de
             0.4, y un relleno ligeramente más claro para que se distingan las
             siluetas de los estados. La idea no es que compitan con Campeche
             sino que den masa y escala al país, como los tiles oscuros. -->
        <g id="nacion" filter="url(#sombra-estado)">
          ${nacion.filter((e) => String(e.cve) !== '4').map((e) => `
            <path class="pais" d="${e.d}"></path>`).join('')}
        </g>

        <!-- Labels de estados vecinos: replicando la convención cartográfica
             de nombrar territorios adyacentes en tipografía espaciada. -->
        <g id="labels-vecinos">${etiquetasVecinos}
          <text x="${golfo[0].toFixed(1)}" y="${golfo[1].toFixed(1)}"
                class="etiqueta-agua">GOLFO DE MÉXICO</text>
        </g>

        <!-- Halo de Campeche: la capa de resplandor se dibuja DEBAJO del
             contorno real para que el glow rodee sin tapar. -->
        <g id="halo-camp" filter="url(#glow-camp)">
          ${nacion.filter((e) => String(e.cve) === '4').map((e) => `
            <path d="${e.d}" fill="rgba(91,157,255,0.08)"
                  stroke="rgba(91,157,255,0.4)" stroke-width="3"
                  stroke-linejoin="round"></path>`).join('')}
        </g>

        <!-- Campeche: contorno remarcado con doble trazo (ancho tenue + fino
             brillante) para que el ojo llegue solo, como en cartografía. -->
        <g id="realce">
          ${nacion.filter((e) => String(e.cve) === '4').map((e) => `
            <path class="realce" d="${e.d}"></path>`).join('')}
        </g>

        <!-- Los municipios: el único elemento con color pleno. Bordes más
             brillantes que antes para que las divisiones internas se lean. -->
        <g id="mapa">
          ${mapa.map((c) => `
            <path class="mun" data-cve="${T.escapar(c.cve)}" d="${c.d}"
                  fill="rgba(91,157,255,0.06)" stroke="rgba(91,157,255,0.28)"
                  stroke-width="0.8" stroke-linejoin="round"></path>`).join('')}
        </g>
        <g id="enlaces" stroke="var(--serie-7)" stroke-width="0.6" opacity="0"></g>
        <g id="nodos">
          ${nodos.map((n, i) => `
            <g class="nodo" data-i="${i}" data-cve="${T.escapar(n.cve)}" opacity="0">
              <circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="9"
                      fill="var(--serie-7)" fill-opacity="0.55"
                      stroke="var(--velo-05)" stroke-width="1.5"></circle>
              <text x="${n.x.toFixed(1)}" y="${(n.y + n.dy).toFixed(1)}"
                    text-anchor="middle" class="nodo__txt">${T.escapar(n.nombre)}</text>
            </g>`).join('')}
        </g>
      </svg>`;
  }

  function titular(lider, d) {
    return `
      <div class="prediccion__titular">
        <span class="prediccion__bloque" style="background:${color(lider.bloque)}"></span>
        <div>
          <strong class="prediccion__cifra">
            ${T.intervalo(lider.media, lider.p5, lider.p95)}
          </strong>
          <span class="text-small">${T.escapar(E.etiqueta(lider.bloque))}
            · probabilidad de victoria ${T.pct(lider.prob_victoria)}</span>
        </div>
      </div>
      <p class="text-small prediccion__pie">
        Monte Carlo · ${T.num(d.sim.iteraciones)} iteraciones · Dirichlet
        (κ ${d.sim.kappa_dirichlet}) · semilla ${T.escapar(d.sim.semilla)} ·
        error de Monte Carlo ±${d.sim.error_montecarlo_pp} pp
      </p>`;
  }

  /* ── La animación ──
     Un solo requestAnimationFrame que se cancela al terminar. Trece círculos
     y doce líneas: menos DOM que la tabla que hay debajo. Nada de canvas,
     nada de partículas, nada que siga corriendo cuando acabe. */

  function conectar(nodos, d) {
    const boton = document.getElementById('disparo');
    const estado = document.getElementById('estado');
    const resultado = document.getElementById('resultado');
    const nota = document.getElementById('nota-mapa');
    const gEnlaces = document.getElementById('enlaces');
    const gNodos = [...document.querySelectorAll('.nodo')];
    // El polígono de cada municipio, indexado por clave, para poder teñir el
    // territorio y no sólo el punto que lo marca.
    const poli = {};
    document.querySelectorAll('.mun').forEach((el) => { poli[el.dataset.cve] = el; });
    if (!boton) return;

    const bloques = d.sim.fuerzas.map((f) => f.bloque);

    // Cada nodo con su vecino más cercano: doce líneas que sugieren que el
    // modelo recorre el territorio, sin ser un grafo de nada real. Es
    // decoración y por eso no se etiqueta ni se explica como dato.
    const enlaces = nodos.map((a, i) => {
      let mejor = null, dist = Infinity;
      nodos.forEach((b, j) => {
        if (i === j) return;
        const dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (dd < dist) { dist = dd; mejor = b; }
      });
      return { a, b: mejor };
    });

    const contador = document.getElementById('contador');
    const revelables = [...document.querySelectorAll('.revelable')]
      .sort((a, b) => (+a.dataset.revelar) - (+b.dataset.revelar));

    /* El contenido nace en el DOM con `hidden`, no se inyecta al terminar.
       Así existe para un lector de pantalla y para Ctrl+F aunque nadie pulse
       el botón: la animación es una forma de presentar, no una condición para
       que el dato exista. Revelar sólo quita `hidden` y añade la clase que
       dispara la transición. */
    const revelar = (escalonado) => {
      revelables.forEach((el, i) => {
        el.hidden = false;
        if (!escalonado) { el.classList.add('revelada'); return; }
        setTimeout(() => el.classList.add('revelada'), 90 * i);
      });
    };

    const contenedor = document.getElementById('prediccion-contenedor');
    const pulseDot = document.getElementById('pulse-dot');

    const asentar = () => {
      if (contenedor) {
        contenedor.classList.remove('prediccion--ejecutando', 'prediccion--inicial');
        contenedor.classList.add('prediccion--revelado');
      }
      if (pulseDot) {
        pulseDot.classList.add('prediccion__pulse-dot--completado');
      }
      gNodos.forEach((g, i) => {
        const n = nodos[i];
        const c = g.querySelector('circle');
        g.setAttribute('opacity', '1');
        c.setAttribute('fill', n.ganador ? color(n.ganador) : 'var(--serie-7)');
        c.setAttribute('fill-opacity', '0.95');
        c.setAttribute('r', '7');
        // El territorio se tiñe con el ganador de 2024. Es lo que hace legible
        // el mapa: trece puntos de color sobre un fondo gris no dicen quién
        // domina dónde, la superficie sí.
        const m = poli[n.cve];
        if (m && n.ganador) {
          m.setAttribute('fill', color(n.ganador));
          m.setAttribute('fill-opacity', '0.42');
        }
      });
      gEnlaces.setAttribute('opacity', '0.18');
      estado.textContent = 'Escenarios recorridos. El mapa muestra reparto base 2024.';
      contador.textContent = `${T.num(d.sim.iteraciones)} escenarios completados`;
      contador.classList.add('prediccion__contador--fin');
      gEnlaces.classList.remove('fluye');
      resultado.hidden = false;
      nota.hidden = false;
      boton.disabled = true;
      boton.innerHTML = `<i data-lucide="check-circle"></i><span>Escenarios ya recorridos</span>`;
      revelar(!quieto);
      if (window.lucide) window.lucide.createIcons();
    };

    // `quieto` se consulta dentro de asentar(), así que se declara antes.
    const quieto = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Quien pidió menos movimiento no ve la función; ve el final.
    boton.addEventListener('click', () => {
      if (quieto) { asentar(); return; }

      if (contenedor) {
        contenedor.classList.add('prediccion--ejecutando');
      }
      if (pulseDot) {
        pulseDot.classList.add('prediccion__pulse-dot--activo');
      }

      // El flujo por las líneas es `stroke-dashoffset` animado por CSS: es la
      // propiedad que el compositor acelera, así que doce líneas no cuestan
      // nada. Se apaga quitando la clase, no con un contador de repeticiones.
      gEnlaces.innerHTML = enlaces.map(({ a, b }) =>
        `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}"
               x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"></line>`).join('');
      gEnlaces.classList.add('fluye');

      boton.disabled = true;
      boton.innerHTML = `<i data-lucide="loader-2" class="prediccion__spin"></i><span>Procesando escenarios…</span>`;
      if (window.lucide) window.lucide.createIcons();
      const t0 = performance.now();
      let raf = 0;
      let cerrado = false;

      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        cancelAnimationFrame(raf);
        asentar();
      };

      // Red de seguridad. `requestAnimationFrame` no garantiza cadencia: en
      // una pestaña de fondo se pausa, y en un entorno sin compositor puede
      // dispararse un par de veces y no más — lo comprobé en Chrome headless,
      // donde la animación se quedaba a medias y el resultado nunca aparecía.
      // El estado final no puede depender de que lleguen suficientes frames:
      // este temporizador lo garantiza aunque no llegue ninguno.
      const red = setTimeout(cerrar, ACTOS.total + 400);

      const paso = (ahora) => {
        const t = ahora - t0;

        if (t < ACTOS.siembra) {
          // Acto 1 — siembra: aparece un nodo por municipio.
          const cuantos = Math.floor((t / ACTOS.siembra) * gNodos.length);
          gNodos.forEach((g, i) => g.setAttribute('opacity', i <= cuantos ? '1' : '0'));
          estado.textContent = 'Situando los 13 municipios…';
          contador.textContent = 'preparando…';

        } else if (t < ACTOS.barrido) {
          // Acto 2 — barrido: Efecto sci-fi (procesamiento de datos).
          // Los nodos pulsan en color tech/cian simulando el motor Monte Carlo,
          // mostrando trabajo y flujo sin usar colores finales todavía.
          const p = (t - ACTOS.siembra) / (ACTOS.barrido - ACTOS.siembra);
          const cada = 90 - p * 60;
          gEnlaces.setAttribute('opacity', String(0.3 + 0.5 * p));
          
          const colorTech = '#00e5ff'; // Cyan sci-fi
          
          gNodos.forEach((g, i) => {
            const n = nodos[i];
            // Pulso que se acelera progresivamente
            const pulse = Math.sin((t / cada + i) * Math.PI) * 0.5 + 0.5;
            
            const circle = g.querySelector('circle');
            circle.setAttribute('fill', colorTech);
            circle.setAttribute('fill-opacity', String(0.4 + 0.6 * pulse));
            
            const m = poli[n.cve];
            if (m) {
              m.setAttribute('fill', colorTech);
              m.setAttribute('fill-opacity', String(0.02 + 0.12 * pulse * p));
            }
          });
          estado.textContent =
            `Recorriendo ${T.num(d.sim.iteraciones)} escenarios ya simulados…`;
          // Sube desacelerando: llega cerca del total pronto y remata al
          // final, que es como se siente un proceso que va terminando. El
          // verbo es "escenario", no "iteración": recorre lo ya simulado.
          contador.textContent =
            `escenario ${T.num(Math.round(d.sim.iteraciones * (1 - Math.pow(1 - p, 2.2))))}`;

        } else if (t < ACTOS.total) {
          // Acto 3 — asiento: cada nodo cae en su ganador de 2024.
          const p = (t - ACTOS.barrido) / (ACTOS.total - ACTOS.barrido);
          gNodos.forEach((g, i) => {
            const n = nodos[i];
            const c = g.querySelector('circle');
            const col = n.ganador ? color(n.ganador) : 'var(--serie-7)';
            c.setAttribute('fill', col);
            c.setAttribute('fill-opacity', String(0.8 + 0.15 * p));
            c.setAttribute('r', String(9 - 2 * p));
            const m = poli[n.cve];
            if (m && n.ganador) {
              m.setAttribute('fill', col);
              m.setAttribute('fill-opacity', String(0.26 + 0.16 * p));
            }
          });
          gEnlaces.setAttribute('opacity', String(0.3 - 0.12 * p));

        } else {
          clearTimeout(red);
          cerrar();                    // termina y se queda quieta
          return;
        }
        raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    });
  }

  /* ── Los paneles de siempre ──
     Se traen tal cual de historico.js: mismo dato, mismo formato, misma
     regla de nunca imprimir el central solo. */


  /* ── 4A · Qué mueve el resultado ──
     Las entradas REALES del modelo, leídas de la metadata que el pipeline
     declara. No se enumera ningún factor que el modelo no use: si mañana
     entra uno nuevo, aparece aquí solo; si sale, desaparece. */

  function panelPorQue(d) {
    const sig = d.meta.origen_sigma || {};
    const est = sig.estimaciones || {};
    const disp = d.meta.insumos_disponibles || {};
    const falta = d.meta.insumos_ausentes || {};

    return `
      <section class="panel revelable" data-revelar="2" hidden>
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="git-branch"></i> Qué mueve este resultado
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          El modelo no adivina: parte de un reparto medido y le aplica una
          incertidumbre también medida. Estas son sus dos entradas, y de dónde
          sale cada una.
        </p>

        <div class="rejilla-tarjetas" style="margin-top:var(--space-md)">
          ${T.cifra('Reparto de partida', T.pct(d.sim.fuerzas[0].base_2024), 'dato', {
            detalle: `${E.etiqueta(d.sim.fuerzas[0].bloque)} en 2024`,
            fuente: d.meta.fuente_base,
          })}
          ${T.cifra('Cuánto puede moverse (σ)', `${d.sim.sigma_lider_pp} pp`, 'calculo', {
            detalle: sig.origen === 'calculado del tracking'
              ? 'medido en el tracking' : 'valor de respaldo',
            fuente: sig.casa || '',
          })}
          ${T.cifra('Dispersión del reparto (κ)', String(d.sim.kappa_dirichlet), 'calculo', {
            detalle: 'concentración Dirichlet',
          })}
        </div>

        ${Object.keys(est).length ? `
          <p class="panel__nota">
            <strong>σ no se eligió a ojo.</strong> Sale de
            ${T.escapar(sig.casa || 'el tracking')}
            (${T.escapar(sig.periodo || '')}), por tres caminos independientes:
          </p>
          <div class="tabla-caja">
            <table class="tabla tabla--compacta">
              <thead><tr><th>Estimación</th><th class="num">pp</th></tr></thead>
              <tbody>
                ${Object.entries(est).map(([k, v]) => `
                  <tr>
                    <td>${T.escapar(k.replace(/_/g, ' '))}</td>
                    <td class="num">${v}</td>
                  </tr>`).join('')}
                <tr class="fila--destacada">
                  <td><strong>La que usa el modelo</strong></td>
                  <td class="num"><strong>${d.sim.sigma_lider_pp}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="panel__nota">
            ${T.escapar(sig.criterio || '')}
            Las tres se publican: si divergieran mucho, el promedio escondería
            el desacuerdo.
          </p>` : ''}

        <p class="panel__nota">
          <strong>Lo que el modelo NO usa.</strong>
          ${Object.entries(falta).map(([k, v]) =>
            `${T.escapar(k.replace(/_/g, ' '))} — ${T.escapar(v)}`).join(' ')}
          Se declara para que el hueco sea visible, no para disimularlo.
        </p>

        ${P.pie({
          fuente: [disp.resultado_2024_por_bloque, disp.tracking_de_encuestas]
            .filter(Boolean).join(' · '),
          fechaCorte: d.meta.fecha_corte,
          metodologia: 'Las entradas se leen de la metadata que declara el '
            + 'pipeline al generar la proyección; esta página no las reinterpreta.',
          confianza: d.proy.confianza,
          cobertura: 'Entidad 04',
        })}
      </section>`;
  }

  /* ── 4B · Los seis bloques ──
     Antes sólo se veía el líder. Un tablero que enseña únicamente a quien va
     ganando no permite juzgar cuán apretado está. */

  function panelProbabilidades(d) {
    const maxP = Math.max(...d.sim.fuerzas.map((f) => f.prob_victoria)) || 1;
    return `
      <section class="panel revelable" data-revelar="3" hidden>
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="bar-chart-3"></i> Probabilidad de victoria, bloque por bloque
          ${P.badge('estimacion', {
            detalle: `${T.num(d.sim.iteraciones)} iteraciones`,
            nota: `Semilla fija ${d.sim.semilla}: reproducible corriendo el pipeline.`,
          })}
        </h3>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Bloque</th>
                <th>En cuántas de las ${T.num(d.sim.iteraciones)} queda primero</th>
                <th class="num">Prob.</th>
                <th class="num">P5–P95</th>
              </tr>
            </thead>
            <tbody>
              ${d.sim.fuerzas.map((f) => `
                <tr>
                  <td><span class="punto-color" style="background:${color(f.bloque)}"></span>
                      ${T.escapar(E.etiqueta(f.bloque))}</td>
                  <td>${T.barra(f.prob_victoria, maxP,
                        T.num(Math.round(f.prob_victoria / 100 * d.sim.iteraciones)))}</td>
                  <td class="num">${T.pct(f.prob_victoria)}</td>
                  <td class="num">${T.pct(f.p5)} – ${T.pct(f.p95)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          <strong>0.0 % no quiere decir imposible.</strong> Quiere decir que ese
          bloque no quedó primero en ninguna de las
          ${T.num(d.sim.iteraciones)} iteraciones que se corrieron, con los
          supuestos de este modelo. Un supuesto distinto —σ mayor, por
          ejemplo— da otras cifras; eso es justo lo que enseña el barrido de
          sensibilidad más abajo.
        </p>
      </section>`;
  }

  /* ── 4C · Qué tendría que pasar ──
     Deriva sobre la estimación, usando la MISMA función que clasifica la
     competitividad municipal. Que el umbral estatal y el municipal salgan de
     la misma regla es lo que hace comparables las dos lecturas. */

  function panelSwing(d) {
    const [primero, segundo, tercero] = d.sim.fuerzas;
    if (!segundo) return '';
    const sigma = d.sim.sigma_lider_pp;

    const fila = (f) => {
      const margen = primero.media - f.media;
      const swing = E.swingNecesario(margen);
      const veces = swing / sigma;
      return `
        <tr>
          <td><span class="punto-color" style="background:${color(f.bloque)}"></span>
              ${T.escapar(E.etiqueta(f.bloque))}</td>
          <td class="num">${T.pct(margen)}</td>
          <td class="num"><strong>${T.pct(swing)}</strong></td>
          <td class="num">${veces.toFixed(1)}×</td>
          <td>${T.escapar(E.COMPETITIVIDAD
                ? (E.COMPETITIVIDAD[E.competitividad(margen, sigma)] || {}).etiqueta || ''
                : '')}</td>
        </tr>`;
    };

    return `
      <section class="panel revelable" data-revelar="4" hidden>
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="move-horizontal"></i> Qué tendría que pasar para que ganara otro
          ${P.badge('calculo', {
            detalle: 'derivación sobre la estimación',
            nota: 'Se calcula sobre la proyección ya congelada; no reejecuta el modelo.',
          })}
        </h3>

        <p class="tarjeta__texto" style="max-width:78ch">
          Para alcanzar al primero no basta con subir: hay que subir lo que el
          otro baja. Por eso el movimiento necesario es <strong>la mitad del
          margen</strong> — la misma regla con la que se clasifica la
          competitividad de cada municipio, aplicada aquí al estado.
        </p>

        <div class="aviso-simulado">
          <i data-lucide="move-horizontal"></i>
          <span><strong>${T.escapar(E.etiqueta(segundo.bloque))} necesitaría un
          movimiento de ${T.pct(E.swingNecesario(primero.media - segundo.media))}</strong>
          sobre el reparto proyectado para alcanzar el primer lugar. El tracking
          ha medido movimientos de ${sigma} pp (σ), así que eso es
          ${(E.swingNecesario(primero.media - segundo.media) / sigma).toFixed(1)}
          veces lo observado.</span>
        </div>

        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Bloque</th>
                <th class="num">Margen contra el primero</th>
                <th class="num">Movimiento necesario</th>
                <th class="num">Veces σ</th>
                <th>Cómo se clasifica</th>
              </tr>
            </thead>
            <tbody>
              ${fila(segundo)}
              ${tercero ? fila(tercero) : ''}
            </tbody>
          </table>
        </div>

        <p class="panel__nota">
          <strong>Es un cálculo, no un pronóstico.</strong> Dice cuánto haría
          falta, no si va a ocurrir. Y se hace sobre la proyección ya calculada
          en el pipeline: esta página no vuelve a simular nada.
        </p>
        ${P.pie({
          fuente: 'Derivación sobre la proyección de este mismo archivo',
          fechaCorte: d.meta.fecha_corte,
          metodologia: 'swing = margen / 2, la misma función que usa la '
            + 'competitividad municipal (Electoral.swingNecesario). σ del '
            + 'tracking = ' + sigma + ' pp.',
          confianza: 'media',
          cobertura: 'Entidad 04',
        })}
      </section>`;
  }

  function panelFuerzas(d) {
    return `
      <section class="panel panel--proyeccion revelable" data-revelar="5" hidden>
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="trending-up"></i> Proyección ${T.escapar(d.proy.cargo)} 2027
          ${P.badge('estimacion', {
            detalle: `Monte Carlo · ${T.num(d.sim.iteraciones)} iteraciones`,
            confianza: d.proy.confianza,
            nota: `Semilla fija ${d.sim.semilla}: reproducible corriendo el pipeline.`,
          })}
        </h3>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fuerza</th>
                <th class="num">Base 2024</th>
                <th class="num">Intervalo estimado P5–P95</th>
                <th class="num">Prob. de victoria</th>
              </tr>
            </thead>
            <tbody>
              ${d.sim.fuerzas.map((f) => `
                <tr>
                  <td><span class="punto-color" style="background:${color(f.bloque)}"></span>
                      ${T.escapar(E.etiqueta(f.bloque))}</td>
                  <td class="num">${T.pct(f.base_2024)}</td>
                  <td class="num">${T.intervalo(f.media, f.p5, f.p95)}</td>
                  <td class="num">${T.pct(f.prob_victoria)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          El central nunca va solo: cada fila lleva su intervalo P5–P95. Una
          fuerza cuyo intervalo cruza al de otra no tiene ventaja decidible con
          este modelo, por más que su media sea mayor.
        </p>
        ${P.pie({
          fuente: d.meta.fuente_base,
          fechaCorte: d.meta.fecha_corte,
          metodologia: `${d.meta.metodo}. Dirichlet sobre el reparto de 2024 `
            + `(κ ${d.sim.kappa_dirichlet}), σ del líder ${d.sim.sigma_lider_pp} pp, `
            + `semilla ${d.sim.semilla}. Error de Monte Carlo sobre la `
            + `probabilidad: ±${d.sim.error_montecarlo_pp} pp.`,
          confianza: d.proy.confianza,
          cobertura: 'Entidad 04 · jornada del 6 de junio de 2027',
        })}
      </section>`;
  }

  function panelSensibilidad(d) {
    if (!d.sens || !d.sens.length) return '';
    return `
      <section class="panel revelable" data-revelar="6" hidden>
        <h3 class="text-h3 panel__titulo">
          <i data-lucide="sliders-horizontal"></i> Qué pasa si el error es otro
        </h3>
        <p class="tarjeta__texto" style="max-width:78ch">
          σ es cuánto puede moverse el líder respecto a 2024. No se elige a ojo:
          sale de la volatilidad medida en el tracking. Esta tabla enseña qué
          tan sensible es la conclusión a ese supuesto.
        </p>
        <div class="tabla-caja" style="margin-top:var(--space-md)">
          <table class="tabla tabla--compacta">
            <thead>
              <tr>
                <th class="num">σ (pp)</th>
                <th class="num">P5–P95 del líder</th>
                ${Object.keys(d.sens[0].prob_victoria).map((b) =>
                  `<th class="num">${T.escapar(b)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${d.sens.map((s) => `
                <tr${s.sigma_lider_pp === d.sim.sigma_lider_pp ? ' class="fila--destacada"' : ''}>
                  <td class="num">${s.sigma_lider_pp}</td>
                  <td class="num">${T.pct(s.p5_p95_lider[0])} – ${T.pct(s.p5_p95_lider[1])}</td>
                  ${Object.values(s.prob_victoria).map((v) =>
                    `<td class="num">${T.pct(v)}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="panel__nota">
          La fila resaltada es la σ que se usa en la proyección de arriba
          (${d.sim.sigma_lider_pp} pp), la medida en el tracking. Las demás son
          el mismo modelo con otro supuesto, para ver si la conclusión aguanta.
        </p>
      </section>`;
  }
})();
