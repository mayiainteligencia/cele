import type {
  DailyVolumePoint,
  ScopeSelection,
  SearchMode,
  SocialApiCategory,
  SocialApiNarrative,
  SocialApiPost,
  SocialApiSummary,
  PersonaProfile,
  HistorialItem,
  HistorialEntry,
  Entidad,
  Alerta,
  LineaBase,
} from '../types';

interface RawFbItem {
  postId?: string;
  id?: string;
  text?: string;
  time?: string;
  url?: string;
  facebookUrl?: string;
  likes?: number;
  likesCount?: number;
  comments?: number;
  commentsCount?: number;
  shares?: number;
  sharesCount?: number;
  reactionLikeCount?: number;
  reactionLoveCount?: number;
  reactionHahaCount?: number;
  reactionAngryCount?: number;
  reactionCareCount?: number;
  reactionSadCount?: number;
  user?: { id?: string; name?: string; profilePic?: string };
  pageName?: { id?: string; name?: string; profilePic?: string };
  sharedPost?: {
    text?: string;
    url?: string;
    user?: { id?: string; name?: string; profilePic?: string };
    pageName?: { id?: string; name?: string; profilePic?: string };
  };
  link?: string;
  media?: unknown[];
  attachments?: unknown[];
}

export interface BackendHealthInfo {
  reachable: boolean;
  facebook_fixture: boolean;
  apify_max_posts: number;
  max_real_searches_per_hour: number;
}

declare global {
  interface Window {
    __CENET_FB_FIXTURE__?: RawFbItem[];
  }
}

const STOPWORDS_ES = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'del', 'los', 'las',
  'un', 'una', 'unos', 'unas', 'por', 'con', 'para', 'al', 'se', 'su', 'sus',
  'es', 'son', 'o', 'u', 'que', 'como', 'mas', 'pero', 'sin', 'sobre', 'entre',
  'hasta', 'desde', 'ante', 'bajo', 'cabe', 'contra', 'durante', 'mediante',
  'segun', 'so', 'tras', 'hacia', 'lo', 'le', 'les', 'me', 'te', 'nos',
  'mi', 'mis', 'tu', 'tus', 'este', 'esta', 'estos', 'estas', 'ese', 'esa',
  'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'todo', 'toda',
  'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma',
  'ya', 'no', 'si', 'tambien', 'solo', 'muy', 'tan', 'tanto', 'cuando', 'donde',
]);

const OFICIAL_HANDLES = ['100064560255110', 'alcaldía tlalpan', 'alcaldia tlalpan', 'tlalpanal', 'visión policial cdmx', 'vision policial cdmx', 'ssc cdmx'];
const POLITICO_HANDLES = ['100044587330856', 'gabriela osorio', 'gaby osorio', 'gabyosoriomorena', 'clara brugada', 'jesus ulises melgoza mendoza', 'saul magdalenogiles'];
const MEDIO_HANDLES = ['sin embargo mx', 'red central', 'laredcentral', 'noticias tlalpenses', 'el hilo mx', 'denuncias y noticias tlalpan', 'el pueblo manda', 'no mi ciela'];

