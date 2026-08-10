// Datos de Campeche precomputados por backend/datalab/build_campeche.py.
// campeche.json y public/data/geo.json están en .gitignore: se regeneran con
//     python3 backend/datalab/build_campeche.py --fetch
//
// Un bloque por hoja del libro maestro del spec (00_Diccionario_Datos ..
// 27_Control_Calidad). Cada bloque trae `proc` con fuente, fecha de corte,
// confianza y clase; renderizar SIEMPRE con <Procedencia> del kit electoral/ui
// para que un dato de ejemplo nunca se lea como un hecho.
import raw from './campeche.json';

export type Clase = 'Dato' | 'Calculo' | 'Estimacion' | 'Inferencia' | 'Recomendacion';
export type Confianza = 'alta' | 'media' | 'baja';
export type Proc = { fuente: string; fechaCorte: string; confianza: Confianza; clase: Clase };

// ponytail: la procedencia vive a nivel de bloque, no de escalar. Envolver cada
// numero en {v, proc} infectaria todos los componentes a cambio de nada: un Panel
// muestra un dataset con un origen. Las filas pueden traer `proc` propio cuando el
// bloque mezcla origenes; si un panel llega a mezclar Dato con Estimacion, se
// parte en dos bloques antes que bajar la procedencia por campo.
export type Bloque<T> = {
  hoja: string;
  proc: Proc;
  items: T;
  nota?: string;
  detalle?: string;
};

/** Nivel geográfico: cada uno es entidad propia, nunca derivada de otra. */
export type Municipio = {
  id_registro: string; clave_entidad: string; clave_municipio: string; nombre: string;
  escuelas: number; escuelasPublicas: number; sitios: number; localidades: number;
  poblacion: number; poblacion18: number; listaNominal: number;
};

export type Localidad = {
  id_registro: string; clave_entidad: string; clave_municipio: string;
  clave_localidad: string; nombre: string; municipio: string;
  escuelas: number; latAprox: number; lonAprox: number;
  ambito: string | null; estatus_validacion: string;
};

export type TipoEleccion =
  | 'gubernatura' | 'ayuntamientos' | 'diputaciones_loc'
  | 'diputaciones_fed' | 'senado' | 'presidencia';

export type Resultado = {
  id_registro: string; clave_entidad: string; eleccion: TipoEleccion; anio: number;
  listaNominal: number; votosEmitidos: number; votosNulos: number; votosValidos: number;
  participacion: number; abstencionismo: number;
  votosPorPartido: Record<string, number>;
  votosPorCoalicion: Record<string, number> | null;
  ganador: string; segundo: string; margenPuntos: number;
  alternancia: boolean | null; casillasComputadas: number | null; incidencias: number | null;
};

/** Tipos oficiales del INE (spec 1.2). Prohibido usar "casilla normal". */
export type TipoCasilla = 'basica' | 'contigua' | 'extraordinaria'
  | 'extraordinaria_contigua' | 'especial';

export type Escuela = {
  id_registro: string; clave_entidad: string; clave_municipio: string; clave_localidad: string;
  cct: string; nombre: string; tipoEducativo: string; nivel: string; servicio: string;
  sostenimiento: string; subcontrol: string; turno: string;
  municipio: string; localidad: string; domicilio: string;
  lat: number; lon: number; sitioId: string;
  alumnos: number; docentes: number; aulas: number;
  usoHistoricoCasilla: string | null; casillasHistoricas: number | null;
  estatusCasilla: 'potencial' | 'historica' | 'aprobada';
  estatus_validacion: string;
  ambito: string | null; accesibilidad: string | null; coberturaMovil: string | null;
};

const b = raw.bloques as Record<string, Bloque<unknown>>;

export const GENERADO = raw.generado;
export const ESTADO = raw.estado as {
  clave_entidad: string; nombre: string; poblacion2020: number; municipios: number; proc: Proc;
};
export const PARTIDOS = raw.partidos as string[];
/** Solo fija el orden por defecto de tablas. El spec es multipartidista:
 *  ningún cálculo, copy ni visualización debe darle trato de protagonista. */
export const PARTIDO_ORDEN = raw.partidoOrden as string;
export const DICCIONARIO = raw.diccionario;

export const bloque = <T,>(k: string) => b[k] as Bloque<T>;

export const municipios = bloque<Municipio[]>('municipios');
export const poblacion = bloque<Array<Record<string, number | null>>>('poblacion');
export const participacion = bloque<Array<{ eleccion: TipoEleccion; anio: number; participacion: number; abstencionismo: number }>>('participacion');
export const controlCalidad = bloque<Array<{
  bloque: string; hoja: string; clase: Clase; fuente: string; fechaCorte: string;
  confianza: Confianza; registros: number | null; estado: 'vacio' | 'poblado';
}>>('control_calidad');

