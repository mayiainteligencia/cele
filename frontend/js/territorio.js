/* ============================================
   CEREBRO ELECTORAL — MÓDULO TERRITORIAL
   ============================================
   Carga y helpers compartidos por las vistas de
   Territorio: casillas, demografía, NSE e
   histórico/proyección.

     Territorio.cargar().then(d => ...)

   Carga el contexto estatal: las cifras que se
   capturan a mano de la publicación de cada
   institución (Censo del INEGI, padrón del INE)
   más la estimación de NSE y la proyección 2027.

   Lo de 2024 —casillas, secciones, resultados,
   lista nominal por municipio— NO está aquí: sale
   de Electoral.cargar(), que lee lo que produce el
   pipeline desde el insumo original.

   Cada bloque del archivo trae su `procedencia`.
   Una estimación se pinta como estimación, con su
   intervalo; nunca como dato de fuente.
   ============================================ */

(function (global) {
  'use strict';

  const RUTA = 'data/contexto_campeche.json';
  let promesa = null;

  function cargar() {
    if (promesa) return promesa;
    promesa = fetch(RUTA)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} al cargar ${RUTA}`);
        return r.json();
      })
      .catch((err) => {
        console.error('Territorio:', err);
        document.querySelectorAll('[data-territorio]').forEach((el) => {
          el.innerHTML = '<p class="text-small">No se pudieron cargar los datos del módulo territorial.</p>';
        });
        throw err;
      });
    return promesa;
  }

  const num = (v) => (typeof v === 'number' ? v.toLocaleString('es-MX') : '—');
  const pct = (v, d) => (typeof v === 'number' ? v.toFixed(d === undefined ? 1 : d) + ' %' : '—');

  function escapar(v) {
    if (v === null || v === undefined || v === '') return '—';
    return String(v).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  /** Aviso fijo de página: estos números no son oficiales. */
  function avisoSimulado(que) {
    return `<div class="aviso-simulado">
      <i data-lucide="flask-conical"></i>
      <span><strong>Datos de demostración.</strong> ${escapar(que)}
      No provienen del INEGI, del INE ni del IEEC, y no deben usarse para
      decidir ni publicarse como cifras oficiales. El universo de 13 municipios
      y los agregados del catálogo CCT sí son reales.</span>
    </div>`;
  }

  /** Cifra grande con etiqueta y badge de procedencia. */
  function cifra(etiqueta, valor, proc, op) {
    return `<div class="cifra">
      <span class="cifra__valor">${valor}</span>
      <span class="cifra__etiqueta">${escapar(etiqueta)}</span>
      <span class="cifra__pie">${global.Procedencia.badge(proc, op || {})}</span>
    </div>`;
  }

  /** Barra proporcional para una celda de tabla. */
  function barra(valor, maximo, texto) {
    const ancho = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
    return `<span class="barra">
      <span class="barra__relleno" style="width:${ancho.toFixed(1)}%"></span>
      <span class="barra__txt">${texto}</span>
    </span>`;
  }

  /**
   * Intervalo de incertidumbre. El central NUNCA se imprime solo:
   * esta función es la única forma de mostrar una proyección.
   */
  function intervalo(central, bajo, alto, sufijo) {
    const s = sufijo === undefined ? ' %' : sufijo;
    return `<span class="intervalo">
      <span class="intervalo__centro">${central.toFixed(1)}${s}</span>
      <span class="intervalo__rango">(${bajo.toFixed(1)}–${alto.toFixed(1)})</span>
    </span>`;
  }

  /** Cinta apilada de una distribución {etiqueta: porcentaje}. */
  function cinta(dist, colores) {
    return `<div class="cinta">${Object.entries(dist).map(([k, v], i) => `
      <span class="cinta__seg" style="width:${v}%; background:${colores[i % colores.length]}"
            title="${escapar(k)}: ${v} %">${v >= 8 ? escapar(k) : ''}</span>`).join('')}</div>`;
  }

  const COLORES_ESCALA = ['--escala-6', '--escala-5', '--escala-4', '--escala-3', '--escala-2', '--escala-1'];

  function tokens(nombres) {
    const cs = getComputedStyle(document.documentElement);
    return nombres.map((n) => cs.getPropertyValue(n).trim());
  }

  /* ── Exportación ──
     CSV se genera de verdad, leyendo la tabla que el usuario está viendo.
     Excel y PDF necesitan una librería que este proyecto no carga —es un
     frontend estático sin bundler— así que salen DESHABILITADOS y dicen por
     qué. Antes los tres botones se veían iguales, se dejaban pulsar y
     mostraban un aviso de "pendiente": prometían una función que no existía.
     Un control deshabilitado con motivo informa; uno que falla al pulsarlo
     hace perder el tiempo. */

  const FORMATOS = [
    { f: 'CSV', activo: true },
    { f: 'Excel', activo: false, porque: 'Requiere una librería que el sitio no carga. Usa CSV: Excel lo abre.' },
    { f: 'PDF', activo: false, porque: 'Requiere una librería que el sitio no carga.' },
  ];

  function exportar(nombre) {
    return `<div class="subnav-bar" role="group" aria-label="Exportar ${escapar(nombre)}">
      ${FORMATOS.map(({ f, activo, porque }) => `
        <button class="subnav-btn" data-exportar="${f}" data-tabla="${escapar(nombre)}"
                ${activo ? '' : `disabled title="${escapar(porque)}"`}>
          <i data-lucide="download"></i><span>${f}</span>
        </button>`).join('')}
    </div>`;
  }

  /* Una celda a CSV. Se escapa según RFC 4180: comillas dobladas y el campo
     entrecomillado si trae coma, comilla o salto. Sin esto, un nombre de
     municipio con coma partiría la fila en dos columnas. */
  function celdaCSV(texto) {
    const v = String(texto == null ? '' : texto)
      .replace(/\s+/g, ' ')
      .trim();
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  /* La tabla es la que sigue a la barra dentro del mismo panel: es lo que el
     usuario tiene delante, con sus filtros ya aplicados. Exportar el dato
     crudo daría un archivo que no coincide con la pantalla. */
  function tablaDe(boton) {
    const panel = boton.closest('.panel') || document;
    return panel.querySelector('table');
  }

  function filasCSV(tabla) {
    return [...tabla.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th, td')]
        // Se quita SÓLO lo que no lleva texto: el relleno de la barra, los
        // iconos y los puntos de color. La cifra vive DENTRO de la barra
        // (`.barra__txt`), así que borrar la barra entera vaciaba la columna
        // — es lo que pasaba con "Peso en el estado" y con "Total".
        .map((c) => {
          const clon = c.cloneNode(true);
          clon.querySelectorAll('.barra__relleno, .punto-color, svg, i')
            .forEach((x) => x.remove());
          return celdaCSV(clon.textContent);
        })
        .join(',')
    ).join('\r\n');
  }

  function descargar(nombreArchivo, contenido) {
    // BOM para que Excel abra el CSV en UTF-8; sin él, "Calkiní" sale roto.
    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function conectarExportar() {
    document.querySelectorAll('[data-exportar]').forEach((b) => {
      if (b.disabled) return;          // los deshabilitados ya se explican solos
      b.addEventListener('click', () => {
        const tabla = tablaDe(b);
        if (!tabla) {
          const msg = 'No se encontró la tabla que exportar.';
          if (global.mostrarToast) global.mostrarToast(msg); else alert(msg);
          return;
        }
        const base = (b.dataset.tabla || 'tabla')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const fecha = new Date().toISOString().slice(0, 10);
        descargar(`${base}-${fecha}.csv`, filasCSV(tabla));
        if (global.mostrarToast) {
          global.mostrarToast(`Descargado ${base}-${fecha}.csv`);
        }
      });
    });
  }

  /**
   * Monta la barra de filtros y la alimenta con lo que hay en los datos.
   * Devuelve los municipios ya filtrados, y vuelve a llamar a `alCambiar`
   * cada vez que el usuario mueve un filtro.
   */
  function conectarFiltros(datos, alCambiar) {
    if (!global.Filtros) return datos.municipios;

    global.Filtros.montarBarra('#filtros');
    global.Filtros.registrarOpciones('municipio', datos.municipios.map((m) => ({
      valor: m.cve_mun, etiqueta: m.nombre,
    })));
    if (datos.partidos) {
      global.Filtros.registrarOpciones('partido',
        datos.partidos.map((p) => ({ valor: p, etiqueta: p })));
    }
    const anios = [...new Set(
      (datos.municipios[0].historico || []).map((h) => h.anio)
    )].sort((a, b) => b - a);
    if (anios.length) {
      global.Filtros.registrarOpciones('anio',
        anios.map((a) => ({ valor: a, etiqueta: String(a) })));
    }

    const filtrar = () => {
      const f = global.Filtros.obtener();
      return f.municipio
        ? datos.municipios.filter((m) => m.cve_mun === f.municipio)
        : datos.municipios;
    };

    global.Filtros.alCambiar(() => alCambiar(filtrar()));
    return filtrar();
  }

  global.Territorio = {
    conectarFiltros,
    cargar, num, pct, escapar, avisoSimulado, cifra, barra,
    intervalo, cinta, tokens, COLORES_ESCALA, exportar, conectarExportar,
  };
})(window);
