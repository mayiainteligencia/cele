/* ============================================
   CEREBRO ELECTORAL — MÓDULO TERRITORIAL
   ============================================
   Carga y helpers compartidos por las vistas de
   Territorio: casillas, demografía, NSE e
   histórico/proyección.

     Territorio.cargar().then(d => ...)

   Lo REAL del archivo son los 13 municipios, sus
   claves y los agregados del catálogo CCT. Todo
   lo demás es de demostración y se pinta con el
   badge rayado de "Simulado". Ninguna vista debe
   mostrar una cifra simulada sin ese badge.
   ============================================ */

(function (global) {
  'use strict';

  const RUTA = 'data/mock/territorio.json';
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

  /** Botones de exportación. En esta etapa no generan archivo. */
  function exportar(nombre) {
    return `<div class="subnav-bar" role="group" aria-label="Exportar ${escapar(nombre)}">
      ${['Excel', 'CSV', 'PDF'].map((f) => `
        <button class="subnav-btn" data-exportar="${f}" data-tabla="${escapar(nombre)}">
          <i data-lucide="download"></i><span>${f}</span>
        </button>`).join('')}
    </div>`;
  }

  /** Engancha los botones de exportación a un aviso honesto. */
  function conectarExportar() {
    document.querySelectorAll('[data-exportar]').forEach((b) => {
      b.addEventListener('click', () => {
        const f = b.dataset.exportar;
        if (global.mostrarToast) {
          global.mostrarToast(`Exportación a ${f} pendiente de implementar. La UI está lista; falta el generador.`);
        } else {
          alert(`Exportación a ${f} pendiente de implementar en esta etapa.`);
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
