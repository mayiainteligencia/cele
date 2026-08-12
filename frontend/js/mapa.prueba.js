/* Verificación del componente de mapa y del contrato de datos geo.
   Sin framework: node frontend/js/mapa.prueba.js
   Falla con código 1 si algo se rompe. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const AQUI = __dirname;
const GEO = path.join(AQUI, '..', 'data', 'geo');

// mapa.js es un IIFE que espera `window` y lee tokens del DOM.
const ventana = { getComputedStyle: () => ({ getPropertyValue: () => '#000000' }) };
ventana.document = { documentElement: {} };
ventana.window = ventana;
vm.createContext(ventana);
vm.runInContext(fs.readFileSync(path.join(AQUI, 'mapa.js'), 'utf8'), ventana);
const { cortes, cubeta, escapar, ficha } = ventana.CerebroMapa._internos;


/* ── Cubetas del choropleth ── */

// deepStrictEqual no sirve aquí: los objetos vienen de otro realm de vm.
const mismo = (a, b, msg) => assert.deepStrictEqual({ ...a }, b, msg);

const c = cortes([0, 50, 100], 5);
mismo(c, { min: 0, max: 100, paso: 20 });
assert.strictEqual(cubeta(0, c, 5), 0, 'el mínimo cae en la primera cubeta');
assert.strictEqual(cubeta(100, c, 5), 4, 'el máximo NO se desborda de la última');
assert.strictEqual(cubeta(50, c, 5), 2);

// Un solo valor distinto no debe reventar ni repartir cubetas.
mismo(cortes([7, 7, 7], 5), { min: 7, max: 7, paso: 0 });
assert.strictEqual(cubeta(7, cortes([7, 7, 7], 5), 5), 0);

// Sin valores numéricos no hay escala.
assert.strictEqual(cortes([], 5), null);
assert.strictEqual(cortes([NaN, undefined, null], 5), null);
assert.strictEqual(cubeta(1, null, 5), 0);


/* ── Escapado: los nombres de escuela vienen de una fuente externa ── */

assert.strictEqual(escapar('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
assert.strictEqual(escapar('a & "b"'), 'a &amp; &quot;b&quot;');
assert.strictEqual(escapar(null), '—');
assert.strictEqual(escapar(''), '—');
assert.strictEqual(escapar(0), '0', 'el cero es un valor, no un vacío');


/* ── La ficha siempre declara procedencia (regla transversal 1) ── */

const html = ficha(
  { cct: '04DPR0001A', nombre_centro_trabajo: 'ESCUELA X', estatus_ubicacion: 'potencial' },
  { claveGeo: 'cct', nombre: 'nombre_centro_trabajo', ficha: [] }
);
assert.ok(html.includes('Fuente'), 'la ficha debe mostrar la fuente');
assert.ok(html.includes('Fecha de corte'), 'la ficha debe mostrar la fecha de corte');
assert.ok(html.includes('no declarada por la fuente'), 'sin fecha, debe decirlo');
assert.ok(html.includes('No aprobada como casilla'), 'una escuela no se presenta como casilla');


/* ── Contrato de las capas ── */

const todas = ventana.CerebroMapa.CATALOGO.flatMap((g) => g.capas);
todas.forEach((capa) => {
  assert.ok(capa.id && capa.etiqueta, `capa sin id/etiqueta: ${JSON.stringify(capa)}`);
  if (capa.estado === 'disponible') {
    assert.ok(capa.archivo, `${capa.id}: capa disponible sin archivo`);
    assert.ok(capa.claveGeo && capa.nombre, `${capa.id}: falta claveGeo o nombre`);
  } else {
    assert.strictEqual(capa.estado, 'pendiente', `${capa.id}: estado desconocido`);
    assert.ok(capa.origen, `${capa.id}: capa pendiente sin origen documentado`);
    assert.ok(!capa.archivo, `${capa.id}: una capa pendiente no debe apuntar a un archivo`);
  }
});


/* ── Datos generados por build_geo.py ── */

const escuelas = JSON.parse(fs.readFileSync(path.join(GEO, 'escuelas_campeche.geojson')));
assert.strictEqual(escuelas.metadata.total, escuelas.features.length);

const BBOX = [-92.5, 17.7, -89.0, 20.9];
const municipios = new Set();
escuelas.features.forEach((f) => {
  const p = f.properties;
  assert.ok(p.cct, 'feature sin cct');
  assert.match(p.cve_mun, /^04\d{3}$/, `cve_mun mal formado: ${p.cve_mun}`);
  assert.ok(
    ['potencial', 'historica', 'aprobada'].includes(p.estatus_ubicacion),
    `estatus_ubicacion inválido: ${p.estatus_ubicacion}`
  );
  assert.ok('fuente' in p && 'fecha_corte' in p, `${p.cct}: falta fuente o fecha_corte`);
  const [lon, lat] = f.geometry.coordinates;
  assert.ok(lon >= BBOX[0] && lon <= BBOX[2] && lat >= BBOX[1] && lat <= BBOX[3],
    `${p.cct}: coordenada fuera de Campeche`);
  municipios.add(p.cve_mun);
});

// Son 13 desde 2021: se crearon Dzitbalché y Seybaplaya.
assert.strictEqual(municipios.size, 13, `se esperaban 13 municipios, hay ${municipios.size}`);

const limite = JSON.parse(fs.readFileSync(path.join(GEO, 'limite_estatal.geojson')));
assert.strictEqual(limite.features[0].properties.cve_ent, '04');

const sitios = new Set(escuelas.features.map((f) => f.geometry.coordinates.join(',')));
console.log(`OK — ${escuelas.features.length} registros, ${municipios.size} municipios, ${sitios.size} sitios físicos`);
