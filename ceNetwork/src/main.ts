import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/network.css';

import { buildConfig } from './config';
import {
  getMapTheme,
  applyThemeCssVariables,
  buildBaseMapStyle,
  buildVolumeColorExpression,
  type ThemeMode,
  type MapThemePalette,
} from './map/theme';
import { computeFeatureBBox, computeFeatureCenter } from './data/mockGenerator';
import {
  abrirHistorialEntry,
  analyzePersonaPage,
  borradorAlerta,
  borrarHistorial,
  checkBackendSearchMode,
  cleanDisplayText,
  fetchPersonaProfiles,
  fetchSocialSearchSummary,
  guardarEntidad,
  lineasBase,
  listarAlertas,
  listarEntidades,
  marcarAlerta,
  listarHistorial,
} from './data/socialClient';
import type {
  CeNetworkConfig,
  DataStatus,
  NormalizedTerritoryProps,
  ScopeLevel,
  ScopeSelection,
  Alerta,
  Entidad,
  HistorialEntry,
  HistorialItem,
  PersonaProfile,
  SearchMode,
  SocialApiNarrative,
  SocialApiPost,
  SocialApiSummary,
} from './types';

declare global {
  interface Window {
    ceNetworkScope: ScopeSelection;
    getCeNetworkScope: () => ScopeSelection;
    CE_NETWORK_PROPS?: Partial<CeNetworkConfig>;
  }
}

interface StateCatalogEntry {
  estado_id: string;
  nombre: string;
  slug: string;
  abrev: string;
  bbox: [number, number, number, number];
  feature: GeoJSON.Feature;
}

interface MunCatalogEntry {
  estado_id: string;
  municipio_id: string;
  nombre: string;
  bbox: [number, number, number, number];
  feature: GeoJSON.Feature;
}

/** Catálogo de iconos SVG Lucide (trazo fino 1.65, sin emojis) */
const LUCIDE_SVG = {
  layers: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`,
  checkCircle: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  building: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
  activity: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>`,
  barChart: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>`,
  pieChart: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`,
  messageSquare: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  thumbsUp: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>`,
  share2: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`,
  externalLink: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  close: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  sun: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  clock: `<svg class="cenet-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

function escapeHtml(raw: string): string {
  return String(raw).replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[ch] || ch;
  });
}

function toSlug(str: string): string {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Anima una cifra desde 0 hasta `target` con tabular-nums, respetando prefers-reduced-motion.
 */
function animateNumbersInContainer(container: HTMLElement): void {
  const els = container.querySelectorAll<HTMLElement>('[data-count-to]');
  const reduced = prefersReducedMotion();

  els.forEach((el) => {
    const target = Number(el.dataset.countTo || 0);
    const suffix = el.dataset.countSuffix || '';
    const decimals = Number(el.dataset.countDecimals || 0);

    if (reduced || !Number.isFinite(target) || target === 0) {
      el.textContent = `${target.toFixed(decimals)}${suffix}`;
      return;
    }

    const duration = 460;
    const startTs = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = `${current.toFixed(decimals)}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `${target.toFixed(decimals)}${suffix}`;
      }
    };

    requestAnimationFrame(step);
  });
}

function normalizeFeatureProps(feat: GeoJSON.Feature, fallbackSlug = ''): NormalizedTerritoryProps {
  const p = (feat.properties || {}) as Record<string, unknown>;
  const keys = Object.keys(p);
  const findKey = (cands: string[]) => keys.find((k) => cands.includes(k.toLowerCase()));

  const kEst = findKey(['estado_id', 'cve_ent', 'id_ent', 'state_id', 'cve_edo']);
  const kMun = findKey(['municipio_id', 'cvegeo', 'cve_mun', 'id_mun', 'mun_id']);
  const kNom = findKey(['nombre', 'nomgeo', 'nom_mun', 'nom_ent', 'name']);
  const kSlug = findKey(['slug']);
  const kAbrev = findKey(['abrev', 'abbr', 'code']);

  const estado_id = String((kEst && p[kEst]) ? p[kEst] : fallbackSlug || '00').trim();
  const rawMun = (kMun && p[kMun] != null) ? String(p[kMun]).trim() : null;
  const municipio_id = rawMun && rawMun !== 'null' ? rawMun : null;
  const nombre = String((kNom && p[kNom]) ? p[kNom] : 'Sin nombre').trim();
  const slug = String((kSlug && p[kSlug]) ? p[kSlug] : toSlug(nombre));
  const abrev = String((kAbrev && p[kAbrev]) ? p[kAbrev] : nombre.slice(0, 4).toUpperCase());

  return { estado_id, municipio_id, nombre, slug, abrev };
}

function buildTerritoryGeoJsonWithRealVolume(
  fc: GeoJSON.FeatureCollection,
  realVolumeById: Map<string, { volume: number; volumeNorm: number; pos: number; neg: number }>
): {
  enrichedGeoJson: GeoJSON.FeatureCollection;
  labelsGeoJson: GeoJSON.FeatureCollection;
} {
  const enrichedFeatures: GeoJSON.Feature[] = [];
  const labelFeatures: GeoJSON.Feature[] = [];

  for (const feat of fc.features) {
    if (!feat.geometry) continue;
    const props = (feat.properties || {}) as unknown as NormalizedTerritoryProps;
    const estado_id = String(props.estado_id || '00');
    const municipio_id = props.municipio_id ? String(props.municipio_id) : null;
    const key = municipio_id || estado_id;
    const nombre = String(props.nombre || 'Territorio');
    const abrev = props.abrev ? String(props.abrev) : undefined;
    const realEntry = realVolumeById.get(key);

    const featureProps: Record<string, unknown> = {
      ...props,
      estado_id,
      municipio_id,
      nombre,
      abrev,
      feature_key: key,
    };

    if (realEntry) {
      featureProps.volume = realEntry.volume;
      featureProps.volumeNorm = realEntry.volumeNorm;
      featureProps.positivePct = realEntry.pos;
      featureProps.negativePct = realEntry.neg;
      featureProps.hasRealSearch = true;
    }

    enrichedFeatures.push({
      type: 'Feature',
      id: key,
      properties: featureProps,
      geometry: feat.geometry,
    });

    const center = computeFeatureCenter(feat.geometry);
    labelFeatures.push({
      type: 'Feature',
      properties: {
        feature_key: key,
        estado_id,
        municipio_id,
        nombre,
        label: abrev || nombre,
        volume: realEntry ? realEntry.volume : null,
      },
      geometry: {
        type: 'Point',
        coordinates: center,
      },
    });
  }

  return {
    enrichedGeoJson: { type: 'FeatureCollection', features: enrichedFeatures },
    labelsGeoJson: { type: 'FeatureCollection', features: labelFeatures },
  };
}

