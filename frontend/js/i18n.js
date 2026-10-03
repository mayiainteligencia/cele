/* ============================================
   CEREBRO ELECTORAL — SISTEMA i18n
   ============================================
   Motor de internacionalización ES ↔ EN.
   Traduce todo el contenido visible usando
   atributos data-i18n="clave" en el HTML.

   Uso:
     <span data-i18n="hero.titulo">Cerebro Electoral</span>
     <input data-i18n-placeholder="hero.buscar" placeholder="Busca por municipio...">

   El idioma se persiste en localStorage('ce-lang').
   ============================================ */

// Frases ES→EN: se carga síncrono, antes de que arranque el motor.
document.write('<script src="' + document.currentScript.src.replace('i18n.js', 'i18n-phrases.js') + '"><\/script>');

const CEi18n = (() => {
  'use strict';

  /* ════════════════════════════════════════════
     DICCIONARIOS
     ════════════════════════════════════════════ */

  const DICT = {
    es: {
      // ── Globales / Navegación ──
      'brand': 'Cerebro Electoral',
      'brand.short': 'CE',
      'nav.campana': 'Inteligencia de campaña',
      'nav.mando': 'Centro de mando',
      'nav.territorio': 'Territorio',
      'nav.analisis': 'Análisis',
      'nav.operacion': 'Operación',
      'nav.decisiones': 'Sala de decisiones',
      'nav.alertas': 'Alertas',
      'nav.sistema': 'Sistema',
      'nav.agentes': '8 Agentes Activos',

      // ── Subnav labels ──
      'sub.mapa': 'Mapa maestro',
      'sub.municipios': 'Municipios',
      'sub.demografia': 'Demografía',
      'sub.socioeconomico': 'Socioeconómico',
      'sub.donde_vota': 'Dónde se vota',
      'sub.resultados': 'Resultados',
      'sub.prediccion': 'Predicción',
      'sub.forensia': 'Forensia',
      'sub.candidaturas': 'Candidaturas',
      'sub.medios': 'Medios',
      'sub.grafo_riesgos': 'Grafo y riesgos',
      'sub.encuestas': 'Encuestas',
      'sub.finanzas': 'Finanzas',
      'sub.dia_d': 'Día D',
      'sub.roles': 'Roles y permisos',
      'sub.fuentes': 'Fuentes y trazabilidad',
      'sub.matriz': 'Matriz maestra',

      // ── Botón de idioma ──
      'lang.toggle': 'EN',
      'lang.tooltip': 'Switch to English',

      // ── INDEX.HTML — Hero ──
      'hero.titulo': 'Cerebro Electoral',
      'hero.descripcion': 'Inteligencia electoral para Campeche. Territorio, historia de voto, análisis y decisión, sobre datos con fuente y fecha de corte.',
      'hero.buscar': 'Busca por municipio, cabecera o centro CCT en Campeche...',
      'hero.ir_mando': 'Ir al Centro de Mando',
      'hero.jornada': 'Jornada electoral',
      'hero.jornada_fecha': 'domingo 6 de junio de 2027',
      'hero.dias': 'días',
      'hero.horas': 'horas',
      'hero.min': 'min',
      'hero.seg': 'seg',
      'hero.jornada_nota': 'Primer domingo de junio, art. 24 LGIPE. Hora del centro (UTC−6).',
      'hero.hoy_jornada': 'Hoy es la jornada electoral.',

      // ── INDEX.HTML — Agentes IA ──
      'agents.titulo': 'Agentes de IA Activos',
      'agents.log1': 'Escaneando participación electoral...',
      'agents.log2': 'Analizando actas de Champotón...',
      'agents.log3': 'Auditoría presupuestal al 100%...',

      // ── INDEX.HTML — Service card ──
      'svc.entidad': 'Campeche (Entidad 04)',
      'svc.marco': 'Marco Geoestadístico INEGI 2024 (corte agosto)',
      'svc.desc': '13 municipios delimitados con precisión poligonal, 1,482 sitios potenciales de casilla (CCT SEP) y el resultado de 2024 sección por sección.',
      'svc.municipios': 'Municipios',
      'svc.sitios': 'Sitios Únicos',
      'svc.casillas': 'Casillas 2024',
      'svc.secciones': 'Secciones con Resultado',
      'svc.centro_mando': 'Centro de Mando',
      'svc.13_municipios': '13 Municipios',
      'svc.trazabilidad': 'Trazabilidad',

      // ── INDEX.HTML — Etapas ──
      'etapa1.titulo': 'Dónde se vota',
      'etapa1.corto': 'Territorio',
      'etapa1.resumen': 'El territorio antes que nada: los 13 municipios, sus localidades y los 1,482 sitios donde físicamente cabe una casilla.',
      'etapa2.titulo': 'Cómo votó Campeche',
      'etapa2.corto': 'Historia',
      'etapa2.resumen': 'El resultado de 2024 sección por sección: participación, margen, voto nulo y quién ganó cada municipio. Pasado registrado, no proyección.',
      'etapa3.titulo': 'Quién compite y qué se dice',
      'etapa3.corto': 'Análisis',
      'etapa3.resumen': 'Candidaturas, medios, encuestas y el grafo de actores. Aquí es donde el análisis empieza a interpretar, y cada salida lo declara.',
      'etapa4.titulo': 'Qué hay que operar',
      'etapa4.corto': 'Operación',
      'etapa4.resumen': 'Presupuesto, estructura territorial y el guion de la jornada: la parte que se ejecuta, no la que se contempla.',
      'etapa5.titulo': 'Quién decide y con qué respaldo',
      'etapa5.corto': 'Decisión',
      'etapa5.resumen': 'La sala de decisiones, las alertas y la trazabilidad completa: de qué archivo salió cada cifra que viste en las cuatro etapas anteriores.',

      // ── Etapas – enlaces ──
      'etapa1.link1': 'Mapa maestro multicapa',
      'etapa1.link2': 'Los 13 municipios',
      'etapa1.link3': 'Infraestructura CCT',
      'etapa1.link4': 'Casillas por tipo',
      'etapa2.link1': 'Ganador y participación en el mapa',
      'etapa2.link2': 'Histórico y proyección',
      'etapa2.link3': 'Lista nominal y demografía',
      'etapa2.link4': 'Perfil socioeconómico',
      'etapa3.link1': 'Candidaturas',
      'etapa3.link2': 'Monitor de medios',
      'etapa3.link3': 'Encuestas',
      'etapa3.link4': 'Grafo y riesgos',
      'etapa4.link1': 'Finanzas de campaña',
      'etapa4.link2': 'Día D',
      'etapa4.link3': 'Forensia electoral',
      'etapa5.link1': 'Sala de decisiones',
      'etapa5.link2': 'Alertas',
      'etapa5.link3': 'Fuentes y trazabilidad',
      'etapa5.link4': 'Matriz maestra',

      // ── Sellos de estado ──
      'sello.dato': 'Datos de fuente',
      'sello.parcial': 'Parcialmente simulado',
      'sello.pendiente': 'Pendiente de insumo',

      // ── ECOSISTEMA.HTML ──
      'eco.volver': 'Campeche',
      'eco.titulo': 'Cerebro Electoral',
      'eco.para': 'Ecosistema para',
      'eco.ganar': 'GANAR LA ELECCIÓN',
      'eco.con_ia': 'con Inteligencia Artificial',
      'eco.partido': 'Inteligencia<br>de Partido',
      'eco.electoral': 'Inteligencia electoral<br>war Room cordinaciom',
      'eco.candidato': 'Inteligencia<br>Candidato',
      'eco.inversionistas': 'Inteligencia<br>Inversionistas',
      'eco.dia_d': 'Inteligencia<br>Día D',
      'eco.gobierno': 'Tu Gobierno<br>Inteligente',
      'eco.infra': 'Infraestructura',
      'eco.centro_datos': 'Centro de Datos',
      'eco.nube': 'Nube Privada /',
      'eco.ciber': 'Ciberseguridad',

      // ── MANDO.HTML ──
      'mando.titulo': 'Centro de Mando Ejecutivo — Campeche (04)',
      'mando.desc': 'Supervisión territorial integral, infraestructura educativa (CCT SEP) y catálogo municipal de 13 cabeceras.',
      'mando.marco': 'Marco INEGI 2024 (corte agosto)',
      'mando.cobertura': '13 Municipios (100% Cobertura)',
      'mando.rail': '13 Municipios de Campeche',

      // ── CARTOGRAFIA.HTML ──
      'carto.titulo': 'Cartografía Maestro y Visor Multicapa — Campeche',
      'carto.desc': 'Exploración interactiva de capas vectoriales INEGI 2024, AGEBs urbanas/rurales, localidades y catálogo educativo SEP CCT.',
      'carto.colorear': 'Colorear municipios por',
      'carto.sin': 'Sin coloreado',
      'carto.escuelas': 'Escuelas CCT',

      // ── CAMPANA.HTML ──
      'camp.titulo': 'Inteligencia de Campaña',
      'camp.agentes': '8 Agentes Activos',
      'camp.actualizado': 'Actualizado hace 2 min',

      // ── MEDIOS.HTML ──
      'medios.titulo': 'Monitoreo de Medios',
      'medios.desc': 'Monitoreo de emisoras de radio en tiempo real con transcripción Whisper y detección de keywords electorales.',

      // ── DECISIONES.HTML ──
      'dec.titulo': 'Sala de Decisiones Estratégicas',
      'dec.desc': 'Simulación de escenarios 2027 con inteligencia predictiva multimodal.',

      // ── DIA-D.HTML ──
      'diad.titulo': 'Centro de Operaciones Día D',
      'diad.desc': 'Estrategia y logística para la jornada electoral del 6 de junio de 2027.',

      // ── FINANZAS.HTML ──
      'fin.titulo': 'Copiloto Financiero y Fiscalización INE',
      'fin.desc': 'Control estricto del presupuesto de campaña, alertas de topes de gasto por municipio y auditoría preventiva de fiscalización.',
      'fin.tope': 'Tope Autorizado INE',
      'fin.tope_sub': 'Límite oficial para la contienda gubernamental',
      'fin.gasto': 'Gasto Ejercido',
      'fin.gasto_sub': '35.9% del tope ejercido',
      'fin.margen': 'Margen Disponible',
      'fin.margen_sub': 'Sin riesgo de sobrepaso',
      'fin.alertas': 'Alertas de Comprobación',
      'fin.alertas_val': '100% al Día',
      'fin.alertas_sub': 'Facturas y comprobantes validados SAT/INE',
      'fin.desglose': 'Desglose Presupuestal por Categoría de Gasto',
      'fin.desglose_desc': 'Auditoría en tiempo real para propaganda en vía pública, medios impresos, producción audiovisual y logística operativa.',
      'fin.cumplimiento': 'Semáforo de Cumplimiento INE',
      'fin.licita': 'Fiscalización Lícita',

      // ── FORENSIA.HTML ──
      'for.titulo': 'Forensia Electoral y Detección de Anomalías',
      'for.desc': 'Detección de anomalías en actas, validación de firmas y auditoría preventiva de casillas.',

      // ── CANDIDATURAS.HTML ──
      'cand.titulo': 'Perfiles Públicos de Candidaturas',
      'cand.desc': 'Registro de candidatos, coaliciones y seguimiento de la contienda electoral.',

      // ── ENCUESTAS.HTML ──
      'enc.titulo': 'Encuestas: tracking de intención de voto',
      'enc.desc': 'Agregador de encuestas públicas con metodología y margen de error declarado.',

      // ── ROLES.HTML ──
      'roles.titulo': 'Infraestructura, Ciberseguridad & Permisos RBAC',
      'roles.desc': 'Control de acceso por rol al ecosistema Cerebro Electoral.',

      // ── FUENTES.HTML ──
      'fuentes.titulo': 'Registro Oficial de Fuentes & Trazabilidad de Datos',
      'fuentes.desc': 'Registro completo de cada fuente de datos, su fecha de corte y la ruta de acceso al archivo original.',

      // ── MATRIZ.HTML ──
      'matriz.titulo': 'Matriz Maestro de Datos (28 Hojas) & Exportación',
      'matriz.desc': 'Tabla de control con el estatus de cada módulo y su fuente de datos asociada.',

      // ── ALERTAS.HTML ──
      'alertas.titulo': 'Tablero Unificado de Alertas Operativas',
      'alertas.desc': 'Centro de notificaciones de todos los agentes activos en la plataforma.',

      // ── INFRAESTRUCTURA.HTML ──
      'infra.titulo': 'Infraestructura Educativa CCT (Potencial para Casillas)',
      'infra.desc': 'Catálogo de inmuebles escolares del estado como sitios potenciales de casilla electoral.',

      // ── MUNICIPIOS.HTML ──
      'mun.titulo': 'Catálogo Municipal de Campeche (13 Municipios)',
      'mun.desc': 'Desglose territorial municipal con datos geoespaciales del Marco INEGI 2024.',

      // ── RIESGOS.HTML ──
      'riesgos.titulo': 'Grafo de Conocimiento y Matriz de Riesgos',
      'riesgos.desc': 'Mapeo de entidades públicas, relaciones institucionales, índice de confianza y evaluación dinámica de riesgo multidimensional.',
      'riesgos.activo': 'CE-Riesgos Activo',
      'riesgos.evaluacion': 'Evaluación Contínua',
      'riesgos.reputacional': 'Riesgo Reputacional',
      'riesgos.bajo': 'BAJO',

      // ── Predicción (mando.html / app.js) ──
      'pred.favorable': 'Favorable',
      'pred.competitivo': 'Competitivo',
      'pred.riesgo': 'En Riesgo',
      'pred.vs': 'vs. oposición',

      // ── Placeholder pages ──
      'placeholder.titulo': 'Módulo en desarrollo',
      'placeholder.desc': 'Este módulo se está construyendo. Los datos se integrarán conforme estén disponibles.',
    },

    en: {
      // ── Global / Navigation ──
      'brand': 'Electoral Brain',
      'brand.short': 'EB',
      'nav.campana': 'Campaign Intelligence',
      'nav.mando': 'Command Center',
      'nav.territorio': 'Territory',
      'nav.analisis': 'Analysis',
      'nav.operacion': 'Operations',
      'nav.decisiones': 'Decision Room',
      'nav.alertas': 'Alerts',
      'nav.sistema': 'System',
      'nav.agentes': '8 Active Agents',

      // ── Subnav labels ──
      'sub.mapa': 'Master Map',
      'sub.municipios': 'Municipalities',
      'sub.demografia': 'Demographics',
      'sub.socioeconomico': 'Socioeconomic',
      'sub.donde_vota': 'Polling Sites',
      'sub.resultados': 'Results',
      'sub.prediccion': 'Forecast',
      'sub.forensia': 'Forensics',
      'sub.candidaturas': 'Candidates',
      'sub.medios': 'Media',
      'sub.grafo_riesgos': 'Graph & Risks',
      'sub.encuestas': 'Polls',
      'sub.finanzas': 'Finances',
      'sub.dia_d': 'D-Day',
      'sub.roles': 'Roles & Permissions',
      'sub.fuentes': 'Sources & Traceability',
      'sub.matriz': 'Master Matrix',

      // ── Language toggle ──
      'lang.toggle': 'ES',
      'lang.tooltip': 'Cambiar a Español',

      // ── INDEX.HTML — Hero ──
      'hero.titulo': 'Electoral Brain',
      'hero.descripcion': 'Electoral intelligence for Campeche. Territory, voting history, analysis, and decision-making, all backed by sourced and timestamped data.',
      'hero.buscar': 'Search by municipality, district seat, or CCT center in Campeche...',
      'hero.ir_mando': 'Go to Command Center',
      'hero.jornada': 'Election Day',
      'hero.jornada_fecha': 'Sunday, June 6, 2027',
      'hero.dias': 'days',
      'hero.horas': 'hours',
      'hero.min': 'min',
      'hero.seg': 'sec',
      'hero.jornada_nota': 'First Sunday of June, Art. 24 LGIPE. Central time (UTC−6).',
      'hero.hoy_jornada': 'Today is Election Day.',

      // ── INDEX.HTML — AI Agents ──
      'agents.titulo': 'Active AI Agents',
      'agents.log1': 'Scanning voter turnout...',
      'agents.log2': 'Analyzing Champotón ballot records...',
      'agents.log3': 'Budget audit at 100%...',

      // ── INDEX.HTML — Service card ──
      'svc.entidad': 'Campeche (Entity 04)',
      'svc.marco': 'INEGI Geostatistical Framework 2024 (August cutoff)',
      'svc.desc': '13 municipalities with polygonal precision, 1,482 potential polling sites (SEP CCT catalog), and 2024 results section by section.',
      'svc.municipios': 'Municipalities',
      'svc.sitios': 'Unique Sites',
      'svc.casillas': 'Polling Booths 2024',
      'svc.secciones': 'Sections with Results',
      'svc.centro_mando': 'Command Center',
      'svc.13_municipios': '13 Municipalities',
      'svc.trazabilidad': 'Traceability',

      // ── INDEX.HTML — Stages ──
      'etapa1.titulo': 'Where people vote',
      'etapa1.corto': 'Territory',
      'etapa1.resumen': 'Territory first: the 13 municipalities, their localities, and the 1,482 sites where a polling booth can physically be set up.',
      'etapa2.titulo': 'How Campeche voted',
      'etapa2.corto': 'History',
      'etapa2.resumen': 'The 2024 results section by section: turnout, margin, null votes, and who won each municipality. Recorded past, not projection.',
      'etapa3.titulo': 'Who competes and what\'s being said',
      'etapa3.corto': 'Analysis',
      'etapa3.resumen': 'Candidacies, media, polls, and the actor graph. This is where analysis begins to interpret, and every output declares it.',
      'etapa4.titulo': 'What needs to be executed',
      'etapa4.corto': 'Operations',
      'etapa4.resumen': 'Budget, territorial structure, and the election day script: the part that gets executed, not the one that\'s observed.',
      'etapa5.titulo': 'Who decides and with what support',
      'etapa5.corto': 'Decision',
      'etapa5.resumen': 'The decision room, alerts, and full traceability: which file every figure from the previous four stages came from.',

      // ── Stages – links ──
      'etapa1.link1': 'Multi-layer master map',
      'etapa1.link2': 'The 13 municipalities',
      'etapa1.link3': 'CCT Infrastructure',
      'etapa1.link4': 'Polling booths by type',
      'etapa2.link1': 'Winner and turnout on map',
      'etapa2.link2': 'Historical & projection',
      'etapa2.link3': 'Voter roll & demographics',
      'etapa2.link4': 'Socioeconomic profile',
      'etapa3.link1': 'Candidates',
      'etapa3.link2': 'Media monitoring',
      'etapa3.link3': 'Polls',
      'etapa3.link4': 'Graph & risks',
      'etapa4.link1': 'Campaign finances',
      'etapa4.link2': 'D-Day',
      'etapa4.link3': 'Electoral forensics',
      'etapa5.link1': 'Decision room',
      'etapa5.link2': 'Alerts',
      'etapa5.link3': 'Sources & traceability',
      'etapa5.link4': 'Master matrix',

      // ── Status badges ──
      'sello.dato': 'Source data',
      'sello.parcial': 'Partially simulated',
      'sello.pendiente': 'Pending input',

      // ── ECOSISTEMA.HTML ──
      'eco.volver': 'Campeche',
      'eco.titulo': 'Electoral Brain',
      'eco.para': 'Ecosystem to',
      'eco.ganar': 'WIN THE ELECTION',
      'eco.con_ia': 'with Artificial Intelligence',
      'eco.partido': 'Party<br>Intelligence',
      'eco.electoral': 'Electoral Intelligence<br>War Room Coordination',
      'eco.candidato': 'Candidate<br>Intelligence',
      'eco.inversionistas': 'Investor<br>Intelligence',
      'eco.dia_d': 'D-Day<br>Intelligence',
      'eco.gobierno': 'Your Smart<br>Government',
      'eco.infra': 'Infrastructure',
      'eco.centro_datos': 'Data Center',
      'eco.nube': 'Private Cloud /',
      'eco.ciber': 'Cybersecurity',

      // ── MANDO.HTML ──
      'mando.titulo': 'Executive Command Center — Campeche (04)',
      'mando.desc': 'Comprehensive territorial oversight, educational infrastructure (SEP CCT), and municipal catalog of 13 district seats.',
      'mando.marco': 'INEGI Framework 2024 (August cutoff)',
      'mando.cobertura': '13 Municipalities (100% Coverage)',
      'mando.rail': '13 Municipalities of Campeche',

      // ── CARTOGRAFIA.HTML ──
      'carto.titulo': 'Master Cartography & Multi-layer Viewer — Campeche',
      'carto.desc': 'Interactive exploration of INEGI 2024 vector layers, urban/rural AGEBs, localities, and SEP CCT educational catalog.',
      'carto.colorear': 'Color municipalities by',
      'carto.sin': 'No coloring',
      'carto.escuelas': 'CCT Schools',

      // ── CAMPANA.HTML ──
      'camp.titulo': 'Campaign Intelligence',
      'camp.agentes': '8 Active Agents',
      'camp.actualizado': 'Updated 2 min ago',

      // ── MEDIOS.HTML ──
      'medios.titulo': 'Media Monitoring',
      'medios.desc': 'Real-time radio station monitoring with Whisper transcription and electoral keyword detection.',

      // ── DECISIONES.HTML ──
      'dec.titulo': 'Strategic Decision Room',
      'dec.desc': '2027 scenario simulation with multimodal predictive intelligence.',

      // ── DIA-D.HTML ──
      'diad.titulo': 'D-Day Operations Center',
      'diad.desc': 'Strategy and logistics for Election Day, June 6, 2027.',

      // ── FINANZAS.HTML ──
      'fin.titulo': 'Financial Copilot & INE Audit',
      'fin.desc': 'Strict campaign budget control, spending cap alerts by municipality, and preventive audit compliance.',
      'fin.tope': 'INE Authorized Cap',
      'fin.tope_sub': 'Official limit for the gubernatorial race',
      'fin.gasto': 'Expenditure',
      'fin.gasto_sub': '35.9% of cap spent',
      'fin.margen': 'Available Margin',
      'fin.margen_sub': 'No overspending risk',
      'fin.alertas': 'Proof-of-Expense Alerts',
      'fin.alertas_val': '100% Up to Date',
      'fin.alertas_sub': 'Invoices and receipts validated SAT/INE',
      'fin.desglose': 'Budget Breakdown by Spending Category',
      'fin.desglose_desc': 'Real-time audit for public advertising, print media, audiovisual production, and operational logistics.',
      'fin.cumplimiento': 'INE Compliance Indicator',
      'fin.licita': 'Lawful Auditing',

      // ── RIESGOS.HTML ──
      'riesgos.titulo': 'Knowledge Graph & Risk Matrix',
      'riesgos.desc': 'Mapping of public entities, institutional relationships, trust index, and dynamic multidimensional risk assessment.',
      'riesgos.activo': 'CE-Risks Active',
      'riesgos.evaluacion': 'Continuous Assessment',
      'riesgos.reputacional': 'Reputational Risk',
      'riesgos.bajo': 'LOW',

      // ── FORENSIA.HTML ──
      'for.titulo': 'Electoral Forensics & Anomaly Detection',
      'for.desc': 'Ballot anomaly detection, signature validation, and preventive polling booth audit.',

      // ── CANDIDATURAS.HTML ──
      'cand.titulo': 'Public Candidate Profiles',
      'cand.desc': 'Candidate registry, coalitions, and electoral race tracking.',

      // ── ENCUESTAS.HTML ──
      'enc.titulo': 'Polls: Voting Intention Tracking',
      'enc.desc': 'Public poll aggregator with declared methodology and margin of error.',

      // ── ROLES.HTML ──
      'roles.titulo': 'Infrastructure, Cybersecurity & RBAC Permissions',
      'roles.desc': 'Role-based access control for the Electoral Brain ecosystem.',

      // ── FUENTES.HTML ──
      'fuentes.titulo': 'Official Data Sources & Traceability Registry',
      'fuentes.desc': 'Complete registry of every data source, its cutoff date, and the path to the original file.',

      // ── MATRIZ.HTML ──
      'matriz.titulo': 'Master Data Matrix (28 Sheets) & Export',
      'matriz.desc': 'Control table with the status of each module and its associated data source.',

      // ── ALERTAS.HTML ──
      'alertas.titulo': 'Unified Operational Alerts Dashboard',
      'alertas.desc': 'Notification center for all active agents on the platform.',

      // ── INFRAESTRUCTURA.HTML ──
      'infra.titulo': 'Educational Infrastructure CCT (Potential Polling Sites)',
      'infra.desc': 'Catalog of state school buildings as potential electoral polling sites.',

      // ── MUNICIPIOS.HTML ──
      'mun.titulo': 'Municipal Catalog of Campeche (13 Municipalities)',
      'mun.desc': 'Municipal territorial breakdown with INEGI 2024 geospatial data.',

      // ── Prediction (mando.html / app.js) ──
      'pred.favorable': 'Favorable',
      'pred.competitivo': 'Competitive',
      'pred.riesgo': 'At Risk',
      'pred.vs': 'vs. opposition',

      // ── Placeholder pages ──
      'placeholder.titulo': 'Module under development',
      'placeholder.desc': 'This module is being built. Data will be integrated as it becomes available.',
    },
  };

  /* ════════════════════════════════════════════
     MOTOR
     ════════════════════════════════════════════ */

  let _lang = localStorage.getItem('ce-lang') || 'es';

  /** Devuelve el idioma activo */
  function lang() { return _lang; }

  /** Traduce una clave al idioma activo */
  function t(key) {
    return (DICT[_lang] && DICT[_lang][key]) || (DICT.es[key]) || key;
  }

  /** Aplica las traducciones a todos los elementos con data-i18n */
  function aplicar() {
    // Textos dentro de elementos
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val !== key) {
        // Si la traducción contiene <br>, usar innerHTML
        if (val.includes('<br>') || val.includes('<')) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    // Tooltips (data-tooltip)
    document.querySelectorAll('[data-i18n-tooltip]').forEach((el) => {
      const key = el.getAttribute('data-i18n-tooltip');
      el.setAttribute('data-tooltip', t(key));
    });

    // aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key));
    });

    traducirDOM();

    // Actualizar <html lang>
    document.documentElement.lang = _lang === 'es' ? 'es' : 'en';

    // Actualizar botón toggle
    const btn = document.getElementById('lang-toggle-btn');
    if (btn) {
      const label = btn.querySelector('.lang-toggle__label');
      if (label) label.textContent = t('lang.toggle');
      btn.setAttribute('data-tooltip', t('lang.tooltip'));
    }
  }


  /* ════════════════════════════════════════════
     TRADUCTOR DE TEXTO (frases ES → EN)
     ════════════════════════════════════════════
     Recorre nodos de texto y atributos visibles y los sustituye con
     PH (js/i18n-phrases.js). Un MutationObserver traduce lo que el JS
     renderiza después (tablas, tarjetas, datos de los JSON).
     El original se guarda para volver a español. */

  let PH = {}, RX = [], FRAG_RX = null, LC = {};
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tooltip'];
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Lo llama js/i18n-phrases.js. ph: {es: en}; rx: [[RegExp, 'reemplazo $1'], ...] */
  function frases(ph, rx) {
    PH = ph; RX = rx || [];
    // Fragmentos largos: sustitución dentro de textos mezclados con variables.
    const frag = Object.keys(PH).filter((k) => k.length >= 5).sort((a, b) => b.length - a.length);
    const L = /[\p{L}\d]/u;   // el límite de palabra sólo se exige donde el fragmento empieza/termina en letra
    const alt = (k) => (L.test(k[0]) ? '(?<![\\p{L}\\d_])' : '') + esc(k) + (L.test(k.slice(-1)) ? '(?![\\p{L}\\d_])' : '');
    FRAG_RX = frag.length ? new RegExp(frag.map(alt).join('|'), 'giu') : null;
    LC = {}; for (const k of Object.keys(PH)) LC[k.toLowerCase()] = k;
  }
  const originales = new WeakMap();   // nodo|elemento → {orig, out} | {attr: {orig,out}}
  let _observer = null;

  function enEn(txt) {
    const k = norm(txt);
    if (!k) return txt;
    let out = PH[k];
    if (out === undefined) {
      for (const [re, rep] of RX) if (!re.global && re.test(k)) { out = k.replace(re, rep); break; }
    }
    if (out === undefined && k.length >= 40) {   // texto cortado por el JS (con o sin …): coincide por prefijo
      const pre = k.replace(/…$/, ''), full = Object.keys(PH).find((e) => e.length > pre.length && e.startsWith(pre));
      if (full) out = PH[full].slice(0, Math.round(pre.length * PH[full].length / full.length)).trimEnd() + (k.endsWith('…') ? '…' : '');
    }
    if (out === undefined && FRAG_RX) {
      let r = k.replace(FRAG_RX, (m) => {
        const e = PH[m] ?? PH[LC[m.toLowerCase()]];
        // el texto original en minúscula conserva la minúscula (salvo siglas/nombres propios)
        return m[0] === m[0].toLowerCase() && m[0] !== m[0].toUpperCase() && /^[A-Z][a-z]/.test(e) ? e[0].toLowerCase() + e.slice(1) : e;
      });
      for (const [re, rep] of RX) if (re.global) r = r.replace(re, rep);   // patrones sueltos (fechas, años…)
      if (r !== k) out = r;
    }
    if (out === undefined) return txt;
    const lead = txt.match(/^\s*/)[0], trail = txt.match(/\s*$/)[0];
    return lead + out + trail;
  }

  function nodoTexto(n) {
    const rec = originales.get(n);
    if (_lang === 'en') {
      if (rec && rec.out === n.nodeValue) return;       // ya traducido
      const out = enEn(n.nodeValue);
      if (out !== n.nodeValue) { originales.set(n, { orig: n.nodeValue, out }); n.nodeValue = out; }
    } else if (rec && rec.out === n.nodeValue) {
      n.nodeValue = rec.orig; originales.delete(n);
    }
  }

  function atributos(el) {
    const rec = originales.get(el) || {};
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null) continue;
      const r = rec[a];
      if (_lang === 'en') {
        if (r && r.out === v) continue;
        const out = enEn(v);
        if (out !== v) { rec[a] = { orig: v, out }; el.setAttribute(a, out); }
      } else if (r && r.out === v) {
        el.setAttribute(a, r.orig); delete rec[a];
      }
    }
    originales.set(el, rec);
  }

  function recorrer(raiz) {
    if (raiz.nodeType === 3) { if (!/^(SCRIPT|STYLE)$/.test(raiz.parentNode?.nodeName)) nodoTexto(raiz); return; }
    if (raiz.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(raiz.nodeName)) return;
    atributos(raiz);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => /^(SCRIPT|STYLE)$/.test(n.nodeName) || (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? nodoTexto(n) : atributos(n);
  }

  function traducirDOM() {
    if (!document.body) return;
    if (_observer) _observer.disconnect();
    recorrer(document.body);
    document.title = _lang === 'en' ? enEn(document.title) : (document.title);
    if (_lang === 'en') {
      _observer = _observer || new MutationObserver((muts) => {
        _observer.disconnect();
        for (const m of muts) {
          if (m.type === 'characterData') nodoTexto(m.target);
          else if (m.type === 'attributes') atributos(m.target);
          else m.addedNodes.forEach(recorrer);
        }
        observar();
      });
      observar();
    }
  }
  function observar() {
    _observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /** Cambia el idioma */
  function setLang(nuevoIdioma) {
    _lang = nuevoIdioma;
    localStorage.setItem('ce-lang', _lang);
    aplicar();

    // Disparar evento para que otros scripts reaccionen
    document.dispatchEvent(new CustomEvent('ce:lang-change', { detail: { lang: _lang } }));
  }

  /** Toggle entre ES y EN */
  function toggle() {
    setLang(_lang === 'es' ? 'en' : 'es');
  }

  /** Renderiza el botón de idioma (se inserta en la barra superior) */
  function renderToggleButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'lang-toggle-btn';
    btn.className = 'lang-toggle';
    btn.setAttribute('data-tooltip', t('lang.tooltip'));
    btn.setAttribute('aria-label', 'Toggle language');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
        <path d="M2 12h20"/>
      </svg>
      <span class="lang-toggle__label">${t('lang.toggle')}</span>
    `;
    btn.addEventListener('click', toggle);
    return btn;
  }

  // Arranque: aplica el idioma guardado y, si la página no tiene sidebar
  // (index, ecosistema, mapa…), pone un botón flotante.
  function iniciar() {
    if (!document.getElementById('lang-toggle-btn')) {
      const b = renderToggleButton();
      b.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999';
      document.body.appendChild(b);
    }
    aplicar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);

  // API pública
  return { lang, t, frases, aplicar, setLang, toggle, renderToggleButton, DICT };
})();
