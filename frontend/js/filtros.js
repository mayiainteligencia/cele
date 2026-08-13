/* ============================================
   CEREBRO ELECTORAL — FILTROS GLOBALES
   ============================================
   Persisten entre módulos sin que el usuario tenga
   que re-filtrar al cambiar de sección.

   Arquitectura:

     sessionStorage   almacén del set activo. Sobrevive la navegación
                      dentro de la pestaña y muere al cerrarla. Dos
                      pestañas pueden mirar cosas distintas.

     URL              manda cuando trae parámetros. Al cargar, lo que
                      venga en la query pisa lo guardado y se escribe
                      al almacén. Eso da enlaces compartibles, botón
                      atrás funcional y estado visible sin abrir
                      DevTools.

     localStorage     NO se usa para el set activo. Si los filtros
                      sobrevivieran al cierre del navegador, alguien
                      abriría la herramienta días después, vería todo
                      recortado a un municipio sin acordarse de por qué
                      y sacaría conclusiones sobre datos parciales. En
                      una herramienta electoral ese es el modo de fallo
                      caro. Queda reservado para preferencias de verdad
                      duraderas, como el municipio por defecto de un rol.

   El set es serializable a query string a propósito: el módulo 10 pide
   reproducir la situación al momento de cada decisión, y con esto el
   "time travel" es guardar una cadena.

     Filtros.obtener()               -> {…}
     Filtros.aplicar({mun:'04002'})  guarda, actualiza URL y avisa
     Filtros.limpiar()
     Filtros.alCambiar(fn)           suscripción
     Filtros.aQueryString()
     Filtros.montarBarra('#id')
   ============================================ */

