/* Verificación del componente de procedencia y del contrato de datos mock.
   node frontend/js/procedencia.prueba.js  — sale con 1 si algo se rompe. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const AQUI = __dirname;
const ventana = {};
ventana.window = ventana;
ventana.console = console;
vm.createContext(ventana);
vm.runInContext(fs.readFileSync(path.join(AQUI, 'procedencia.js'), 'utf8'), ventana);
const P = ventana.Procedencia;

const TIPOS = ['dato', 'calculo', 'estimacion', 'inferencia', 'recomendacion'];


/* ── Los cinco tipos de la regla transversal 4 existen ── */

assert.deepStrictEqual(Object.keys(P.TIPOS).sort(), [...TIPOS].sort());

TIPOS.forEach((t) => {
  const h = P.badge(t);
  assert.ok(h.includes(`proc--${t}`), `${t}: falta la clase modificadora`);
  // El color no puede ser el único canal: la etiqueta de texto va siempre.
  assert.ok(h.includes(P.TIPOS[t].etiqueta), `${t}: falta la etiqueta de texto`);
  assert.ok(h.includes('title="'), `${t}: falta el tooltip con la definición`);
});


/* ── "simulado" es aparte de los cinco: un dummy no es un dato ── */

const sim = P.badge('simulado');
assert.ok(sim.includes('proc--simulado'));
assert.ok(sim.includes('Simulado'));
assert.ok(!Object.keys(P.TIPOS).includes('simulado'),
  'simulado no debe colarse entre los cinco tipos de la spec');

// Un tipo inventado no produce badge en vez de producir uno silenciosamente mal.
assert.strictEqual(P.badge('inventado'), '');


/* ── Escapado: los nombres de fuente vienen de archivos externos ── */

const malicioso = P.badge('dato', { fuente: '"><script>alert(1)</script>' });
assert.ok(!malicioso.includes('<script>'), 'la fuente debe escaparse');
assert.ok(malicioso.includes('&lt;script&gt;'));

const det = P.badge('estimacion', { detalle: '<b>x</b>' });
assert.ok(!det.includes('<b>'), 'el detalle debe escaparse');


/* ── El pie siempre declara fuente y corte (regla transversal 1) ── */

const pie = P.pie({ fuente: 'INEGI' });
assert.ok(pie.includes('Fuente'));
assert.ok(pie.includes('Fecha de corte'));
assert.ok(pie.includes('no declarada por la fuente'),
  'sin fecha de corte, el pie debe decirlo en vez de omitir la fila');

const pieCompleto = P.pie({
  fuente: 'INEGI', fechaCorte: '2024-08', metodologia: 'M', confianza: 'alta', cobertura: '13',
});
['Fuente', 'Fecha de corte', 'Metodología', 'Confianza', 'Cobertura']
  .forEach((k) => assert.ok(pieCompleto.includes(k), `falta ${k} en el pie`));
assert.ok(pieCompleto.includes('Confianza alta'));

// La leyenda lista los cinco; el simulado sólo si se pide.
assert.ok(!P.leyenda().includes('proc--simulado'));
assert.ok(P.leyenda(true).includes('proc--simulado'));


/* ── Contrato de los datos de demostración ── */

const D = JSON.parse(fs.readFileSync(path.join(AQUI, '..', 'data', 'mock', 'territorio.json')));

assert.strictEqual(D.metadata.procedencia, 'simulado',
  'el archivo mock debe declararse simulado en su metadata');
assert.ok(D.metadata.advertencia.length > 40, 'falta la advertencia de uso');
assert.strictEqual(D.municipios.length, 13);

const TIPOS_CASILLA = ['basica', 'contigua', 'extraordinaria', 'especial'];

D.municipios.forEach((m) => {
  assert.match(m.cve_mun, /^04\d{3}$/, `cve_mun mal formado: ${m.cve_mun}`);
  assert.ok(m.nombre && m.cabecera, `${m.cve_mun}: falta nombre o cabecera`);

  // Nomenclatura oficial del INE: no existe la "casilla normal".
  TIPOS_CASILLA.forEach((t) =>
    assert.ok(typeof m.casillas[t] === 'number', `${m.cve_mun}: falta casilla ${t}`));
  assert.ok(!('normal' in m.casillas), 'no existe el tipo "casilla normal" en la normativa');
  assert.strictEqual(
    m.casillas.total,
    TIPOS_CASILLA.reduce((a, t) => a + m.casillas[t], 0),
    `${m.cve_mun}: el total de casillas no cuadra con la suma por tipo`
  );
  // Una básica por sección: la regla del INE.
  assert.strictEqual(m.casillas.basica, m.secciones,
    `${m.cve_mun}: debe haber una casilla básica por sección`);

  // La lista nominal nunca puede superar a la población.
  assert.ok(m.lista_nominal < m.poblacion,
    `${m.cve_mun}: lista nominal (${m.lista_nominal}) mayor que población (${m.poblacion})`);

  // NSE suma 100 (con tolerancia de redondeo).
  const suma = D.nse_cortes.reduce((a, k) => a + m.nse[k], 0);
  assert.ok(Math.abs(suma - 100) < 0.5, `${m.cve_mun}: NSE suma ${suma}, no 100`);

  // Toda proyección lleva intervalo, y el central cae dentro.
  m.proyeccion_2027.partidos.forEach((p) => {
    assert.ok(typeof p.ic_bajo === 'number' && typeof p.ic_alto === 'number',
      `${m.cve_mun}/${p.partido}: proyección sin intervalo`);
    assert.ok(p.ic_bajo <= p.pct_central && p.pct_central <= p.ic_alto,
      `${m.cve_mun}/${p.partido}: el central cae fuera de su intervalo`);
  });
  assert.ok(['alta', 'media', 'baja'].includes(m.proyeccion_2027.confianza));
  assert.ok(Object.keys(m.proyeccion_2027.escenarios).length >= 4,
    `${m.cve_mun}: se esperaban al menos 4 escenarios`);

  // Histórico: el ganador es quien tiene el mayor porcentaje.
  m.historico.forEach((h) => {
    assert.ok(h.pct_ganador >= h.pct_segundo, `${m.cve_mun}/${h.anio}: ganador con menos votos que el segundo`);
    assert.ok(Math.abs((h.pct_ganador - h.pct_segundo) - h.margen) < 0.15,
      `${m.cve_mun}/${h.anio}: el margen no cuadra`);
    assert.ok(Math.abs(h.participacion + h.abstencionismo - 100) < 0.15,
      `${m.cve_mun}/${h.anio}: participación y abstencionismo no suman 100`);
  });
});

const listaTot = D.municipios.reduce((a, m) => a + m.lista_nominal, 0);
const pobTot = D.municipios.reduce((a, m) => a + m.poblacion, 0);
assert.ok(pobTot > 700000 && pobTot < 1200000,
  `población estatal simulada fuera de un orden plausible: ${pobTot}`);

console.log(`OK — 5 tipos de procedencia, 13 municipios, población ${pobTot.toLocaleString('es-MX')}, lista nominal ${listaTot.toLocaleString('es-MX')}`);
