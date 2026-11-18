/** Pestañas del panel de resultados en modo Persona: Resumen | Palabras y temas | Análisis y acciones | Radar. */
import type { Analisis, ContenidoRadar, FilaRadar, Palabras, Radar, SocialApiSummary, Temas } from './types';
import { confirmar } from './dialogo';
import {
  calcularPalabras, calcularTemas, cancelarRadar, diagnosticoIA, estadoIA, estimadoAnalisis, estimadoMedir, estimadoRadar, generarAnalisis, generarRadar, medirCuenta, progresoRadar, reintentarIA, sugerirFormatos,
} from './data/socialClient';

type Api = { apiUrl: string; apiToken?: string };
/** Pasos para conseguir muestra: los pinta y enlaza main.ts (botones con costo estimado). */
export interface Ayuda { pasos: () => string; enlazar: (el: HTMLElement) => void }

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const BORRADOR = 'Borrador: validar antes de publicar';
const nom = (s: string) => s.replace(/_/g, ' ');

function barras(filas: { palabra: string; posts: number; comentarios?: number }[], clase: string): string {
  if (!filas.length) return '<div class="cenet-empty-box">Sin coincidencias en el léxico.</div>';
  const max = Math.max(...filas.map((f) => f.posts), 1);
  return filas
    .slice(0, 10)
    .map(
      (f) => `<div class="cenet-an-bar"><span>${esc(f.palabra)}</span>
        <div class="cenet-an-bar__track"><i class="${clase}" style="width:${Math.round((f.posts / max) * 100)}%"></i></div>
        <b>${f.posts} ${f.posts === 1 ? 'post' : 'posts'}${f.comentarios ? ` + ${f.comentarios} com.` : ''}</b></div>`
    )
    .join('');
}

function evidencia(ids: string[], summary: SocialApiSummary): string {
  const todos = [...(summary.posts_recientes || []), ...(summary.por_confirmar || [])];
  return ids
    .map((id, n) => {
      const p = todos.find((x) => String((x as { postId?: string }).postId || x.url) === id);
      return p?.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">post ${n + 1}</a>` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

function copiable(texto: string): string {
  return `<div class="cenet-an-copy"><pre>${esc(texto)}</pre><button type="button" class="cenet-hist-refresh" data-copiar="${esc(texto)}">Copiar</button></div>`;
}

/** Panel colapsado con cada modelo, su estado y la hora en que vuelve. */
async function panelEstadoIA(host: HTMLElement, api: Api): Promise<void> {
  try {
    const { modelos } = await estadoIA(api);
    const filas = modelos.map((m) => `<li>${esc(m.modelo)}${m.descubierto ? ' (descubierto)' : ''}: ${m.estado === 'en_espera' ? `en espera${m.tipo ? ` (${esc(m.tipo)})` : ''}, vuelve a las ${esc(m.vuelve || '')}` : 'disponible'} · ${m.ultimo_minuto}/${m.rpm} peticiones en el último minuto · último código ${m.codigo ?? 's/d'} · latencia media ${m.latencia_media != null ? `${m.latencia_media} s` : 's/d'}${m.disponible_desde ? ` · volvió a las ${esc(m.disponible_desde)}` : ''}${m.penalizado ? ' · al final de la lista por falla o lentitud' : ''}${m.ultimo_error ? ` <small title="${esc(m.ultimo_error)}">· último error</small>` : ''}</li>`).join('');
    host.insertAdjacentHTML('beforeend', `<details class="cenet-an-nota"><summary>Estado de IA</summary><ul>${filas}</ul><button type="button" class="cenet-hist-refresh" data-probar>Probar modelos</button><ul data-probe></ul></details>`);
    const det = host.lastElementChild as HTMLElement;
    det.querySelector<HTMLButtonElement>('[data-probar]')?.addEventListener('click', async (ev) => {
      const b = ev.target as HTMLButtonElement;
      const lista = det.querySelector('[data-probe]') as HTMLElement;
      b.disabled = true;
      lista.innerHTML = '<li>Probando con una llamada mínima por modelo…</li>';
      try {
        const { modelos: r } = await diagnosticoIA(api);
        lista.innerHTML = r.map((m) => `<li>${esc(m.modelo)}: ${m.ok ? `responde (${m.latencia} s)` : `error${m.codigo ? ` ${m.codigo}` : ''}: ${esc(m.error || '')}`}</li>`).join('');
      } catch (e) {
        lista.innerHTML = `<li>${esc(e instanceof Error ? e.message : 'No se pudo probar')}</li>`;
      }
      b.disabled = false;
    });
  } catch { /* sin backend de IA: no se muestra */ }
}

function indicadorModelo(modelos?: string[], cambio?: boolean): string {
  if (!modelos?.length) return '';
  return `<span class="cenet-an-modelo" title="Modelo que respondió">modelo: ${esc(modelos.join(', '))}${cambio ? ' · respaldo por cuota' : ''}</span>`;
}

export function montarPestanas(drawerBody: HTMLElement, summary: SocialApiSummary, api: Api, ayuda: Ayuda): void {
  const id = summary.id;
  const header = drawerBody.querySelector<HTMLElement>('.cenet-drawer__header');
  if (!header || !id || summary.query?.modo !== 'persona') return;

  const resumenPane = document.createElement('div');
  resumenPane.dataset.pane = 'resumen';
  while (header.nextSibling) resumenPane.appendChild(header.nextSibling);

  const nombres: [string, string][] = [['resumen', 'Resumen'], ['palabras', 'Palabras y temas'], ['analisis', 'Análisis y acciones'], ['radar', 'Radar']];
  const bar = document.createElement('div');
  bar.className = 'cenet-an-tabs';
  bar.innerHTML = `<div class="cenet-segmented" role="tablist">${nombres
    .map(([k, t], i) => `<button type="button" class="cenet-segmented__btn ${i === 0 ? 'is-active' : ''}" role="tab" data-tab="${k}">${t}</button>`)
    .join('')}</div>${indicadorModelo(summary.modelos_usados, summary.ia?.cambio_por_cuota)}`;
  const panes: Record<string, HTMLElement> = { resumen: resumenPane };
  for (const [k] of nombres.slice(1)) {
    const d = document.createElement('div');
    d.dataset.pane = k;
    d.hidden = true;
    panes[k] = d;
  }
  header.after(bar, ...Object.values(panes));

  const montado = new Set<string>();
  const montar: Record<string, () => void> = {
    palabras: () => panepalabras(panes.palabras, summary, id, api, ayuda),
    analisis: () => paneAnalisis(panes.analisis, summary, id, api, ayuda),
    radar: () => paneRadar(panes.radar, summary, id, api, ayuda),
  };
  bar.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.tab as string;
      bar.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-active', x === b));
      for (const [pk, el] of Object.entries(panes)) el.hidden = pk !== k;
      if (!montado.has(k) && montar[k]) {
        montado.add(k);
        montar[k]();
      }
    })
  );
  drawerBody.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-copiar]');
    if (btn) void navigator.clipboard?.writeText(btn.dataset.copiar || '').then(() => (btn.textContent = 'Copiado'));
  });
}

