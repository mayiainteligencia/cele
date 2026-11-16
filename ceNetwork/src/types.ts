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
  titulo: string;
  texto: string;
  fuente: string;
  fuentes: string[];
  tipo_fuente: 'oficial' | 'politico' | 'medio' | 'ciudadano';
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
  tipo_fuente: 'oficial' | 'politico' | 'medio' | 'ciudadano';
  sentimiento: 'pos' | 'neu' | 'neg' | 'oficial' | 'sin_clasificar';
  clasificador?: 'gemini' | 'reglas';
  repeticiones?: number;
  origen_post?: 'publicado_por_persona' | 'mencion';
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
  };
  volumen: number;
  interacciones_totales?: number;
  sentimiento: SentimentBreakdown & {
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
  persona?: { pagina_url: string; pagina_nombre: string; publicados: number; menciones: number };
  ficha?: { id: string; nombre: string };
  por_confirmar?: SocialApiPost[];
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
  monitoreo?: boolean;
}

export interface Alerta {
  id: string;
  fecha: string;
  ficha_id: string;
  ficha_nombre: string;
  tipo: 'pico' | 'narrativa';
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
