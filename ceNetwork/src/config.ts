import type { ActiveCountryOption, CeNetworkConfig, SearchMode } from './types';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

function parseBounds(raw: string | undefined, fallback: [number, number, number, number]): [number, number, number, number] {
  if (!raw) return fallback;
  const parts = raw.split(',').map((n) => Number(n.trim()));
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0], parts[1], parts[2], parts[3]];
  }
  return fallback;
}

function parseCoord(raw: string | undefined, fallback: [number, number]): [number, number] {
  if (!raw) return fallback;
  const parts = raw.split(',').map((n) => Number(n.trim()));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0], parts[1]];
  }
  return fallback;
}

const COUNTRY_NAMES_BY_CODE: Record<string, string> = {
  MX: 'México',
  US: 'Estados Unidos',
  CO: 'Colombia',
  AR: 'Argentina',
  BR: 'Brasil',
  ES: 'España',
  CL: 'Chile',
  PE: 'Perú',
};

function parseActiveCountries(raw: string | undefined, fallbackCode: string, fallbackName: string): ActiveCountryOption[] {
  if (!raw) {
    return [{ code: fallbackCode, name: fallbackName }];
  }
  const codes = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (!codes.length) {
    return [{ code: fallbackCode, name: fallbackName }];
  }
  return codes.map((code) => ({
    code,
    name: code === fallbackCode ? fallbackName : (COUNTRY_NAMES_BY_CODE[code] || code),
  }));
}

/**
 * Configuración centralizada por variables de entorno y props.
 * - No hay territorio preseleccionado: la app inicia sin país, estado ni municipio y con el globo completo.
 *   Nunca se dispara una búsqueda automática al abrir o recargar.
 * - VITE_DEFAULT_TOPIC queda únicamente como placeholder sugerido del campo de texto.
 * - Prepara activeCountries (por defecto ['MX']) para habilitar otros países después por config.
 */
export function buildConfig(overrides: Partial<CeNetworkConfig> = {}): CeNetworkConfig {
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const fileFallbackMainUrl =
    isFileProtocol && window.location.pathname.includes('/frontend/ceNetwork')
      ? '../index.html'
      : isFileProtocol
        ? '../frontend/index.html'
        : 'http://localhost:8080/index.html';

  const referrerMainUrl =
    typeof document !== 'undefined' && document.referrer
      ? document.referrer
      : fileFallbackMainUrl;

  const rawUseMock = env.VITE_USE_MOCK ?? 'false';
  const useMock = ['true', '1', 'yes', 'si'].includes(String(rawUseMock).trim().toLowerCase());

  const rawFixture = env.VITE_FACEBOOK_FIXTURE ?? 'true';
  const facebookFixture = ['true', '1', 'yes', 'si'].includes(String(rawFixture).trim().toLowerCase());

  const rawModo = (env.VITE_DEFAULT_MODO || 'tema').trim().toLowerCase();
  const defaultMode: SearchMode =
    rawModo === 'persona' || rawModo === 'tendencias' ? rawModo : 'tema';

  const countryCode = (env.VITE_COUNTRY_CODE || 'MX').trim().toUpperCase();
  const countryName = env.VITE_COUNTRY_NAME || 'México';

  const defaultConfig: CeNetworkConfig = {
    appName: env.VITE_APP_NAME || 'ceNetwork',
    appSubtitle: env.VITE_APP_SUBTITLE || 'Escucha Social & Pulso Territorial',
    appUrl: env.VITE_CENETWORK_URL || 'http://localhost:5174',
    mainAppUrl: env.VITE_MAIN_APP_URL || referrerMainUrl,
    mainAppLabel: env.VITE_MAIN_APP_LABEL || 'Cerebro Electoral',
    apiUrl: (env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, ''),
    apiToken: env.VITE_API_TOKEN || '',
    useMock,
    facebookFixture,
    apifyMaxPosts: Number(env.VITE_APIFY_MAX_POSTS || 20),
    tileSourceUrl: env.VITE_TILE_SOURCE_URL || 'https://tiles.openfreemap.org/planet',
    defaultTheme: env.VITE_DEFAULT_THEME === 'light' ? 'light' : 'dark',
    defaultTopic: '',
    topicPlaceholder: env.VITE_DEFAULT_TOPIC || 'Ej. seguridad, agua, bacheo…',
    defaultMode,
    defaultScope: {
      // Sin territorio al iniciar: el usuario elige país, estado o municipio (o reabre una búsqueda del historial).
      nivel: 'pais',
      estado_id: null,
      municipio_id: null,
      pais_code: countryCode,
    },
    globeSpinSpeedDegPerSec: Number(env.VITE_GLOBE_SPIN_SPEED || 3.2),
    country: {
      code: countryCode,
      name: countryName,
      level1Label: env.VITE_LEVEL1_LABEL || 'Estado',
      level2Label: env.VITE_LEVEL2_LABEL || 'Municipio',
      bounds: parseBounds(env.VITE_COUNTRY_BOUNDS, [-118.45, 14.53, -86.7, 32.72]),
      center: parseCoord(env.VITE_COUNTRY_CENTER, [-102.55, 23.63]),
      initialGlobeCenter: parseCoord(env.VITE_GLOBE_CENTER, [-30, 20]),
      initialGlobeZoom: Number(env.VITE_GLOBE_ZOOM || 1.1),
      worldCountriesGeoJsonUrl: env.VITE_WORLD_GEOJSON_URL || 'geo/world_countries.geojson',
      statesGeoJsonUrl: env.VITE_ESTADOS_GEOJSON_URL || 'geo/mx_estados.geojson',
      municipiosUrlTemplate: env.VITE_MUNICIPIOS_URL_TEMPLATE || 'geo/municipios/{slug}.json',
      activeCountries: parseActiveCountries(env.VITE_ACTIVE_COUNTRIES, countryCode, countryName),
    },
  };

  return {
    ...defaultConfig,
    ...overrides,
    defaultScope: {
      ...defaultConfig.defaultScope,
      ...(overrides.defaultScope || {}),
    },
    country: {
      ...defaultConfig.country,
      ...(overrides.country || {}),
    },
  };
}
