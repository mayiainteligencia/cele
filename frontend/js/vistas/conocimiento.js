/* Vista: Conocimiento — perfil agregado por municipio, censo de necesidades
   por zona y directorio del equipo de campaña.

   Tres reglas que esta vista hace cumplir:

   1. NADA por persona. Todo lo que se agrega o se cuenta es a nivel
      municipio (población, lista nominal, cobertura). El directorio del
      equipo es sobre el EQUIPO de campaña, no sobre el electorado: los
      nombres los escribe el propio usuario, esta vista no genera ninguno.

   2. El censo de necesidades usa el único dato real que hay: ENVIPE 2026
      (estatal). El INEGI no publica el desglose por municipio y aquí no se
      inventa un porcentaje para rellenar ese hueco. Lo único que varía por
      municipio es un indicador cualitativo (arriba / en línea / abajo del
      promedio estatal), derivado mecánicamente de la tipología
      socioeconómica que ya declara contexto_campeche.json — nunca un
      número nuevo. Ver `tipologiaDirecciones` abajo: cada flecha cita la
      frase exacta de donde sale.

   3. El directorio del equipo vive en localStorage del navegador: no hay
      backend todavía, así que no hay forma honesta de decir que está
      "guardado" en ningún otro lado. Se declara en pantalla. */

