// Datos electorales reales (Oaxaca, COMPILADO.xlsx) precomputados por
// backend/datalab/agregar_electoral.py. NO editar electoral.json a mano:
// correr `python3 agregar_electoral.py` para regenerarlo.
import raw from './electoral.json';

export type TopMuni = { municipio: string; votosPRI: number; ganador: string };
export type Recuperable = { municipio: string; gano: string; votosPRI: number; margen: number };
export type RiesgoAbst = { municipio: string; abst: number };

export type AnioData = {
  totalMunicipios: number;
  ganadosPRI: number;
  sharePRI: number;
  votosPRI: number;
  totalVotos: number;
  abstProm: number;
  listaNominal: number;
  casillas: number;
  segundaFuerza: string;
  ganadosSegunda: number;
  ganados: Record<string, number>;
  votosPorPartido: Record<string, number>;
  topPRI: TopMuni[];
  recuperables: Recuperable[];
  riesgoAbst: RiesgoAbst[];
};

export const ANIOS = raw.anios as number[];
export const REPRESENTANTES = raw.representantes as { municipios: number; total: number; presupuesto: number };
export const porAnio = raw.porAnio as unknown as Record<string, AnioData>;

export const ULTIMO = String(ANIOS[ANIOS.length - 1]); // '2010'

// Colores oficiales de partido (para charts/badges)
export const PARTIDO_COLOR: Record<string, string> = {
  PRI: '#006847', PAN: '#0047AB', PRD: '#F2C200', PVEM: '#4CA22F',
  PT: '#D52B1E', MC: '#F58025', PNA: '#00B2A9', PUP: '#7A3FA0',
  CONVER: '#E56A00', PARMEO: '#8E8E8E', Morena: '#9B2247',
};

export const fmt = (n: number) => n.toLocaleString('es-MX');
export const fmtMXN = (n: number) => '$' + n.toLocaleString('es-MX');

// Proyeccion lineal simple del share PRI a la proxima eleccion (1998 -> 2010 -> +12 anios)
export function proyeccionPRI(): number {
  const a = porAnio[String(ANIOS[0])].sharePRI;
  const b = porAnio[ULTIMO].sharePRI;
  return Math.round((b + (b - a)) * 10) / 10;
}
