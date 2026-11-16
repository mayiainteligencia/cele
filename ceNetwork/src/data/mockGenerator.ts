import type {
  MockComment,
  NormalizedTerritoryProps,
  TerritorySocialData,
  TopicItem,
  HourlyPoint,
} from '../types';

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedStr: string): () => number {
  let a = hashSeed(seedStr) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLATFORMS: MockComment['platform'][] = ['X', 'TikTok', 'Facebook', 'Instagram', 'Reddit'];

const AUTHORS = [
  ['Valeria Méndez', '@val_mendez'],
  ['Carlos Ruiz', '@cruiz_opina'],
  ['Observatorio Ciudadano', '@obs_ciudadano'],
  ['Mariana Torres', '@marianat_mx'],
  ['Jorge Hernández', '@jorgehdz_voz'],
  ['Sofía Alarcón', '@sofi_alarcon'],
  ['Red Vecinal Activa', '@redvecinal'],
  ['Diego Castellanos', '@dcastellanos'],
  ['Elena Vargas', '@elena_vargas'],
  ['Pulso Local', '@pulsolocal_info'],
];

const COMMENT_TEMPLATES: { sent: MockComment['sentiment']; tpl: (topic: string, place: string) => string }[] = [
  {
    sent: 'pos',
    tpl: (t, p) => `En ${p} ya se nota movimiento real sobre "${t}". Qué bueno que por fin esté en la agenda pública esta semana.`,
  },
  {
    sent: 'neg',
    tpl: (t, p) => `Llevamos meses pidiendo atención a "${t}" en ${p} y todavía faltan respuestas concretas en las colonias.`,
  },
  {
    sent: 'neu',
    tpl: (t, p) => `Hoy se abrió el debate sobre "${t}" en medios locales de ${p}; habrá que ver los indicadores del próximo corte.`,
  },
  {
    sent: 'pos',
    tpl: (t, p) => `Gran participación ciudadana en ${p} conversando de "${t}". Los videos cortos están teniendo muchísimo alcance orgánico.`,
  },
  {
    sent: 'neg',
    tpl: (t, p) => `Urge priorizar "${t}" en ${p}. En grupos vecinales es el tema número uno de conversación desde ayer.`,
  },
  {
    sent: 'neu',
    tpl: (t, p) => `Comparando cifras de "${t}" en ${p}, la conversación subió 28% respecto al promedio de la última quincena.`,
  },
  {
    sent: 'pos',
    tpl: (t, p) => `Excelente cobertura comunitaria en ${p} respecto a "${t}", la propuesta técnica fue muy bien recibida.`,
  },
];

export function computeFeatureBBox(geometry: GeoJSON.Geometry): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lon = coords[0];
      const lat = coords[1];
      if (lon < minX) minX = lon;
      if (lat < minY) minY = lat;
      if (lon > maxX) maxX = lon;
      if (lat > maxY) maxY = lat;
      return;
    }
    for (const c of coords) visit(c);
  };

  if ('coordinates' in geometry) {
    visit(geometry.coordinates);
  }
  if (!Number.isFinite(minX)) return [-102.5, 23.6, -102.5, 23.6];
  return [minX, minY, maxX, maxY];
}

export function computeFeatureCenter(geometry: GeoJSON.Geometry): [number, number] {
  // Elegir el anillo con más vértices para evitar que islas pequeñas desvíen la etiqueta
  let bestRing: number[][] | null = null;
  if (geometry.type === 'Polygon') {
    bestRing = geometry.coordinates[0] || null;
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      if (ring && (!bestRing || ring.length > bestRing.length)) {
        bestRing = ring;
      }
    }
  }
  if (bestRing && bestRing.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const pt of bestRing) {
      sx += pt[0];
      sy += pt[1];
    }
    return [sx / bestRing.length, sy / bestRing.length];
  }
  const [minX, minY, maxX, maxY] = computeFeatureBBox(geometry);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Genera métricas mock deterministas para cualquier conjunto de polígonos (estados o municipios)
 * y tema buscado, sin acoplar a ningún país fijo.
 */