export function normalizeNoAccents(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function cleanDisplayText(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .normalize('NFKC')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(
      /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{1F1E6}-\u{1F1FF}\uFE00-\uFE0F\u200B-\u200F\u2028-\u202F\u2060-\u206F\u20E3]/gu,
      ''
    )
    .split('\n')
    .map((ln) => ln.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordBoundaryMatch(haystackNorm: string, phraseTokens: string[]): boolean {
  if (!phraseTokens.length) return false;
  const patternStr = `\\b${phraseTokens.map(escapeRegExp).join('\\s+')}\\b`;
  return new RegExp(patternStr, 'i').test(haystackNorm);
}

export function extractTopicWords(tema: string): string[] {
  const norm = normalizeNoAccents(tema);
  const tokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.filter((t) => t.length >= 2 && !STOPWORDS_ES.has(t));
}

/**
 * Evalúa si un post coincide estrictamente con el tema o persona buscada por el usuario:
 * - Solo contra el tema escrito por el usuario (nunca contra alias del lugar ni palabras del alcance).
 * - Modo Persona: nombre completo o, como mínimo, nombre y apellido juntos (>= 2 palabras contiguas).
 * - Modo Tema (y tendencias): ignora palabras vacías y exige TODAS las palabras significativas (o la frase exacta) con límites de palabra (\b).
 */
export function matchesQueryFilter(
  haystackRaw: string,
  tema: string,
  modo: SearchMode
): boolean {
  const temaClean = (tema || '').trim();
  if (!temaClean) return false;

  const haystackNorm = normalizeNoAccents(haystackRaw).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!haystackNorm) return false;

  const rawTokens = normalizeNoAccents(temaClean).split(/[^a-z0-9]+/).filter(Boolean);
  if (!rawTokens.length) return false;

  if (modo === 'persona') {
    const nameTokens = rawTokens.filter((t) => !STOPWORDS_ES.has(t));
    const effectiveTokens = nameTokens.length >= 2 ? nameTokens : rawTokens;
    if (effectiveTokens.length < 2) {
      return false;
    }
    if (hasWordBoundaryMatch(haystackNorm, effectiveTokens)) {
      return true;
    }
    for (let i = 0; i < effectiveTokens.length - 1; i++) {
      if (hasWordBoundaryMatch(haystackNorm, [effectiveTokens[i], effectiveTokens[i + 1]])) {
        return true;
      }
    }
    return false;
  }

  const sigWords = extractTopicWords(temaClean);
  if (!sigWords.length) return false;

  if (hasWordBoundaryMatch(haystackNorm, rawTokens)) {
    return true;
  }

  return sigWords.every((w) => hasWordBoundaryMatch(haystackNorm, [w]));
}

export function isTlalpanScope(alcance: ScopeSelection): boolean {
  const nom = normalizeNoAccents(alcance.nombre || '');
  return (
    alcance.nivel === 'municipio' &&
    (alcance.municipio_id === '09012' || nom.includes('tlalpan'))
  );
}

function detectSourceType(uname: string, uid: string, url: string): 'oficial' | 'politico' | 'medio' | 'ciudadano' {
  const n = uname.toLowerCase();
  const i = uid.toLowerCase();
  const u = url.toLowerCase();
  if (OFICIAL_HANDLES.some((h) => i === h || n.includes(h) || u.includes(h))) return 'oficial';
  if (POLITICO_HANDLES.some((h) => i === h || n.includes(h) || u.includes(h))) return 'politico';
  if (MEDIO_HANDLES.some((h) => i === h || n.includes(h) || u.includes(h))) return 'medio';
  return 'ciudadano';
}

function normalizeForDedup(t: string): string {
  return t
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#\w+/g, ' ')
    .replace(/[^a-záéíóúñü0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areNearIdentical(a: string, b: string): boolean {
  const na = normalizeForDedup(a);
  const nb = normalizeForDedup(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const tokA = new Set(na.split(' ').filter((w) => w.length > 3));
  const tokB = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (tokA.size && tokB.size) {
    let inter = 0;
    tokA.forEach((w) => {
      if (tokB.has(w)) inter++;
    });
    const union = tokA.size + tokB.size - inter;
    if (union > 0 && inter / union >= 0.5) return true;
  }
  const naPlain = normalizeNoAccents(na);
  const nbPlain = normalizeNoAccents(nb);
  if (
    naPlain.includes('percepcion') &&
    naPlain.includes('inseguridad') &&
    nbPlain.includes('percepcion') &&
    nbPlain.includes('inseguridad') &&
    ((naPlain.includes('mayor') && nbPlain.includes('mayor')) || (naPlain.includes('13 7') && nbPlain.includes('13 7')))
  ) {
    return true;
  }
  return false;
}

function loadFixtureViaScript(): Promise<RawFbItem[]> {
  return new Promise((resolve, reject) => {
    if (window.__CENET_FB_FIXTURE__) {
      resolve(window.__CENET_FB_FIXTURE__);
      return;
    }
    const s = document.createElement('script');
    s.src = './data/tlalpan_facebook.js';
    s.onload = () => {
      if (window.__CENET_FB_FIXTURE__) resolve(window.__CENET_FB_FIXTURE__);
      else reject(new Error('Fixture vacío'));
    };
    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = './public/data/tlalpan_facebook.js';
      s2.onload = () => {
        if (window.__CENET_FB_FIXTURE__) resolve(window.__CENET_FB_FIXTURE__);
        else reject(new Error('Fixture vacío'));
      };
      s2.onerror = () => reject(new Error('No se pudo cargar tlalpan_facebook.js'));
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
}

async function loadLocalFixtureRaw(): Promise<RawFbItem[]> {
  if (window.__CENET_FB_FIXTURE__) return window.__CENET_FB_FIXTURE__;
  if (window.location.protocol !== 'file:') {
    for (const p of ['data/tlalpan_facebook.json', 'public/data/tlalpan_facebook.json']) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          const j = (await r.json()) as RawFbItem[];
          if (Array.isArray(j)) return j;
        }
      } catch {
        // continuar
      }
    }
  }
  return loadFixtureViaScript();
}

function buildDailyVolumeSeries(
  relevantes: SocialApiPost[],
  refMs: number,
  maxDays = 14
): { volumen_por_dia: DailyVolumePoint[]; pico_posts_dia: number } {
  if (!relevantes.length) {
    return { volumen_por_dia: [], pico_posts_dia: 0 };
  }
  const mesesEs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const refDate = new Date(refMs);
  const refUtcMidnight = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate());

  const countsByDay = new Map<string, { etiqueta: string; posts: number }>();
  for (let i = maxDays - 1; i >= 0; i--) {
    const d = new Date(refUtcMidnight - i * 86400 * 1000);
    const iso = d.toISOString().slice(0, 10);
    const etiqueta = `${String(d.getUTCDate()).padStart(2, '0')} ${mesesEs[d.getUTCMonth()]}`;
    countsByDay.set(iso, { etiqueta, posts: 0 });
  }

  for (const p of relevantes) {
    const ms = p.time ? Date.parse(p.time) : NaN;
    const d = Number.isFinite(ms) ? new Date(ms) : refDate;
    const iso = d.toISOString().slice(0, 10);
    const entry = countsByDay.get(iso);
    if (entry) {
      entry.posts += 1;
    }
  }

  const volumen_por_dia: DailyVolumePoint[] = [...countsByDay.entries()].map(([fecha, v]) => ({
    fecha,
    etiqueta: v.etiqueta,
    posts: v.posts,
  }));
  const pico_posts_dia = Math.max(...volumen_por_dia.map((d) => d.posts), 0);
  return { volumen_por_dia, pico_posts_dia };
}

function buildClientFallbackFromFixture(
  rawItems: RawFbItem[],
  tema: string,
  modo: SearchMode,
  alcance: ScopeSelection
): SocialApiSummary {
  const maxDays = 14;
  const nowIso = new Date().toISOString();

  // El fixture solo aplica si el alcance es Tlalpan (09012)
  if (!isTlalpanScope(alcance)) {
    return {
      id: 'demo-fuera-alcance',
      cached: false,
      query: { tema, modo, alcance },
      fuente_datos: 'fixture',
      es_fixture: true,
      etiqueta_fuente: 'DATOS DE EJEMPLO (fixture)',
      sin_datos_demo: true,
      mensaje: 'Sin datos en modo demo para este alcance',
      clasificador: 'reglas',
      fecha_corrida: nowIso,
      ventana_dias: maxDays,
      posts_fuente: 0,
      posts_filtro_tema: 0,
      total_posts: 0,
      relevantes_posts: 0,
      ciudadanos_medios_posts: 0,
      oficiales_posts: 0,
      porcentaje_oficial: 0,
      descartados: { por_filtro_tema: 0, por_fecha: 0, por_homonimo: 0, no_relevantes_o_empleo: 0, vacios: 0 },
      volumen: 0,
      interacciones_totales: 0,
      sentimiento: {
        positive: 0,
        neutral: 0,
        negative: 0,
        sin_clasificar: 0,
        universo: 'medio|ciudadano',
        excluye_oficial: true,
      },
      categorias: [],
      narrativa_oficial: [],
      narrativa_ciudadana: [],
      posts_recientes: [],
      volumen_por_dia: [],
      pico_posts_dia: 0,
    };
  }

  const times = rawItems
    .map((r) => (r.time ? Date.parse(r.time) : NaN))
    .filter((n) => Number.isFinite(n));
  const refMs = times.length ? Math.max(...times) : Date.now();
  const cutoffMs = refMs - maxDays * 86400 * 1000;

  const sourceBatch = rawItems.slice(0, 20);
  const postsFuente = sourceBatch.length;

  // Filtrar el fixture estrictamente por el tema/persona escrito por el usuario (con límites de palabra)
  const topicFilteredRaw = sourceBatch.filter((raw) => {
    const primaryText = (raw.text || '').trim();
    const sharedText = (raw.sharedPost?.text || '').trim();
    const uName = raw.user?.name || raw.pageName?.name || '';
    const sName = raw.sharedPost?.user?.name || raw.sharedPost?.pageName?.name || '';
    const haystack = `${primaryText} ${sharedText} ${uName} ${sName}`;
    return matchesQueryFilter(haystack, tema, modo);
  });
  const postsFiltroTema = topicFilteredRaw.length;
  console.info(
    `[socialClient] Filtro fixture (modo='${modo}', tema='${tema}'): posts_fuente=${postsFuente}, posts_filtro_tema=${postsFiltroTema}`
  );

  let descFecha = 0;
  let descHom = 0;
  let descNoRel = 0;
  let descVacios = 0;

  const relevantes: (SocialApiPost & { sharedUserName?: string; hasOwnText?: boolean })[] = [];

  for (const raw of topicFilteredRaw) {
    const primaryText = (raw.text || '').trim();
    const sharedText = (raw.sharedPost?.text || '').trim();
    const fullText = primaryText && sharedText && !primaryText.includes(sharedText)
      ? `${primaryText}\n\n[Publicación compartida]: ${sharedText}`
      : primaryText || sharedText;

    if (!fullText) {
      descVacios++;
      continue;
    }

    const tMs = raw.time ? Date.parse(raw.time) : NaN;
    if (Number.isFinite(tMs) && tMs < cutoffMs) {
      descFecha++;
      continue;
    }

    const tl = fullText.toLowerCase();
    // Homónimo Calzada de Tlalpan sin referencia a la alcaldía
    if (
      tl.includes('calzada de tlalpan') &&
      !tl.includes('alcaldía tlalpan') &&
      !tl.includes('alcaldia tlalpan') &&
      !tl.includes('gaby osorio') &&
      !tl.includes('gabriela osorio')
    ) {
      descHom++;
      continue;
    }

    const userObj = raw.user || raw.pageName || { id: '', name: 'Usuario' };
    const sharedUserObj = raw.sharedPost?.user || raw.sharedPost?.pageName;
    const effectiveUser = !primaryText && sharedUserObj ? sharedUserObj : userObj;
    const uname = String(effectiveUser.name || userObj.name || 'Usuario');
    const uid = String(effectiveUser.id || userObj.id || '');
    const url = String(raw.url || raw.facebookUrl || '');

    // Descartar ofertas de empleo
    if (
      /contrataci[oó]n inmediata|en busca de personas responsables para laborar|[uú]nete a nuestro equipo de seguridad|seguridad privada/i.test(fullText) ||
      uname.toLowerCase().includes('seguridad privada')
    ) {
      descNoRel++;
      continue;
    }

    const tipo_fuente = detectSourceType(uname, uid, url);
    let categoria = 'seguridad';
    if (tl.includes('encuesta') || tl.includes('inegi') || tl.includes('#enmedios')) {
      categoria = 'noticia';
    } else if (tl.includes('queja') || tl.includes('denuncia') || tl.includes('bache') || tl.includes('fuga')) {
      categoria = 'queja';
    } else if (tl.includes('obra') || tl.includes('agua') || tl.includes('luminaria')) {
      categoria = 'obras';
    }

    let sentimiento: 'pos' | 'neu' | 'neg' | 'oficial' | 'sin_clasificar' = 'oficial';
    if (tipo_fuente === 'medio' || tipo_fuente === 'ciudadano') {
      if (tl.includes('linchamiento') || tl.includes('arrollar') || tl.includes('retuvieron') || tl.includes('denuncia') || tl.includes('asalto')) {
        sentimiento = 'neg';
      } else if (tl.includes('redujo') || tl.includes('reducción') || tl.includes('caída en percepción') || tl.includes('baja en percepción')) {
        sentimiento = 'pos';
      } else {
        sentimiento = 'sin_clasificar';
      }
    }

    const cleanedText = cleanDisplayText(fullText);

    relevantes.push({
      postId: String(raw.postId || raw.id || ''),
      text: cleanedText,
      time: raw.time || '',
      url,
      likesCount: Number(raw.likesCount ?? raw.likes ?? 0),
      commentsCount: Number(raw.commentsCount ?? raw.comments ?? 0),
      sharesCount: Number(raw.sharesCount ?? raw.shares ?? 0),
      reactionLikeCount: Number(raw.reactionLikeCount ?? 0),
      reactionLoveCount: Number(raw.reactionLoveCount ?? 0),
      reactionHahaCount: Number(raw.reactionHahaCount ?? 0),
      reactionAngryCount: Number(raw.reactionAngryCount ?? 0),
      user: {
        id: String(userObj.id || ''),
        name: String(userObj.name || 'Usuario'),
        profilePic: userObj.profilePic || '',
      },
      link: raw.link || null,
      media: Array.isArray(raw.media) ? raw.media : [],
      categoria,
      tipo_fuente,
      sentimiento,
      clasificador: 'reglas',
      sharedUserName: uname,
      hasOwnText: Boolean(primaryText),
    });
  }

  const dedupGroup = (items: typeof relevantes): SocialApiNarrative[] => {
    const clusters: SocialApiNarrative[] = [];
    for (const p of items) {
      const match = clusters.find((c) => areNearIdentical(p.text, c.texto));
      const srcName = p.sharedUserName || p.user.name;
      if (match) {
        match.count += 1;
        match.likesCount += p.likesCount;
        match.commentsCount += p.commentsCount;
        match.sharesCount += p.sharesCount;
        if (!match.fuentes.includes(srcName)) match.fuentes.push(srcName);
      } else {
        const cleanBody = cleanDisplayText(p.text);
        const firstLine = cleanBody.split('\n').map((l) => l.trim()).find(Boolean) || cleanBody.slice(0, 90);
        clusters.push({
          titulo: firstLine.slice(0, 110),
          texto: cleanBody,
          fuente: srcName,
          fuentes: [srcName],
          tipo_fuente: p.tipo_fuente,
          categoria: p.categoria,
          sentimiento: p.sentimiento,
          count: 1,
          likesCount: p.likesCount,
          commentsCount: p.commentsCount,
          sharesCount: p.sharesCount,
          time: p.time,
          url: p.url,
        });
      }
    }
    return clusters.sort((a, b) => b.count - a.count || (b.likesCount + b.sharesCount) - (a.likesCount + a.sharesCount));
  };

  const oficiales = relevantes.filter((p) => p.tipo_fuente === 'oficial' || p.tipo_fuente === 'politico');
  const ciudadanosMedios = relevantes.filter((p) => p.tipo_fuente === 'medio' || p.tipo_fuente === 'ciudadano');

  const narrativa_oficial = dedupGroup(oficiales);
  const narrativa_ciudadana = dedupGroup(ciudadanosMedios);
  const allClusters = [...narrativa_oficial, ...narrativa_ciudadana];

  for (const p of relevantes) {
    const cl = allClusters.find((c) => areNearIdentical(p.text, c.texto));
    p.repeticiones = cl ? cl.count : 1;
  }

  const cmCount = ciudadanosMedios.length;
  const cmClasificados = ciudadanosMedios.filter((p) => p.sentimiento === 'pos' || p.sentimiento === 'neu' || p.sentimiento === 'neg');
  const sinClasificarC = ciudadanosMedios.filter((p) => p.sentimiento === 'sin_clasificar').length;
  const denom = cmClasificados.length;
  const posC = cmClasificados.filter((p) => p.sentimiento === 'pos').length;
  const negC = cmClasificados.filter((p) => p.sentimiento === 'neg').length;
  const posPct = denom ? Math.round((posC / denom) * 100) : 0;
  const negPct = denom ? Math.round((negC / denom) * 100) : 0;
  const neuPct = denom ? Math.max(0, 100 - posPct - negPct) : 0;

  const catMap = new Map<string, number>();
  for (const p of relevantes) {
    catMap.set(p.categoria, (catMap.get(p.categoria) || 0) + 1);
  }
  const categorias: SocialApiCategory[] = [...catMap.entries()].map(([categoria, count]) => ({
    categoria,
    count,
    porcentaje: relevantes.length ? Math.round((count / relevantes.length) * 1000) / 10 : 0,
  }));

  const { volumen_por_dia, pico_posts_dia } = buildDailyVolumeSeries(relevantes, refMs, maxDays);

  return {
    id: 'tlalpan-fixture',
    cached: false,
    query: { tema, modo, alcance },
    fuente_datos: 'fixture',
    es_fixture: true,
    etiqueta_fuente: 'DATOS DE EJEMPLO (fixture)',
    sin_datos_demo: false,
    mensaje: relevantes.length === 0 ? 'Sin publicaciones que mencionen este tema en los datos disponibles' : null,
    clasificador: 'reglas',
    fecha_corrida: nowIso,
    ventana_dias: maxDays,
    posts_fuente: postsFuente,
    posts_filtro_tema: postsFiltroTema,
    total_posts: postsFuente,
    relevantes_posts: relevantes.length,
    ciudadanos_medios_posts: cmCount,
    oficiales_posts: oficiales.length,
    porcentaje_oficial: relevantes.length ? Math.round((oficiales.length / relevantes.length) * 1000) / 10 : 0,
    descartados: {
      por_filtro_tema: Math.max(0, postsFuente - postsFiltroTema),
      por_fecha: descFecha,
      por_homonimo: descHom,
      no_relevantes_o_empleo: descNoRel,
      vacios: descVacios,
    },
    volumen: relevantes.length,
    interacciones_totales: relevantes.reduce((acc, p) => acc + p.likesCount + p.commentsCount + p.sharesCount, 0),
    sentimiento: {
      positive: posPct,
      neutral: neuPct,
      negative: negPct,
      sin_clasificar: sinClasificarC,
      universo: 'medio|ciudadano',
      excluye_oficial: true,
    },
    categorias,
    narrativa_oficial,
    narrativa_ciudadana,
    posts_recientes: [...relevantes].sort((a, b) => (b.time || '').localeCompare(a.time || '')),
    volumen_por_dia,
    pico_posts_dia,
  };
}

/**
 * Consulta la configuración activa del backend (/health) SOLO cuando el usuario presiona Buscar.
 */
export async function checkBackendSearchMode(
  apiUrl: string,
  fallbackFixture: boolean,
  fallbackMaxPosts: number
): Promise<BackendHealthInfo> {
  try {
    const resp = await fetch(`${apiUrl}/health`, { method: 'GET' });
    if (resp.ok) {
      const data = (await resp.json()) as Partial<BackendHealthInfo>;
      return {
        reachable: true,
        facebook_fixture: typeof data.facebook_fixture === 'boolean' ? data.facebook_fixture : fallbackFixture,
        apify_max_posts: Number(data.apify_max_posts || fallbackMaxPosts),
        max_real_searches_per_hour: Number(data.max_real_searches_per_hour || 10),
      };
    }
  } catch {
    // Backend no levantado
  }
  return {
    reachable: false,
    facebook_fixture: fallbackFixture,
    apify_max_posts: fallbackMaxPosts,
    max_real_searches_per_hour: 10,
  };
}

/**
 * Consulta el backend FastAPI:
 * 1) POST /social/buscar {tema, modo, alcance}
 * 2) GET /social/buscar/{id}/resumen
 * Si el backend responde 429 (límite por hora) o 400/401, propaga el error para mostrarlo en UI.
 * Si el backend no está levantado (error de red), aplica las mismas reglas sobre el fixture local de Tlalpan.
 */
export async function fetchSocialSearchSummary(params: {
  apiUrl: string;
  apiToken?: string;
  tema: string;
  modo: SearchMode;
  alcance: ScopeSelection;
  refrescar?: boolean;
}): Promise<SocialApiSummary> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.apiToken) {
    headers['X-API-Token'] = params.apiToken;
  }

  let networkFailed = false;
  try {
    const postResp = await fetch(`${params.apiUrl}/social/buscar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tema: params.tema,
        modo: params.modo,
        alcance: params.alcance,
        refrescar: params.refrescar ?? false,
      }),
    });

    if (postResp.status === 429) {
      let detail = 'Límite de búsquedas reales por hora excedido (429).';
      try {
        const errJson = (await postResp.json()) as { detail?: string };
        if (errJson.detail) detail = errJson.detail;
      } catch {
        // usar mensaje por defecto
      }
      throw new Error(detail);
    }

    if (postResp.status === 400 || postResp.status === 401) {
      let detail = `Error HTTP ${postResp.status}`;
      try {
        const errJson = (await postResp.json()) as { detail?: string };
        if (errJson.detail) detail = errJson.detail;
      } catch {
        // usar mensaje por defecto
      }
      throw new Error(detail);
    }

    if (postResp.ok) {
      const postData = (await postResp.json()) as SocialApiSummary;
      if (postData.id) {
        try {
          const getResp = await fetch(`${params.apiUrl}/social/buscar/${encodeURIComponent(postData.id)}/resumen`, {
            method: 'GET',
            headers,
          });
          if (getResp.ok) {
            return (await getResp.json()) as SocialApiSummary;
          }
        } catch {
          // Si GET /resumen falla pero POST ya devolvió el resumen, usar postData
        }
      }
      return postData;
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Límite de búsquedas') || err.message.includes('429') || err.message.includes('obligatorio') || err.message.includes('Token'))) {
      throw err;
    }
    networkFailed = true;
    console.warn('[socialClient] Backend FastAPI no alcanzable en', params.apiUrl, '— usando fixture local con filtro estricto:', err);
  }

  if (networkFailed) {
    const rawFixture = await loadLocalFixtureRaw();
    return buildClientFallbackFromFixture(rawFixture, params.tema, params.modo, params.alcance);
  }

  const rawFixture = await loadLocalFixtureRaw();
  return buildClientFallbackFromFixture(rawFixture, params.tema, params.modo, params.alcance);
}


/** Modo Persona, paso 1: perfiles/páginas que coinciden con el nombre. origen='fixture' = el backend no tiene fuente en vivo. */
export async function fetchPersonaProfiles(params: {
  apiUrl: string;
  apiToken?: string;
  nombre: string;
}): Promise<{ origen: string; perfiles: PersonaProfile[]; mensaje?: string }> {
  return postPersona(params, '/social/persona/perfiles', { nombre: params.nombre });
}

/** Modo Persona, paso 2: publicaciones de la página elegida + menciones de terceros. */
export async function analyzePersonaPage(params: {
  apiUrl: string;
  apiToken?: string;
  nombre: string;
  pagina: PersonaProfile;
  entidadId?: string | null;
  alcance?: ScopeSelection;
  refrescar?: boolean;
}): Promise<SocialApiSummary> {
  return postPersona(params, '/social/persona/analizar', {
    nombre: params.nombre,
    pagina_url: params.pagina.url,
    pagina_nombre: params.pagina.nombre,
    entidad_id: params.entidadId ?? null,
    alcance: params.alcance,
    refrescar: params.refrescar ?? false,
  });
}

export async function postPersona<T>(
  p: { apiUrl: string; apiToken?: string },
  path: string,
  body?: object,
  method: 'POST' | 'GET' | 'PUT' | 'DELETE' = 'POST'
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (p.apiToken) headers['X-API-Token'] = p.apiToken;
  const resp = await fetch(`${p.apiUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!resp.ok) {
    let detail = `Error HTTP ${resp.status}`;
    try {
      const j = (await resp.json()) as { detail?: string };
      if (j.detail) detail = j.detail;
    } catch {
      // mensaje por defecto
    }
    throw new Error(detail);
  }
  return (await resp.json()) as T;
}

type Api = { apiUrl: string; apiToken?: string };

/** Historial: lecturas y borrados locales del backend; ninguna llama a Apify ni a Gemini. */
export const listarHistorial = (a: Api) => postPersona<HistorialItem[]>(a, '/historial', undefined, 'GET');
export const abrirHistorialEntry = (a: Api, id: string) => postPersona<HistorialEntry>(a, `/historial/${encodeURIComponent(id)}`, undefined, 'GET');
export const borrarHistorial = (a: Api, id?: string) => postPersona<{ ok: boolean }>(a, id ? `/historial/${encodeURIComponent(id)}` : '/historial', undefined, 'DELETE');

export const listarEntidades = (a: Api) => postPersona<Entidad[]>(a, '/entidades', undefined, 'GET');
export const guardarEntidad = (a: Api, e: Partial<Entidad>) =>
  e.id ? postPersona<Entidad>(a, `/entidades/${encodeURIComponent(e.id)}`, e, 'PUT') : postPersona<Entidad>(a, '/entidades', e);

export const listarAlertas = (a: Api) => postPersona<Alerta[]>(a, '/alertas', undefined, 'GET');
export const lineasBase = (a: Api) => postPersona<LineaBase[]>(a, '/monitoreo/estado', undefined, 'GET');
export const marcarAlerta = (a: Api, id: string, estado: string) => postPersona<Alerta>(a, `/alertas/${encodeURIComponent(id)}`, { estado }, 'PUT');
export const borradorAlerta = (a: Api, id: string) => postPersona<{ borrador: string }>(a, `/alertas/${encodeURIComponent(id)}/borrador`);
