/* Datos SIMULADOS de "Análisis de discursos".

   Este archivo se reemplaza cuando exista el backend: window.evaluarDiscursos
   (discursos.js) deja de leerlo y devuelve la respuesta de
   POST /api/discursos/evaluar, que debe tener la misma forma que
   DISCURSOS_MOCK.resultado.

   Los temas y las cifras de ENVIPE son los de la corrida real del 2026-10-10
   (temas_campeche_2026-10-10.json y problemas_campeche.csv). Lo único simulado
   son los discursos: qué temas tocan y sus frases de riesgo. Las dos coberturas
   se CALCULAN aquí con la misma fórmula del pipeline (cruce_encuesta.py), no se
   escriben a mano, para que nunca se contradigan con los datos de arriba. */

(function (global) {
  'use strict';

  const PESO_ENCUESTA = 0.7;  // mezcla del pipeline: 70 % encuesta + 30 % noticias

  const temas = [
    { id: 't1', nombre: 'Protección Civil y Alerta Meteorológica por Ciclón', notas: 38, tono: 'negativo' },
    { id: 't2', nombre: 'Pugnas Políticas y Sucesión Electoral',              notas: 10, tono: 'neutral' },
    { id: 't3', nombre: 'Economía, Empleo y Contrataciones Públicas',         notas: 8,  tono: 'negativo' },
    { id: 't4', nombre: 'Crisis en Salud Pública y Protestas Laborales',      notas: 6,  tono: 'negativo' },
    { id: 't5', nombre: 'Seguridad y Procuración de Justicia',                notas: 6,  tono: 'neutral' },
    { id: 't6', nombre: 'Medio Ambiente y Contingencias Marítimas',           notas: 4,  tono: 'negativo' },
    { id: 't7', nombre: 'Violencia Digital y Acoso Escolar',                  notas: 3,  tono: 'negativo' },
    { id: 't8', nombre: 'Tarifas y Subsidios de Energía Eléctrica',           notas: 3,  tono: 'negativo' },
  ];

  const categorias = [
    { id: 'e1',  nombre: 'Inseguridad',                     pct: 51.7 },
    { id: 'e2',  nombre: 'Salud',                           pct: 44.3 },
    { id: 'e3',  nombre: 'Desempleo',                       pct: 41.7 },
    { id: 'e4',  nombre: 'Aumento de precios',              pct: 37.6 },
    { id: 'e5',  nombre: 'Corrupción',                      pct: 19.7 },
    { id: 'e6',  nombre: 'Narcotráfico',                    pct: 19.7 },
    { id: 'e7',  nombre: 'Pobreza',                         pct: 17.8 },
    { id: 'e8',  nombre: 'Escasez de agua',                 pct: 16.5 },
    { id: 'e9',  nombre: 'Falta de castigo a delincuentes', pct: 15.2 },
    { id: 'e10', nombre: 'Educación',                       pct: 10.7 },
  ];

  // tema -> categorías de ENVIPE que lo respaldan (el cruce)
  const cruces = {
    t5: ['e1', 'e6', 'e9'],   // Seguridad  <- Inseguridad, Narcotráfico, Falta de castigo
    t3: ['e3', 'e4', 'e7'],   // Economía   <- Desempleo, Aumento de precios, Pobreza
    t4: ['e2'],               // Salud      <- Salud
    t7: ['e10'],              // Violencia Digital <- Educación (coincidencia débil)
  };
  const confianza = { t1: 'media', t2: 'media', t3: 'media', t4: 'media', t5: 'media', t6: 'baja', t7: 'media', t8: 'baja' };

  // Qué toca cada discurso simulado (A, B, C en el orden en que se capturan) y sus frases de riesgo.
  const discursos = [
    { toca: ['t2', 't3', 't6'], frases: [
      { tema: 't3', frase: '…trayendo bienestar, turismo y empleos…', motivo: 'Triunfalista frente a la inconformidad por contrataciones y empleo.' },
      { tema: 't6', frase: '…nuestros pescadores olvidados…', motivo: 'Habla en pasado de un reclamo que hoy sigue vigente.' } ] },
    { toca: ['t1', 't3', 't6'], frases: [
      { tema: 't1', frase: '…hoy no vengo a dar un discurso de fiesta…', motivo: 'Tono adecuado, pero no ofrece acciones concretas ante la emergencia.' },
      { tema: 't3', frase: '…esa solidaridad es nuestra mejor obra pública…', motivo: 'Metáfora de obra pública en un tema con descontento por contratos.' } ] },
    { toca: ['t1', 't3', 't4', 't5', 't7', 't8'], frases: [
      { tema: 't1', frase: '…que la atención de la emergencia esté por encima de cualquier diferencia…', motivo: 'Compromiso sin fecha ni responsable.' },
      { tema: 't4', frase: '…tienen razón en exigir que se les escuche…', motivo: 'Reconoce la protesta sin comprometer medicamentos ni insumos.' },
      { tema: 't5', frase: '…sobre todo por las mujeres y las víctimas…', motivo: 'Menciona el problema sin propuesta de seguridad.' },
      { tema: 't8', frase: '…cuando termina el subsidio…', motivo: 'Señala el alza sin decir qué se haría.' },
      { tema: 't2', frase: '…se gobierna escuchando…', motivo: 'Frase genérica en medio de pugnas políticas abiertas.' } ] },
  ];


  /* ── Municipios ──
     REAL: lista nominal, ganador, margen y participación 2024 (resultados_municipio_2024.json) y los titulares de la
     semana que nombran al municipio (sólo 8 de 78 lo hacen: casi todas las notas dicen "Campeche" por el estado).
     SIMULADO: qué temas "se disparan" en cada municipio más allá de esos titulares. Regla de demostración: el tema se
     reparte en proporción a la lista nominal; el ciclón y lo marítimo sólo en municipios con costa. */
  const MUN_2024 = [{"cve": "04001", "nombre": "Calkiní", "lista": 32551, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 21.13, "part": 74.16}, {"cve": "04002", "nombre": "Campeche", "lista": 213994, "ganador": "Movimiento Ciudadano", "margen": 9.47, "part": 63.72}, {"cve": "04003", "nombre": "Carmen", "lista": 188721, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 34.96, "part": 57.34}, {"cve": "04004", "nombre": "Champotón", "lista": 58657, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 29.85, "part": 59.72}, {"cve": "04005", "nombre": "Hecelchakán", "lista": 24253, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 4.04, "part": 72.8}, {"cve": "04006", "nombre": "Hopelchén", "lista": 30812, "ganador": "PRI-PRD", "margen": 0.23, "part": 71.0}, {"cve": "04007", "nombre": "Palizada", "lista": 7401, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 24.77, "part": 79.15}, {"cve": "04008", "nombre": "Tenabo", "lista": 8887, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 8.38, "part": 81.67}, {"cve": "04009", "nombre": "Escárcega", "lista": 44630, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 29.9, "part": 53.04}, {"cve": "04010", "nombre": "Calakmul", "lista": 20986, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 33.28, "part": 62.01}, {"cve": "04011", "nombre": "Candelaria", "lista": 36016, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 20.39, "part": 56.91}, {"cve": "04012", "nombre": "Seybaplaya", "lista": 12016, "ganador": "Sigamos Haciendo Historia (PT-PVEM-Morena)", "margen": 5.47, "part": 74.15}, {"cve": "04013", "nombre": "Dzitbalché", "lista": 12180, "ganador": "Movimiento Ciudadano", "margen": 7.59, "part": 73.97}];
  const MENCIONES = [
 {
  "mun": "Calkiní",
  "tema": "t1",
  "titulo": "Campeche | Jairo Magaña | Ayuntamiento de Calkiní desaloja a 23 familias de Isla Arena por prevención ante 'Isaías' - La Jornada Maya",
  "fuente": "La Jornada Maya",
  "link": "https://news.google.com/rss/articles/CBMizAFBVV95cUxPSThjNTI5aU90Skxpa3BWNDdoV3NZUVJYcDJ3RktZX2dfNXN5N0tGcGV0SHY1aW9aUXJ0QTJOSlp5RDVKNGJkZm9CY3diZkVTZko3amt0UzMxbmhoekdzX2tpV3Zxc3BIak0zSkp6TmpQanlkT2F6VV83R2lTT2hzX3JSR3FRdGExOTFYVlFrcEVDdVN2QllfOS1RZXE4MzV6cWdMa1pJakV3VmJ2ZjVla1ZERENScWZZdjN1bWZoQWRsbER4Nm5TclVlZWc?oc=5"
 },
 {
  "mun": "Seybaplaya",
  "tema": "t1",
  "titulo": "PESCADORES DE SEYBAPLAYA RESGUARDAN EMBARCACIONES ANTE POSIBLES EFECTOS DE “ISAÍAS” - Tribuna Campeche",
  "fuente": "Tribuna Campeche",
  "link": "https://news.google.com/rss/articles/CBMivAFBVV95cUxQbUVWQ2hMQjIyLVlpNUQyeG1pQUFySkRnbjJyRVVCVEFjRV9zLXktZUdlQWg4T0dDSC1NNENzaS12czY5b20ybE9scXA4M29XVHZlaHgyRVN6cGVMS1FiMXhQSXdmSFRKd19Jejc4UkFNcXBWUUticVhOV25lUlUySkxVZzFkTzJ3WWVuWFRHU2VrNmpTVENaYTlrWUR1R2pmSzZZUlNDY19hakQ2QUhGNVpjZWhWMTFqbk5GZg?oc=5"
 },
 {
  "mun": "Carmen",
  "tema": "t1",
  "titulo": "Huracán 'Isaías' deja daños menores en Carmen - La Jornada Maya",
  "fuente": "La Jornada Maya",
  "link": "https://news.google.com/rss/articles/CBMiqAFBVV95cUxNaXFQQ2toWkh6cHlwR1VuajdZaXp4Q1dIMUtFendZcEdtYTdWVjdKbEZDX0x2dmlWQmpKLUREZVhPdUpLTzNvYlV5RUt3b2dERDFxcDQ4WWFyZkx1cEhPb0NYOXQ5SVRkZWNDZEI0ZE4wU0ExVFJsMzJYcHZBa1Q3SHhldmFVckRNUDFJODVoYk1UNVJRanlWWHBPdmVfQzMyV3kzYVJQNW0?oc=5"
 },
 {
  "mun": "Carmen",
  "tema": "t1",
  "titulo": "Tormenta Tropical 'Isaías' erosiona la playa y derriba ocho palapas en Sabancuy - La Jornada Maya",
  "fuente": "La Jornada Maya",
  "link": "https://news.google.com/rss/articles/CBMi7AFBVV95cUxOWGlIeDM3UkU1OUc4Q0tQbkRaaHlWQWNVS1g2UjNBT3p0U3UyTVNTYkNaRWJBRGZ2X2lYVGZPQVVhRHlvcU9xT0JkRDAwUUZFSm41bXJKRFhfMUFlcXdYcTFWaUNxNHViM0FCR2U0YnpvUHlnbTZSWU1JRTNzMXdVbnVaTkRLTDlkWE91SlcxV1JGZ1k0S3pmVFJhdUs3enItcm9GWDVrMnJMLW16ajU3UlpwYm9XOF83dGRRaGM1Y3VabHdTc1JNdXFpNC1NN1NIMUhqMTlMQWRzTGRRb1k5azNieURqZjd5OFZHWg?oc=5"
 },
 {
  "mun": "Calkiní",
  "tema": "t1",
  "titulo": "Gobernadora de Campeche ordena evacuar Isla Arena por marea alta - MILENIO",
  "fuente": "MILENIO",
  "link": "https://news.google.com/rss/articles/CBMimgFBVV95cUxQTG9nQ1pkUzByT25rbjd1czNYVV9WYjUxajVQdUh1Q1dNd1RSb1BnVFpRMDlmdVNRcUVOTVhNSjhtQkRFd3Q4Z3g5ZTBNX1NaRHBQbEFueUtLd3p3MHpwRkdkUG5FR1BzdHJLc19pbVRwQ0VCd21COWxUTDZyb19feGpkc0NTTFl3Q3NISVZROWFIenA3WmxYS25B0gGaAUFVX3lxTE9BOFJrc2Z4YktESkRwY25QMHo5dkltOWllSS1wcWlmTjVKb3gwc2xQM3djQU0xZUtmTmx5Z19RZ1VRWTdqbFpHYmFGby1Rc0Z3ZE1CMkxKX3oyNnlucmpVcmdsWjRSR2hxSnYyLWR1LU1MSW5pelhKYm94VjZOOVE4eVFmUmtTS0ttYjdlUjc2NTNKZjJFV3I1THc?oc=5"
 },
 {
  "mun": "Calkiní",
  "tema": "t1",
  "titulo": "SE INTENSIFICA LA TORMENTA TROPICAL ISAÍAS CON VIENTOS MÁXIMOS SOSTENIDOS DE 75 KILÓMETROS POR HORA; SE UBICA A 376 KILÓMETROS DE ISLA ARENA - Tribuna Campeche",
  "fuente": "Tribuna Campeche",
  "link": "https://news.google.com/rss/articles/CBMiigJBVV95cUxPOEt0cXp0dnlsaVM1UERNcldyV3VoVmJNQ0NHYWExZ3NXT3dxTW94OEI4S2VZUFByRFo1OHhPSlc3VGh6Z2x3aUxnTHdpOVJQa1NRSC1zeV94XzFqbGx4QWpENy1JT1M1Q3piM1FwRDNXUHdyNFNnQUh0UG4xRWJaR0N0VW1zTWxVRGowcUlBNGRfY1dxaTAyMnVKZm1hRGpLeFF3N0VtSU9kRlZ5QkFsaTFaNTFXS2pWUGFFUDZ2aTd2Wk1NRFBkZ2lVLVhoRzNiM0xZSHVNbWlQQkFFbm1kbWxoUzMtTzJ5bG9CcUkzU0xyc2YyalRVazQtNHp6MEhSZ295bU1ocG4tUQ?oc=5"
 },
 {
  "mun": "Calkiní",
  "tema": "t1",
  "titulo": "EVACUACIÓN PREVENTIVA DE 23 PERSONAS EN ISLA ARENA, POR ISAÍAS - Tribuna Campeche",
  "fuente": "Tribuna Campeche",
  "link": "https://news.google.com/rss/articles/CBMiogFBVV95cUxNdUpwSl9WV3JZczU4b3pXYXc0N3R3N0hQVVpaX2JXLXJkekdrSVRkYzZrWFAwUVpYb1ZkX0NCN0VzQWIwZ2d2VWtoeHJPcmg5Zjd0Tk5QYXhwdzhHdnNCUV9mSGtWQ09TdDQ2ZXdGSWtqZm95c3F1RnMzZlBUSU9FSm9KUGFrZWZpSVIxamY3X21nTnJMTzZibnhjMkVEOTJ6Q2c?oc=5"
 },
 {
  "mun": "Tenabo",
  "tema": "t5",
  "titulo": "ELEMENTO DE LA POLICÍA ESTATAL PIERDE LA VIDA EN FATAL ACCIDENTE EN LA CARRETERA CAMPECHE – TENABO - Tribuna Campeche",
  "fuente": "Tribuna Campeche",
  "link": "https://news.google.com/rss/articles/CBMi0AFBVV95cUxPc0ZycjhzRXVLZjJoSlFCMjM5Q09aS1lIMTdHZzhmWWVZcFVWd2N4akNJU0NwX2MwX1VkdUhhazZMWUo4bG4tWmNWSUtaYXM3dkpERWVxeDhOTEw3VkgybjUxUzIyeDdLTXdPQnRZU01tc2Z4RWJ5X0FRR2RjT0xVTFZ0WWNyX3hFTkl1bUpyR2xjdmhTX0FZMFQ0aFdmNmtYZEs3Tzg2UlY4Tk5WMXNVelJfR05VVDZGTTlnMkViREw1VW9rU2dqMUFRaWdjeFBU?oc=5"
 }
];
  const COSTEROS = ['Calkiní', 'Campeche', 'Carmen', 'Champotón', 'Seybaplaya', 'Tenabo'];
  const SOLO_COSTA = ['t1', 't6'];

  /* ── Cálculo (misma fórmula que cruce_encuesta.pesos) ── */
  const totalNotas = temas.reduce((a, t) => a + t.notas, 0);
  const totalEnc = categorias.reduce((a, c) => a + c.pct, 0);
  const cat = Object.fromEntries(categorias.map((c) => [c.id, c]));

  const resTemas = temas.map((t) => {
    const ids = cruces[t.id] || [];
    const pesoEnc = ids.reduce((a, id) => a + cat[id].pct, 0) / totalEnc;   // peso relativo, NO el % de ENVIPE
    const n = t.notas / totalNotas;
    let lectura;
    if (!ids.length) lectura = 'sin_contraste';
    else if (n / pesoEnc > 2) lectura = 'amplificado';
    else if (n / pesoEnc < 0.5) lectura = 'silencioso';
    else lectura = 'confirmado';
    return { ...t, categorias: ids, pesoEncuesta: pesoEnc, peso: PESO_ENCUESTA * pesoEnc + (1 - PESO_ENCUESTA) * n,
             lectura, confianza: confianza[t.id] };
  });
  const pesoTotal = resTemas.reduce((a, t) => a + t.peso, 0);

  const resCategorias = categorias.map((c) => ({
    ...c,
    temas: Object.keys(cruces).filter((tid) => cruces[tid].includes(c.id)),
  }));


  /* Municipios: titulares reales + reparto simulado (máx. 3 municipios por tema). */
  const resMunicipios = MUN_2024.map((m) => ({
    id: 'm' + m.cve, cve: m.cve, nombre: m.nombre, listaNominal: m.lista, ganador2024: m.ganador, margen2024: m.margen,
    participacion2024: m.part,
    titulares: MENCIONES.filter((x) => x.mun === m.nombre),
    dispara: [],
  }));
  const totalLista = MUN_2024.reduce((a, m) => a + m.lista, 0);
  resTemas.forEach((t) => {
    const reales = MENCIONES.filter((x) => x.tema === t.id);
    resMunicipios.forEach((m) => {
      const n = reales.filter((x) => x.mun === m.nombre).length;
      if (n) m.dispara.push({ tema: t.id, n, real: true });
    });
    const cand = resMunicipios
      .filter((m) => !m.dispara.some((d) => d.tema === t.id))
      .filter((m) => !SOLO_COSTA.includes(t.id) || COSTEROS.includes(m.nombre))
      .sort((a, b) => b.listaNominal - a.listaNominal);
    const hay = resMunicipios.filter((m) => m.dispara.some((d) => d.tema === t.id)).length;
    cand.slice(0, Math.max(0, 3 - hay)).forEach((m) => {
      m.dispara.push({ tema: t.id, n: Math.max(1, Math.round(t.notas * m.listaNominal / totalLista)), real: false });
    });
  });
  // Ningún municipio queda mudo: los que no salieron en el reparto reciben un tema de la agenda nacional (simulado).
  const AGENDA = ['t3', 't4', 't5', 't8'];
  resMunicipios.filter((m) => !m.dispara.length).forEach((m, i) => {
    const t = resTemas.find((x) => x.id === AGENDA[i % AGENDA.length]);
    m.dispara.push({ tema: t.id, n: Math.max(1, Math.round(t.notas * m.listaNominal / totalLista) || 1), real: false });
  });

  function evaluar(d) {
    const tocados = resTemas.filter((t) => d.toca.includes(t.id));
    return {
      toca: d.toca,
      coberturaNoticias: tocados.reduce((a, t) => a + t.notas, 0) / totalNotas,
      coberturaPonderada: tocados.reduce((a, t) => a + t.peso, 0) / pesoTotal,
      frases: d.frases,
    };
  }

  global.DISCURSOS_MOCK = {
    resultado: {
      entidad: 'Campeche',
      fechaNotas: '2026-10-10',
      totalNotas,
      pesoEncuesta: PESO_ENCUESTA,
      fuenteEncuesta: 'ENVIPE 2026 INEGI',
      temas: resTemas,
      categorias: resCategorias,
      municipios: resMunicipios,
      discursos: discursos.map(evaluar),   // se asignan por orden a los discursos capturados
    },
  };
})(window);