export function generateSocialMockForFeatures(
  fc: GeoJSON.FeatureCollection,
  topicQuery: string
): {
  enrichedGeoJson: GeoJSON.FeatureCollection;
  labelsGeoJson: GeoJSON.FeatureCollection;
  byId: Map<string, TerritorySocialData>;
  totalVolume: number;
} {
  const cleanTopic = (topicQuery || 'Conversación general').trim();
  const byId = new Map<string, TerritorySocialData>();
  const rawVolumes: { id: string; vol: number }[] = [];

  for (const feat of fc.features) {
    const props = (feat.properties || {}) as unknown as NormalizedTerritoryProps;
    const id = props.municipio_id || props.estado_id || props.nombre;
    const rng = createRng(`${cleanTopic}::${id}`);
    const base = props.municipio_id ? 350 : 4200;
    const spread = props.municipio_id ? 4800 : 48000;
    const vol = Math.round(base + Math.pow(rng(), 1.35) * spread);
    rawVolumes.push({ id, vol });
  }

  const minVol = Math.min(...rawVolumes.map((r) => r.vol), 0);
  const maxVol = Math.max(...rawVolumes.map((r) => r.vol), 1);
  let totalVolume = 0;

  const enrichedFeatures: GeoJSON.Feature[] = [];
  const labelFeatures: GeoJSON.Feature[] = [];

  const topicWords = cleanTopic
    .split(/[\s,.;:/]+/)
    .map((w) => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/g, ''))
    .filter((w) => w.length >= 3);
  const rootWord = topicWords[0] || 'Pulso';

  fc.features.forEach((feat, idx) => {
    const props = (feat.properties || {}) as unknown as NormalizedTerritoryProps;
    const id = props.municipio_id || props.estado_id || `f-${idx}`;
    const rng = createRng(`${cleanTopic}::detail::${id}`);
    const vol = rawVolumes[idx].vol;
    totalVolume += vol;

    const volumeNorm = maxVol > minVol
      ? Math.round(((vol - minVol) / (maxVol - minVol)) * 100)
      : 50;

    const pos = Math.round(25 + rng() * 48);
    const neg = Math.round(10 + rng() * Math.min(45, 85 - pos));
    const neu = Math.max(0, 100 - pos - neg);

    const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
      const wave = Math.sin(((h - 7) / 24) * Math.PI * 2) * 0.42 + 0.58;
      const factor = (0.55 + rng() * 0.65) * wave;
      return {
        hour: `${String(h).padStart(2, '0')}:00`,
        volume: Math.max(5, Math.round((vol / 24) * factor)),
      };
    });

    const subTags = [
      `#${rootWord}EnVivo`,
      `${props.nombre} ${rootWord}`,
      `Propuestas ${cleanTopic.slice(0, 22)}`,
      `Reporte ciudadano ${props.abrev || props.nombre.slice(0, 10)}`,
      `Tendencia ${rootWord} 2026`,
    ];

    const topics: TopicItem[] = subTags.map((tag, tIdx) => {
      const share = Math.round(vol * (0.34 - tIdx * 0.055) * (0.85 + rng() * 0.3));
      const delta = Math.round(-8 + rng() * 44);
      return {
        tag,
        volume: Math.max(12, share),
        trend: `${delta >= 0 ? '+' : ''}${delta}%`,
      };
    });

    const comments: MockComment[] = Array.from({ length: 5 }, (_, cIdx) => {
      const pick = Math.floor(rng() * COMMENT_TEMPLATES.length);
      const tpl = COMMENT_TEMPLATES[(pick + cIdx) % COMMENT_TEMPLATES.length];
      const [author, handle] = AUTHORS[(idx + cIdx * 2) % AUTHORS.length];
      const platform = PLATFORMS[(idx + cIdx) % PLATFORMS.length];
      const mins = Math.round(4 + cIdx * 13 + rng() * 25);
      return {
        id: `${id}-c-${cIdx}`,
        author,
        handle,
        platform,
        timeAgo: mins < 60 ? `hace ${mins} min` : `hace ${Math.floor(mins / 60)} h`,
        sentiment: tpl.sent,
        text: tpl.tpl(cleanTopic, props.nombre),
      };
    });

    const socialData: TerritorySocialData = {
      id,
      estado_id: props.estado_id,
      municipio_id: props.municipio_id || null,
      nombre: props.nombre,
      abrev: props.abrev,
      volume: vol,
      volumeNorm,
      sentiment: { positive: pos, neutral: neu, negative: neg },
      hourly,
      topics,
      comments: comments as TerritorySocialData['comments'],
    };

    byId.set(id, socialData);

    enrichedFeatures.push({
      type: 'Feature',
      id: idx + 1,
      properties: {
        ...props,
        feature_key: id,
        volume: vol,
        volumeNorm,
        positivePct: pos,
        neutralPct: neu,
        negativePct: neg,
      },
      geometry: feat.geometry,
    });

    if (feat.geometry) {
      const center = computeFeatureCenter(feat.geometry);
      labelFeatures.push({
        type: 'Feature',
        properties: {
          feature_key: id,
          estado_id: props.estado_id,
          municipio_id: props.municipio_id || null,
          nombre: props.nombre,
          label: props.abrev || props.nombre.slice(0, 4).toUpperCase(),
          volume: vol,
          volumeNorm,
        },
        geometry: {
          type: 'Point',
          coordinates: center,
        },
      });
    }
  });

  return {
    enrichedGeoJson: { type: 'FeatureCollection', features: enrichedFeatures },
    labelsGeoJson: { type: 'FeatureCollection', features: labelFeatures },
    byId,
    totalVolume,
  };
}

