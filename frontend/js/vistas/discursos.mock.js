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
      discursos: discursos.map(evaluar),   // se asignan por orden a los discursos capturados
    },
  };
})(window);