/** Bloques de resultados, por tipo de elección. */
export const RESULTADOS: Record<TipoEleccion, string> = {
  gubernatura: 'resultados_gubernatura',
  ayuntamientos: 'resultados_ayuntamientos',
  diputaciones_loc: 'resultados_dip_local',
  diputaciones_fed: 'resultados_dip_federal',
  senado: 'resultados_senado',
  presidencia: 'resultados_presidencia',
};
export const resultadosDe = (t: TipoEleccion) => bloque<Resultado[]>(RESULTADOS[t]);

/** Bloques que aún no tienen fuente real: se muestran vacíos, nunca estimados
 *  desde otro nivel geográfico (spec 1.2 y Cuadrito 2). */
export const secciones = bloque<never[]>('secciones');
export const casillasHistoricas = bloque<never[]>('casillas_historicas');
export const casillasVigentes = bloque<never[]>('casillas_vigentes');

export type Alerta = {
  id_registro: string; nivel: string; categoria: string; descripcion: string;
  fuente: string; evidencia: string | null; impacto: string; urgencia: string;
  responsable: string | null; fechaLimite: string | null; estatus: string;
};
export const alertas = b.alertas as Bloque<Alerta[]> & {
  niveles: string[];
  semaforoForensia: string[];
  comprobaciones: { proc: Proc; items: Comprobacion[] };
};

/** Catálogo del Cuadrito 2: qué se vigila, con qué granularidad y con qué insumo.
 *  Se declara aunque ninguna comprobación pueda correr todavía — hace visible el
 *  hueco en lugar de esconderlo. */
export type Comprobacion = { id: string; nombre: string; granularidad: string; insumo: string };
export const forensia = alertas.comprobaciones;

export const escuelasResumen = b.escuelas as Bloque<null> & {
  resumen: { planteles: number; sitios: number; publicas: number; privadas: number; porNivel: Record<string, number> };
};
export const localidadesResumen = b.localidades as Bloque<null> & { resumen: { total: number } };

/** Capas del mapa maestro (spec 1.1). Se declaran todas, incluidas las que no
 *  tenemos: una capa ausente que no aparece en la leyenda parece innecesaria. */
export type Capa = {
  id: string; nombre: string;
  tipo: 'punto' | 'poligono' | 'linea' | 'raster';
  disponible: boolean; fuente: string;
  /** Solo las capas disponibles de geometría la declaran. 'aproximada' impide
   *  que un trazo simplificado se lea como frontera oficial. */
  precision?: 'aproximada';
};
export const capas = raw.capas as { proc: Proc; items: Capa[] };

/** Lienzo de la proyección calculada en datalab. El frontend no proyecta nada:
 *  cada punto ya trae x/y en este sistema de coordenadas. */
export type Lienzo = {
  proyeccion: string; ancho: number; alto: number;
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number };
};
/** Contorno del estado tomado del mapa nacional SVG. Trazo simplificado: sirve
 *  para orientar la vista, no como frontera. `contencion` es la fracción medida
 *  de escuelas que caen dentro (0.8887 hoy). */
export type Contorno = {
  proc: Proc; path: string; vertices: number; contencion: number; nota: string;
};
type Geo = {
  lienzo: Lienzo;
  contorno: Contorno;
  escuelas: { proc: Proc; items: (Escuela & { x: number; y: number })[] };
  localidades: { proc: Proc; items: (Localidad & { x: number; y: number })[] };
};
let geo: Promise<Geo> | null = null;
/** Carga el payload de mapa (1.8 MB). Cachea la promesa: una sola descarga. */
export function cargarGeo() {
  geo ??= fetch('/data/geo.json').then(r => {
    if (!r.ok) throw new Error(`geo.json: HTTP ${r.status}`);
    return r.json() as Promise<Geo>;
  });
  return geo;
}

export const PARTIDO_COLOR: Record<string, string> = {
  MORENA: '#9B2247', PAN: '#0047AB', PRI: '#006847', PVEM: '#4CA22F',
  PT: '#D52B1E', MC: '#F58025', PRD: '#F2C200', PANAL: '#00B2A9',
};
export const colorPartido = (p: string) => PARTIDO_COLOR[p] ?? '#6B7280';

export const fmt = (n: number) => n.toLocaleString('es-MX');
export const fmtMXN = (n: number) => '$' + n.toLocaleString('es-MX');
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export const totalListaNominal = municipios.items.reduce((s, m) => s + m.listaNominal, 0);