/** Una línea: por qué la pestaña está limitada y cuál es el siguiente paso. Vacío si la base es alta. */
function lineaLimite(tab: 'palabras' | 'analisis' | 'radar', summary: SocialApiSummary): string {
  const q = summary.que_se_sabe;
  const c = q?.confianza;
  const base = c ? `${c.posts} posts + ${c.comentarios} comentarios de terceros` : 'sin base calculada';
  let txt = '';
  if (tab === 'radar') {
    txt = 'El radar se arma con las cuentas de tus búsquedas guardadas en este alcance y con lo que sugiere la búsqueda web; con una muestra chica salen pocas cuentas medidas. Siguiente paso: activar otras plataformas o ampliar el periodo.';
  } else if (!c || c.vacio) {
    txt = `Limitada: ${base}, no hay base para ${tab === 'palabras' ? 'contar palabras' : 'hablar de opinión pública'}. Siguiente paso: conseguir muestra (abajo).`;
  } else if (c.nivel === 'baja') {
    txt = `Limitada: ${c.etiqueta} (${base}), confianza baja. Siguiente paso: extraer comentarios, ampliar el periodo o activar otras plataformas.`;
  } else if (c.nivel === 'media') {
    txt = `Confianza media con ${base}; para confianza alta faltan ${q?.falta.faltan_para_alta ?? 0}. Siguiente paso: extraer comentarios.`;
  }
  return txt ? `<p class="cenet-an-aviso">${esc(txt)}</p>` : '';
}

const cargando = (el: HTMLElement, txt = 'Cargando…') => (el.innerHTML = `<div class="cenet-empty-box">${txt}</div>`);
const fallo = (e: unknown) => `<div class="cenet-empty-box">${esc(e instanceof Error ? e.message : 'No se pudo completar la acción.')}</div>`;

