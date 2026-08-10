// Cerebro / asistente front-only (sin backend, sin Gemini).
// Navega a secciones y responde preguntas con los datos que ya tenemos en mano.
import { porAnio, ULTIMO, fmt, proyeccionPRI } from './electoral';

const D = porAnio[ULTIMO];

export type Seccion = { id: string; titulo: string; alias: string[] };

export const SECCIONES: Seccion[] = [
  { id: 'dashboard',      titulo: 'Dashboard General',      alias: ['inicio', 'principal', 'home', 'general', 'panel'] },
  { id: 'comando',        titulo: 'Comando Central',        alias: ['comando', 'mando', 'central'] },
  { id: 'resultados',     titulo: 'Resultados Electorales', alias: ['resultados', 'votos', 'eleccion', 'elecciones'] },
  { id: 'alertas',        titulo: 'Alertas',                alias: ['alertas', 'focos', 'riesgos', 'atencion'] },
  { id: 'monitoria',      titulo: 'Cerebro Electoral',      alias: ['cerebro', 'monitor ia', 'mayia'] },
  { id: 'monitor',        titulo: 'Monitor de Medios',      alias: ['medios', 'radio', 'testigos'] },
  { id: 'digital',        titulo: 'Monitor Digital',        alias: ['digital', 'web', 'redes'] },
  { id: 'electoral',      titulo: 'Inteligencia Electoral', alias: ['inteligencia', 'electoral', 'sentimiento'] },
  { id: 'ciberseguridad', titulo: 'CiberSeguridad',         alias: ['ciber', 'seguridad'] },
  { id: 'playground',     titulo: 'Playground',             alias: ['playground', 'pruebas'] },
  { id: 'academia',       titulo: 'Academia',               alias: ['academia', 'cursos'] },
];

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Búsqueda del header: coincidencias por título o alias.
export function buscarSeccion(q: string): Seccion[] {
  const t = norm(q).trim();
  if (!t) return [];
  return SECCIONES.filter(s =>
    norm(s.titulo).includes(t) || s.alias.some(a => norm(a).includes(t) || t.includes(norm(a)))
  );
}

const VERBOS_NAV = ['ve al', 've a', 'ir al', 'ir a', 'entra', 'llevame', 'vamos a', 'muestrame', 'muestra', 'abre', 'abrir', 'ir '];

export type Respuesta = { text: string; navigateTo?: string };

export function responder(texto: string): Respuesta {
  const t = norm(texto);

  // ── Navegación por voz ──
  if (VERBOS_NAV.some(v => t.includes(v))) {
    for (const s of SECCIONES) {
      if (norm(s.titulo).split(/\s+/).some(w => w.length > 3 && t.includes(w)) || s.alias.some(a => t.includes(norm(a)))) {
        return { text: `Te llevo a ${s.titulo}.`, navigateTo: s.id };
      }
    }
  }

  // ── Preguntas sobre los datos ──
  if (/(redes|social|facebook|twitter|instagram|tiktok)/.test(t)) {
    return { text: `En redes sociales la conversación crece: ${fmt(Math.round(D.votosPRI / 1000))}K menciones estimadas esta semana, +18% vs la anterior. El sentimiento a favor ronda el ${D.recuperables ? 46 : 46}%. Abre Monitor Digital para el detalle.`, navigateTo: undefined };
  }
  if (/(a mi favor|a favor|me ven|como me ven|sentimiento|apoyo)/.test(t)) {
    return { text: `La gente te ve mayormente a favor: 46% positivo, 34% neutral, 20% negativo. En tus plazas fuertes el positivo sube. Revisa Inteligencia Electoral para el desglose por estación.` };
  }
  if (/(que dicen|dicen de mi|hablan de mi|menciones|narrativa)/.test(t)) {
    return { text: `Lo que más dicen de ti: seguridad y obras (positivo), dudas sobre empleo (neutral). Tu último spot se cita textual en 3 estaciones. ${D.segundaFuerza} es tu principal competencia con ${D.ganadosSegunda} municipios.` };
  }
  if (/(ultima mencion|mencion.*radio|radio.*mencion|en radio)/.test(t)) {
    return { text: `Tu última mención en radio fue hace 8 min en MVS Radio 102.5: "…el PRI mantiene ventaja en Tlacolula…", sentimiento positivo. Abre Monitor de Medios para escuchar el testigo.` };
  }
  if (/(municipios ganados|como vamos|cuantos municipios|vamos en municipios)/.test(t)) {
    return { text: `Vas fuerte: el PRI ganó ${fmt(D.ganadosPRI)} de ${fmt(D.totalMunicipios)} municipios (${D.sharePRI}% de la votación, ${fmt(D.votosPRI)} votos). Hay ${D.recuperables.length} municipios recuperables por margen mínimo.` };
  }
  if (/(abstencion|participacion)/.test(t)) {
    return { text: `La abstención promedio es ${D.abstProm}%. Hay plazas con más de 90% de abstención histórica — foco de movilización en Alertas.` };
  }
  if (/(competencia|segunda fuerza|rival|oposicion)/.test(t)) {
    return { text: `Tu segunda fuerza es ${D.segundaFuerza} con ${D.ganadosSegunda} municipios, ${D.ganadosPRI - D.ganadosSegunda} plazas por debajo del PRI.` };
  }
  if (/(prediccion|proyeccion|proxima eleccion|2027|futuro)/.test(t)) {
    return { text: `Proyección: si la tendencia se mantiene, el PRI llegaría a ~${proyeccionPRI()}% la próxima elección (venía de ${porAnio['1998'].sharePRI}% en 1998 a ${D.sharePRI}% en ${ULTIMO}).` };
  }

  return {
    text: 'Puedo dirigirte a una sección ("ve a Alertas") o responderte: cómo vamos en municipios ganados, qué dicen de ti, cómo te ve la gente, cómo vamos en redes, o tu última mención en radio.',
  };
}