(function (global) {
  'use strict';

  const CLAVE = 'ce.filtros';

  /* Versión del esquema. Si mañana cambia la forma del set, este número
     sube y el estado viejo se descarta en vez de reventar contra campos
     que ya no existen. */
  const VERSION = 1;

  /* Cada filtro declara su clave corta para la URL. Las claves cortas
     mantienen los enlaces legibles y son parte del contrato: cambiarlas
     rompe enlaces guardados. */
  const CAMPOS = {
    eleccion:  { url: 'e',   etiqueta: 'Elección',   tipo: 'opcion' },
    anio:      { url: 'a',   etiqueta: 'Año',        tipo: 'opcion' },
    cargo:     { url: 'c',   etiqueta: 'Cargo',      tipo: 'opcion' },
    municipio: { url: 'mun', etiqueta: 'Municipio',  tipo: 'opcion' },
    seccion:   { url: 's',   etiqueta: 'Sección',    tipo: 'texto'  },
    partido:   { url: 'p',   etiqueta: 'Partido',    tipo: 'opcion' },
    fuente:    { url: 'f',   etiqueta: 'Fuente',     tipo: 'opcion' },
  };

  const VACIO = Object.fromEntries(Object.keys(CAMPOS).map((k) => [k, null]));

  let estado = null;
  const suscriptores = [];

  /* ── Almacén ── */

  function leerAlmacen() {
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      if (!crudo) return null;
      const d = JSON.parse(crudo);
      // Estado de una versión anterior del esquema: se descarta entero.
      if (d.v !== VERSION) {
        sessionStorage.removeItem(CLAVE);
        return null;
      }
      return d.f || null;
    } catch (e) {
      sessionStorage.removeItem(CLAVE);
      return null;
    }
  }

  function escribirAlmacen(f) {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify({ v: VERSION, f }));
    } catch (e) {
      // Modo privado o cuota llena: los filtros siguen vivos en memoria
      // y en la URL, solo no sobreviven el salto de página.
      console.warn('Filtros: no se pudo persistir en sessionStorage.', e);
    }
  }

  /* ── URL ── */

  function leerURL() {
    const q = new URLSearchParams(location.search);
    const f = {};
    let hay = false;
    Object.entries(CAMPOS).forEach(([campo, def]) => {
      const v = q.get(def.url);
      if (v !== null && v !== '') { f[campo] = v; hay = true; }
    });
    return hay ? f : null;
  }

  function aQueryString(f) {
    const q = new URLSearchParams();
    Object.entries(CAMPOS).forEach(([campo, def]) => {
      const v = (f || estado)[campo];
      if (v !== null && v !== undefined && v !== '') q.set(def.url, v);
    });
    return q.toString();
  }

  /* replaceState y no pushState: cambiar un filtro no debería llenar el
     historial de entradas que el botón atrás tenga que recorrer una por una. */
  function sincronizarURL() {
    const qs = aQueryString();
    const nueva = location.pathname + (qs ? '?' + qs : '') + location.hash;
    history.replaceState(null, '', nueva);
  }

  /* ── API ── */

  function obtener() {
    if (!estado) inicializar();
    return Object.assign({}, estado);
  }

  function activos() {
    const f = obtener();
    return Object.entries(f).filter(([, v]) => v !== null && v !== '');
  }

  function aplicar(parche, op) {
    if (!estado) inicializar();
    const antes = JSON.stringify(estado);
    Object.entries(parche || {}).forEach(([k, v]) => {
      if (!(k in CAMPOS)) { console.warn('Filtros: campo desconocido:', k); return; }
      estado[k] = (v === '' || v === undefined) ? null : v;
    });
    if (JSON.stringify(estado) === antes) return estado;

    escribirAlmacen(estado);
    if (!op || op.url !== false) sincronizarURL();
    notificar();
    return Object.assign({}, estado);
  }

  function limpiar() {
    estado = Object.assign({}, VACIO);
    escribirAlmacen(estado);
    sincronizarURL();
    notificar();
  }

  function alCambiar(fn) {
    suscriptores.push(fn);
    return () => {
      const i = suscriptores.indexOf(fn);
      if (i >= 0) suscriptores.splice(i, 1);
    };
  }

  function notificar() {
    const copia = Object.assign({}, estado);
    suscriptores.forEach((fn) => {
      try { fn(copia); } catch (e) { console.error('Filtros: suscriptor falló.', e); }
    });
    pintarBarra();
  }

  /* La URL manda cuando trae algo; si no, se recupera lo guardado. */
  function inicializar() {
    const deURL = leerURL();
    if (deURL) {
      estado = Object.assign({}, VACIO, deURL);
      escribirAlmacen(estado);
    } else {
      estado = Object.assign({}, VACIO, leerAlmacen() || {});
      // Sin parámetros en la URL pero con filtros guardados: se reflejan,
      // para que lo que se ve y lo que dice la barra de direcciones coincidan.
      if (activos().length) sincronizarURL();
    }
    return estado;
  }


  /* ════════════════════════════════════════════
     BARRA DE FILTROS
     ════════════════════════════════════════════ */

  let contenedor = null;
  let opciones = {};   // campo -> [{valor, etiqueta}]

  /** Alimenta las opciones de un campo. Las páginas la llaman con sus datos. */
  function registrarOpciones(campo, lista) {
    if (!(campo in CAMPOS)) { console.warn('Filtros: campo desconocido:', campo); return; }
    opciones[campo] = lista;
    pintarBarra();
  }

  function escapar(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  function montarBarra(sel) {
    contenedor = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!contenedor) return;
    if (!estado) inicializar();
    contenedor.className = 'filtros-barra';
    pintarBarra();
  }

  function pintarBarra() {
    if (!contenedor) return;
    const f = obtener();
    const n = activos().length;

    const controles = Object.entries(CAMPOS).map(([campo, def]) => {
      const lista = opciones[campo];
      if (!lista || !lista.length) return '';
      const sel = f[campo];
      return `
        <label class="filtro">
          <span class="filtro__etiqueta">${escapar(def.etiqueta)}</span>
          <select class="filtro__select" data-filtro="${campo}">
            <option value="">Todos</option>
            ${lista.map((o) => `
              <option value="${escapar(o.valor)}"${String(o.valor) === String(sel) ? ' selected' : ''}>
                ${escapar(o.etiqueta)}
              </option>`).join('')}
          </select>
        </label>`;
    }).join('');

    contenedor.innerHTML = `
      <div class="filtros-barra__campos">${controles}</div>
      <div class="filtros-barra__acciones">
        ${n ? `<span class="badge badge--info">${n} filtro${n > 1 ? 's' : ''} activo${n > 1 ? 's' : ''}</span>
               <button class="subnav-btn" data-filtros="limpiar">
                 <i data-lucide="x"></i><span>Limpiar</span>
               </button>` : '<span class="text-small">Sin filtros aplicados</span>'}
        <button class="subnav-btn" data-filtros="copiar" title="Copia el enlace con estos filtros">
          <i data-lucide="link"></i><span>Copiar vista</span>
        </button>
      </div>`;

    contenedor.querySelectorAll('[data-filtro]').forEach((sel2) => {
      sel2.addEventListener('change', () => aplicar({ [sel2.dataset.filtro]: sel2.value }));
    });
    const btnLimpiar = contenedor.querySelector('[data-filtros="limpiar"]');
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiar);
    const btnCopiar = contenedor.querySelector('[data-filtros="copiar"]');
    if (btnCopiar) btnCopiar.addEventListener('click', copiarVista);

    if (global.lucide) global.lucide.createIcons();
  }

  function copiarVista() {
    const url = location.origin + location.pathname +
                (aQueryString() ? '?' + aQueryString() : '');
    const avisar = (t) => (global.CE && global.CE.toast)
      ? global.CE.toast({ titulo: 'Enlace copiado', texto: t })
      : console.log(t);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => avisar(url), () => avisar(url));
    } else {
      avisar(url);
    }
  }

  global.Filtros = {
    obtener, aplicar, limpiar, alCambiar, activos,
    aQueryString: () => aQueryString(),
    registrarOpciones, montarBarra,
    CAMPOS, VERSION,
  };
})(window);
