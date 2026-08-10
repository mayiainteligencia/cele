// Asistente front-only (sin backend, sin Gemini). Navega a secciones y responde
// con los datos que ya tenemos en mano.
//
// Regla central del spec: toda respuesta declara su clase — Dato (viene de una
// fuente), Cálculo (sale de una fórmula), Estimación (sale de un modelo),
// Inferencia (interpretación) o Recomendación (sujeta a autorización humana).
// Mientras un bloque no tenga fuente real, la respuesta correcta es decir que no
// se sabe: inventar una cifra es justo lo que el spec prohíbe.
import { menuItems } from '../config/menu';
import {
  ESTADO, municipios, localidadesResumen, escuelasResumen, controlCalidad,
  casillasVigentes, secciones as bloqueSecciones, forensia, resultadosDe, fmt,
} from './campeche';

export type Clase = 'Dato' | 'Cálculo' | 'Estimación' | 'Inferencia' | 'Recomendación';
export type Seccion = { id: string; titulo: string; alias: string[] };

const ALIAS: Record<string, string[]> = {
  dashboard:      ['inicio', 'principal', 'home', 'general', 'panel'],
  comando:        ['comando', 'mando', 'central'],
  resultados:     ['resultados', 'votos', 'eleccion', 'elecciones'],
  alertas:        ['alertas', 'focos', 'riesgos', 'atencion', 'forensia', 'anomalias'],
  mapa:           ['mapa', 'territorio', 'casillas', 'escuelas', 'geografia'],
  monitoria:      ['cerebro', 'monitor ia', 'mayia'],
  monitor:        ['medios', 'radio', 'testigos'],
  digital:        ['digital', 'web', 'redes'],
  electoral:      ['inteligencia', 'electoral', 'sentimiento'],
  ciberseguridad: ['ciber', 'seguridad'],
  playground:     ['playground', 'pruebas'],
  academia:       ['academia', 'cursos'],
};

// Deriva del menu unico: una seccion nueva queda navegable sin tocar este archivo.
export const SECCIONES: Seccion[] = menuItems.map(m => ({
  id: m.id, titulo: m.nombre, alias: ALIAS[m.id] ?? [],
}));

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

export type Respuesta = { text: string; clase?: Clase; navigateTo?: string };

const pendientes = () => controlCalidad.items.filter(c => c.estado === 'vacio');

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

  // ── Lo que sí tiene fuente ──
  if (/(poblacion|habitantes|cuanta gente)/.test(t)) {
    return {
      clase: 'Dato',
      text: `${ESTADO.nombre} tiene ${fmt(ESTADO.poblacion2020)} habitantes según el Censo 2020 del INEGI, repartidos en ${municipios.items.length} municipios y ${fmt(localidadesResumen.resumen.total)} localidades con plantel registrado.`,
    };
  }
  if (/(escuela|plantel|inmueble|donde.*casilla|sede)/.test(t)) {
    return {
      clase: 'Dato',
      text: `Hay ${fmt(escuelasResumen.resumen.planteles)} planteles en el catálogo del SIGED, en ${fmt(escuelasResumen.resumen.sitios)} sitios distintos (varios comparten predio). Todos están clasificados como ubicación potencial: ninguno es casilla hasta que el INE lo apruebe.`,
      navigateTo: 'mapa',
    };
  }
  if (/(municipio|cuantos municipios)/.test(t)) {
    return {
      clase: 'Dato',
      text: `${municipios.items.length} municipios, con claves INEGI 001 a 013. Los más recientes son Seybaplaya y Dzitbalché.`,
    };
  }
  if (/(calidad|fuentes|que falta|pendiente|cobertura)/.test(t)) {
    const p = pendientes();
    return {
      clase: 'Cálculo',
      text: `${p.length} de ${controlCalidad.items.length} bloques del libro maestro no tienen fuente conectada. Entre ellos: ${p.slice(0, 4).map(x => x.hoja).join(', ')}.`,
      navigateTo: 'comando',
    };
  }
  if (/(forensia|anomalia|irregularidad|fraude)/.test(t)) {
    return {
      clase: 'Dato',
      text: `Hay ${forensia.items.length} comprobaciones de forensia definidas (Cuadrito 2). Ninguna puede correr todavía: casi todas necesitan datos por sección o por casilla, y esos bloques están vacíos.`,
      navigateTo: 'alertas',
    };
  }

  // ── Lo que NO tiene fuente: se dice, no se inventa ──
  if (/(casilla|cuantas casillas|2027)/.test(t)) {
    return {
      clase: 'Dato',
      text: `No lo sé todavía. ${casillasVigentes.nota ?? 'Las casillas de 2027 dependen de los acuerdos del INE.'} Usar la cifra de 2024 como si fuera la de 2027 sería incorrecto.`,
    };
  }
  if (/(seccion|secciones|distrito)/.test(t)) {
    return {
      clase: 'Dato',
      text: `Sin dato: ${bloqueSecciones.hoja} está vacío. Requiere el Marco Geográfico Electoral del INE. No se puede estimar desde municipio sin volverlo inservible para forensia.`,
    };
  }
  if (/(resultado|voto|gano|ganador|eleccion|participacion|abstencion)/.test(t)) {
    const gub = resultadosDe('gubernatura');
    const u = gub.items[gub.items.length - 1];
    return {
      clase: 'Estimación',
      text: `Cuidado: las cifras cargadas son de ejemplo, no resultados reales. En el dataset de prueba, la gubernatura ${u.anio} da ${u.ganador} arriba de ${u.segundo} por ${u.margenPuntos} puntos, con ${u.participacion}% de participación. Se sustituye al conectar el SICEE del INE.`,
      navigateTo: 'resultados',
    };
  }
  if (/(redes|social|facebook|twitter|instagram|tiktok|mencion|medios|sentimiento|que dicen)/.test(t)) {
    return {
      clase: 'Dato',
      text: 'Todavía no hay fuente de medios ni de redes conectada para Campeche. Monitor de Medios sí captura radio en vivo, pero sus testigos aún no alimentan el análisis electoral.',
      navigateTo: 'monitor',
    };
  }
  if (/(prediccion|proyeccion|proxima eleccion|futuro|quien va a ganar)/.test(t)) {
    return {
      clase: 'Estimación',
      text: 'No hay proyección publicable. El modelo del anexo 1.7 exige escenarios con intervalo de incertidumbre y backtesting contra elecciones ya celebradas; sin resultados históricos reales no se puede calibrar ni medir su error.',
    };
  }
  if (/(encuesta|poll)/.test(t)) {
    return {
      clase: 'Dato',
      text: 'No hay encuestas cargadas. El alta pasa por el flujo del Cuadrito 6: metodología, tamaño de muestra, margen de error y aprobación humana antes de entrar al modelo.',
    };
  }

  return {
    text: `Puedo llevarte a una sección ("ve a Alertas") o responderte sobre lo que sí tiene fuente: población, municipios, localidades, escuelas y estado de las fuentes. Sobre resultados, casillas, encuestas o medios te voy a decir que todavía no hay dato — ${pendientes().length} bloques siguen sin conectar.`,
  };
}