(function () {
  'use strict';

  const T = window.Territorio;
  const P = window.Procedencia;
  const E = window.Electoral;
  const Censo = window.Censo;
  const esc = T.escapar;
  const $ = (id) => document.getElementById(id);

  const LS_KEY = 'ce-equipo-campana';

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      T.cargar(), E.cargar(), Censo.cargar(),
      fetch('data/electoral/envipe_2026.json').then((r) => {
        if (!r.ok) throw new Error(`${r.status} al cargar envipe_2026.json`);
        return r.json();
      }),
      fetch('data/censo/cct_por_municipio.json').then((r) => {
        if (!r.ok) throw new Error(`${r.status} al cargar cct_por_municipio.json`);
        return r.json();
      }),
    ]).then(([ctx, elec, censo, envipe, cct]) => {
      const municipios = construirMunicipios(elec, censo, cct.municipios, ctx.nse.tipologia_municipal);
      iniciarPerfil(municipios);
      iniciarNecesidades(municipios, envipe);
      iniciarEquipo(municipios);
      if (window.lucide) lucide.createIcons();
    }).catch((err) => {
      console.error('conocimiento:', err);
      document.getElementById('con-mun-grid').innerHTML =
        '<p class="text-small">No se pudieron cargar los datos municipales.</p>';
    });
  });

  /* ════════════════════════════════════════════
     DATOS: un municipio, tres fuentes reales
     ════════════════════════════════════════════ */

  function construirMunicipios(elec, censo, cctPorMun, tipologia) {
    const tipoDe = {};
    tipologia.grupos.forEach((g) => g.municipios.forEach((cve) => { tipoDe[cve] = g; }));

    return Object.values(elec.municipios)
      .sort((a, b) => a.cve_mun.localeCompare(b.cve_mun))
      .map((m) => {
        const c = censo.municipios[m.cve_mun] || null;   // Dzitbalché no tiene cifra 2020: se declara, no se inventa
        const cct = cctPorMun[m.cve_mun];
        return {
          cve_mun: m.cve_mun,
          nombre: m.nombre,
          poblacion: c,
          electoral: m,
          cct: cct || null,
          tipologia: tipoDe[m.cve_mun] || null,
        };
      });
  }

  /* ════════════════════════════════════════════
     1. PERFIL POR MUNICIPIO
     ════════════════════════════════════════════ */

  let municipiosG = [];
  let seleccionado = null;

  function iniciarPerfil(municipios) {
    municipiosG = municipios;
    pintarGrid();
    pintarDetalle(null);
  }

  function pintarGrid() {
    $('con-mun-grid').innerHTML = municipiosG.map((m) => `
      <button type="button" class="con-mun-card${m.cve_mun === seleccionado ? ' con-mun-card--activa' : ''}" data-mun="${m.cve_mun}">
        <strong>${esc(m.nombre)}</strong>
        <span class="con-mun-card__dato">${m.poblacion ? T.num(m.poblacion.poblacion_total) + ' hab.' : 'sin cifra 2020'}</span>
        <span class="con-mun-card__dato">Lista nominal: ${T.num(m.electoral.lista_nominal)}</span>
        ${m.tipologia ? `<span class="badge" style="align-self:flex-start;">${esc(m.tipologia.etiqueta)}</span>` : ''}
      </button>`).join('');
    $('con-mun-grid').querySelectorAll('[data-mun]').forEach((b) => {
      b.addEventListener('click', () => {
        seleccionado = seleccionado === b.dataset.mun ? null : b.dataset.mun;
        pintarGrid();
        pintarDetalle(seleccionado);
        pintarNecesidades();
        if (window.lucide) lucide.createIcons();
      });
    });
  }

  function pintarDetalle(cve) {
    const cont = $('con-mun-detalle');
    if (!cve) {
      cont.innerHTML = '<p class="text-small">Elige un municipio para ver su perfil completo.</p>';
      return;
    }
    const m = municipiosG.find((x) => x.cve_mun === cve);
    const el = m.electoral;
    const p = m.poblacion;

    cont.innerHTML = `
      <div class="tarjeta">
        <header class="tarjeta__cabeza"><strong>${esc(m.nombre)}</strong> ${P.badge('dato', { fuente: 'INEGI 2020 · IEEC 2024 · SEP CCT', fechaCorte: '2024-08' })}</header>

        <h4 class="text-h3" style="margin-top:var(--space-sm);">Población</h4>
        ${p ? `<div class="con-stat-row">
          <div class="con-stat"><div class="con-stat__label">Población total</div><div class="con-stat__valor">${T.num(p.poblacion_total)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Mujeres</div><div class="con-stat__valor">${T.pct(100 * p.mujeres / p.poblacion_total)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Hombres</div><div class="con-stat__valor">${T.pct(100 * p.hombres / p.poblacion_total)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Menores de 18</div><div class="con-stat__valor">${T.num(p.menores_18)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Mayores de 50</div><div class="con-stat__valor">${T.num(p.mayores_50)}</div></div>
        </div>` : `<p class="text-small">${esc(m.nombre)} se erigió en municipio después del Censo 2020: no tiene cifra propia (está incluido en el municipio del que se separó).</p>`}

        <h4 class="text-h3" style="margin-top:var(--space-md);">Lista nominal y resultado 2024</h4>
        <div class="con-stat-row">
          <div class="con-stat"><div class="con-stat__label">Lista nominal</div><div class="con-stat__valor">${T.num(el.lista_nominal)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Participación 2024</div><div class="con-stat__valor">${T.pct(el.participacion)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Ganó en 2024</div><div class="con-stat__valor" style="font-size:0.95rem;">${esc(el.ganador_nombre)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Margen</div><div class="con-stat__valor">${T.pct(el.margen)}</div></div>
        </div>

        <h4 class="text-h3" style="margin-top:var(--space-md);">Perfil socioeconómico</h4>
        ${m.tipologia ? `<p class="tarjeta__texto">
          <span class="badge">${esc(m.tipologia.etiqueta)}</span> ${esc(m.tipologia.rasgo)}
          ${P.badge('inferencia', { detalle: 'tipología cualitativa; no es un porcentaje por municipio' })}
        </p>` : '<p class="text-small">Sin tipología declarada.</p>'}

        <h4 class="text-h3" style="margin-top:var(--space-md);">Cobertura de infraestructura</h4>
        <div class="con-stat-row">
          <div class="con-stat"><div class="con-stat__label">Casillas 2024</div><div class="con-stat__valor">${T.num(el.casillas_tipo.total)}</div><div class="con-stat__sub">${T.num(el.casillas_tipo.sitios)} sitios físicos</div></div>
          <div class="con-stat"><div class="con-stat__label">Secciones</div><div class="con-stat__valor">${T.num(el.secciones)}</div></div>
          ${m.cct ? `<div class="con-stat"><div class="con-stat__label">Planteles SEP (CCT)</div><div class="con-stat__valor">${T.num(m.cct.planteles)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Alumnado</div><div class="con-stat__valor">${T.num(m.cct.alumnos)}</div></div>
          <div class="con-stat"><div class="con-stat__label">Docentes</div><div class="con-stat__valor">${T.num(m.cct.docentes)}</div></div>` : ''}
        </div>
      </div>`;
  }

  /* ════════════════════════════════════════════
     2. CENSO DE NECESIDADES POR ZONA
     ════════════════════════════════════════════
     Único número real: el % estatal de ENVIPE. Lo que cambia por municipio
     es una flecha (arriba/en línea/abajo), nunca un porcentaje inventado. */

  // categoría de ENVIPE -> a qué grupo de la tipología aplica una dirección, y por qué.
  // Cada entrada cita literalmente el campo `rasgo` de contexto_campeche.json que la motiva.
  const DIRECCIONES = {
    'Desempleo': {
      'Urbano burocrático': { dir: 'abajo', por: 'rasgo declarado: "Clase media de empleo público, estable y compacta."' },
      'Rural con rezago':  { dir: 'arriba', por: 'rasgo declarado: "Predominio de trabajo informal y agrícola, carencias de infraestructura."' },
    },
    'Pobreza': {
      'Rural con rezago': { dir: 'arriba', por: 'rasgo declarado: "Predominio de trabajo informal y agrícola, carencias de infraestructura."' },
    },
    'Aumento de precios': {
      'Urbano petrolero': { dir: 'arriba', por: 'rasgo declarado: "Ingreso alto concentrado y costo de vida alto."' },
    },
    'Escasez de agua': {
      'Rural con rezago': { dir: 'arriba', por: 'rasgo declarado: "Predominio de trabajo informal y agrícola, carencias de infraestructura."' },
    },
  };

  let envipeG = null;

  function iniciarNecesidades(municipios, envipe) {
    envipeG = envipe;
    pintarNecesidades();
  }

  function pintarNecesidades() {
    const m = municipiosG.find((x) => x.cve_mun === seleccionado);
    const grupo = m && m.tipologia ? m.tipologia.etiqueta : null;

    $('con-necesidades').innerHTML = `
      <div class="aviso-simulado">
        <i data-lucide="info"></i>
        <span><strong>${seleccionado ? `Zona: ${esc(m.nombre)}.` : 'Sin zona elegida: cifras estatales.'}</strong>
        El porcentaje es el dato real de ENVIPE 2026 a nivel estatal (el INEGI no lo desglosa por municipio).
        ${seleccionado ? 'La flecha compara la zona elegida con el promedio estatal, derivada de su perfil socioeconómico ya declarado arriba — nunca es un porcentaje nuevo.' : 'Elige un municipio en “Perfil por municipio” para ver cómo se ubica cada zona frente al promedio.'}</span>
      </div>
      <div style="margin-top:var(--space-sm);">
        ${envipeG.categorias.map((c) => {
          const regla = grupo && DIRECCIONES[c.categoria] && DIRECCIONES[c.categoria][grupo];
          const dir = regla ? regla.dir : 'linea';
          const texto = { arriba: 'Arriba del promedio', abajo: 'Abajo del promedio', linea: 'En línea con el promedio' }[dir];
          return `<div class="con-necesidad">
            <span class="con-necesidad__nombre">${esc(c.categoria)}</span>
            <strong style="font-family:var(--font-mono); font-variant-numeric:tabular-nums;">${c.porcentaje} %</strong>
            <span class="con-chip con-chip--${dir}" ${regla ? `title="${esc(regla.por)}"` : ''}>${texto}</span>
          </div>`;
        }).join('')}
      </div>
      <p class="panel__nota">${P.pie({ fuente: envipeG.metadata.fuente, fechaCorte: envipeG.metadata.fecha_corte, metodologia: envipeG.metadata.que_es })}</p>`;
    if (window.lucide) lucide.createIcons();
  }

  /* ════════════════════════════════════════════
     3. DIRECTORIO DEL EQUIPO — localStorage, datos del propio usuario
     ════════════════════════════════════════════ */

  function leerEquipo() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  }
  function guardarEquipo(lista) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(lista)); } catch { /* almacenamiento no disponible: se pierde al recargar */ }
  }

  function iniciarEquipo(municipios) {
    const sel = $('ce-municipio');
    sel.innerHTML = municipios.map((m) => `<option value="${m.cve_mun}">${esc(m.nombre)}</option>`).join('');

    $('con-equipo-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const nombre = $('ce-nombre').value.trim();
      if (!nombre) return;
      const lista = leerEquipo();
      lista.push({
        id: Date.now(),
        nombre,
        rol: $('ce-rol').value,
        cve_mun: $('ce-municipio').value,
        municipio: sel.selectedOptions[0].textContent,
        telefono: $('ce-telefono').value.trim(),
      });
      guardarEquipo(lista);
      $('con-equipo-form').reset();
      pintarEquipo();
    });

    pintarEquipo();
  }

  function pintarEquipo() {
    const lista = leerEquipo();
    const cont = $('con-equipo-lista');

    if (!lista.length) {
      cont.innerHTML = `<div class="con-equipo-vacio">
        <strong>Todavía no has agregado a nadie.</strong>
        Agrega a tu coordinador municipal o representante con el formulario de arriba — son datos tuyos, no se sugiere ni se genera ningún nombre aquí.
      </div>`;
      return;
    }

    cont.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-xs);">
        <button class="btn-glass" data-exportar data-tabla="equipo-campana"><i data-lucide="download"></i><span>Exportar CSV</span></button>
      </div>
      <div class="tabla-caja">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Municipio</th><th>Teléfono</th><th></th></tr></thead>
          <tbody>
            ${lista.map((p) => `<tr>
              <td><strong>${esc(p.nombre)}</strong></td>
              <td>${esc(p.rol)}</td>
              <td>${esc(p.municipio)}</td>
              <td>${esc(p.telefono || '—')}</td>
              <td><button type="button" class="con-fila-borrar" data-borrar="${p.id}" title="Quitar"><i data-lucide="trash-2"></i></button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    cont.querySelectorAll('[data-borrar]').forEach((b) => {
      b.addEventListener('click', () => {
        guardarEquipo(leerEquipo().filter((p) => String(p.id) !== b.dataset.borrar));
        pintarEquipo();
      });
    });
    T.conectarExportar();
    if (window.lucide) lucide.createIcons();
  }
})();