export function createCeNetworkApp(overrides: Partial<CeNetworkConfig> = {}): void {
  const config = buildConfig({ ...(window.CE_NETWORK_PROPS || {}), ...overrides });
  let themeMode: ThemeMode = config.defaultTheme;
  let theme: MapThemePalette = getMapTheme(themeMode);
  applyThemeCssVariables(theme);

  // Modo debug oculto: solo activo cuando la URL contiene ?debug=1
  const isDebugMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  // Sin territorio al iniciar: ni país, estado ni municipio hasta que el usuario elija uno (o reabra una búsqueda del historial).
  let scope: ScopeSelection = { nivel: 'pais', estado_id: null, municipio_id: null, pais_code: config.country.code };
  let scopeElegido = false;
  let currentMode: SearchMode = config.defaultMode;
  let currentTopic = '';
  let searchInFlight = false;
  let lastSearchSummary: SocialApiSummary | null = null;

  const realStateVolumes = new Map<string, { volume: number; volumeNorm: number; pos: number; neg: number }>();
  const realMunVolumes = new Map<string, { volume: number; volumeNorm: number; pos: number; neg: number }>();

  let worldCountriesFc: GeoJSON.FeatureCollection | null = null;
  let statesRawFc: GeoJSON.FeatureCollection | null = null;
  const statesCatalog = new Map<string, StateCatalogEntry>();
  const munCache = new Map<string, GeoJSON.FeatureCollection>();
  const currentMunCatalog = new Map<string, MunCatalogEntry>();

  let hoveredWorldIso: string | null = null;
  let hoveredStateKey: string | null = null;
  let hoveredMunKey: string | null = null;
  let selectedFeatureKey: string | null = null;

  // Giro suave del globo en estado vacío antes de buscar
  let globeSpinning = !prefersReducedMotion();
  let spinFrameId: number | null = null;
  let lastSpinTs = 0;

  // Referencias del DOM
  const topicInput = document.getElementById('cenet-topic-input') as HTMLInputElement;
  const selModo = document.getElementById('cenet-sel-modo') as HTMLSelectElement | null;
  const segmentedBtns = document.querySelectorAll<HTMLButtonElement>('.cenet-segmented__btn');
  const searchForm = document.getElementById('cenet-search-form') as HTMLFormElement;
  const searchBtn = document.getElementById('cenet-search-btn') as HTMLButtonElement | null;
  const searchBtnLabel = document.getElementById('cenet-search-btn-label') as HTMLElement | null;

  const crumbPais = document.getElementById('cenet-crumb-pais') as HTMLButtonElement | null;
  const crumbEstado = document.getElementById('cenet-crumb-estado') as HTMLButtonElement | null;
  const crumbMun = document.getElementById('cenet-crumb-mun') as HTMLButtonElement | null;
  const slashEstado = document.getElementById('cenet-slash-estado') as HTMLElement | null;
  const slashMun = document.getElementById('cenet-slash-mun') as HTMLElement | null;
  const scopeToggleBtn = document.getElementById('cenet-scope-toggle') as HTMLButtonElement | null;
  const scopePopover = document.getElementById('cenet-scope-popover') as HTMLElement | null;
  const popoverCloseBtn = document.getElementById('cenet-popover-close') as HTMLButtonElement | null;
  const breadcrumbWrap = document.getElementById('cenet-breadcrumb-wrap') as HTMLElement | null;

  const selPais = document.getElementById('cenet-sel-pais') as HTMLSelectElement | null;
  const selNivel = document.getElementById('cenet-sel-nivel') as HTMLSelectElement;
  const selEstado = document.getElementById('cenet-sel-estado') as HTMLSelectElement;
  const selMunicipio = document.getElementById('cenet-sel-municipio') as HTMLSelectElement;

  const sourcePill = document.getElementById('cenet-source-pill') as HTMLElement | null;
  const sourceLabel = document.getElementById('cenet-source-label') as HTMLElement | null;
  const debugPill = document.getElementById('cenet-debug-pill') as HTMLElement | null;
  const themeBtn = document.getElementById('cenet-theme-btn') as HTMLButtonElement | null;
  const themeLabel = document.getElementById('cenet-theme-label') as HTMLElement | null;
  const themeIcon = document.getElementById('cenet-theme-icon') as HTMLElement | null;

  const emptyHero = document.getElementById('cenet-empty-hero') as HTMLElement | null;
  const emptyScopeLabel = document.getElementById('cenet-empty-scope-label') as HTMLElement | null;
  const exampleChips = document.querySelectorAll<HTMLButtonElement>('[data-example-topic]');
  const legendEl = document.getElementById('cenet-legend') as HTMLElement | null;

  const statusOverlay = document.getElementById('cenet-status-overlay') as HTMLElement;
  const statusCard = document.getElementById('cenet-status-card') as HTMLElement;
  const tooltipEl = document.getElementById('cenet-tooltip') as HTMLElement;
  const drawerEl = document.getElementById('cenet-panel') as HTMLElement;
  const drawerBody = document.getElementById('cenet-drawer-body') as HTMLElement;
  const drawerHandle = document.getElementById('cenet-drawer-handle') as HTMLElement | null;

  const backLink = document.getElementById('cenet-back-link') as HTMLAnchorElement;
  const brandTitle = document.getElementById('cenet-brand-title') as HTMLElement;
  const brandSub = document.getElementById('cenet-brand-sub') as HTMLElement;

  /**
   * Devuelve el alcance en texto legible para humanos:
   * - "México"
   * - "Ciudad de México"
   * - "Tlalpan, Ciudad de México"
   */
  function resolveReadableScopeText(s: ScopeSelection): string {
    if (s.nivel === 'municipio' && s.municipio_id) {
      const m = currentMunCatalog.get(s.municipio_id);
      const st = s.estado_id ? statesCatalog.get(s.estado_id) : undefined;
      const mName = m?.nombre || 'Municipio';
      const stName = st?.nombre || '';
      return stName ? `${mName}, ${stName}` : mName;
    }
    if (s.nivel === 'estado' && s.estado_id) {
      const st = statesCatalog.get(s.estado_id);
      return st?.nombre || config.country.name;
    }
    return config.country.name;
  }

  function resolvePlaceShortName(s: ScopeSelection): string {
    if (s.nivel === 'municipio' && s.municipio_id) {
      return currentMunCatalog.get(s.municipio_id)?.nombre || 'Municipio';
    }
    if (s.nivel === 'estado' && s.estado_id) {
      return statesCatalog.get(s.estado_id)?.nombre || config.country.name;
    }
    return config.country.name;
  }

  function updateSourcePill(isLive: boolean): void {
    if (!sourcePill || !sourceLabel) return;
    sourcePill.classList.toggle('is-live', isLive);
    sourceLabel.textContent = isLive ? 'En vivo' : 'Demo';
  }

  updateSourcePill(!config.facebookFixture);

  function updateBreadcrumbUi(): void {
    if (!scopeElegido) {
      if (crumbPais) { crumbPais.textContent = 'Seleccionar'; crumbPais.classList.remove('is-current'); }
      if (slashEstado) slashEstado.hidden = true;
      if (crumbEstado) crumbEstado.hidden = true;
      if (slashMun) slashMun.hidden = true;
      if (crumbMun) crumbMun.hidden = true;
      if (emptyScopeLabel) emptyScopeLabel.textContent = 'ninguno: elige un lugar';
      return;
    }
    const stName = scope.estado_id
      ? (statesCatalog.get(scope.estado_id)?.nombre || 'Estado')
      : 'Estado';
    const munName = scope.municipio_id
      ? (currentMunCatalog.get(scope.municipio_id)?.nombre || 'Municipio')
      : 'Municipio';

    if (crumbPais) {
      crumbPais.textContent = config.country.name;
      crumbPais.classList.toggle('is-current', scope.nivel === 'pais');
    }

    if (crumbEstado && slashEstado) {
      const showEstado = scope.nivel === 'estado' || scope.nivel === 'municipio';
      slashEstado.hidden = !showEstado;
      crumbEstado.hidden = !showEstado;
      crumbEstado.textContent = stName;
      crumbEstado.classList.toggle('is-current', scope.nivel === 'estado');
    }

    if (crumbMun && slashMun) {
      const showMun = scope.nivel === 'municipio' && Boolean(scope.municipio_id);
      slashMun.hidden = !showMun;
      crumbMun.hidden = !showMun;
      crumbMun.textContent = munName;
      crumbMun.classList.toggle('is-current', scope.nivel === 'municipio');
    }

    if (emptyScopeLabel) {
      emptyScopeLabel.textContent = resolveReadableScopeText(scope);
    }
  }

  const publishScope = (next: ScopeSelection) => {
    scope = {
      nivel: next.nivel,
      estado_id: next.estado_id,
      municipio_id: next.municipio_id,
      nombre: next.nombre || resolvePlaceShortName(next),
      pais_code: next.pais_code || config.country.code,
    };
    window.ceNetworkScope = scope;
    window.getCeNetworkScope = () => ({ ...scope });
    window.dispatchEvent(new CustomEvent('cenetwork:scope-change', { detail: scope }));
    if (config.onScopeChange) config.onScopeChange(scope);

    // Datos técnicos únicamente en consola o con ?debug=1
    console.debug('[ceNetwork:scope]', scope);
    if (isDebugMode && debugPill) {
      debugPill.hidden = false;
      debugPill.textContent = `${scope.nivel}:${scope.estado_id || '-'}/${scope.municipio_id || '-'}`;
    }

    updateBreadcrumbUi();
  };

  publishScope(scope);

  if (selPais) {
    selPais.innerHTML = '<option value="">Seleccionar</option>' + config.country.activeCountries
      .map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name)}</option>`)
      .join('');
    selPais.value = '';
  }

  if (topicInput) {
    topicInput.value = '';
    topicInput.placeholder = config.topicPlaceholder || 'Ej. seguridad, agua, bacheo…';
  }

  function syncModeSegmentedUi(mode: SearchMode): void {
    currentMode = mode;
    if (selModo) selModo.value = mode;
    segmentedBtns.forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  syncModeSegmentedUi(currentMode);

  if (backLink) {
    backLink.href = config.mainAppUrl;
    backLink.title = `Volver a ${config.mainAppLabel}`;
    const span = backLink.querySelector('span');
    if (span) span.textContent = config.mainAppLabel;
  }
  if (brandTitle) brandTitle.textContent = config.appName;
  if (brandSub) brandSub.textContent = `${config.appSubtitle} · ${config.country.name}`;

  document.body.classList.toggle('light-mode', themeMode === 'light');

  function openDrawer(): void {
    if (!drawerEl) return;
    drawerEl.classList.add('is-open');
    drawerEl.classList.remove('is-collapsed');
    drawerEl.setAttribute('aria-hidden', 'false');
    if (emptyHero) emptyHero.hidden = true;
  }

  function closeDrawer(): void {
    if (!drawerEl) return;
    drawerEl.classList.remove('is-open', 'is-collapsed');
    drawerEl.setAttribute('aria-hidden', 'true');
    if (!lastSearchSummary && emptyHero) {
      emptyHero.hidden = false;
    }
  }

  /**
   * Muestra esqueletos de carga con brillo (shimmer) en el cajón lateral en lugar de spinners.
   */
  function renderDrawerSkeleton(topic: string, readableScope: string): void {
    if (!drawerBody) return;
    openDrawer();
    drawerBody.innerHTML = `
      <div class="cenet-drawer__header">
        <div style="width:100%;">
          <div class="cenet-drawer__eyebrow">Analizando conversación</div>
          <h2 class="cenet-drawer__title">${escapeHtml(readableScope)}</h2>
          <div class="cenet-drawer__meta">
            <span class="cenet-meta-tag">Tema: <strong>${escapeHtml(topic)}</strong></span>
          </div>
        </div>
      </div>

      <div class="cenet-kpi-grid" aria-busy="true" aria-label="Cargando indicadores">
        <div class="cenet-kpi-card"><div class="cenet-skeleton" style="height:14px;width:65%;"></div><div class="cenet-skeleton" style="height:26px;width:48%;margin-top:4px;"></div></div>
        <div class="cenet-kpi-card"><div class="cenet-skeleton" style="height:14px;width:65%;"></div><div class="cenet-skeleton" style="height:26px;width:48%;margin-top:4px;"></div></div>
        <div class="cenet-kpi-card"><div class="cenet-skeleton" style="height:14px;width:65%;"></div><div class="cenet-skeleton" style="height:26px;width:48%;margin-top:4px;"></div></div>
        <div class="cenet-kpi-card"><div class="cenet-skeleton" style="height:14px;width:65%;"></div><div class="cenet-skeleton" style="height:26px;width:48%;margin-top:4px;"></div></div>
      </div>

      <section class="cenet-card">
        <div class="cenet-skeleton" style="height:14px;width:45%;"></div>
        <div class="cenet-skeleton" style="height:92px;width:100%;"></div>
      </section>

      <section class="cenet-card">
        <div class="cenet-skeleton" style="height:14px;width:52%;"></div>
        <div class="cenet-skeleton" style="height:10px;width:100%;"></div>
        <div class="cenet-skeleton" style="height:48px;width:100%;"></div>
      </section>

      <section class="cenet-card">
        <div class="cenet-skeleton" style="height:30px;width:100%;"></div>
        <div class="cenet-skeleton" style="height:78px;width:100%;"></div>
        <div class="cenet-skeleton" style="height:78px;width:100%;"></div>
      </section>
    `;
  }

  /** El botón Buscar se bloquea mientras busca y mientras no haya un lugar elegido. */
  function actualizarBloqueoBusqueda(): void {
    if (searchBtn) searchBtn.disabled = searchInFlight || !scopeElegido;
    if (searchBtnLabel) searchBtnLabel.textContent = searchInFlight ? 'Buscando…' : scopeElegido ? 'Buscar' : 'Elige un lugar';
  }

  function setSearchLoadingUi(loading: boolean): void {
    searchInFlight = loading;
    actualizarBloqueoBusqueda();
  }

  actualizarBloqueoBusqueda();

  // Inicializar MapLibre GL JS con proyección globo y teselas OpenFreeMap
  const map = new maplibregl.Map({
    container: 'cenet-map',
    style: buildBaseMapStyle(theme, config.tileSourceUrl),
    center: config.country.initialGlobeCenter,
    zoom: config.country.initialGlobeZoom,
    pitch: 0,
    bearing: 0,
    attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');

  function applyAtmosphere(): void {
    try {
      map.setProjection({ type: 'globe' });
      if (typeof map.setSky === 'function') {
        map.setSky({
          'sky-color': theme.spaceColor,
          'horizon-color': theme.atmosphereColor,
          'fog-color': theme.globeFogColor,
          'sky-horizon-blend': 0.55,
          'horizon-fog-blend': 0.65,
          'fog-ground-blend': 0.48,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.92, 5, 0.55, 8, 0.12],
        });
      }
    } catch {
      // Ignorar si el estilo aún está inicializándose
    }
  }

  function stopGlobeSpin(): void {
    globeSpinning = false;
    if (spinFrameId !== null) {
      cancelAnimationFrame(spinFrameId);
      spinFrameId = null;
    }
  }

  function spinStep(ts: number): void {
    if (!globeSpinning || prefersReducedMotion()) return;
    if (lastSpinTs > 0) {
      const dt = (ts - lastSpinTs) / 1000;
      const c = map.getCenter();
      map.setCenter([c.lng - config.globeSpinSpeedDegPerSec * dt, c.lat]);
    }
    lastSpinTs = ts;
    spinFrameId = requestAnimationFrame(spinStep);
  }

  ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach((evName) => {
    map.getCanvasContainer().addEventListener(evName, () => stopGlobeSpin(), { passive: true });
  });

  function setStatus(status: DataStatus, message = ''): void {
    if (!statusOverlay || !statusCard) return;

    if (status === 'ready' || status === 'loading') {
      statusOverlay.hidden = true;
      return;
    }

    statusOverlay.hidden = false;
    statusCard.innerHTML = `
      <h3>Aviso de consulta</h3>
      <p>${escapeHtml(message || 'No se pudo completar la operación.')}</p>
      <button type="button" class="cenet-btn-search" id="cenet-retry-btn">Entendido</button>
    `;
    document.getElementById('cenet-retry-btn')?.addEventListener('click', () => {
      statusOverlay.hidden = true;
    });
  }

  function ensureMapLayers(): void {
    const emptyFc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    const activeIsoCodes = config.country.activeCountries.map((c) => c.code.toUpperCase());

    if (!map.getSource('world-countries-src')) {
      map.addSource('world-countries-src', {
        type: 'geojson',
        data: worldCountriesFc || emptyFc,
      });
    }
    if (!map.getSource('states-src')) {
      map.addSource('states-src', { type: 'geojson', data: emptyFc });
    }
    if (!map.getSource('state-labels-src')) {
      map.addSource('state-labels-src', { type: 'geojson', data: emptyFc });
    }
    if (!map.getSource('muns-src')) {
      map.addSource('muns-src', { type: 'geojson', data: emptyFc });
    }
    if (!map.getSource('mun-labels-src')) {
      map.addSource('mun-labels-src', { type: 'geojson', data: emptyFc });
    }

    // 1. Capa mundial de países (Natural Earth 110m): relleno #1b2a3a y borde luminoso #3a5a6e
    if (!map.getLayer('world-countries-fill')) {
      map.addLayer({
        id: 'world-countries-fill',
        type: 'fill',
        source: 'world-countries-src',
        filter: ['!', ['in', ['get', 'iso_a2'], ['literal', activeIsoCodes]]],
        paint: {
          'fill-color': theme.worldLandFill,
          'fill-opacity': 0.94,
        },
      });
    }

    if (!map.getLayer('world-countries-hover-fill')) {
      map.addLayer({
        id: 'world-countries-hover-fill',
        type: 'fill',
        source: 'world-countries-src',
        filter: ['==', ['get', 'iso_a3'], ''],
        paint: {
          'fill-color': theme.worldHoverFill,
          'fill-opacity': 0.96,
        },
      });
    }

    if (!map.getLayer('world-countries-line')) {
      map.addLayer({
        id: 'world-countries-line',
        type: 'line',
        source: 'world-countries-src',
        filter: ['!', ['in', ['get', 'iso_a2'], ['literal', activeIsoCodes]]],
        paint: {
          'line-color': theme.worldBorderLine,
          'line-width': 0.9,
        },
      });
    }

    if (!map.getLayer('world-countries-hover-line')) {
      map.addLayer({
        id: 'world-countries-hover-line',
        type: 'line',
        source: 'world-countries-src',
        filter: ['==', ['get', 'iso_a3'], ''],
        paint: {
          'line-color': theme.worldHoverBorder,
          'line-width': 1.6,
        },
      });
    }

    // 2. Capas interactivas de México (#0f3d3a) con bordes claros bien visibles y borde exterior teal brillante
    if (!map.getLayer('states-fill')) {
      map.addLayer({
        id: 'states-fill',
        type: 'fill',
        source: 'states-src',
        paint: {
          'fill-color': buildVolumeColorExpression(theme),
          'fill-opacity': theme.activeOpacity,
        },
      });
    }

    if (!map.getLayer('states-active-fill')) {
      map.addLayer({
        id: 'states-active-fill',
        type: 'fill',
        source: 'states-src',
        filter: ['==', ['get', 'estado_id'], ''],
        paint: {
          'fill-color': theme.activeTerritoryFill,
          'fill-opacity': 0.55,
        },
      });
    }

    if (!map.getLayer('states-hover-fill')) {
      map.addLayer({
        id: 'states-hover-fill',
        type: 'fill',
        source: 'states-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'fill-color': theme.hoverFill,
          'fill-opacity': 1,
        },
      });
    }

    if (!map.getLayer('states-line')) {
      map.addLayer({
        id: 'states-line',
        type: 'line',
        source: 'states-src',
        paint: {
          'line-color': theme.borderLine,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.9, 5, 1.25, 8, 1.6],
        },
      });
    }

    // Contorno exterior teal brillante para destacar a México del resto del continente
    if (!map.getLayer('mexico-country-outline')) {
      map.addLayer({
        id: 'mexico-country-outline',
        type: 'line',
        source: 'world-countries-src',
        filter: ['in', ['get', 'iso_a2'], ['literal', activeIsoCodes]],
        paint: {
          'line-color': theme.mexicoOutline,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1.5, 1.4, 5, 2.2, 8, 2.6],
        },
      });
    }

    if (!map.getLayer('muns-fill')) {
      map.addLayer({
        id: 'muns-fill',
        type: 'fill',
        source: 'muns-src',
        paint: {
          'fill-color': buildVolumeColorExpression(theme),
          'fill-opacity': 0.92,
        },
      });
    }

    if (!map.getLayer('muns-active-fill')) {
      map.addLayer({
        id: 'muns-active-fill',
        type: 'fill',
        source: 'muns-src',
        filter: ['==', ['get', 'municipio_id'], ''],
        paint: {
          'fill-color': theme.activeTerritoryFill,
          'fill-opacity': 0.78,
        },
      });
    }

    if (!map.getLayer('muns-hover-fill')) {
      map.addLayer({
        id: 'muns-hover-fill',
        type: 'fill',
        source: 'muns-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'fill-color': theme.hoverFill,
          'fill-opacity': 1,
        },
      });
    }

    if (!map.getLayer('muns-line')) {
      map.addLayer({
        id: 'muns-line',
        type: 'line',
        source: 'muns-src',
        paint: {
          'line-color': theme.munBorderLine,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 8, 1.25, 11, 1.6],
        },
      });
    }

    // Resplandor suave (glow) y borde nítido al pasar el cursor y al seleccionar
    if (!map.getLayer('states-hover-glow')) {
      map.addLayer({
        id: 'states-hover-glow',
        type: 'line',
        source: 'states-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.glowHover,
          'line-width': 7,
          'line-blur': 5,
        },
      });
    }

    if (!map.getLayer('states-hover-line')) {
      map.addLayer({
        id: 'states-hover-line',
        type: 'line',
        source: 'states-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.borderHover,
          'line-width': 1.9,
        },
      });
    }

    if (!map.getLayer('muns-hover-glow')) {
      map.addLayer({
        id: 'muns-hover-glow',
        type: 'line',
        source: 'muns-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.glowHover,
          'line-width': 6.5,
          'line-blur': 4.5,
        },
      });
    }

    if (!map.getLayer('muns-hover-line')) {
      map.addLayer({
        id: 'muns-hover-line',
        type: 'line',
        source: 'muns-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.borderHover,
          'line-width': 1.8,
        },
      });
    }

    if (!map.getLayer('selected-glow')) {
      map.addLayer({
        id: 'selected-glow',
        type: 'line',
        source: 'states-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.glowSelected,
          'line-width': 8,
          'line-blur': 5.5,
        },
      });
    }

    if (!map.getLayer('selected-line')) {
      map.addLayer({
        id: 'selected-line',
        type: 'line',
        source: 'states-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.borderSelected,
          'line-width': 2.1,
        },
      });
    }

    if (!map.getLayer('selected-mun-glow')) {
      map.addLayer({
        id: 'selected-mun-glow',
        type: 'line',
        source: 'muns-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.glowSelected,
          'line-width': 7.5,
          'line-blur': 5,
        },
      });
    }

    if (!map.getLayer('selected-mun-line')) {
      map.addLayer({
        id: 'selected-mun-line',
        type: 'line',
        source: 'muns-src',
        filter: ['==', ['get', 'feature_key'], ''],
        paint: {
          'line-color': theme.borderSelected,
          'line-width': 2.1,
        },
      });
    }

    if (!map.getLayer('state-abbr-labels')) {
      map.addLayer({
        id: 'state-abbr-labels',
        type: 'symbol',
        source: 'state-labels-src',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 5, 11, 7, 12.5],
          'text-allow-overlap': false,
          'text-padding': 2,
        },
        paint: {
          'text-color': theme.labelText,
          'text-halo-color': theme.labelHalo,
          'text-halo-width': 1.4,
        },
      });
    }

    if (!map.getLayer('mun-labels')) {
      map.addLayer({
        id: 'mun-labels',
        type: 'symbol',
        source: 'mun-labels-src',
        minzoom: 5.5,
        layout: {
          'text-field': ['get', 'nombre'],
          'text-font': ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5.5, 9, 9, 11.5],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': theme.labelText,
          'text-halo-color': theme.labelHalo,
          'text-halo-width': 1.2,
        },
      });
    }
  }

  function updateScopeAttenuation(): void {
    if (!map.getLayer('states-fill')) return;

    if (scope.nivel === 'pais' || !scope.estado_id) {
      map.setPaintProperty('states-fill', 'fill-opacity', theme.activeOpacity);
      const stFilter: maplibregl.FilterSpecification = ['==', ['get', 'feature_key'], selectedFeatureKey || ''];
      map.setFilter('selected-line', stFilter);
      if (map.getLayer('selected-glow')) map.setFilter('selected-glow', stFilter);
      if (map.getLayer('states-active-fill')) {
        map.setFilter('states-active-fill', ['==', ['get', 'estado_id'], '']);
      }
    } else {
      map.setPaintProperty('states-fill', 'fill-opacity', [
        'case',
        ['==', ['get', 'estado_id'], scope.estado_id],
        0.38,
        theme.dimmedOpacity,
      ]);
      const stFilter: maplibregl.FilterSpecification = ['==', ['get', 'estado_id'], scope.estado_id];
      map.setFilter('selected-line', stFilter);
      if (map.getLayer('selected-glow')) map.setFilter('selected-glow', stFilter);
      if (map.getLayer('states-active-fill')) {
        // Si el nivel es estado (ej. CDMX), resalta todo el estado con #6ee7b7; si es municipio, deja ver los municipios dentro del estado
        map.setFilter(
          'states-active-fill',
          scope.nivel === 'estado'
            ? ['==', ['get', 'estado_id'], scope.estado_id]
            : ['==', ['get', 'estado_id'], '']
        );
      }
    }

    if (map.getLayer('muns-fill')) {
      if (scope.nivel === 'municipio' && scope.municipio_id) {
        map.setPaintProperty('muns-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'municipio_id'], scope.municipio_id],
          0.95,
          theme.dimmedOpacity,
        ]);
        const munFilter: maplibregl.FilterSpecification = ['==', ['get', 'municipio_id'], scope.municipio_id];
        map.setFilter('selected-mun-line', munFilter);
        if (map.getLayer('selected-mun-glow')) map.setFilter('selected-mun-glow', munFilter);
        if (map.getLayer('muns-active-fill')) map.setFilter('muns-active-fill', munFilter);
      } else {
        map.setPaintProperty('muns-fill', 'fill-opacity', 0.88);
        const munFilter: maplibregl.FilterSpecification = ['==', ['get', 'feature_key'], selectedFeatureKey || ''];
        map.setFilter('selected-mun-line', munFilter);
        if (map.getLayer('selected-mun-glow')) map.setFilter('selected-mun-glow', munFilter);
        if (map.getLayer('muns-active-fill')) map.setFilter('muns-active-fill', munFilter);
      }
    }
  }

  function refreshStatesSource(): void {
    if (!statesRawFc) return;
    ensureMapLayers();
    const { enrichedGeoJson, labelsGeoJson } = buildTerritoryGeoJsonWithRealVolume(statesRawFc, realStateVolumes);
    const src = map.getSource('states-src') as maplibregl.GeoJSONSource | undefined;
    const lblSrc = map.getSource('state-labels-src') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(enrichedGeoJson);
    if (lblSrc) lblSrc.setData(labelsGeoJson);
    updateScopeAttenuation();
  }

  function refreshCurrentMunsSource(): void {
    if (!scope.estado_id || !munCache.has(scope.estado_id)) return;
    ensureMapLayers();
    const rawMunFc = munCache.get(scope.estado_id)!;
    const { enrichedGeoJson, labelsGeoJson } = buildTerritoryGeoJsonWithRealVolume(rawMunFc, realMunVolumes);
    const src = map.getSource('muns-src') as maplibregl.GeoJSONSource | undefined;
    const lblSrc = map.getSource('mun-labels-src') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(enrichedGeoJson);
    if (lblSrc) lblSrc.setData(labelsGeoJson);
    updateScopeAttenuation();
  }

  function clearMunicipiosLayer(): void {
    const emptyFc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    const src = map.getSource('muns-src') as maplibregl.GeoJSONSource | undefined;
    const lblSrc = map.getSource('mun-labels-src') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(emptyFc);
    if (lblSrc) lblSrc.setData(emptyFc);
    currentMunCatalog.clear();
  }

  function loadGeoJsonViaScript(cleanPath: string): Promise<GeoJSON.FeatureCollection> {
    return new Promise((resolve, reject) => {
      const store = ((window as unknown as { __CENET_GEO__?: Record<string, GeoJSON.FeatureCollection> }).__CENET_GEO__ ||= {});
      if (store[cleanPath]) {
        resolve(store[cleanPath]);
        return;
      }
      const jsPath = cleanPath.replace(/\.(geo)?json$/i, '.js');
      const script = document.createElement('script');
      script.src = `./${jsPath}`;
      script.onload = () => {
        if (store[cleanPath]) {
          resolve(store[cleanPath]);
        } else {
          reject(new Error(`No se encontró ${cleanPath} en ${jsPath}`));
        }
      };
      script.onerror = () => {
        const script2 = document.createElement('script');
        script2.src = `./public/${jsPath}`;
        script2.onload = () => {
          if (store[cleanPath]) {
            resolve(store[cleanPath]);
          } else {
            reject(new Error(`No se encontró ${cleanPath} en public/${jsPath}`));
          }
        };
        script2.onerror = () => reject(new Error(`No se pudo cargar ${cleanPath}`));
        document.head.appendChild(script2);
      };
      document.head.appendChild(script);
    });
  }

  async function fetchGeoJson(url: string): Promise<GeoJSON.FeatureCollection> {
    const clean = url.replace(/^\.?\//, '');
    if (window.location.protocol === 'file:') {
      return loadGeoJsonViaScript(clean);
    }
    try {
      let resp = await fetch(url);
      if (!resp.ok && !url.startsWith('http') && !url.includes('public/')) {
        resp = await fetch(`public/${clean}`);
      }
      if (resp.ok) {
        return (await resp.json()) as GeoJSON.FeatureCollection;
      }
    } catch {
      // Fallback a carga por script si fetch falla
    }
    return loadGeoJsonViaScript(clean);
  }

  async function loadMunicipiosForState(estadoId: string): Promise<void> {
    const stEntry = statesCatalog.get(estadoId);
    if (!stEntry) return;

    let rawMunFc = munCache.get(estadoId);
    if (!rawMunFc) {
      const url = config.country.municipiosUrlTemplate
        .replace('{slug}', stEntry.slug)
        .replace('{estado_id}', stEntry.estado_id);

      const json = await fetchGeoJson(url);
      const normFeatures: GeoJSON.Feature[] = (json.features || []).map((f) => {
        const norm = normalizeFeatureProps(f, stEntry.slug);
        return {
          type: 'Feature',
          properties: {
            ...norm,
            estado_id: stEntry.estado_id,
            abrev: stEntry.abrev,
          },
          geometry: f.geometry,
        };
      });
      rawMunFc = { type: 'FeatureCollection', features: normFeatures };
      munCache.set(estadoId, rawMunFc);
    }

    currentMunCatalog.clear();
    for (const f of rawMunFc.features) {
      const p = f.properties as unknown as NormalizedTerritoryProps;
      if (p.municipio_id && f.geometry) {
        currentMunCatalog.set(p.municipio_id, {
          estado_id: stEntry.estado_id,
          municipio_id: p.municipio_id,
          nombre: p.nombre,
          bbox: computeFeatureBBox(f.geometry),
          feature: f,
        });
      }
    }

    populateMunicipioSelect();
    refreshCurrentMunsSource();
  }

  function populateEstadoSelect(): void {
    if (!selEstado) return;
    const entries = [...statesCatalog.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    selEstado.innerHTML = `<option value="">${scopeElegido ? 'Todos los estados' : 'Seleccionar'}</option>` +
      entries.map((e) => `<option value="${escapeHtml(e.estado_id)}">${escapeHtml(e.nombre)}</option>`).join('');
  }

  function populateMunicipioSelect(): void {
    if (!selMunicipio) return;
    const entries = [...currentMunCatalog.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    selMunicipio.innerHTML = `<option value="">${scopeElegido ? 'Todos los municipios' : 'Seleccionar'}</option>` +
      entries.map((m) => `<option value="${escapeHtml(m.municipio_id)}">${escapeHtml(m.nombre)}</option>`).join('');
    selMunicipio.disabled = entries.length === 0;
  }

  function syncDropdownsWithScope(): void {
    if (selPais) selPais.value = scopeElegido ? config.country.code : '';
    if (selNivel) selNivel.value = scopeElegido ? scope.nivel : '';
    if (selEstado && selEstado.options[0]) selEstado.options[0].text = scopeElegido ? 'Todos los estados' : 'Seleccionar';
    if (selMunicipio && selMunicipio.options[0]) selMunicipio.options[0].text = scopeElegido ? 'Todos los municipios' : 'Seleccionar';
    if (selEstado) {
      selEstado.value = scope.estado_id || '';
      selEstado.disabled = false;
    }
    if (selMunicipio) {
      selMunicipio.value = scope.municipio_id || '';
      selMunicipio.disabled = !scope.estado_id;
    }
  }

  function flyToBBox(bbox: [number, number, number, number], padding: number, duration: number, maxZoom: number): void {
    map.resize();
    const effectiveDuration = prefersReducedMotion() ? 0 : duration;
    const [minX, minY, maxX, maxY] = bbox;
    const center: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
    const span = Math.max(Math.abs(maxX - minX), Math.abs(maxY - minY), 0.05);
    const fallbackZoom = Math.min(maxZoom, Math.max(3.2, Math.log2(360 / span) - 0.55));
    try {
      const cam = map.cameraForBounds([[minX, minY], [maxX, maxY]], { padding, maxZoom });
      if (cam && cam.center && typeof cam.zoom === 'number' && Number.isFinite(cam.zoom)) {
        map.flyTo({ center: cam.center, zoom: Math.min(cam.zoom, maxZoom), duration: effectiveDuration, essential: true });
        return;
      }
    } catch {
      // Fallback directo en proyección globo
    }
    map.flyTo({ center, zoom: fallbackZoom, duration: effectiveDuration, essential: true });
  }

  function zoomToCurrentScope(): void {
    stopGlobeSpin();
    if (scope.nivel === 'municipio' && scope.municipio_id) {
      const m = currentMunCatalog.get(scope.municipio_id);
      if (m) {
        flyToBBox(m.bbox, 68, 1050, 10.5);
        return;
      }
    }
    if (scope.estado_id) {
      const st = statesCatalog.get(scope.estado_id);
      if (st) {
        flyToBBox(st.bbox, 56, 1150, 7.2);
        return;
      }
    }
    flyToBBox(config.country.bounds, 48, 1300, 4.6);
  }

  /**
   * Actualiza la selección geográfica, pero NO dispara ninguna búsqueda automática.
   */
  async function applyScopeSelection(next: ScopeSelection, shouldZoom = true): Promise<void> {
    scopeElegido = true;
    actualizarBloqueoBusqueda();
    try {
      if (!next.estado_id) {
        clearMunicipiosLayer();
      } else {
        await loadMunicipiosForState(next.estado_id);
      }

      publishScope({
        ...next,
        nombre: resolvePlaceShortName(next),
      });
      syncDropdownsWithScope();
      if (selMunicipio) selMunicipio.value = scope.municipio_id || '';

      selectedFeatureKey = scope.municipio_id || scope.estado_id || null;
      updateScopeAttenuation();
      if (shouldZoom) zoomToCurrentScope();
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Error al cambiar el alcance geográfico.');
    }
  }

  function formatCorridaDate(iso: string): string {
    if (!iso) return '—';
    try {
      const dt = new Date(iso);
      return dt.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function getSourceBadgeLabel(tipo: string): string {
    if (tipo === 'oficial') return 'Oficial';
    if (tipo === 'politico') return 'Político';
    if (tipo === 'medio') return 'Medio';
    return 'Ciudadano';
  }

  /**
   * Formatea métricas de interacción: si pasan de mil, usa formato "1,9 mil".
   */
  function formatMetricEs(val: number): string {
    const n = Number(val) || 0;
    if (n >= 1000) {
      const k = Math.round((n / 1000) * 10) / 10;
      return `${String(k).replace('.', ',')} mil`;
    }
    return String(Math.max(0, Math.round(n)));
  }

  /**
   * Devuelve la etiqueta de sentimiento sin usar "Neutro" por defecto cuando el clasificador falla.
   */
  function renderSentimentBadge(sentimiento?: string): string {
    if (sentimiento === 'pos') {
      return '<span class="cenet-badge cenet-badge--pos">Positivo</span>';
    }
    if (sentimiento === 'neg') {
      return '<span class="cenet-badge cenet-badge--neg">Negativo</span>';
    }
    if (sentimiento === 'neu') {
      return '<span class="cenet-badge cenet-badge--neu">Neutro</span>';
    }
    return '<span class="cenet-badge cenet-badge--sin_clasificar">Sin clasificar</span>';
  }

  function renderMetricsGroup(likes: number, comments: number, shares: number): string {
    const fmtLikes = formatMetricEs(likes);
    const fmtComments = formatMetricEs(comments);
    const fmtShares = formatMetricEs(shares);
    return `
      <div class="cenet-post-metrics" role="group" aria-label="Métricas de interacción">
        <span class="cenet-post-metric" aria-label="Reacciones: ${escapeHtml(fmtLikes)}" title="Reacciones">
          ${LUCIDE_SVG.thumbsUp}
          <span class="cenet-post-metric__val">${escapeHtml(fmtLikes)}</span>
          <span class="cenet-sr-only">reacciones</span>
        </span>
        <span class="cenet-post-metric" aria-label="Comentarios: ${escapeHtml(fmtComments)}" title="Comentarios">
          ${LUCIDE_SVG.messageSquare}
          <span class="cenet-post-metric__val">${escapeHtml(fmtComments)}</span>
          <span class="cenet-sr-only">comentarios</span>
        </span>
        <span class="cenet-post-metric" aria-label="Compartidos: ${escapeHtml(fmtShares)}" title="Compartidos">
          ${LUCIDE_SVG.share2}
          <span class="cenet-post-metric__val">${escapeHtml(fmtShares)}</span>
          <span class="cenet-sr-only">compartidos</span>
        </span>
      </div>
    `;
  }

  function renderNarrativeCard(n: SocialApiNarrative): string {
    const srcLabel = getSourceBadgeLabel(n.tipo_fuente);
    const isOfficial = n.tipo_fuente === 'oficial' || n.tipo_fuente === 'politico';
    const sentBadge = !isOfficial ? renderSentimentBadge(n.sentimiento) : '';
    const cleanedTitle = cleanDisplayText(n.titulo || n.texto || '');
    return `
      <article class="cenet-post-card">
        <div class="cenet-post-card__head">
          <div class="cenet-post-card__author-wrap">
            <span class="cenet-post-card__author">${escapeHtml(n.fuentes.join(', '))}</span>
            <div class="cenet-post-card__meta">
              <span style="text-transform:capitalize;">${escapeHtml(n.categoria)}</span>
              ${n.time ? `<span>· ${escapeHtml(formatCorridaDate(n.time))}</span>` : ''}
            </div>
          </div>
          <div class="cenet-badges">
            <span class="cenet-badge cenet-badge--${escapeHtml(n.tipo_fuente)}">${escapeHtml(srcLabel)}${n.count > 1 ? ` ×${n.count}` : ''}</span>
            ${sentBadge}
          </div>
        </div>
        <p class="cenet-post-card__text">${escapeHtml(cleanedTitle)}</p>
        <div class="cenet-post-card__foot">
          ${renderMetricsGroup(n.likesCount, n.commentsCount, n.sharesCount)}
          ${
            n.url
              ? `<a class="cenet-post-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener"><span>Abrir publicación</span>${LUCIDE_SVG.externalLink}</a>`
              : ''
          }
        </div>
      </article>
    `;
  }

  function renderPersonaSection(summary: SocialApiSummary): string {
    const per = summary.persona;
    const st = summary.sin_texto;
    if (!per) return '';
    const origenTxt = (o?: string) => (o === 'publicado_por_persona' ? 'publicada por la persona' : 'mención');
    return `
      <section class="cenet-card">
        <div class="cenet-card__title">
          <span class="cenet-card__title-left"><span>Página elegida: ${escapeHtml(per.pagina_nombre || per.pagina_url)}</span></span>
        </div>
        <p style="font-size:0.78rem;">${per.publicados} publicadas por la persona · ${per.menciones} menciones de terceros</p>
        ${
          st && st.total
            ? `<p style="font-size:0.78rem;margin-top:6px;"><strong>${st.total} sin texto, no analizables</strong> (${st.publicados} de la persona, ${st.menciones} menciones)</p>
               <div class="cenet-post-list">${st.posts
                 .map(
                   (x) => `<article class="cenet-post-card"><div class="cenet-post-card__head"><div class="cenet-post-card__author-wrap">
                     <span class="cenet-post-card__author">${escapeHtml(x.user)}</span>
                     <div class="cenet-post-card__meta"><span>${escapeHtml(origenTxt(x.origen_post))}</span>${x.time ? `<span>· ${escapeHtml(formatCorridaDate(x.time))}</span>` : ''}</div>
                   </div></div>${x.url ? `<div class="cenet-post-card__foot"><a class="cenet-post-link" href="${escapeHtml(x.url)}" target="_blank" rel="noopener"><span>Abrir publicación</span>${LUCIDE_SVG.externalLink}</a></div>` : ''}</article>`
                 )
                 .join('')}</div>`
            : ''
        }
      </section>
    `;
  }

  /** Agrega la X de cerrar al encabezado de los paneles de historial, alertas, ficha y perfiles. */
  function agregarCerrar(): void {
    const h = drawerBody?.querySelector('.cenet-drawer__header');
    if (!h || h.querySelector('.cenet-close-btn')) return;
    h.insertAdjacentHTML('beforeend', `<button type="button" class="cenet-close-btn" aria-label="Cerrar panel">${LUCIDE_SVG.close}</button>`);
    h.querySelector('.cenet-close-btn')?.addEventListener('click', () => {
      closeDrawer();
      map.resize();
    });
  }

  /* ───────── Historial de búsquedas (todo local: no llama a Apify ni a Gemini) ───────── */
  const apiHist = { apiUrl: config.apiUrl, apiToken: config.apiToken };
  const histWrap = document.getElementById('cenet-hist-wrap') as HTMLElement | null;
  const histList = document.getElementById('cenet-hist-list') as HTMLElement | null;
  const histBtn = document.getElementById('cenet-hist-btn') as HTMLButtonElement | null;
  let histItems: HistorialItem[] = [];

  const ICONO_MODO: Record<string, string> = {
    tema: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
    persona: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    tendencias: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  };

  function haceCuanto(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    if (min < 1440) return `hace ${Math.round(min / 60)} h`;
    return `hace ${Math.round(min / 1440)} d`;
  }

  function tarjetasHistorial(items: HistorialItem[]): string {
    return items
      .map((h) => {
        const lugar = h.alcance?.texto || h.alcance?.nombre || 'Sin lugar';
        const modo = h.modo === 'persona' ? 'Persona' : h.modo === 'tendencias' ? 'Tendencias' : 'Tema';
        return `<div class="cenet-hist__card" role="button" tabindex="0" data-hist-id="${escapeHtml(h.id)}">
          <span class="cenet-hist__ico">${ICONO_MODO[h.modo] || ICONO_MODO.tema}</span>
          <span><div class="cenet-hist__tema">${escapeHtml(h.tema)}</div>
            <div class="cenet-hist__meta">${modo} · ${escapeHtml(lugar)} · ${escapeHtml(haceCuanto(h.fecha))} · ${h.n_posts} posts</div></span>
          <button type="button" class="cenet-hist__del" data-hist-del="${escapeHtml(h.id)}" aria-label="Borrar esta búsqueda">&times;</button>
        </div>`;
      })
      .join('');
  }

  function enlazarHistorial(cont: HTMLElement): void {
    cont.querySelectorAll<HTMLElement>('[data-hist-id]').forEach((card) => {
      const abrir = () => void abrirHistorial(card.dataset.histId || '');
      card.addEventListener('click', abrir);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrir();
        }
      });
    });
    cont.querySelectorAll<HTMLElement>('[data-hist-del]').forEach((b) =>
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await borrarHistorial(apiHist, b.dataset.histDel);
        } catch (err) {
          setStatus('error', err instanceof Error ? err.message : 'No se pudo borrar.');
        }
        await cargarHistorial();
        if (drawerBody?.querySelector('[data-hist-lista]')) mostrarListaHistorial();
      })
    );
  }

  async function cargarHistorial(): Promise<void> {
    try {
      histItems = await listarHistorial(apiHist);
    } catch {
      histItems = [];   // backend apagado: el historial simplemente no aparece
    }
    if (histWrap && histList) {
      histWrap.hidden = histItems.length === 0;
      histList.innerHTML = tarjetasHistorial(histItems);
      enlazarHistorial(histList);
    }
  }

  function mostrarListaHistorial(): void {
    if (!drawerBody) return;
    openDrawer();
    drawerBody.innerHTML = `<div data-hist-lista>
      <div class="cenet-drawer__header"><div style="width:100%;"><div class="cenet-drawer__eyebrow">Historial</div>
        <h2 class="cenet-drawer__title">Búsquedas anteriores</h2></div></div>
      <div class="cenet-hist__list">${histItems.length ? tarjetasHistorial(histItems) : '<div class="cenet-empty-box">Aún no hay búsquedas guardadas.</div>'}</div>
      ${histItems.length ? '<button type="button" class="cenet-hist-refresh" id="cenet-hist-vaciar" style="margin-top:12px;">Vaciar historial</button>' : ''}
    </div>`;
    agregarCerrar();
    enlazarHistorial(drawerBody);
    drawerBody.querySelector('#cenet-hist-vaciar')?.addEventListener('click', async () => {
      if (!window.confirm('¿Borrar todo el historial de búsquedas?')) return;
      await borrarHistorial(apiHist);
      await cargarHistorial();
      mostrarListaHistorial();
    });
  }

  histBtn?.addEventListener('click', () => {
    void cargarHistorial().then(mostrarListaHistorial);
  });

  /** Reabre una búsqueda guardada: carga el JSON local, fija su alcance y pinta panel y mapa. Sin llamadas externas. */
  async function abrirHistorial(id: string): Promise<void> {
    if (searchInFlight || !id) return;
    setSearchLoadingUi(true);
    try {
      const e = await abrirHistorialEntry(apiHist, id);
      const a = e.alcance;
      await applyScopeSelection({ nivel: a?.nivel || 'pais', estado_id: a?.estado_id ?? null, municipio_id: a?.municipio_id ?? null }, true);
      currentTopic = e.tema;
      if (topicInput) topicInput.value = e.tema;
      syncModeSegmentedUi(e.modo);
      const searchScope: ScopeSelection = { ...scope, texto: a?.texto || resolveReadableScopeText(scope) };
      mostrarResumen(e.resumen, searchScope, e.tema, e.modo, searchScope.texto || '', false);
      drawerBody?.insertAdjacentHTML(
        'afterbegin',
        `<div class="cenet-hist-banner"><span>Guardada el ${escapeHtml(formatCorridaDate(e.fecha))}</span>
         <button type="button" class="cenet-hist-refresh" data-hist-refresh>Actualizar</button></div>`
      );
      drawerBody?.querySelector('[data-hist-refresh]')?.addEventListener('click', () => void actualizarDesdeHistorial(e));
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'No se pudo abrir la búsqueda guardada.');
    } finally {
      setSearchLoadingUi(false);
    }
  }

  /** «Actualizar»: repite la búsqueda real (ignora la caché de disco) previa confirmación de consumo de créditos. */
  async function actualizarDesdeHistorial(e: HistorialEntry): Promise<void> {
    if (searchInFlight) return;
    const health = await checkBackendSearchMode(config.apiUrl, config.facebookFixture, config.apifyMaxPosts);
    if (!health.facebook_fixture && !window.confirm(`Esta búsqueda consumirá créditos de Apify (máx. ${health.apify_max_posts} resultados)`)) return;
    const texto = e.alcance?.texto || resolveReadableScopeText(scope);
    const searchScope: ScopeSelection = { ...scope, nombre: resolvePlaceShortName(scope), texto };
    setSearchLoadingUi(true);
    renderDrawerSkeleton(e.tema, texto);
    try {
      const p = e.resumen.persona;
      const summary =
        e.modo === 'persona' && p
          ? await analyzePersonaPage({
              ...apiHist,
              nombre: e.tema,
              pagina: { nombre: p.pagina_nombre, url: p.pagina_url, categoria: '', seguidores: 0 },
              entidadId: e.resumen.ficha?.id,
              alcance: searchScope,
              refrescar: true,
            })
          : await fetchSocialSearchSummary({ ...apiHist, tema: e.tema, modo: e.modo, alcance: searchScope, refrescar: true });
      mostrarResumen(summary, searchScope, e.tema, e.modo, texto, false);
      void cargarHistorial();
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'No se pudo actualizar la búsqueda.');
    } finally {
      setSearchLoadingUi(false);
    }
  }

  void cargarHistorial();

  /* ───────── Fichas de entidad ───────── */
  const fichaSelEl = document.getElementById('cenet-ficha-sel') as HTMLSelectElement | null;
  const fichaSaveBtn = document.getElementById('cenet-ficha-save') as HTMLButtonElement | null;
  let fichas: Entidad[] = [];
  let fichaSel: Entidad | null = null;

  async function cargarFichas(seleccionarId?: string): Promise<void> {
    try {
      fichas = await listarEntidades(apiHist);
    } catch {
      fichas = [];
    }
    if (!fichaSelEl) return;
    fichaSelEl.innerHTML = '<option value="">Sin ficha</option>' + fichas.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.nombre)} · ${f.tipo}</option>`).join('');
    fichaSelEl.hidden = fichas.length === 0;
    fichaSelEl.value = seleccionarId || fichaSel?.id || '';
    fichaSel = fichas.find((f) => f.id === fichaSelEl.value) || null;
  }

  fichaSelEl?.addEventListener('change', () => {
    fichaSel = fichas.find((f) => f.id === fichaSelEl.value) || null;
    if (fichaSel) {
      if (topicInput) topicInput.value = fichaSel.nombre;
      syncModeSegmentedUi(fichaSel.tipo === 'persona' ? 'persona' : 'tema');
    }
  });
  // Escribir otro nombre desasocia la ficha: la búsqueda libre sigue funcionando igual.
  topicInput?.addEventListener('input', () => {
    if (fichaSel && topicInput.value.trim() !== fichaSel.nombre) {
      fichaSel = null;
      if (fichaSelEl) fichaSelEl.value = '';
    }
  });

  const lista = (txt: string, sep: RegExp) => txt.split(sep).map((x) => x.trim()).filter(Boolean);

  /** Formulario de ficha en el panel. `alGuardar(ficha|null)`: null = continuar sin guardar. */
  function mostrarFormFicha(base: Partial<Entidad>, alGuardar: (f: Entidad | null) => void, textoSecundario = ''): void {
    if (!drawerBody) return;
    openDrawer();
    const v = (x: string | undefined) => escapeHtml(x || '');
    const terr = base.territorio;
    drawerBody.innerHTML = `
      <div class="cenet-drawer__header"><div style="width:100%;"><div class="cenet-drawer__eyebrow">Ficha de entidad</div>
        <h2 class="cenet-drawer__title">${base.id ? 'Editar ficha' : 'Guardar como ficha'}</h2></div></div>
      <form class="cenet-card" id="fi-form" style="display:grid;gap:8px;">
        <label>Tipo <select id="fi-tipo" class="cenet-select">${['persona', 'tema', 'partido'].map((t) => `<option value="${t}" ${base.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Nombre completo <input id="fi-nombre" class="cenet-cmdbar__input" required value="${v(base.nombre)}"></label>
        <label>Variantes (separadas por coma) <input id="fi-variantes" class="cenet-cmdbar__input" value="${v((base.variantes || []).join(', '))}"></label>
        <label>Cargo <input id="fi-cargo" class="cenet-cmdbar__input" value="${v(base.cargo)}"></label>
        <label>Partido <input id="fi-partido" class="cenet-cmdbar__input" value="${v(base.partido)}"></label>
        <label>Territorio (nombre) <input id="fi-terr" class="cenet-cmdbar__input" value="${v(terr?.nombre || '')}"></label>
        <label>Páginas oficiales (una URL por línea) <textarea id="fi-paginas" class="cenet-cmdbar__input" rows="2">${v((base.paginas_oficiales || []).join('\n'))}</textarea></label>
        <label>Hashtags (separados por coma) <input id="fi-hashtags" class="cenet-cmdbar__input" value="${v((base.hashtags || []).join(', '))}"></label>
        <label>Palabras de descarte (separadas por coma) <input id="fi-descarte" class="cenet-cmdbar__input" value="${v((base.palabras_descarte || []).join(', '))}"></label>
        <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="fi-monitoreo" ${base.monitoreo ? 'checked' : ''}> Monitoreo activo (corrida programada de alertas)</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="submit" class="cenet-btn-search">Guardar ficha${textoSecundario ? ' y analizar' : ''}</button>
          ${textoSecundario ? `<button type="button" class="cenet-hist-refresh" id="fi-skip">${escapeHtml(textoSecundario)}</button>` : ''}
        </div>
      </form>`;
    agregarCerrar();
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    document.getElementById('fi-skip')?.addEventListener('click', () => alGuardar(null));
    document.getElementById('fi-form')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const saved = await guardarEntidad(apiHist, {
          id: base.id,
          tipo: val('fi-tipo') as Entidad['tipo'],
          nombre: val('fi-nombre').trim(),
          variantes: lista(val('fi-variantes'), /,/),
          cargo: val('fi-cargo').trim(),
          partido: val('fi-partido').trim(),
          territorio: { estado_id: terr?.estado_id ?? null, municipio_id: terr?.municipio_id ?? null, nombre: val('fi-terr').trim() || null },
          paginas_oficiales: lista(val('fi-paginas'), /\n/),
          hashtags: lista(val('fi-hashtags'), /,/),
          palabras_descarte: lista(val('fi-descarte'), /,/),
          idioma: 'es',
          monitoreo: (document.getElementById('fi-monitoreo') as HTMLInputElement).checked,
        });
        await cargarFichas(saved.id);
        alGuardar(saved);
      } catch (err) {
        setStatus('error', err instanceof Error ? err.message : 'No se pudo guardar la ficha.');
      }
    });
  }

  fichaSaveBtn?.addEventListener('click', () => {
    const territorio = {
      estado_id: scope.estado_id,
      municipio_id: scope.municipio_id,
      nombre: scopeElegido && scope.nivel !== 'pais' ? resolvePlaceShortName(scope) : null,
    };
    const base: Partial<Entidad> = fichaSel
      ? fichaSel
      : { tipo: currentMode === 'persona' ? 'persona' : 'tema', nombre: (topicInput?.value || '').trim(), territorio };
    mostrarFormFicha(base, (f) => {
      if (f) setStatus('ready');
    });
  });

  void cargarFichas();

  /* ───────── Alertas de picos y narrativas ───────── */
  const alertBtn = document.getElementById('cenet-alert-btn') as HTMLButtonElement | null;

  function lineaTiempoHtml(a: Alerta): string {
    const porHora = new Map<string, number>();
    a.linea_tiempo.forEach((x) => porHora.set(x.hora.slice(0, 13), (porHora.get(x.hora.slice(0, 13)) || 0) + 1));
    if (!porHora.size) return '';
    const max = Math.max(...porHora.values());
    return `<div class="cenet-tl" aria-label="Línea de tiempo del grupo: publicaciones por hora">${[...porHora.entries()]
      .sort()
      .map(([h, n]) => `<span title="${escapeHtml(h.replace('T', ' '))}:00 · ${n} posts" style="height:${Math.round((n / max) * 100)}%"></span>`)
      .join('')}</div>`;
  }

  function tarjetaAlerta(a: Alerta): string {
    const d = a.datos as Record<string, unknown>;
    const lista = (k: string) => ((d[k] as string[]) || []).map(escapeHtml).join(', ');
    const tono: Record<string, string> = { ataque: 'ataque', critica_legitima: 'crítica legítima', neutral: 'neutral', no_determinado: 'no determinado' };
    return `<article class="cenet-card" data-alerta="${escapeHtml(a.id)}">
      <div class="cenet-card__title"><span class="cenet-card__title-left"><span>${a.tipo === 'pico' ? 'Pico de menciones' : 'Narrativa repetida'} · ${escapeHtml(a.ficha_nombre)}</span></span>
        <span class="cenet-card__badge">${escapeHtml(a.gravedad)}</span></div>
      <p class="cenet-hist__meta">${escapeHtml(formatCorridaDate(a.fecha))} · ${escapeHtml(a.estado)} · <strong>${escapeHtml(a.etiqueta)}</strong></p>
      <p style="font-size:0.8rem;margin:8px 0;">${escapeHtml(a.resumen)}</p>
      ${a.afirmacion ? `<p style="font-size:0.8rem;"><strong>Afirmación a verificar:</strong> ${escapeHtml(a.afirmacion)}<br><span class="cenet-hist__meta">Tono: ${escapeHtml(tono[a.tono || ''] || a.tono || '—')}${a.explicacion ? ' · ' + escapeHtml(a.explicacion) : ''}</span></p>` : ''}
      ${a.tipo === 'narrativa' ? `<p class="cenet-hist__meta">${d.cuentas} cuentas distintas · ${d.posts} posts${(d.cuentas_publicas as string[])?.length ? ' · cuentas públicas: ' + lista('cuentas_publicas') : ''}${(d.hashtags_compartidos as string[])?.length ? ' · hashtags: ' + lista('hashtags_compartidos') : ''}${(d.enlaces_compartidos as string[])?.length ? ' · enlaces compartidos: ' + lista('enlaces_compartidos') : ''}</p>${lineaTiempoHtml(a)}` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button type="button" class="cenet-hist-refresh" data-al-estado="revisada">Marcar revisada</button>
        <button type="button" class="cenet-hist-refresh" data-al-estado="descartada">Descartar</button>
        ${a.tipo === 'narrativa' ? '<button type="button" class="cenet-hist-refresh" data-al-borrador>Borrador de respuesta</button>' : ''}
      </div>
      <textarea class="cenet-cmdbar__input" data-al-texto rows="7" hidden style="width:100%;margin-top:8px;"></textarea>
    </article>`;
  }

  async function mostrarAlertas(): Promise<void> {
    if (!drawerBody) return;
    openDrawer();
    drawerBody.innerHTML = '<div class="cenet-skeleton" style="height:90px;width:100%;"></div>';
    try {
      const [alertas, bases] = await Promise.all([listarAlertas(apiHist), lineasBase(apiHist)]);
      const visibles = alertas.filter((a) => a.estado !== 'descartada');
      drawerBody.innerHTML = `
        <div class="cenet-drawer__header"><div style="width:100%;"><div class="cenet-drawer__eyebrow">Monitoreo</div><h2 class="cenet-drawer__title">Alertas</h2></div></div>
        ${bases.length ? `<section class="cenet-card">${bases.map((b) => `<p class="cenet-hist__meta"><strong>${escapeHtml(b.ficha)}</strong>: ${escapeHtml(b.estado === 'linea_base' ? b.mensaje || '' : `línea base lista (${b.dias} días)`)}</p>`).join('')}</section>` : '<div class="cenet-empty-box">Activa «Monitoreo activo» en una ficha para recibir alertas.</div>'}
        ${visibles.length ? visibles.map(tarjetaAlerta).join('') : '<div class="cenet-empty-box">Sin alertas por revisar.</div>'}
        <p class="cenet-hist__meta">Solo cuentas y páginas públicas, en agregado. Las alertas describen patrones de publicación; no acusan a nadie y siempre requieren verificación por una persona.</p>`;
      agregarCerrar();
      drawerBody.querySelectorAll<HTMLElement>('[data-alerta]').forEach((card) => {
        const id = card.dataset.alerta || '';
        card.querySelectorAll<HTMLButtonElement>('[data-al-estado]').forEach((b) =>
          b.addEventListener('click', async () => {
            await marcarAlerta(apiHist, id, b.dataset.alEstado || 'revisada');
            void mostrarAlertas();
          })
        );
        card.querySelector('[data-al-borrador]')?.addEventListener('click', async () => {
          const box = card.querySelector<HTMLTextAreaElement>('[data-al-texto]');
          if (!box) return;
          box.hidden = false;
          box.value = 'Generando borrador…';
          try {
            box.value = (await borradorAlerta(apiHist, id)).borrador;
          } catch (err) {
            box.value = err instanceof Error ? err.message : 'No se pudo generar el borrador.';
          }
        });
      });
    } catch (err) {
      drawerBody.innerHTML = `<div class="cenet-empty-box">${escapeHtml(err instanceof Error ? err.message : 'No se pudieron cargar las alertas.')}</div>`;
    }
  }

  alertBtn?.addEventListener('click', () => void mostrarAlertas());

  /** Modo Persona, paso 1: lista de coincidencias para que el usuario elija la página correcta. Devuelve false si el backend usa fixture. */
  async function buscarPerfiles(nombre: string): Promise<boolean> {
    setSearchLoadingUi(true);
    renderDrawerSkeleton(nombre, 'Buscando perfiles y páginas');
    try {
      const r = await fetchPersonaProfiles({ apiUrl: config.apiUrl, apiToken: config.apiToken, nombre });
      if (r.origen === 'fixture') return false;
      if (!drawerBody) return true;
      drawerBody.innerHTML = `
        <div class="cenet-drawer__header"><div style="width:100%;">
          <div class="cenet-drawer__eyebrow">Modo Persona · paso 1 de 2</div>
          <h2 class="cenet-drawer__title">${escapeHtml(nombre)}</h2>
        </div></div>
        <section class="cenet-card">
          <div class="cenet-card__title"><span class="cenet-card__title-left"><span>Perfiles y páginas encontrados</span></span><span class="cenet-card__badge">${r.perfiles.length}</span></div>
          <p style="font-size:0.74rem;color:var(--text-secondary);">Puede haber homónimos: elige la página correcta.</p>
          ${
            r.perfiles.length
              ? r.perfiles
                  .map(
                    (pf, i) => `<article class="cenet-post-card">
                      <div class="cenet-post-card__head"><div class="cenet-post-card__author-wrap">
                        <span class="cenet-post-card__author">${escapeHtml(pf.nombre)}</span>
                        <div class="cenet-post-card__meta"><span>${escapeHtml(pf.categoria || 'Sin categoría')}</span><span>· ${pf.seguidores.toLocaleString('es-MX')} seguidores</span></div>
                      </div></div>
                      <div class="cenet-post-card__foot">
                        <a class="cenet-post-link" href="${escapeHtml(pf.url)}" target="_blank" rel="noopener"><span>Ver página</span>${LUCIDE_SVG.externalLink}</a>
                        <button type="button" class="cenet-btn-search" data-usar-pagina="${i}">Usar esta página</button>
                      </div></article>`
                  )
                  .join('')
              : `<div class="cenet-empty-box">${escapeHtml(r.mensaje || 'Facebook no devolvió páginas para este nombre')}</div>`
          }
        </section>`;
      agregarCerrar();
      drawerBody.querySelectorAll<HTMLButtonElement>('[data-usar-pagina]').forEach((btn) =>
        btn.addEventListener('click', () => void elegirPagina(nombre, r.perfiles[Number(btn.dataset.usarPagina)]))
      );
      setStatus('ready');
      return true;
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Error al buscar perfiles.');
      return true;
    } finally {
      setSearchLoadingUi(false);
    }
  }

  /** Tras «Usar esta página»: ofrece guardar la ficha con los datos prellenados (o seguir sin guardar). */
  function elegirPagina(nombre: string, pagina: PersonaProfile): void {
    const base: Partial<Entidad> = fichaSel
      ? { ...fichaSel, paginas_oficiales: [...new Set([...fichaSel.paginas_oficiales, pagina.url])] }
      : {
          tipo: 'persona',
          nombre,
          paginas_oficiales: [pagina.url],
          territorio: {
            estado_id: scope.estado_id,
            municipio_id: scope.municipio_id,
            nombre: scopeElegido && scope.nivel !== 'pais' ? resolvePlaceShortName(scope) : null,
          },
        };
    mostrarFormFicha(base, (f) => void analizarPagina(nombre, pagina, f?.id), 'Analizar sin guardar');
  }

  /** Modo Persona, paso 2: publicaciones de la página elegida + menciones. */
  async function analizarPagina(nombre: string, pagina: PersonaProfile, entidadId?: string): Promise<void> {
    if (searchInFlight) return;
    const texto = resolveReadableScopeText(scope);
    const searchScope: ScopeSelection = { ...scope, nombre: resolvePlaceShortName(scope), texto };
    setSearchLoadingUi(true);
    renderDrawerSkeleton(nombre, pagina.nombre);
    try {
      const summary = await analyzePersonaPage({ ...apiHist, nombre, pagina, alcance: searchScope, entidadId });
      mostrarResumen(summary, searchScope, nombre, 'persona', texto, false);
      void cargarHistorial();
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Error al analizar la página.');
    } finally {
      setSearchLoadingUi(false);
    }
  }

  function renderPostCard(p: SocialApiPost): string {
    const srcLabel = getSourceBadgeLabel(p.tipo_fuente);
    const isOfficial = p.tipo_fuente === 'oficial' || p.tipo_fuente === 'politico';
    const sentBadge = !isOfficial ? renderSentimentBadge(p.sentimiento) : '';
    const cleanedBody = cleanDisplayText(p.text || '');
    const snippet = cleanedBody.length > 220 ? `${cleanedBody.slice(0, 220)}…` : cleanedBody;
    return `
      <article class="cenet-post-card">
        <div class="cenet-post-card__head">
          <div class="cenet-post-card__author-wrap">
            <span class="cenet-post-card__author">${escapeHtml(p.user?.name || 'Usuario')}</span>
            <div class="cenet-post-card__meta">
              <span style="text-transform:capitalize;">${escapeHtml(p.categoria)}</span>
              <span>· ${escapeHtml(formatCorridaDate(p.time))}</span>
              ${p.repeticiones && p.repeticiones > 1 ? `<span>· ×${p.repeticiones}</span>` : ''}
            </div>
          </div>
          <div class="cenet-badges">
            ${p.origen_post ? `<span class="cenet-badge">${p.origen_post === 'publicado_por_persona' ? 'Publicada por la persona' : 'Mención'}</span>` : ''}
            <span class="cenet-badge cenet-badge--${escapeHtml(p.tipo_fuente)}">${escapeHtml(srcLabel)}</span>
            ${sentBadge}
          </div>
        </div>
        <p class="cenet-post-card__text">${escapeHtml(snippet)}</p>
        ${
          p.atribucion
            ? `<p class="cenet-hist__meta">Atribuido a la persona (${p.atribucion.puntaje}/100): ${escapeHtml(p.atribucion.razones.join('; ') || 'sin indicios adicionales')}${p.atribucion.razon_ia ? ` · IA: ${escapeHtml(p.atribucion.razon_ia)}` : ''}</p>`
            : ''
        }
        <div class="cenet-post-card__foot">
          ${renderMetricsGroup(p.likesCount, p.commentsCount, p.sharesCount)}
          ${
            p.url
              ? `<a class="cenet-post-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener"><span>Abrir publicación</span>${LUCIDE_SVG.externalLink}</a>`
              : ''
          }
        </div>
      </article>
    `;
  }

  /**
   * Renderiza el cajón lateral derecho con los resultados reales de la consulta:
   * 1. 4 tarjetas KPI (posts totales, relevantes, % oficial, sentimiento ciudadano)
   * 2. Gráfica de volumen por día
   * 3. Sentimiento y categorías
   * 4. Narrativas ("Oficial y afín" | "Medios y ciudadanía") + tarjetas de post limpias
   */
  function renderSearchSummaryPanel(
    summary: SocialApiSummary,
    usedTopic: string,
    usedMode: SearchMode,
    readableScope: string
  ): void {
    if (!drawerBody) return;
    openDrawer();

    const isFixture = Boolean(summary.es_fixture || summary.fuente_datos?.includes('fixture'));
    updateSourcePill(!isFixture);

    const postsFuente = summary.posts_fuente ?? summary.total_posts ?? 0;
    const postsFiltroTema = summary.posts_filtro_tema ?? summary.relevantes_posts ?? 0;

    // Log de filtro y resultado en consola
    console.info(
      `[ceNetwork:filtro] tema="${usedTopic}" modo="${usedMode}" -> posts_fuente=${postsFuente}, posts_filtro_tema=${postsFiltroTema}, relevantes=${summary.relevantes_posts}`
    );
    console.debug('[ceNetwork:searchResult]', {
      id: summary.id,
      fuente_datos: summary.fuente_datos,
      posts_fuente: postsFuente,
      posts_filtro_tema: postsFiltroTema,
      relevantes_posts: summary.relevantes_posts,
      clasificador: summary.clasificador,
      descartados: summary.descartados,
      alcance: summary.query?.alcance || scope,
    });
    if (isDebugMode && debugPill) {
      debugPill.hidden = false;
      debugPill.textContent = `src:${summary.fuente_datos} · ${postsFiltroTema}/${postsFuente} · cls:${summary.clasificador || 'reglas'}`;
    }

    const sent = summary.sentimiento || { positive: 0, neutral: 0, negative: 0 };
    const dailySeries = summary.volumen_por_dia || [];
    const peakPostsDay = summary.pico_posts_dia ?? (dailySeries.length ? Math.max(...dailySeries.map((d) => d.posts), 0) : 0);
    const windowDays = summary.ventana_dias || 14;
    const cmCount = summary.ciudadanos_medios_posts ?? summary.relevantes_posts;
    const sinClasificarCount = summary.sentimiento?.sin_clasificar ?? 0;
    const classifiedCmCount = Math.max(0, cmCount - sinClasificarCount);
    const hasSentimentPosts = classifiedCmCount > 0 && (sent.positive + sent.neutral + sent.negative > 0);

    // Determinar métrica de la 4ª tarjeta KPI (Sentimiento ciudadano)
    let citizenKpiVal = 0;
    let citizenKpiLabel = cmCount > 0 ? 'Sin clasificar' : 'Sin muestra';
    let citizenKpiColor = 'var(--text-secondary)';
    if (hasSentimentPosts) {
      if (sent.positive >= sent.negative && sent.positive >= sent.neutral) {
        citizenKpiVal = sent.positive;
        citizenKpiLabel = 'Positivo dominante';
        citizenKpiColor = 'var(--sent-pos)';
      } else if (sent.negative > sent.positive && sent.negative >= sent.neutral) {
        citizenKpiVal = sent.negative;
        citizenKpiLabel = 'Negativo dominante';
        citizenKpiColor = 'var(--sent-neg)';
      } else {
        citizenKpiVal = sent.neutral;
        citizenKpiLabel = 'Neutro dominante';
        citizenKpiColor = 'var(--sent-neu)';
      }
    }

    const modeDisplay = usedMode === 'persona' ? 'Persona' : usedMode === 'tendencias' ? 'Tendencias' : 'Tema';

    const noDataBannerHtml = summary.sin_datos_demo
      ? `
      <section class="cenet-card" style="border-color:rgba(245, 158, 11, 0.40); background:rgba(245, 158, 11, 0.07);">
        <div class="cenet-card__title">
          <span class="cenet-card__title-left" style="color:var(--sent-neu);">Alcance sin cobertura en modo demo</span>
        </div>
        <p style="font-size:0.8rem; font-weight:600; color:var(--text-primary);">
          ${escapeHtml(summary.mensaje || 'Sin datos en modo demo para este alcance')}
        </p>
        <p style="font-size:0.74rem; color:var(--text-secondary);">
          La muestra de demostración corresponde a <strong>Tlalpan, Ciudad de México</strong>. Selecciona Tlalpan o conecta la fuente en vivo para consultar otros territorios.
        </p>
      </section>
      `
      : summary.relevantes_posts === 0
        ? `
      <section class="cenet-card">
        <div class="cenet-card__title">
          <span class="cenet-card__title-left">Sin coincidencias</span>
          <span class="cenet-card__badge">${postsFiltroTema} de ${postsFuente} en fuente</span>
        </div>
        <p style="font-size:0.8rem; font-weight:600; color:var(--text-primary);">
          Sin publicaciones que mencionen este tema en los datos disponibles
        </p>
        <p style="font-size:0.74rem; color:var(--text-secondary);">
          De <strong>${postsFuente}</strong> publicaciones analizadas en la fuente, <strong>${postsFiltroTema}</strong> mencionan <strong>"${escapeHtml(usedTopic)}"</strong> en <strong>${escapeHtml(readableScope)}</strong>.
        </p>
      </section>
      `
        : '';

    const dailyChartHtml =
      dailySeries.length > 0 && peakPostsDay > 0
        ? `
        <div class="cenet-daily-chart">
          ${dailySeries
            .map((pt, idx) => {
              const pct = pt.posts > 0 ? Math.max(10, Math.round((pt.posts / peakPostsDay) * 100)) : 3;
              const showLbl = idx === 0 || idx === dailySeries.length - 1 || idx % 3 === 0;
              const delayMs = prefersReducedMotion() ? 0 : idx * 18;
              return `
                <div class="cenet-day-col" title="${escapeHtml(pt.etiqueta)}: ${pt.posts} publicaciones">
                  <div class="cenet-day-bar ${pt.posts === 0 ? 'is-zero' : ''}" style="height:${pct}%; animation-delay:${delayMs}ms;"></div>
                  <span class="cenet-day-lbl">${showLbl ? escapeHtml(pt.etiqueta) : ''}</span>
                </div>
              `;
            })
            .join('')}
        </div>
        `
        : `<div class="cenet-empty-box">Sin actividad registrada en la ventana de ${windowDays} días.</div>`;

    const defaultActiveTab =
      summary.narrativa_ciudadana.length > 0 || summary.narrativa_oficial.length === 0
        ? 'ciudadana'
        : 'oficial';

    drawerBody.innerHTML = `
      <!-- Cabecera del cajón -->
      <div class="cenet-drawer__header">
        <div style="min-width:0; flex:1;">
          <div class="cenet-drawer__eyebrow">
            <span>${isFixture ? 'Muestra Demo' : 'Consulta en vivo'}</span>
            <span>·</span>
            <span>${escapeHtml(modeDisplay)}</span>
          </div>
          <h2 class="cenet-drawer__title">${escapeHtml(readableScope)}</h2>
          <div class="cenet-drawer__meta">
            <span class="cenet-meta-tag">Tema: <strong>${escapeHtml(usedTopic)}</strong></span>
            <span class="cenet-meta-tag cenet-meta-tag--mono" title="Fecha de la corrida">${LUCIDE_SVG.clock}<span>${escapeHtml(formatCorridaDate(summary.fecha_corrida))}</span></span>
          </div>
        </div>
        <button type="button" class="cenet-close-btn" id="cenet-panel-close" aria-label="Cerrar panel de resultados">
          ${LUCIDE_SVG.close}
        </button>
      </div>

      ${noDataBannerHtml}

      <!-- 1. 4 Tarjetas KPI (posts en fuente, relevantes tras filtro, % oficial, sentimiento ciudadano) -->
      <section class="cenet-kpi-grid" aria-label="Indicadores principales de la búsqueda">
        <div class="cenet-kpi-card">
          <div class="cenet-kpi-card__top">
            <span>Posts en fuente</span>
            ${LUCIDE_SVG.layers}
          </div>
          <div class="cenet-kpi-card__val" data-count-to="${postsFuente}" data-count-decimals="0">0</div>
          <span class="cenet-kpi-card__sub">Filtro tema: ${postsFiltroTema}</span>
        </div>

        <div class="cenet-kpi-card">
          <div class="cenet-kpi-card__top">
            <span>Relevantes</span>
            ${LUCIDE_SVG.checkCircle}
          </div>
          <div class="cenet-kpi-card__val cenet-kpi-card__val--mint" data-count-to="${summary.relevantes_posts}" data-count-decimals="0">0</div>
          <span class="cenet-kpi-card__sub">De ${postsFiltroTema} con el tema</span>
        </div>

        <div class="cenet-kpi-card">
          <div class="cenet-kpi-card__top">
            <span>% Oficial</span>
            ${LUCIDE_SVG.building}
          </div>
          <div class="cenet-kpi-card__val cenet-kpi-card__val--cyan" data-count-to="${summary.porcentaje_oficial}" data-count-decimals="1" data-count-suffix="%">0%</div>
          <span class="cenet-kpi-card__sub">${summary.oficiales_posts ?? 0} publicaciones</span>
        </div>

        <div class="cenet-kpi-card">
          <div class="cenet-kpi-card__top">
            <span>Sentimiento ciudadano</span>
            ${LUCIDE_SVG.activity}
          </div>
          <div class="cenet-kpi-card__val" style="color:${citizenKpiColor};" data-count-to="${citizenKpiVal}" data-count-decimals="0" data-count-suffix="%">0%</div>
          <span class="cenet-kpi-card__sub">${escapeHtml(citizenKpiLabel)}</span>
        </div>
      </section>

      <!-- 2. Gráfica de Volumen por día (14 días) -->
      <section class="cenet-card">
        <div class="cenet-card__title">
          <span class="cenet-card__title-left">${LUCIDE_SVG.barChart}<span>Volumen por día (${windowDays}d)</span></span>
          <span class="cenet-card__badge">Pico: ${peakPostsDay} posts/día</span>
        </div>
        ${dailyChartHtml}
      </section>

      <!-- 3. Sentimiento y Categorías -->
      <section class="cenet-card">
        <div class="cenet-card__title">
          <span class="cenet-card__title-left">${LUCIDE_SVG.pieChart}<span>Sentimiento y categorías</span></span>
          <span class="cenet-card__badge">Medios y ciudadanía</span>
        </div>
        ${
          hasSentimentPosts
            ? `
            <div class="cenet-sent-bar" role="img" aria-label="Sentimiento: Positivo ${sent.positive}%, Neutro ${sent.neutral}%, Negativo ${sent.negative}%">
              <div class="cenet-sent-bar__seg cenet-sent-bar__pos" style="width:${sent.positive}%"></div>
              <div class="cenet-sent-bar__seg cenet-sent-bar__neu" style="width:${sent.neutral}%"></div>
              <div class="cenet-sent-bar__seg cenet-sent-bar__neg" style="width:${sent.negative}%"></div>
            </div>
            <div class="cenet-sent-legend">
              <span class="cenet-sent-pos">Positivo ${sent.positive}%</span>
              <span class="cenet-sent-neu">Neutro ${sent.neutral}%</span>
              <span class="cenet-sent-neg">Negativo ${sent.negative}%</span>
            </div>
            `
            : `<div class="cenet-empty-box">Sin publicaciones ciudadanas o de medios para desglosar sentimiento.</div>`
        }

        ${
          summary.categorias.length
            ? `
            <div class="cenet-cat-list" style="margin-top:4px; padding-top:8px; border-top:1px solid var(--glass-border);">
              ${summary.categorias
                .map(
                  (c) => `
                  <div class="cenet-cat-row">
                    <div class="cenet-cat-row__head">
                      <span class="cenet-cat-row__name">${escapeHtml(c.categoria)}</span>
                      <span class="cenet-cat-row__nums">${c.count} · ${c.porcentaje}%</span>
                    </div>
                    <div class="cenet-cat-row__track">
                      <div class="cenet-cat-row__fill" style="width:${Math.max(4, c.porcentaje)}%"></div>
                    </div>
                  </div>
                `
                )
                .join('')}
            </div>
            `
            : ''
        }
      </section>

      <!-- 4. Narrativas ("Oficial y afín" | "Medios y ciudadanía") + Posts -->
      <section class="cenet-card">
        <div class="cenet-card__title">
          <span class="cenet-card__title-left">${LUCIDE_SVG.messageSquare}<span>Narrativas detectadas</span></span>
        </div>

        <div class="cenet-tabs" role="tablist" aria-label="Tipo de narrativa">
          <button
            type="button"
            class="cenet-tab-btn ${defaultActiveTab === 'ciudadana' ? 'is-active' : ''}"
            role="tab"
            aria-selected="${defaultActiveTab === 'ciudadana' ? 'true' : 'false'}"
            data-nar-tab="ciudadana"
          >
            <span>Medios y ciudadanía</span>
            <span class="cenet-tab-btn__count">${summary.narrativa_ciudadana.length}</span>
          </button>
          <button
            type="button"
            class="cenet-tab-btn ${defaultActiveTab === 'oficial' ? 'is-active' : ''}"
            role="tab"
            aria-selected="${defaultActiveTab === 'oficial' ? 'true' : 'false'}"
            data-nar-tab="oficial"
          >
            <span>Oficial y afín</span>
            <span class="cenet-tab-btn__count">${summary.narrativa_oficial.length}</span>
          </button>
        </div>

        <div class="cenet-tab-pane" id="cenet-pane-ciudadana" role="tabpanel" ${defaultActiveTab === 'ciudadana' ? '' : 'hidden'}>
          <div class="cenet-post-list">
            ${
              summary.narrativa_ciudadana.length
                ? summary.narrativa_ciudadana.map(renderNarrativeCard).join('')
                : '<div class="cenet-empty-box">Sin narrativas de medios o ciudadanía en este corte.</div>'
            }
          </div>
        </div>

        <div class="cenet-tab-pane" id="cenet-pane-oficial" role="tabpanel" ${defaultActiveTab === 'oficial' ? '' : 'hidden'}>
          <div class="cenet-post-list">
            ${
              summary.narrativa_oficial.length
                ? summary.narrativa_oficial.map(renderNarrativeCard).join('')
                : '<div class="cenet-empty-box">Sin narrativas oficiales o afines en este corte.</div>'
            }
          </div>
        </div>
      </section>

      ${
        summary.posts_recientes.length
          ? `
          <section class="cenet-card">
            <div class="cenet-card__title">
              <span class="cenet-card__title-left">${LUCIDE_SVG.layers}<span>Publicaciones recientes</span></span>
              <span class="cenet-card__badge">${summary.posts_recientes.length}</span>
            </div>
            <div class="cenet-post-list">
              ${summary.posts_recientes.map(renderPostCard).join('')}
            </div>
          </section>
          `
          : ''
      }

      ${summary.persona ? renderPersonaSection(summary) : ''}
      ${summary.por_confirmar?.length ? `<section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left"><span>Por confirmar</span></span><span class="cenet-card__badge">${summary.por_confirmar.length}</span></div><p style="font-size:0.74rem;color:var(--text-secondary);">No se pudo asegurar que traten de la persona: no entran a las cifras.</p><div class="cenet-post-list">${summary.por_confirmar.map(renderPostCard).join('')}</div></section>` : ''}
    `;

    animateNumbersInContainer(drawerBody);

    // Interacción de pestañas de narrativas
    const tabBtns = drawerBody.querySelectorAll<HTMLButtonElement>('[data-nar-tab]');
    const paneCiudadana = drawerBody.querySelector<HTMLElement>('#cenet-pane-ciudadana');
    const paneOficial = drawerBody.querySelector<HTMLElement>('#cenet-pane-oficial');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.narTab;
        tabBtns.forEach((b) => {
          const active = b.dataset.narTab === target;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (paneCiudadana) paneCiudadana.hidden = target !== 'ciudadana';
        if (paneOficial) paneOficial.hidden = target !== 'oficial';
      });
    });

    document.getElementById('cenet-panel-close')?.addEventListener('click', () => {
      closeDrawer();
      map.resize();
    });
  }

  function showTerritoryTooltip(x: number, y: number, props: Record<string, unknown>): void {
    if (!tooltipEl) return;
    const nombre = String(props.nombre || '');
    const abrev = String(props.abrev || '');
    const hasReal = Boolean(props.hasRealSearch);
    const volume = Number(props.volume || 0);
    const pos = Number(props.positivePct || 0);
    const neg = Number(props.negativePct || 0);

    tooltipEl.hidden = false;
    tooltipEl.style.left = `${Math.min(window.innerWidth - 210, x + 10)}px`;
    tooltipEl.style.top = `${Math.max(54, y)}px`;
    tooltipEl.innerHTML = `
      <div class="cenet-tooltip__head">
        <span>${escapeHtml(nombre)}</span>
        ${abrev ? `<span class="cenet-tooltip__abrev">${escapeHtml(abrev)}</span>` : ''}
      </div>
      ${
        hasReal
          ? `
          <div class="cenet-tooltip__row">
            <span>Relevantes</span>
            <strong class="cenet-num">${volume.toLocaleString('es-MX')}</strong>
          </div>
          <div class="cenet-tooltip__row">
            <span>Sentimiento</span>
            <span class="cenet-num">+${pos}% / -${neg}%</span>
          </div>
          `
          : `
          <div class="cenet-tooltip__row">
            <span>Seleccionar territorio</span>
          </div>
          `
      }
    `;
  }

  function showWorldCountryTooltip(x: number, y: number, countryName: string): void {
    if (!tooltipEl) return;
    tooltipEl.hidden = false;
    tooltipEl.style.left = `${Math.min(window.innerWidth - 200, x + 10)}px`;
    tooltipEl.style.top = `${Math.max(54, y)}px`;
    tooltipEl.innerHTML = `
      <div class="cenet-tooltip__head">
        <span>${escapeHtml(countryName)}</span>
      </div>
    `;
  }

  function hideTooltip(): void {
    if (tooltipEl) tooltipEl.hidden = true;
  }

  function setHoverFilters(munKey: string, stateKey: string): void {
    const munFilter: maplibregl.FilterSpecification = ['==', ['get', 'feature_key'], munKey];
    const stFilter: maplibregl.FilterSpecification = ['==', ['get', 'feature_key'], stateKey];
    if (map.getLayer('muns-hover-fill')) map.setFilter('muns-hover-fill', munFilter);
    if (map.getLayer('muns-hover-line')) map.setFilter('muns-hover-line', munFilter);
    if (map.getLayer('muns-hover-glow')) map.setFilter('muns-hover-glow', munFilter);
    if (map.getLayer('states-hover-fill')) map.setFilter('states-hover-fill', stFilter);
    if (map.getLayer('states-hover-line')) map.setFilter('states-hover-line', stFilter);
    if (map.getLayer('states-hover-glow')) map.setFilter('states-hover-glow', stFilter);
  }

  function setWorldHoverFilter(iso3: string): void {
    const worldFilter: maplibregl.FilterSpecification = ['==', ['get', 'iso_a3'], iso3];
    if (map.getLayer('world-countries-hover-fill')) map.setFilter('world-countries-hover-fill', worldFilter);
    if (map.getLayer('world-countries-hover-line')) map.setFilter('world-countries-hover-line', worldFilter);
  }

  function bindMapInteractions(): void {
    map.on('mousemove', 'muns-fill', (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      map.getCanvas().style.cursor = 'pointer';
      const key = String(feat.properties?.feature_key || '');
      if (hoveredMunKey !== key || hoveredStateKey !== null) {
        hoveredMunKey = key;
        hoveredStateKey = null;
        setHoverFilters(key, '');
      }
      if (hoveredWorldIso) {
        hoveredWorldIso = null;
        setWorldHoverFilter('');
      }
      showTerritoryTooltip(e.originalEvent.clientX, e.originalEvent.clientY, feat.properties || {});
    });

    map.on('mouseleave', 'muns-fill', () => {
      map.getCanvas().style.cursor = '';
      hoveredMunKey = null;
      setHoverFilters('', hoveredStateKey || '');
      hideTooltip();
    });

    map.on('mousemove', 'states-fill', (e: maplibregl.MapLayerMouseEvent) => {
      const munFeats = map.queryRenderedFeatures(e.point, { layers: ['muns-fill'] });
      if (munFeats.length > 0) return;

      const feat = e.features?.[0];
      if (!feat) return;
      map.getCanvas().style.cursor = 'pointer';
      const key = String(feat.properties?.feature_key || '');
      if (hoveredStateKey !== key) {
        hoveredStateKey = key;
        setHoverFilters('', key);
      }
      if (hoveredWorldIso) {
        hoveredWorldIso = null;
        setWorldHoverFilter('');
      }
      showTerritoryTooltip(e.originalEvent.clientX, e.originalEvent.clientY, feat.properties || {});
    });

    map.on('mouseleave', 'states-fill', () => {
      map.getCanvas().style.cursor = '';
      hoveredStateKey = null;
      setHoverFilters(hoveredMunKey || '', '');
      hideTooltip();
    });

    map.on('mousemove', 'world-countries-fill', (e: maplibregl.MapLayerMouseEvent) => {
      const mxFeats = map.queryRenderedFeatures(e.point, { layers: ['muns-fill', 'states-fill'] });
      if (mxFeats.length > 0) return;

      const feat = e.features?.[0];
      if (!feat) return;
      map.getCanvas().style.cursor = 'default';
      const iso3 = String(feat.properties?.iso_a3 || '');
      const nombrePais = String(feat.properties?.nombre || feat.properties?.name_en || 'País');
      if (hoveredWorldIso !== iso3) {
        hoveredWorldIso = iso3;
        setWorldHoverFilter(iso3);
      }
      showWorldCountryTooltip(e.originalEvent.clientX, e.originalEvent.clientY, nombrePais);
    });

    map.on('mouseleave', 'world-countries-fill', () => {
      hoveredWorldIso = null;
      setWorldHoverFilter('');
      hideTooltip();
    });

    map.on('click', 'muns-fill', (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const munId = String(feat.properties?.municipio_id || '');
      const estId = String(feat.properties?.estado_id || scope.estado_id || '');
      if (!munId) return;

      applyScopeSelection(
        {
          nivel: 'municipio',
          estado_id: estId,
          municipio_id: munId,
        },
        true
      );
    });

    map.on('click', 'states-fill', (e: maplibregl.MapLayerMouseEvent) => {
      const munFeats = map.queryRenderedFeatures(e.point, { layers: ['muns-fill'] });
      if (munFeats.length > 0) return;

      const feat = e.features?.[0];
      if (!feat) return;
      const estId = String(feat.properties?.estado_id || '');
      if (!estId) return;

      applyScopeSelection(
        {
          nivel: 'estado',
          estado_id: estId,
          municipio_id: null,
        },
        true
      );
    });
  }

  /**
   * Carga las capas geográficas iniciales sin disparar búsqueda ni llamada al backend.
   * Mantiene el globo girando suavemente en el estado vacío inicial.
   */
  async function loadInitialCartography(): Promise<void> {
    try {
      const [worldRaw, statesRaw] = await Promise.all([
        fetchGeoJson(config.country.worldCountriesGeoJsonUrl).catch(() => ({
          type: 'FeatureCollection',
          features: [],
        } as GeoJSON.FeatureCollection)),
        fetchGeoJson(config.country.statesGeoJsonUrl),
      ]);

      worldCountriesFc = worldRaw;
      const worldSrc = map.getSource('world-countries-src') as maplibregl.GeoJSONSource | undefined;
      if (worldSrc && worldCountriesFc) {
        worldSrc.setData(worldCountriesFc);
      }

      const normFeatures: GeoJSON.Feature[] = (statesRaw.features || []).map((f) => {
        const norm = normalizeFeatureProps(f);
        return {
          type: 'Feature',
          properties: norm,
          geometry: f.geometry,
        };
      });

      statesRawFc = { type: 'FeatureCollection', features: normFeatures };
      statesCatalog.clear();

      for (const f of normFeatures) {
        const p = f.properties as unknown as NormalizedTerritoryProps;
        if (f.geometry) {
          statesCatalog.set(p.estado_id, {
            estado_id: p.estado_id,
            nombre: p.nombre,
            slug: p.slug || toSlug(p.nombre),
            abrev: p.abrev || p.nombre.slice(0, 4).toUpperCase(),
            bbox: computeFeatureBBox(f.geometry),
            feature: f,
          });
        }
      }

      populateEstadoSelect();
      populateMunicipioSelect();
      refreshStatesSource();

      // Solo carga catálogos si ya hay un estado elegido (al iniciar no hay ninguno)
      if (scope.estado_id && statesCatalog.has(scope.estado_id)) {
        await applyScopeSelection(scope, false);
      }
      setStatus('ready');
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Fallo al inicializar la cartografía.');
    }
  }

  /** Pinta el resumen (mapa + panel) igual que al terminar una búsqueda; también lo usa el historial. */
  function mostrarResumen(
    summary: SocialApiSummary,
    searchScope: ScopeSelection,
    topic: string,
    mode: SearchMode,
    readable: string,
    zoom = true
  ): void {
    lastSearchSummary = summary;

    realStateVolumes.clear();
    realMunVolumes.clear();
    const vol = summary.relevantes_posts;
    const volNorm = vol > 0 ? Math.min(100, Math.max(28, vol * 8)) : 0;

    if (searchScope.nivel === 'municipio' && searchScope.municipio_id && vol > 0) {
      realMunVolumes.set(searchScope.municipio_id, {
        volume: vol,
        volumeNorm: volNorm,
        pos: summary.sentimiento.positive,
        neg: summary.sentimiento.negative,
      });
    }
    if (searchScope.estado_id && vol > 0) {
      realStateVolumes.set(searchScope.estado_id, {
        volume: vol,
        volumeNorm: volNorm,
        pos: summary.sentimiento.positive,
        neg: summary.sentimiento.negative,
      });
    }

    // Mostrar la leyenda compacta ("Bajo — Alto") únicamente cuando hay resultados
    if (legendEl) {
      legendEl.hidden = vol <= 0;
    }

    refreshStatesSource();
    refreshCurrentMunsSource();
    setStatus('ready');
    if (zoom) zoomToCurrentScope();

    renderSearchSummaryPanel(summary, topic, mode, readable);
  }

  /**
   * Ejecuta la búsqueda SOLO por acción explícita del usuario.
   */
  async function executeExplicitSearch(): Promise<void> {
    if (searchInFlight) return;
    if (!scopeElegido) {
      toggleScopePopover(true);
      return;
    }

    const rawTopic = (topicInput?.value || '').trim();
    if (!rawTopic) {
      topicInput?.focus();
      return;
    }

    currentTopic = rawTopic;
    closeScopePopover();
    stopGlobeSpin();

    // Si FACEBOOK_FIXTURE=false, mostrar confirmación corta antes de consumir créditos de Apify
    const health = await checkBackendSearchMode(config.apiUrl, config.facebookFixture, config.apifyMaxPosts);
    updateSourcePill(!health.facebook_fixture);
    if (!health.facebook_fixture) {
      const confirmed = window.confirm(
        `Esta búsqueda consumirá créditos de Apify (máx. ${health.apify_max_posts} resultados)`
      );
      if (!confirmed) {
        return;
      }
    }

    if (currentMode === 'persona' && !health.facebook_fixture) {
      if (fichaSel?.tipo === 'persona' && fichaSel.paginas_oficiales.length) {
        // La ficha ya tiene páginas oficiales: se consultan siempre y no hace falta elegir página.
        void analizarPagina(fichaSel.nombre, { nombre: fichaSel.nombre, url: fichaSel.paginas_oficiales[0], categoria: '', seguidores: 0 }, fichaSel.id);
        return;
      }
      if (await buscarPerfiles(currentTopic)) return;
    }

    const searchScope: ScopeSelection = {
      ...scope,
      nombre: resolvePlaceShortName(scope),
      texto: resolveReadableScopeText(scope),
    };
    const readableScope = resolveReadableScopeText(searchScope);

    setSearchLoadingUi(true);
    renderDrawerSkeleton(currentTopic, readableScope);

    try {
      const summary = await fetchSocialSearchSummary({
        apiUrl: config.apiUrl,
        apiToken: config.apiToken,
        tema: currentTopic,
        modo: currentMode,
        alcance: searchScope,
      });

      mostrarResumen(summary, searchScope, currentTopic, currentMode, readableScope);
      void cargarHistorial();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al ejecutar la búsqueda.';
      setStatus('error', msg);
    } finally {
      setSearchLoadingUi(false);
    }
  }

  // Eventos del formulario de comando
  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    executeExplicitSearch();
  });

  // Segmentos de Modo (Tema | Persona | Tendencias)
  segmentedBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = (btn.dataset.mode as SearchMode) || 'tema';
      syncModeSegmentedUi(m);
    });
  });

  selModo?.addEventListener('change', () => {
    syncModeSegmentedUi(((selModo.value as SearchMode) || 'tema'));
  });

  // 3 ejemplos de tema clicables en el estado vacío inicial
  exampleChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const topic = chip.dataset.exampleTopic || '';
      if (topicInput && topic) {
        topicInput.value = topic;
        executeExplicitSearch();
      }
    });
  });

  // Ruta clicable (breadcrumb) y popover de alcance
  function toggleScopePopover(forceOpen?: boolean): void {
    if (!scopePopover) return;
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : scopePopover.hidden;
    scopePopover.hidden = !nextOpen;
    scopeToggleBtn?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    crumbEstado?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    crumbMun?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  }

  function closeScopePopover(): void {
    toggleScopePopover(false);
  }

  crumbPais?.addEventListener('click', () => {
    applyScopeSelection({ nivel: 'pais', estado_id: null, municipio_id: null }, true);
  });

  crumbEstado?.addEventListener('click', () => {
    toggleScopePopover(true);
    selEstado?.focus();
  });

  crumbMun?.addEventListener('click', () => {
    toggleScopePopover(true);
    selMunicipio?.focus();
  });

  scopeToggleBtn?.addEventListener('click', () => {
    toggleScopePopover();
  });

  popoverCloseBtn?.addEventListener('click', () => {
    closeScopePopover();
  });

  document.addEventListener('click', (e) => {
    if (!scopePopover || scopePopover.hidden) return;
    const target = e.target as Node;
    if (breadcrumbWrap && !breadcrumbWrap.contains(target)) {
      closeScopePopover();
    }
  });

  selNivel?.addEventListener('change', () => {
    const nuevoNivel = selNivel.value as ScopeLevel;
    if (nuevoNivel === 'pais') {
      applyScopeSelection({ nivel: 'pais', estado_id: null, municipio_id: null }, true);
    } else if (nuevoNivel === 'estado' && scope.estado_id) {
      applyScopeSelection({ nivel: 'estado', estado_id: scope.estado_id, municipio_id: null }, true);
    } else if (nuevoNivel === 'municipio' && scope.estado_id) {
      loadMunicipiosForState(scope.estado_id).then(populateMunicipioSelect);
    }
    // Sin estado elegido no se asume ninguno: el usuario lo elige en el selector de Estado.
  });

  selPais?.addEventListener('change', () => {
    if (selPais.value) applyScopeSelection({ nivel: 'pais', estado_id: null, municipio_id: null }, true);
  });

  selEstado?.addEventListener('change', () => {
    const estId = selEstado.value || null;
    if (!estId) {
      applyScopeSelection({ nivel: 'pais', estado_id: null, municipio_id: null }, true);
    } else {
      applyScopeSelection({ nivel: 'estado', estado_id: estId, municipio_id: null }, true);
    }
  });

  selMunicipio?.addEventListener('change', () => {
    const munId = selMunicipio.value || null;
    if (!munId) {
      applyScopeSelection({ nivel: 'estado', estado_id: scope.estado_id, municipio_id: null }, true);
    } else {
      applyScopeSelection({ nivel: 'municipio', estado_id: scope.estado_id, municipio_id: munId }, true);
    }
  });

  // Hoja inferior arrastrable en móvil (bottom sheet handle)
  if (drawerHandle && drawerEl) {
    let startY = 0;
    let dragging = false;

    drawerHandle.addEventListener('click', () => {
      drawerEl.classList.toggle('is-collapsed');
    });

    drawerHandle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        drawerEl.classList.toggle('is-collapsed');
      }
    });

    drawerHandle.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      dragging = true;
      drawerHandle.setPointerCapture(e.pointerId);
    });

    drawerHandle.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = e.clientY - startY;
      if (dy > 45) {
        drawerEl.classList.add('is-collapsed');
      } else if (dy < -35) {
        drawerEl.classList.remove('is-collapsed');
      }
    });
  }

  // Botón de cambio de tema (oscuro / claro)
  themeBtn?.addEventListener('click', () => {
    themeMode = themeMode === 'dark' ? 'light' : 'dark';
    theme = getMapTheme(themeMode);
    applyThemeCssVariables(theme);
    document.body.classList.toggle('light-mode', themeMode === 'light');
    if (themeLabel) themeLabel.textContent = themeMode === 'dark' ? 'Claro' : 'Oscuro';
    if (themeIcon) {
      themeIcon.outerHTML =
        themeMode === 'dark'
          ? LUCIDE_SVG.sun.replace('class="cenet-icon"', 'class="cenet-icon" id="cenet-theme-icon"')
          : LUCIDE_SVG.moon.replace('class="cenet-icon"', 'class="cenet-icon" id="cenet-theme-icon"');
    }

    map.setStyle(buildBaseMapStyle(theme, config.tileSourceUrl));
    map.once('styledata', () => {
      applyAtmosphere();
      ensureMapLayers();
      const worldSrc = map.getSource('world-countries-src') as maplibregl.GeoJSONSource | undefined;
      if (worldSrc && worldCountriesFc) {
        worldSrc.setData(worldCountriesFc);
      }
      refreshStatesSource();
      refreshCurrentMunsSource();
      updateScopeAttenuation();
    });
  });

  let mapInitialized = false;
  async function initMapOnce(): Promise<void> {
    if (mapInitialized) return;
    mapInitialized = true;
    applyAtmosphere();
    ensureMapLayers();
    bindMapInteractions();
    await loadInitialCartography();
    if (globeSpinning && spinFrameId === null && !prefersReducedMotion()) {
      spinFrameId = requestAnimationFrame(spinStep);
    }
  }

  map.on('style.load', () => {
    initMapOnce();
  });

  map.on('load', () => {
    initMapOnce();
  });
}

createCeNetworkApp();
