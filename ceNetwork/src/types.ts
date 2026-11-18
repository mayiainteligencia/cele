import type { ThemeMode } from './map/theme';

export type ScopeLevel = 'pais' | 'estado' | 'municipio';
export type SearchMode = 'tema' | 'persona' | 'tendencias';

/**
 * Estructura de alcance expuesta para filtrar consultas posteriores.
 */
export interface ScopeSelection {
  nivel: ScopeLevel;
  estado_id: string | null;
  municipio_id: string | null;
  nombre?: string;
  texto?: string;
  pais_code?: string;
}

export interface NormalizedTerritoryProps {
  estado_id: string;
  municipio_id: string | null;
  nombre: string;
  slug?: string;
  abrev?: string;
  volume?: number;
  volumeNorm?: number;
  positivePct?: number;
  neutralPct?: number;
  negativePct?: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface HourlyPoint {
  hour: string;
  volume: number;
}

export interface DailyVolumePoint {
  fecha: string;
  etiqueta: string;
  posts: number;
}

export interface TopicItem {
  tag: string;
  volume: number;
  trend: string;
}

export interface MockComment {
  id: string;
  author: string;
  handle: string;
  platform: 'X' | 'TikTok' | 'Facebook' | 'Instagram' | 'Reddit';
  timeAgo: string;
  sentiment: 'pos' | 'neu' | 'neg';
  text: string;
}

export interface SocialApiCategory {
  categoria: string;
  count: number;
  porcentaje: number;
}

export interface SocialApiNarrative {
  plataformas?: Plataforma[];
  titulo: string;
  texto: string;
  fuente: string;
  fuentes: string[];
  tipo_fuente: 'persona' | 'oficial' | 'afin' | 'politico' | 'medio' | 'ciudadano' | 'sin_clasificar';
  categoria: string;
  sentimiento: 'pos' | 'neu' | 'neg' | 'oficial' | 'sin_clasificar';
  count: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  time: string;
  url: string;
}

export interface SocialApiPost {
  postId: string;
  text: string;
  time: string;
  url: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  reactionLikeCount?: number;
  reactionLoveCount?: number;
  reactionHahaCount?: number;
  reactionAngryCount?: number;
  user: {
    id: string;
    name: string;
    profilePic?: string;
  };
  link?: string | null;
  media?: unknown[];
  categoria: string;
  tipo_fuente: 'persona' | 'oficial' | 'afin' | 'politico' | 'medio' | 'ciudadano' | 'sin_clasificar';
  sentimiento: 'pos' | 'neu' | 'neg' | 'oficial' | 'sin_clasificar';
  clasificador?: 'gemini' | 'reglas';
  repeticiones?: number;
  origen_post?: 'publicado_por_persona' | 'mencion';
  coincidencia?: { puntaje: number; nivel: string; coincidencias: string[]; umbral?: number };
  texto_origen?: 'propio' | 'imagen' | 'enlace';
  plataforma?: Plataforma;
  seguidores?: number | null;
  metricas?: { reacciones: number | null; comentarios: number | null; compartidos: number | null; vistas: number | null; retuits?: number | null; citas?: number | null };
  atribucion?: { puntaje: number; razones: string[]; es_la_persona: 'si' | 'no' | 'incierto'; razon_ia: string };
}

export interface PersonaProfile {
  nombre: string;
  url: string;
  categoria: string;
  seguidores: number;
}

export interface SocialApiSummary {
  id: string;
  cached?: boolean;
  query?: {
    tema: string;
    modo: string;
    alcance: ScopeSelection;
  };
  fuente_datos: string;
  es_fixture?: boolean;
  etiqueta_fuente?: string;
  sin_datos_demo?: boolean;
  mensaje?: string | null;
  clasificador?: 'gemini' | 'reglas';
  fecha_corrida: string;
  ventana_dias?: number;
  posts_fuente?: number;
  posts_filtro_tema?: number;
  total_posts: number;
  relevantes_posts: number;
  ciudadanos_medios_posts?: number;
  oficiales_posts?: number;
  porcentaje_oficial: number;
  descartados?: {
    por_filtro_tema?: number;
    por_fecha: number;
    por_homonimo: number;
    no_relevantes_o_empleo: number;
    vacios: number;
    por_idioma?: number;
    por_propia_pagina?: number;
  };
  descartados_detalle?: DescartadoDetalle[];
  periodo?: PeriodoInfo;
  aviso_ficha?: string;
  que_se_sabe?: QueSeSabe;
  muestra?: Confianza;
  aviso_menciones?: string;
  variantes_buscadas?: { variante: string; tipo: string; posts: number }[];
  lugares_mencion?: { lugar: string; tipo: string; posts: number }[];
  opinion?: Opinion;
  publicado_por_persona?: { total: number; en_periodo: number; posts: { autor: string; plataforma: Plataforma; fecha: string; url: string; fragmento: string; interacciones: number }[] };
  comentarios?: { fecha: string; items: unknown[]; estados: Record<string, { estado: string; comentarios?: number; motivo?: string }>; posts_consultados: number };
  historial_anterior?: HistorialAnteriorItem[];
  historial_anterior_total?: number;
  antiguo_repetido?: { titulo: string; fragmento: string; cuentas: number }[];
  plataformas?: Record<string, EstadoPlataforma>;
  plataformas_solicitadas?: Plataforma[];
  costo_estimado_usd?: number;
  volumen_por_dia_plataforma?: Record<string, DailyVolumePoint[]>;
  umbral_coincidencia?: number;
  volumen: number;
  interacciones_totales?: number;
  sentimiento_afines?: { positive: number; neutral: number; negative: number; base: number };
  sin_clasificar_tipo?: number;
  sentimiento: SentimentBreakdown & {
    base?: number;
    sin_clasificar?: number;
    universo?: string;
    excluye_oficial?: boolean;
  };
  categorias: SocialApiCategory[];
  narrativa_oficial: SocialApiNarrative[];
  narrativa_ciudadana: SocialApiNarrative[];
  posts_recientes: SocialApiPost[];
  volumen_por_dia?: DailyVolumePoint[];
  pico_posts_dia?: number;
  serie_horaria?: HourlyPoint[];
  persona?: { pagina_url: string; pagina_nombre: string; publicados: number; menciones: number; ultima_publicacion?: string | null; inactiva?: boolean; dias_sin_publicar?: number | null };
  ficha?: { id: string; nombre: string };
  por_confirmar?: SocialApiPost[];
  aviso_ia?: string | null;
  modelos_usados?: string[];
  ia?: { modelos_usados: string[]; cambio_por_cuota: boolean; cuota_agotada: boolean };
  palabras?: Palabras;
  temas?: Temas;
  analisis?: Analisis;
  radar?: Radar;
  sin_texto?: {
    total: number;
    publicados: number;
    menciones: number;
    posts: { url?: string; user: string; time?: string; origen_post?: string }[];
  };
}

export interface TerritorySocialData {
  id: string;
  estado_id: string;
  municipio_id: string | null;
  nombre: string;
  abrev?: string;
  volume: number;
  volumeNorm: number;
  sentiment: SentimentBreakdown;
  hourly: HourlyPoint[];
  topics: TopicItem[];
  comments: [MockComment, MockComment, MockComment, MockComment, MockComment];
  realSummary?: SocialApiSummary;
}

export type DataStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface ActiveCountryOption {
  code: string;
  name: string;
}

export interface CountryGeoConfig {
  code: string;
  name: string;
  level1Label: string;
  level2Label: string;
  bounds: [number, number, number, number];
  center: [number, number];
  initialGlobeCenter: [number, number];
  initialGlobeZoom: number;
  worldCountriesGeoJsonUrl: string;
  statesGeoJsonUrl: string;
  municipiosUrlTemplate: string;
  activeCountries: ActiveCountryOption[];
}

export interface CeNetworkConfig {
  appName: string;
  appSubtitle: string;
  appUrl: string;
  mainAppUrl: string;
  mainAppLabel: string;
  apiUrl: string;
  apiToken: string;
  useMock: boolean;
  facebookFixture: boolean;
  apifyMaxPosts: number;
  tileSourceUrl: string;
  defaultTheme: ThemeMode;
  defaultTopic: string;
  topicPlaceholder: string;
  defaultMode: SearchMode;
  defaultScope: ScopeSelection;
  globeSpinSpeedDegPerSec: number;
  country: CountryGeoConfig;
  onScopeChange?: (scope: ScopeSelection) => void;
}

export interface Entidad {
  id: string;
  tipo: 'persona' | 'tema' | 'partido';
  nombre: string;
  variantes: string[];
  cargo: string;
  partido: string;
  territorio: { estado_id: string | null; municipio_id: string | null; nombre: string | null };
  paginas_oficiales: string[];
  hashtags: string[];
  palabras_descarte: string[];
  idioma: string;
  logros_verificables?: string;
  apodo?: string;
  usuario_x?: string;
  usuario_tiktok?: string;
  usuario_instagram?: string;
  hashtags_x?: string[];
  hashtags_tiktok?: string[];
  hashtags_instagram?: string[];
  monitoreo?: boolean;
}

export interface Alerta {
  id: string;
  fecha: string;
  ficha_id: string;
  ficha_nombre: string;
  tipo: 'pico' | 'narrativa' | 'contenido_antiguo';
  estado: 'nueva' | 'revisada' | 'descartada';
  gravedad: 'alta' | 'media' | 'baja';
  etiqueta: string;
  resumen: string;
  afirmacion: string | null;
  tono: string | null;
  explicacion: string | null;
  datos: Record<string, unknown>;
  linea_tiempo: { hora: string; cuenta: string }[];
}

export interface LineaBase {
  ficha_id: string;
  ficha: string;
  estado: string;
  mensaje?: string;
  dias: number;
  puntos: number;
}

export interface HistorialItem {
  id: string;
  periodo?: PeriodoInfo;
  plataformas?: Plataforma[];
  tema: string;
  modo: SearchMode;
  alcance: ScopeSelection;
  fecha: string;
  origen: string;
  n_posts: number;
}

export interface HistorialEntry extends HistorialItem {
  resumen: SocialApiSummary;
}

export interface FilaPalabra { palabra: string; posts: number; comentarios?: number; menciones: number; ids: string[] }
export interface Palabras {
  muestra: number; muestra_posts?: number; muestra_comentarios?: number; confianza?: Confianza; suficiente: boolean; mensaje?: string;
  positivas?: FilaPalabra[]; negativas?: FilaPalabra[]; sentimiento?: { pos: number; neu: number; neg: number };
}
export interface Temas {
  muestra: number; muestra_posts?: number; muestra_comentarios?: number; confianza?: Confianza; suficiente: boolean; mensaje?: string; modelo?: string;
  temas?: { tema: string; posts: number; comentarios?: number; ejemplos: { texto: string; url?: string }[] }[];
  tipos_mensaje?: { tipo: string; posts: number }[];
}
export interface Analisis {
  estado: string; mensaje?: string; etiqueta: string; posts_base: number; modelo?: string; cambio_por_cuota?: boolean;
  base?: { posts: number; tipos_fuente: Record<string, number>; plataformas: Record<string, number>; muestra_terceros: { posts: number; comentarios: number }; confianza: Confianza };
  mensajes_clave?: string[]; temas?: string[]; huecos?: string[]; aviso_muestra?: string;
  hallazgos?: string[]; riesgos?: string[]; oportunidades?: string[];
  acciones?: { prioridad: string; plazo: string; canal: string; objetivo: string; evidencia: string[] }[];
  respuestas?: { narrativa: string; clasificacion: string; respuesta: string; evidencia: string[] }[];
  contenido?: { idea: string; canal: string; logro_base: string }[];
  aviso_contenido?: string | null;
}
export interface CuentaRadar { plataforma: string; usuario: string; url: string; seguidores: number | null; verificado: boolean | null; fecha_medicion: string | null }
export interface FilaRadar {
  nombre: string; categorias: string[]; fuente_url: string; razon_sugerencia: string; sugerido: boolean; propia: boolean;
  origen: string; referente_nacional: boolean; habla_de_la_persona: 'sí' | 'no' | 'sin dato'; ambito_etiqueta: string;
  estado_medicion: 'medido' | 'sugerido_sin_medir'; etiqueta: string; motivo_sin_medir: string; usuarios: Record<string, string>;
  plataformas: CuentaRadar[]; seguidores: number | null; interaccion_promedio: number | null; actividad: number | null; nivel: string | null;
  ambito: 'municipio' | 'estado' | 'nacional'; evidencia_ubicacion: string[]; menciona_ficha: boolean;
  tipo: string | null; tono: string | null; temas: string[]; razon: string; puntaje: number | null;
  desglose: { alcance: number; interaccion: number; actividad: number; relevancia_local: number } | null; fecha_medicion: string | null;
}
export interface FuentesRadar { medidos_historial: number; sugeridos_gemini: number; verificados: number; sin_medir: number; reutilizados?: number; referentes?: Record<string, number>; categorias_consultadas: number }
export interface Radar {
  version?: number;
  estado: string; aviso: string; nota_normativa: string; fecha: string; lugar: string; persona: string; categorias: string[];
  niveles: Record<string, number>; medidos: FilaRadar[]; avisos: string[]; fuentes: FuentesRadar; incluye_referentes?: boolean;
  contenido?: ContenidoRadar | null; formatos?: FormatosRadar;
  aviso_ia: string | null; modelos_usados: string[]; cambio_por_cuota: boolean;
}
export interface EstimadoMedir { nombre: string; total_usd: number; cuentas: Record<string, { usuario: string; costo_usd: number; unidades_youtube?: number; activo: boolean }> }
export interface EstimadoConsumo {
  peticiones_gemini: number; creditos_apify_usd: number; posts_base?: number;
  lugar?: string; categorias_en_cache?: number; sugerencias_en_cache?: boolean; incluye_referentes?: boolean; perfiles_apify_max?: number; youtube_activo?: boolean; unidades_youtube_max?: number; tope_consultas?: number;
}

export interface DescartadoDetalle {
  motivo: 'no contiene el tema' | 'fuera del periodo' | 'homónimo' | 'otro idioma' | 'escrito por la propia página' | 'otro';
  plataforma?: Plataforma; nota: string; autor: string; fecha: string; fragmento: string; url: string; origen_post?: string | null; coincidencia?: number | null;
}

export type Plataforma = 'facebook' | 'x' | 'tiktok' | 'instagram';
export interface EstadoPlataforma {
  estado: 'ok' | 'vacío' | 'error'; motivo: string | null; crudos: number; con_texto: number; relevantes: number; origen: string | null; costo_usd: number; tope?: number; limitada?: boolean;
}
export interface EstimadoPlataformas {
  en_vivo: boolean; total_usd: number; aviso_periodo?: string | null; nota_todo?: string | null;
  plataformas: Record<string, { max_resultados: number; costo_usd: number; costo_1000_usd: number }>;
}

/** Periodo que viaja en la petición: dias (0 = todo el historial) o desde/hasta (YYYY-MM-DD). */
export interface PeriodoReq { dias?: number; desde?: string; hasta?: string }
export interface PeriodoInfo { tipo: 'dias' | 'rango' | 'todo'; dias: number | null; desde: string | null; hasta: string | null; etiqueta: string }
export interface HistorialAnteriorItem {
  autor: string; plataforma: Plataforma; fecha: string; fragmento: string; url: string; interacciones: number; dias_antiguedad: number;
}

export interface Opinion { confianza?: Confianza; posts: number; comentarios: number; base: number; positive: number; neutral: number; negative: number; suficiente: boolean }
export interface EstimadoComentarios {
  en_vivo: boolean; total_usd: number; tope_comentarios: number;
  plataformas: Record<string, { posts: number; max_comentarios: number; costo_usd: number }>;
}

export interface Confianza { base: number; posts: number; comentarios: number; nivel: 'baja' | 'media' | 'alta'; minimo: number; vacio: boolean; preliminar: boolean; etiqueta: string }
export interface NarrativaSenal {
  titulo: string; fragmento: string; tipo_fuente: string; posts: number; cuentas: number; plataformas: string[]; desde: string; interaccion: number;
  reacciones: number; comentarios: number; compartidos: number; comentarios_por_reaccion: number | null; compartidos_por_reaccion: number | null;
  desglose_reacciones: { enojo: number; risa: number; tristeza: number } | null;
}
export interface QueSeSabe {
  confianza: Confianza; total_posts: number; por_tipo_fuente: Record<string, number>; por_plataforma: Record<string, number>;
  narrativas: NarrativaSenal[]; nota_senal: string; aviso_tipo?: string | null;
  falta: { posts_terceros: number; comentarios_terceros: number; minimo: number; faltan_para_media: number; faltan_para_alta: number };
}

export interface ContenidoRadar {
  base: number; con_seguidores: number; fecha: string; nota: string; vacio?: boolean; clasificacion?: 'gemini' | 'basica'; aviso_clasificacion?: string | null;
  por_formato?: { formato: string; n: number; tasa_mediana: number | null; interaccion_media: number }[];
  hashtags?: [string, number][]; temas?: { tema: string; n: number; tasa_mediana: number | null }[];
  duracion?: { mediana_s: number | null; n: number };
  mejores_dias?: { clave: string; tasa_media: number; n: number }[]; mejores_horas?: { clave: string; tasa_media: number; n: number }[];
  ejemplos?: { plataforma: string; autor: string; formato: string; texto: string; url: string; interaccion?: number; interacciones: number; seguidores: number | null; tasa: number | null; tema: string }[];
}
export interface FormatosRadar {
  estado: string; mensaje?: string; etiqueta?: string; base?: number; fecha?: string; modelo?: string;
  formatos?: { formato: string; tema: string; horario: string; idea: string; patron_base: string }[];
}
export interface ProgresoRadar { estado: string; etapa?: string; i?: number; n?: number; filas_parciales?: number; radar?: Radar | null; error?: string | null }
