/* ============================================
   CEREBRO ELECTORAL — PROCEDENCIA DEL DATO
   ============================================
   Regla transversal 4 de la especificación: toda
   salida del sistema declara de dónde viene.

     Dato          sale de una fuente
     Cálculo       resultado de una fórmula
     Estimación    resultado de un modelo
     Inferencia    interpretación analítica
     Recomendación acción sujeta a autorización

   Un solo lugar produce estos badges. Si mañana
   cambia el criterio visual, cambia aquí y cambia
   en toda la app.

     Procedencia.badge('estimacion')
     Procedencia.badge('dato', { fuente: 'INEGI', fechaCorte: '2024-08' })
     Procedencia.badge('estimacion', { confianza: 'media', detalle: '±3.2 pp' })
     Procedencia.leyenda()
     Procedencia.pie({ fuente, fechaCorte, metodologia, confianza })

   Todas devuelven HTML como string. El texto que
   entra se escapa: los nombres de municipio y de
   fuente vienen de archivos externos.
   ============================================ */

(function (global) {
  'use strict';

  const TIPOS = {
    dato: {
      etiqueta: 'Dato',
      icono: 'database',
      ayuda: 'Proviene directamente de una fuente. No fue transformado.',
    },
    calculo: {
      etiqueta: 'Cálculo',
      icono: 'sigma',
      ayuda: 'Resultado de una fórmula aplicada sobre datos de fuente.',
    },
    estimacion: {
      etiqueta: 'Estimación',
      icono: 'trending-up',
      ayuda: 'Resultado de un modelo. Tiene incertidumbre asociada.',
    },
    inferencia: {
      etiqueta: 'Inferencia',
      icono: 'lightbulb',
      ayuda: 'Interpretación analítica. No es un hecho verificado.',
    },
    recomendacion: {
      etiqueta: 'Recomendación',
      icono: 'flag',
      ayuda: 'Acción propuesta. Requiere autorización humana.',
    },
  };

  // Datos de demostración: no salen de ninguna fuente real y no deben
  // usarse para decidir nada. Se marcan aparte de los cinco tipos para
  // que nadie confunda un dummy con un dato de fuente.
  const SIMULADO = {
    etiqueta: 'Simulado',
    icono: 'flask-conical',
    ayuda: 'Valor sintético de demostración. No apto para decisiones.',
  };

  const CONFIANZA = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' };

  function escapar(v) {
    if (v === null || v === undefined || v === '') return '';
    return String(v).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  /**
   * @param {string} tipo  dato | calculo | estimacion | inferencia | recomendacion | simulado
   * @param {object} [op]  { detalle, fuente, fechaCorte, confianza, compacto }
   */
  function badge(tipo, op) {
    op = op || {};
    const t = tipo === 'simulado' ? SIMULADO : TIPOS[tipo];
    if (!t) {
      console.warn('Procedencia: tipo desconocido:', tipo);
      return '';
    }

    // El tooltip carga la definición y, si vienen, fuente y corte:
    // así ninguna cifra queda sin procedencia consultable.
    const tip = [
      t.ayuda,
      op.fuente ? `Fuente: ${op.fuente}` : '',
      op.fechaCorte ? `Corte: ${op.fechaCorte}` : '',
      op.confianza ? CONFIANZA[op.confianza] || op.confianza : '',
    ].filter(Boolean).join(' · ');

    const detalle = op.detalle
      ? `<span class="proc__detalle">${escapar(op.detalle)}</span>`
      : '';

    return `<span class="proc proc--${tipo}${op.compacto ? ' proc--compacto' : ''}"
                  title="${escapar(tip)}">
      <i data-lucide="${t.icono}"></i><span class="proc__txt">${t.etiqueta}</span>${detalle}
    </span>`;
  }

  /** Leyenda de los cinco tipos, para el pie de una sección. */
  function leyenda(incluirSimulado) {
    const tipos = Object.keys(TIPOS).concat(incluirSimulado ? ['simulado'] : []);
    return `<div class="proc-leyenda">
      <span class="proc-leyenda__titulo">Procedencia</span>
      ${tipos.map((t) => badge(t, { compacto: true })).join('')}
    </div>`;
  }

  /**
   * Pie de ficha: fuente, corte, metodología y confianza.
   * Ninguna cifra de la app debe quedar sin uno de estos.
   */
  function pie(op) {
    op = op || {};
    const filas = [
      ['Fuente', op.fuente],
      ['Fecha de corte', op.fechaCorte || 'no declarada por la fuente'],
      ['Metodología', op.metodologia],
      ['Confianza', op.confianza ? CONFIANZA[op.confianza] || op.confianza : null],
      ['Cobertura', op.cobertura],
    ].filter(([, v]) => v);

    return `<dl class="proc-pie">
      ${filas.map(([k, v]) => `<dt>${escapar(k)}</dt><dd>${escapar(v)}</dd>`).join('')}
    </dl>`;
  }

  /** Refresca los iconos Lucide después de inyectar badges. */
  function iconos() {
    if (global.lucide) global.lucide.createIcons();
  }

  global.Procedencia = { badge, leyenda, pie, iconos, TIPOS, SIMULADO };
})(window);
