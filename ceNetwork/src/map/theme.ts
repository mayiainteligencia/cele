import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';

export type ThemeMode = 'dark' | 'light';

export interface UiThemeTokens {
  bgBase: string;
  bgElevated: string;
  glassBg: string;
  glassBgStrong: string;
  glassHover: string;
  glassBorder: string;
  glassBorderBright: string;
  glassTopHighlight: string;
  accentMint: string;
  accentMintDim: string;
  accentCyan: string;
  accentCyanDim: string;
  sentimentPos: string;
  sentimentNeu: string;
  sentimentNeg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
}

export interface MapThemePalette {
  mode: ThemeMode;
  background: string;
  spaceColor: string;
  globeFogColor: string;
  atmosphereColor: string;
  atmosphereHighColor: string;
  oceanFill: string;
  oceanWaterFill: string;
  landBase: string;
  worldLandFill: string;
  worldHoverFill: string;
  worldBorderLine: string;
  worldHoverBorder: string;
  countryBorder: string;
  mexicoOutline: string;
  /** Escala de volumen: de verde profundo a verde menta/neón brillante */
  volumeStops: [number, string][];
  noDataFill: string;
  activeTerritoryFill: string;
  hoverFill: string;
  borderLine: string;
  munBorderLine: string;
  borderHover: string;
  borderSelected: string;
  glowHover: string;
  glowSelected: string;
  labelText: string;
  labelHalo: string;
  dimmedOpacity: number;
  activeOpacity: number;
  hoverOpacity: number;
  ui: UiThemeTokens;
}

/**
 * Tema oscuro (por defecto): océano azul profundo, países del mundo en verde bosque (#14452f)
 * y México en verde teal más claro (#1e8570) con borde menta (#6ee7b7). Sin tonos azul-violeta en los estados.
 * Territorio activo en menta (#6ee7b7) con resplandor.
 */
export const DARK_MAP_THEME: MapThemePalette = {
  mode: 'dark',
  background: '#04070d',
  spaceColor: '#03060c',
  globeFogColor: '#13314a',
  atmosphereColor: '#1f6f68',
  atmosphereHighColor: '#6ee7b7',
  oceanFill: '#0b1929',
  oceanWaterFill: '#0e2136',
  landBase: '#0f2a1f',
  worldLandFill: '#14452f',
  worldHoverFill: '#1f6b47',
  worldBorderLine: '#3fae7a',
  worldHoverBorder: '#8df5c0',
  countryBorder: '#3fae7a',
  mexicoOutline: '#6ee7b7',
  volumeStops: [
    [0, '#1b6f62'],
    [20, '#1f8a73'],
    [40, '#25a487'],
    [60, '#34c79b'],
    [80, '#6ee7b7'],
    [100, '#c8fbe4'],
  ],
  noDataFill: '#1e8570',
  activeTerritoryFill: '#6ee7b7',
  hoverFill: 'rgba(110, 231, 183, 0.30)',
  borderLine: '#6ee7b7',
  munBorderLine: '#4cb8a6',
  borderHover: '#a7f3d0',
  borderSelected: '#d1fae5',
  glowHover: 'rgba(110, 231, 183, 0.42)',
  glowSelected: 'rgba(110, 231, 183, 0.65)',
  labelText: '#f0fdf9',
  labelHalo: 'rgba(3, 8, 15, 0.92)',
  dimmedOpacity: 0.52,
  activeOpacity: 0.92,
  hoverOpacity: 0.98,
  ui: {
    bgBase: '#04070d',
    bgElevated: '#070d17',
    glassBg: 'rgba(8, 15, 26, 0.76)',
    glassBgStrong: 'rgba(10, 18, 30, 0.90)',
    glassHover: 'rgba(16, 28, 44, 0.88)',
    glassBorder: 'rgba(148, 210, 194, 0.13)',
    glassBorderBright: 'rgba(110, 231, 183, 0.42)',
    glassTopHighlight: 'rgba(220, 255, 244, 0.14)',
    accentMint: '#6ee7b7',
    accentMintDim: 'rgba(110, 231, 183, 0.15)',
    accentCyan: '#22d3ee',
    accentCyanDim: 'rgba(34, 211, 238, 0.13)',
    sentimentPos: '#34f5b5',
    sentimentNeu: '#f59e0b',
    sentimentNeg: '#f43f5e',
    textPrimary: '#f1f8f6',
    textSecondary: '#a3bab3',
    textMuted: '#647d76',
    textOnAccent: '#02130c',
  },
};

/**
 * Tema claro alternativo:
 * Esfera oceánica en azul claro con degradado, países en gris-azulado claro,
 * México destacado en verde agua y territorio activo en verde esmeralda intenso.
 */