/* ───────── Palabras y temas ───────── */
async function panepalabrasPintar(el: HTMLElement, summary: SocialApiSummary, id: string, api: Api, ayuda: Ayuda): Promise<void> {
  const pal = summary.palabras as Palabras;
  const tem: Temas | undefined = summary.temas;
  const conf = pal.confianza;
  const cuerpoPal = !pal.suficiente
    ? `<div class="cenet-empty-box">${esc(pal.mensaje || 'Sin posts ni comentarios de terceros atribuidos')}.</div>${ayuda.pasos()}`
    : `${conf?.preliminar ? `<p class="cenet-an-aviso">${esc(conf.etiqueta)} · confianza ${esc(conf.nivel)}</p>` : ''}<div class="cenet-an-cols"><div><h4>Positivas</h4>${barras(pal.positivas || [], 'is-pos')}</div><div><h4>Negativas</h4>${barras(pal.negativas || [], 'is-neg')}</div></div>
       <p class="cenet-an-nota">Base: ${pal.muestra_posts ?? pal.muestra} posts${pal.muestra_comentarios ? ` + ${pal.muestra_comentarios} comentarios` : ''} de terceros atribuidos a la persona. Cada barra cuenta los que contienen la palabra o sus variantes.</p>`;
  let cuerpoTem: string;
  if (tem?.temas?.length) {
    cuerpoTem = `<p class="cenet-an-nota">Base: ${tem.muestra_posts ?? tem.muestra} posts${tem.muestra_comentarios ? ` + ${tem.muestra_comentarios} comentarios` : ''}${tem.confianza?.preliminar ? ` · ${esc(tem.confianza.etiqueta)}` : ''}. Un lote clasificado por IA; los conteos son de código.</p><div class="cenet-an-tipos">${(tem.tipos_mensaje || []).map((t) => `<span class="cenet-meta-tag">${esc(nom(t.tipo))}: <strong>${t.posts}</strong></span>`).join('')}</div>` +
      tem.temas.map((t) => `<div class="cenet-an-tema"><b>${esc(nom(t.tema))}</b> <span class="cenet-card__badge">${t.posts} ${t.posts === 1 ? 'post' : 'posts'}${t.comentarios ? ` + ${t.comentarios} com.` : ''}</span>
        ${t.ejemplos.map((x) => `<blockquote>${esc(x.texto)}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">ver</a>` : ''}</blockquote>`).join('')}</div>`).join('') +
      `<p class="cenet-an-nota">${indicadorModelo(tem.modelo ? [tem.modelo] : [])}</p>`;
  } else if (!pal.suficiente) {
    cuerpoTem = '<div class="cenet-empty-box">Sin base para clasificar temas.</div>';
  } else {
    cuerpoTem = `${tem?.mensaje ? `<div class="cenet-empty-box">${esc(tem.mensaje)}</div>` : ''}
      <p class="cenet-an-nota">Consumo estimado: 1 petición a Gemini, 0 créditos de Apify.</p>
      <button type="button" class="cenet-btn-search" data-temas>Clasificar temas</button>`;
  }
  el.innerHTML = `${lineaLimite('palabras', summary)}<section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Palabras sobre la persona</span></div>${cuerpoPal}</section>
    <section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Qué más le dicen</span></div>${cuerpoTem}</section>`;
  el.querySelector<HTMLButtonElement>('[data-temas]')?.addEventListener('click', async (ev) => {
    (ev.target as HTMLButtonElement).disabled = true;
    try {
      summary.temas = await calcularTemas(api, id);
    } catch (e) {
      summary.temas = { muestra: 0, suficiente: true, mensaje: e instanceof Error ? e.message : 'Error' };
    }
    void panepalabrasPintar(el, summary, id, api, ayuda);
  });
  ayuda.enlazar(el);
}

async function panepalabras(el: HTMLElement, summary: SocialApiSummary, id: string, api: Api, ayuda: Ayuda): Promise<void> {
  if (!summary.palabras) {
    cargando(el);
    try {
      summary.palabras = await calcularPalabras(api, id);   // léxico local: sin IA ni créditos
    } catch (e) {
      el.innerHTML = fallo(e);
      return;
    }
  }
  await panepalabrasPintar(el, summary, id, api, ayuda);
}

/* ───────── Análisis y acciones ───────── */
function pintarAnalisis(el: HTMLElement, a: Analisis, summary: SocialApiSummary): string {
  const lista = (t: string, xs?: string[]) => (xs?.length ? `<h4>${t}</h4><ul class="cenet-an-lista">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const acciones = (a.acciones || []).map((x) => `<div class="cenet-an-accion is-${esc(x.prioridad)}">
      <div class="cenet-an-accion__top"><b>Prioridad ${esc(x.prioridad)}</b><span>${esc(x.plazo)} · ${esc(x.canal)}</span></div>
      <p>${esc(x.objetivo)}</p><small>Evidencia: ${evidencia(x.evidencia, summary) || 'sin posts citados'}</small></div>`).join('');
  const respuestas = (a.respuestas || []).map((r) => `<div class="cenet-an-resp"><b>${esc(r.narrativa)}</b>
      <span class="cenet-card__badge">${esc(nom(r.clasificacion))}</span>${copiable(r.respuesta)}<small>Evidencia: ${evidencia(r.evidencia, summary) || 'sin posts citados'}</small></div>`).join('');
  const contenido = (a.contenido || []).map((c) => `<div class="cenet-an-resp"><b>${esc(c.canal)}</b>${copiable(c.idea)}<small>Basado en: ${esc(c.logro_base)}</small></div>`).join('');
  const b = a.base;
  const tipos = b ? Object.entries(b.tipos_fuente).filter(([, n]) => n > 0).map(([t, n]) => `${t === 'afin' ? 'afín' : t}: ${n}`).join(', ') : '';
  const baseHtml = b
    ? `<section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Base del análisis</span><span class="cenet-card__badge">${esc(b.confianza.preliminar ? b.confianza.etiqueta : `Confianza ${b.confianza.nivel}`)}</span></div>
        <p class="cenet-an-nota">${b.posts} posts atribuidos del periodo (${esc(tipos || 'sin tipo')}). Muestra de terceros: ${b.muestra_terceros.posts} posts + ${b.muestra_terceros.comentarios} comentarios.</p>
        ${a.aviso_muestra ? `<p class="cenet-an-aviso">${esc(a.aviso_muestra)}</p>` : ''}</section>`
    : '';
  return `<p class="cenet-an-etiqueta">${BORRADOR}</p>${baseHtml}
    <section class="cenet-card">${lista('Mensajes clave', a.mensajes_clave)}${lista('Temas', a.temas)}${lista('Huecos', a.huecos)}${lista('Hallazgos', a.hallazgos)}${lista('Riesgos', a.riesgos)}${lista('Oportunidades', a.oportunidades)}</section>
    <section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Acciones</span></div>${acciones || '<div class="cenet-empty-box">Sin acciones.</div>'}</section>
    <section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Cómo responder a lo negativo</span></div>${respuestas || '<div class="cenet-empty-box">Sin narrativas negativas que responder.</div>'}</section>
    <section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Contenido a publicar</span></div>${contenido || `<div class="cenet-empty-box">${esc(a.aviso_contenido || 'Sin ideas.')}</div>`}</section>
    <p class="cenet-an-nota">${indicadorModelo(a.modelo ? [a.modelo] : [], a.cambio_por_cuota)}</p>`;
}

async function paneAnalisis(el: HTMLElement, summary: SocialApiSummary, id: string, api: Api, ayuda: Ayuda): Promise<void> {
  if (summary.analisis?.estado === 'ok') {
    el.innerHTML = `${lineaLimite('analisis', summary)}${pintarAnalisis(el, summary.analisis, summary)}`;   // ya generado: sin llamadas nuevas
    return;
  }
  let nota = '';
  let base = summary.que_se_sabe?.confianza.posts ?? 0;
  try {
    const e = await estimadoAnalisis(api, id);
    base = e.posts_base ?? base;
    nota = `Consumo estimado: ${e.peticiones_gemini} petición a Gemini, 0 créditos de Apify. Base: ${e.posts_base} posts atribuidos (oficial, afín, medio y ciudadano) + ${summary.que_se_sabe?.confianza.comentarios ?? 0} comentarios. La IA recibe solo agregados y esta base.`;
  } catch {
    nota = 'Consumo estimado: 1 petición a Gemini, 0 créditos de Apify.';
  }
  if (base < 1) {   // sin ningún post atribuido no hay base: pasos para conseguirla
    el.innerHTML = `${lineaLimite('analisis', summary)}<section class="cenet-card"><div class="cenet-empty-box">No hay posts atribuidos en el periodo: no hay base para analizar.</div>${ayuda.pasos()}</section>`;
    ayuda.enlazar(el);
    return;
  }
  el.innerHTML = `${lineaLimite('analisis', summary)}<section class="cenet-card">
    ${summary.analisis?.mensaje ? `<div class="cenet-empty-box">${esc(summary.analisis.mensaje)}${summary.analisis.estado === 'cuota_agotada' ? ' <button type="button" class="cenet-hist-refresh" data-reintentar>Reintentar ahora</button>' : ''}</div>` : ''}
    <p class="cenet-an-nota">${nota}</p><button type="button" class="cenet-btn-search" data-gen>${summary.analisis?.mensaje ? 'Reintentar análisis' : 'Generar análisis'}</button></section>`;
  void panelEstadoIA(el.querySelector('section.cenet-card') as HTMLElement, api);
  el.querySelector<HTMLButtonElement>('[data-reintentar]')?.addEventListener('click', async (ev) => {
    (ev.target as HTMLButtonElement).disabled = true;
    try { await reintentarIA(api); } catch { /* el siguiente intento lo informa */ }
    el.querySelector<HTMLButtonElement>('[data-gen]')?.click();
  });
  el.querySelector<HTMLButtonElement>('[data-gen]')?.addEventListener('click', async (ev) => {
    (ev.target as HTMLButtonElement).disabled = true;
    cargando(el, 'Generando análisis…');
    try {
      summary.analisis = await generarAnalisis(api, id);
    } catch (e) {
      el.innerHTML = fallo(e);
      return;
    }
    void paneAnalisis(el, summary, id, api, ayuda);
  });
}

/* ───────── Radar ───────── */
const COLS: [string, string][] = [
  ['nombre', 'Creador'], ['plataformas', 'Plataformas'], ['seguidores', 'Seguidores medidos'], ['interaccion_promedio', 'Interacción'], ['nivel', 'Nivel'],
  ['ambito', 'Ámbito'], ['habla_de_la_persona', 'Habla de la persona'], ['tono', 'Tono'], ['puntaje', 'Puntaje'], ['fecha_medicion', 'Medido'], ['accion', ''],
];
const orden = { k: 'puntaje', desc: true };
// Por defecto se ve todo: los filtros están visibles y no ocultan nada hasta que el usuario los use
const filtro = { alcance: 'todos', plataforma: '', categoria: '', nivel: 'todos', referentes: true };
const NIVEL_ORDEN: Record<string, number> = { local: 0, micro: 1, macro: 2, mega: 3 };
const PLAT: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', x: 'X' };
let ctxRadar: { summary: SocialApiSummary; id: string; api: Api; error: string } | null = null;

function pasa(f: FilaRadar): boolean {
  if (!filtro.referentes && String(f.origen || '').startsWith('referente_')) return false;   // vista «Relacionados con la persona»
  if (filtro.alcance === 'local' && f.ambito === 'nacional') return false;       // Local: el lugar elegido (municipio o estado)
  if (filtro.alcance === 'nacional' && f.ambito !== 'nacional') return false;    // Nacional con base en el lugar
  if (filtro.plataforma && !f.plataformas.some((p) => p.plataforma === filtro.plataforma)) return false;
  if (filtro.categoria && !f.categorias.includes(filtro.categoria)) return false;
  if (filtro.nivel !== 'todos' && f.nivel !== filtro.nivel) return false;
  return true;
}

function valor(f: FilaRadar, k: string): unknown {
  if (k === 'plataformas') return f.plataformas.length;
  if (k === 'nivel') return f.nivel == null ? null : NIVEL_ORDEN[f.nivel];
  return (f as unknown as Record<string, unknown>)[k];
}

function opciones(vals: [string, string][], sel: string): string {
  return vals.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
}

function tablaRadar(r: Radar): string {
  const filas = r.medidos.filter(pasa).sort((a, b) => {
    if ((a.estado_medicion === 'medido') !== (b.estado_medicion === 'medido')) return a.estado_medicion === 'medido' ? -1 : 1;   // los sin medir siempre al final
    if (r.persona && a.menciona_ficha !== b.menciona_ficha && orden.k === 'puntaje') return a.menciona_ficha ? -1 : 1;   // con ficha: primero quienes ya hablan de ella
    const x = valor(a, orden.k), y = valor(b, orden.k);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return ((x as number | string) > (y as number | string) ? 1 : (x as number | string) < (y as number | string) ? -1 : 0) * (orden.desc ? -1 : 1);
  });
  if (!filas.length) return `<div class="cenet-empty-box">${r.medidos.length} cuentas en el radar, ninguna coincide con los filtros actuales. Cambia el alcance o los filtros para verlas.</div>`;
  const sd = (v: unknown) => (v == null || v === '' ? '<span class="cenet-an-sd">sin dato</span>' : esc(v));
  return `<div class="cenet-an-scroll"><table class="cenet-an-tabla"><thead><tr>${COLS.map(([k, t]) => `<th ${k === 'accion' ? '' : `data-ord="${k}"`}>${t}${orden.k === k ? (orden.desc ? ' ▾' : ' ▴') : ''}</th>`).join('')}</tr></thead><tbody>
    ${filas.map((f) => {
      const d = f.desglose;
      const sin = f.estado_medicion !== 'medido';
      return `<tr><td><b>${esc(f.nombre)}</b>${sin ? ` <span class="cenet-card__badge" style="color:var(--sent-neu);">${esc(f.etiqueta || 'Sugerido, sin medir')}</span>` : ''}${f.menciona_ficha ? ' <span class="cenet-card__badge">habla de la ficha</span>' : ''}
          <small>${sin ? `Sugerido por búsqueda web de Gemini; ${esc(f.motivo_sin_medir)}` : f.sugerido ? 'Sugerido por búsqueda web y medido con datos reales' : 'Medido en las búsquedas guardadas'} · ${esc(f.categorias.join(', '))}${sin && f.fuente_url ? ` · <a href="${esc(f.fuente_url)}" target="_blank" rel="noopener noreferrer">fuente</a>` : ''}</small>
          ${f.razon ? `<small>${esc(f.razon)}</small>` : sin && f.razon_sugerencia ? `<small>${esc(f.razon_sugerencia)}</small>` : ''}</td>
        <td>${f.plataformas.length ? f.plataformas.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(PLAT[p.plataforma] || p.plataforma)}</a> ${sd(p.seguidores?.toLocaleString('es-MX'))}`).join('<br>') : '<span class="cenet-an-sd">sin cuentas conocidas</span>'}</td>
        <td>${sd(f.seguidores?.toLocaleString('es-MX'))}</td><td>${sd(f.interaccion_promedio)}</td><td>${sd(f.nivel)}</td>
        <td>${esc(f.ambito_etiqueta || (f.ambito === 'nacional' ? 'nacional' : 'local'))}${f.referente_nacional ? ' <span class="cenet-card__badge">Referente nacional</span>' : ''}<small>${esc(f.evidencia_ubicacion.join('; '))}</small></td>
        <td>${sd(f.habla_de_la_persona)}</td><td>${sd(f.tono)}</td>
        <td>${f.puntaje == null ? '<span class="cenet-an-sd">sin dato</span>' : `<b>${f.puntaje}</b>`}${d ? `<small>alcance ${d.alcance} x interacción ${d.interaccion} x actividad ${d.actividad} x relevancia local ${d.relevancia_local}</small>` : ''}</td>
        <td>${sd(f.fecha_medicion?.slice(0, 10))}</td>
        <td>${sin && Object.keys(f.usuarios || {}).length ? `<button type="button" class="cenet-hist-refresh" data-medir="${esc(f.nombre)}">Medir</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

/** «Qué contenido le gusta a la gente de aquí»: patrones calculados en código con los posts y videos de los referentes. */
function panelContenido(r: Radar): string {
  const c: ContenidoRadar | null | undefined = r.contenido;
  const nota = (t: string) => `<section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Qué contenido le gusta a la gente de aquí</span></div><div class="cenet-empty-box">${esc(t)}</div></section>`;
  if (r.incluye_referentes === false) return nota('Este radar se generó sin referentes del territorio. Genéralo de nuevo con "Incluir referentes sin relación con la persona" para medir qué contenido funciona.');
  if (!c || c.vacio) return nota('Sin contenido medido de referentes en el periodo: revisa los avisos de fuentes (YouTube sin clave, Apify inactivo o sin cuota de IA).');
  const tasa = (v: number | null | undefined) => (v == null ? '<span class="cenet-an-sd">sin dato</span>' : `${v}%`);
  const fecha = c.fecha.slice(0, 10);
  const formatos = (c.por_formato || []).map((f) => `<div class="cenet-an-bar"><span>${esc(f.formato)}</span><div class="cenet-an-bar__track"><i class="is-pos" style="width:${Math.min(100, Math.round((f.tasa_mediana ?? 0) * 4))}%"></i></div><b>tasa ${tasa(f.tasa_mediana)} · ${f.n} contenidos</b></div>`).join('');
  const f = r.formatos;
  return `<section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Qué contenido le gusta a la gente de aquí</span><span class="cenet-card__badge">${c.base} contenidos · ${c.con_seguidores} con tasa · ${esc(fecha)}</span></div>
    <p class="cenet-an-aviso">${esc(c.nota)}</p>
    ${c.aviso_clasificacion ? `<p class="cenet-an-nota">${esc(c.aviso_clasificacion)}</p>` : '<p class="cenet-an-nota">Temas y tono clasificados con Gemini en una sola petición por lotes.</p>'}
    <h4>Formato (tasa de interacción = interacciones / seguidores de la cuenta)</h4>${formatos || '<span class="cenet-an-sd">sin dato</span>'}
    <h4>Temas</h4><p class="cenet-an-nota">${(c.temas || []).map((t) => `${esc(t.tema)}: ${t.n} (tasa ${t.tasa_mediana == null ? 'sin dato' : t.tasa_mediana + '%'})`).join(' · ') || 'sin dato'}</p>
    <h4>Hashtags más repetidos</h4><p class="cenet-an-nota">${(c.hashtags || []).map(([h, n]) => `#${esc(h)} (${n})`).join(' · ') || 'sin dato'}</p>
    <h4>Duración y momento</h4><p class="cenet-an-nota">Duración típica de los videos: ${c.duracion?.mediana_s ? `${c.duracion.mediana_s} s (${c.duracion.n} videos)` : 'sin dato'} · Mejores días: ${(c.mejores_dias || []).map((d) => `${esc(d.clave)} (${d.tasa_media}%, ${d.n})`).join(', ') || 'sin dato'} · Mejores horas (hora de CDMX): ${(c.mejores_horas || []).map((d) => `${esc(d.clave)} (${d.tasa_media}%, ${d.n})`).join(', ') || 'sin dato'}</p>
    <h4>Los 5 contenidos con más interacción relativa</h4>
    ${(c.ejemplos || []).map((e) => `<div class="cenet-desc__item"><b>${esc(e.autor)}</b> (${esc(PLAT[e.plataforma] || e.plataforma)}, ${esc(e.formato)}) · ${e.tasa == null ? 'tasa sin dato' : `tasa ${e.tasa}%`} · ${e.interacciones.toLocaleString('es-MX')} interacciones${e.url ? ` · <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">ver</a>` : ''}<small>${esc(e.texto)}</small></div>`).join('')}
    <h4>Recomendaciones para la persona</h4>
    ${f?.estado === 'ok' ? `<p class="cenet-an-etiqueta">${esc(f.etiqueta || 'Borrador: validar antes de publicar')}</p>${(f.formatos || []).map((x) => `<div class="cenet-an-resp"><b>${esc(x.formato)} · ${esc(x.tema)} · ${esc(x.horario)}</b><p>${esc(x.idea)}</p><small>Patrón medido: ${esc(x.patron_base)}</small></div>`).join('')}<p class="cenet-an-nota">Base: ${f.base ?? c.base} contenidos medidos.</p>`
      : `${f?.mensaje ? `<p class="cenet-an-aviso">${esc(f.mensaje)}</p>` : ''}<p class="cenet-an-nota">Borradores basados solo en los patrones de arriba; no sugiere copiar a un creador ni contratar influencers.</p><button type="button" class="cenet-hist-refresh" data-formatos>Sugerir formatos</button>`}
  </section>`;
}

function pintarRadar(el: HTMLElement, r: Radar, reintentar?: () => void, linea = ''): void {
  const plats = [...new Set(r.medidos.flatMap((f) => f.plataformas.map((p) => p.plataforma)))];
  const nv = r.niveles || {};
  const cuenta = (fn: (f: FilaRadar) => boolean) => r.medidos.filter(fn).length;
  const fu = r.fuentes;
  el.innerHTML = `${linea}<p class="cenet-an-aviso">${esc(r.aviso)}</p><p class="cenet-an-aviso">${esc(r.nota_normativa)}.</p>
    ${(r.avisos || []).map((a) => `<p class="cenet-an-aviso">${esc(a)}</p>`).join('')}
    ${ctxRadar?.error ? `<p class="cenet-an-aviso">${esc(ctxRadar.error)}</p>` : ''}
    ${r.estado === 'parcial' ? '<section class="cenet-card"><p class="cenet-an-nota">Radar incompleto: no se obtuvieron sugerencias de creadores. Se muestran solo las cuentas medidas en tus búsquedas.</p><button type="button" class="cenet-btn-search" data-reintentar>Reintentar sugerencias</button></section>' : ''}
    <section class="cenet-card"><div class="cenet-card__title"><span class="cenet-card__title-left">Creadores</span><span class="cenet-card__badge">${esc(r.lugar)}</span></div>
      <p class="cenet-an-nota"><strong>Fuentes usadas:</strong> ${fu.medidos_historial} cuentas medidas de tus búsquedas guardadas · ${fu.sugeridos_gemini} sugeridos por Gemini (una sola búsqueda web, ${fu.categorias_consultadas} categorías): ${fu.verificados} verificados y ${fu.sin_medir} sin medir
        ${fu.referentes && Object.keys(fu.referentes).length ? ` · referentes del territorio, posts recogidos: ${Object.entries(fu.referentes).map(([p, n]) => `${PLAT[p] || p} ${n}`).join(', ')}` : r.incluye_referentes === false ? ' · sin referentes del territorio (generado sin ellos)' : ''}${fu.reutilizados ? ` · ${fu.reutilizados} cuentas reutilizadas del historial` : ''}. Solo los medidos entran al puntaje; los referentes nacionales no puntúan.</p>
      <label class="cenet-an-chk"><input type="checkbox" data-f="referentes" ${filtro.referentes ? 'checked' : ''}> Incluir referentes sin relación con la persona</label>
      <div class="cenet-an-filtros">
        <div class="cenet-segmented" role="group" aria-label="Alcance del radar">
          ${([['todos', `Todos (${r.medidos.length})`], ['local', `Local (${cuenta((f) => f.ambito !== 'nacional')})`], ['nacional', `Nacional con base en el lugar (${cuenta((f) => f.ambito === 'nacional')})`]] as [string, string][])
            .map(([v, t]) => `<button type="button" class="cenet-segmented__btn ${filtro.alcance === v ? 'is-active' : ''}" data-alcance="${v}">${esc(t)}</button>`).join('')}
        </div>
        <label>Plataforma<select data-f="plataforma">${opciones([['', 'Todas'], ...plats.map((p) => [p, PLAT[p] || p] as [string, string])], filtro.plataforma)}</select></label>
        <label>Categoría<select data-f="categoria">${opciones([['', 'Todas'], ...r.categorias.map((c) => [c, c] as [string, string])], filtro.categoria)}</select></label>
        <label>Nivel<select data-f="nivel">${opciones([['todos', 'Todos'], ['local', `Local (< ${(nv.micro ?? 0).toLocaleString('es-MX')})`], ['micro', 'Micro'], ['macro', 'Macro'], ['mega', 'Mega']], filtro.nivel)}</select></label>
      </div>
      ${tablaRadar(r)}
      ${r.aviso_ia ? `<p class="cenet-an-nota">${esc(r.aviso_ia)}</p>` : ''}
      <p class="cenet-an-nota">Nivel por seguidores medidos: micro desde ${(nv.micro ?? 0).toLocaleString('es-MX')}, macro desde ${(nv.macro ?? 0).toLocaleString('es-MX')}, mega desde ${(nv.mega ?? 0).toLocaleString('es-MX')}. ${indicadorModelo(r.modelos_usados, r.cambio_por_cuota)}</p></section>
    ${panelContenido(r)}`;
  el.querySelector('[data-reintentar]')?.addEventListener('click', () => reintentar?.());
  el.querySelectorAll<HTMLElement>('[data-ord]').forEach((th) =>
    th.addEventListener('click', () => {
      const k = th.dataset.ord as string;
      orden.desc = orden.k === k ? !orden.desc : true;
      orden.k = k;
      pintarRadar(el, r, reintentar, linea);
    })
  );
  el.querySelectorAll<HTMLElement>('[data-alcance]').forEach((b) =>
    b.addEventListener('click', () => {
      filtro.alcance = b.dataset.alcance as string;
      pintarRadar(el, r, reintentar, linea);
    })
  );
  el.querySelectorAll<HTMLSelectElement>('select[data-f]').forEach((c) =>
    c.addEventListener('change', () => {
      (filtro as Record<string, string | boolean>)[c.dataset.f as string] = c.value;
      pintarRadar(el, r, reintentar, linea);
    })
  );
  el.querySelector<HTMLInputElement>('input[data-f="referentes"]')?.addEventListener('change', (ev) => {
    filtro.referentes = (ev.target as HTMLInputElement).checked;
    pintarRadar(el, r, reintentar, linea);
  });
  el.querySelector<HTMLButtonElement>('[data-formatos]')?.addEventListener('click', async (ev) => {
    if (!ctxRadar) return;
    (ev.target as HTMLButtonElement).disabled = true;
    try {
      r.formatos = await sugerirFormatos(ctxRadar.api, ctxRadar.id);
    } catch (e) {
      ctxRadar.error = e instanceof Error ? e.message : 'No se pudieron sugerir formatos.';
    }
    pintarRadar(el, r, reintentar, linea);
  });
  // «Medir»: consulta solo esa cuenta, con confirmación de costo; luego entra al puntaje
  el.querySelectorAll<HTMLButtonElement>('[data-medir]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!ctxRadar) return;
      const nombre = b.dataset.medir as string;
      ctxRadar.error = '';
      try {
        const e = await estimadoMedir(ctxRadar.api, ctxRadar.id, nombre);
        const filas = Object.entries(e.cuentas).map(([p, c]) => `${PLAT[p] || p} @${c.usuario}: ${c.unidades_youtube ? `${c.unidades_youtube} unidades de cuota de YouTube` : `USD ${c.costo_usd.toFixed(4)}`}${c.activo ? '' : ' (no disponible ahora)'}`);
        if (!(await confirmar({ titulo: `Medir ${nombre}`, mensaje: `${filas.join('\n')}\nTotal máximo estimado en Apify: USD ${e.total_usd.toFixed(4)}`, aceptar: 'Medir' }))) return;
        ctxRadar.summary.radar = await medirCuenta(ctxRadar.api, ctxRadar.id, nombre);
        pintarRadar(el, ctxRadar.summary.radar, reintentar, linea);
      } catch (err) {
        ctxRadar.error = err instanceof Error ? err.message : 'No se pudo medir la cuenta.';
        pintarRadar(el, r, reintentar, linea);
      }
    })
  );
}

/** Generación en segundo plano: muestra el progreso ("etapa 3 de 9"), permite cancelar y, si algo se agota, deja ver lo ya obtenido. */
async function correrRadar(el: HTMLElement, summary: SocialApiSummary, id: string, api: Api, ayuda: Ayuda, incluir: boolean): Promise<void> {
  const fin = (r?: Radar | null) => {
    if (r) summary.radar = r;
    void paneRadar(el, summary, id, api, ayuda);
  };
  try {
    const ini = await generarRadar(api, id, incluir);
    if (ini.estado === 'listo' && ini.radar) return fin(ini.radar);
  } catch (e) {
    el.innerHTML = fallo(e);
    return;
  }
  const pintarProgreso = (i: number, n: number, etapa: string, filas: number) => {
    el.innerHTML = `<section class="cenet-card"><p class="cenet-an-aviso">Generando radar: etapa ${i} de ${n}${etapa ? ` · ${esc(etapa)}` : ''}</p>
      <progress value="${i}" max="${Math.max(n, 1)}" style="width:100%;"></progress>
      <p class="cenet-an-nota">${filas} cuentas obtenidas hasta ahora. Si una fuente se agota o tarda demasiado, se continúa con lo obtenido.</p>
      <button type="button" class="cenet-hist-refresh" data-cancelar>Cancelar</button></section>`;
    el.querySelector('[data-cancelar]')?.addEventListener('click', () => void cancelarRadar(api, id));
  };
  pintarProgreso(0, 0, 'Iniciando', 0);
  for (let intentos = 0; intentos < 600; intentos++) {   // hasta ~12 min: el backend ya limita cada etapa
    await new Promise((r) => setTimeout(r, 1200));
    if (!el.isConnected) return;
    try {
      const p = await progresoRadar(api, id);
      if (p.estado !== 'corriendo') return fin(p.radar);
      pintarProgreso(p.i ?? 0, p.n ?? 0, p.etapa ?? '', p.filas_parciales ?? 0);
    } catch (e) {
      el.innerHTML = fallo(e);
      return;
    }
  }
}

async function paneRadar(el: HTMLElement, summary: SocialApiSummary, id: string, api: Api, ayuda: Ayuda): Promise<void> {
  ctxRadar = { summary, id, api, error: '' };
  if (summary.radar?.version === 4 && summary.radar.estado !== 'sin_generar') {
    // ya generado: sin llamadas nuevas; si quedó parcial se ofrece reintentar
    pintarRadar(el, summary.radar, () => {
      summary.radar = undefined;
      void paneRadar(el, summary, id, api, ayuda);
    }, lineaLimite('radar', summary));
    return;
  }
  const pintarEstimado = async (incluir: boolean) => {
    let est: Awaited<ReturnType<typeof estimadoRadar>>;
    try {
      est = await estimadoRadar(api, id, incluir);
    } catch (e) {
      el.innerHTML = fallo(e);
      return;
    }
    const texto = `${est.lugar}: hasta ${est.peticiones_gemini} peticiones a Gemini (sugerencias ${est.sugerencias_en_cache ? 'ya en caché' : 'en una sola búsqueda web'}) · ` +
      `${est.perfiles_apify_max} perfiles de Apify como máximo + referentes ≈ USD ${est.creditos_apify_usd} · ` +
      (est.youtube_activo ? `YouTube: hasta ${est.unidades_youtube_max} unidades de cuota gratuita (la búsqueda de videos cuesta ~105)` : 'YouTube sin consultar (falta YOUTUBE_API_KEY)');
    el.innerHTML = `${lineaLimite('radar', summary)}<p class="cenet-an-aviso">El radar cubre Facebook, YouTube, Instagram, TikTok y X; solo cuentas públicas y en agregado.</p>
      <p class="cenet-an-aviso">Verifica la normativa electoral vigente y la divulgación de contenido pagado antes de colaborar con creadores.</p>
      <section class="cenet-card"><label class="cenet-an-chk"><input type="checkbox" data-incluir ${incluir ? 'checked' : ''}> Incluir referentes sin relación con la persona</label>
      <p class="cenet-an-nota">Consumo estimado: ${esc(texto)}</p><button type="button" class="cenet-btn-search" data-gen>Generar radar</button></section>`;
    el.querySelector<HTMLInputElement>('[data-incluir]')?.addEventListener('change', (ev) => void pintarEstimado((ev.target as HTMLInputElement).checked));
    el.querySelector<HTMLButtonElement>('[data-gen]')?.addEventListener('click', async (ev) => {
      if (!(await confirmar({ titulo: 'Generar radar', mensaje: `Se consumirán recursos:\n${texto}`, aceptar: 'Generar' }))) return;
      (ev.target as HTMLButtonElement).disabled = true;
      filtro.referentes = incluir;
      void correrRadar(el, summary, id, api, ayuda, incluir);
    });
  };
  await pintarEstimado(true);   // el interruptor viene activo por defecto
}