export const LIGHT_MAP_THEME: MapThemePalette = {
  mode: 'light',
  background: '#edf3f1',
  spaceColor: '#dce7e5',
  globeFogColor: '#b3d4e0',
  atmosphereColor: '#7dd3c0',
  atmosphereHighColor: '#10b981',
  oceanFill: '#c7dfec',
  oceanWaterFill: '#bdd8e8',
  landBase: '#dde7ee',
  worldLandFill: '#d3dfe8',
  worldHoverFill: '#bccfdf',
  worldBorderLine: '#7d9cb2',
  worldHoverBorder: '#476b85',
  countryBorder: '#7d9cb2',
  mexicoOutline: '#0d9488',
  volumeStops: [
    [0, '#a7e2d4'],
    [20, '#7ad3be'],
    [40, '#4bc0a6'],
    [60, '#23a489'],
    [80, '#0f846c'],
    [100, '#065f46'],
  ],
  noDataFill: '#9fe0d0',
  activeTerritoryFill: '#10b981',
  hoverFill: 'rgba(16, 185, 129, 0.34)',
  borderLine: '#158072',
  munBorderLine: '#0f766e',
  borderHover: '#047857',
  borderSelected: '#065f46',
  glowHover: 'rgba(16, 185, 129, 0.38)',
  glowSelected: 'rgba(16, 185, 129, 0.58)',
  labelText: '#062419',
  labelHalo: 'rgba(255, 255, 255, 0.94)',
  dimmedOpacity: 0.56,
  activeOpacity: 0.92,
  hoverOpacity: 0.98,
  ui: {
    bgBase: '#edf3f1',
    bgElevated: '#e2ece8',
    glassBg: 'rgba(255, 255, 255, 0.84)',
    glassBgStrong: 'rgba(255, 255, 255, 0.94)',
    glassHover: 'rgba(240, 247, 244, 0.96)',
    glassBorder: 'rgba(15, 55, 40, 0.13)',
    glassBorderBright: 'rgba(5, 150, 105, 0.42)',
    glassTopHighlight: 'rgba(255, 255, 255, 0.85)',
    accentMint: '#059669',
    accentMintDim: 'rgba(5, 150, 105, 0.12)',
    accentCyan: '#0891b2',
    accentCyanDim: 'rgba(8, 145, 178, 0.12)',
    sentimentPos: '#059669',
    sentimentNeu: '#d97706',
    sentimentNeg: '#e11d48',
    textPrimary: '#092218',
    textSecondary: '#2d4b40',
    textMuted: '#5c7a6e',
    textOnAccent: '#ffffff',
  },
};

export function getMapTheme(mode: ThemeMode): MapThemePalette {
  return mode === 'light' ? LIGHT_MAP_THEME : DARK_MAP_THEME;
}

/**
 * Sincroniza los tokens de `src/map/theme.ts` con las variables CSS de `:root`
 * para que toda la interfaz (vidrio, acentos, leyenda y sentimiento) responda a un solo archivo.
 */
export function applyThemeCssVariables(theme: MapThemePalette): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { ui } = theme;
  root.style.setProperty('--bg-base', ui.bgBase);
  root.style.setProperty('--bg-elevated', ui.bgElevated);
  root.style.setProperty('--glass-bg', ui.glassBg);
  root.style.setProperty('--glass-bg-strong', ui.glassBgStrong);
  root.style.setProperty('--glass-hover', ui.glassHover);
  root.style.setProperty('--glass-border', ui.glassBorder);
  root.style.setProperty('--glass-border-bright', ui.glassBorderBright);
  root.style.setProperty('--glass-top-highlight', ui.glassTopHighlight);
  root.style.setProperty('--accent-mint', ui.accentMint);
  root.style.setProperty('--accent-mint-dim', ui.accentMintDim);
  root.style.setProperty('--accent-cyan', ui.accentCyan);
  root.style.setProperty('--accent-cyan-dim', ui.accentCyanDim);
  root.style.setProperty('--sent-pos', ui.sentimentPos);
  root.style.setProperty('--sent-neu', ui.sentimentNeu);
  root.style.setProperty('--sent-neg', ui.sentimentNeg);
  root.style.setProperty('--text-primary', ui.textPrimary);
  root.style.setProperty('--text-secondary', ui.textSecondary);
  root.style.setProperty('--text-muted', ui.textMuted);
  root.style.setProperty('--text-on-accent', ui.textOnAccent);
  root.style.setProperty('--map-space-bg', theme.spaceColor);
  root.style.setProperty('--map-ocean-fill', theme.oceanFill);
  root.style.setProperty('--map-world-fill', theme.worldLandFill);
  root.style.setProperty('--map-world-border', theme.worldBorderLine);
  root.style.setProperty('--map-mexico-fill', theme.noDataFill);
  root.style.setProperty('--map-mexico-outline', theme.mexicoOutline);
  root.style.setProperty('--map-active-fill', theme.activeTerritoryFill);
  root.style.setProperty(
    '--volume-gradient',
    `linear-gradient(90deg, ${theme.volumeStops.map(([pct, col]) => `${col} ${pct}%`).join(', ')})`
  );
}

/**
 * Expresión MapLibre para colorear polígonos según su métrica normalizada (0..100).
 */
export function buildVolumeColorExpression(theme: MapThemePalette): ExpressionSpecification {
  const stops: (number | string)[] = [];
  for (const [val, color] of theme.volumeStops) {
    stops.push(val, color);
  }
  return [
    'case',
    ['has', 'volumeNorm'],
    ['interpolate', ['linear'], ['to-number', ['get', 'volumeNorm'], 0], ...stops],
    theme.noDataFill,
  ] as unknown as ExpressionSpecification;
}

/**
 * Construye el estilo base de MapLibre con teselas vectoriales libres de OpenFreeMap
 * (sin API key), proyección globo y estética limpia de centro de mando.
 */
export function buildBaseMapStyle(theme: MapThemePalette, tileSourceUrl = 'https://tiles.openfreemap.org/planet'): StyleSpecification {
  return {
    version: 8,
    name: `ceNetwork-${theme.mode}`,
    projection: { type: 'globe' },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: tileSourceUrl,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': theme.oceanFill,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {
          'fill-color': theme.oceanWaterFill,
        },
      },
      {
        id: 'landcover-base',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: {
          'fill-color': theme.landBase,
          'fill-opacity': 0.32,
        },
      },
      {
        id: 'admin-country-borders',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['==', ['get', 'admin_level'], 2],
        paint: {
          'line-color': theme.countryBorder,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, 0.55,
            5, 1.0,
            8, 1.4,
          ],
        },
      },
    ],
  };
}
