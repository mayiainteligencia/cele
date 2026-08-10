import React, { useEffect, useMemo, useState } from 'react';
import { Layers, MapPin, School, Loader2, Building2 } from 'lucide-react';
import {
  Panel, Kpi, Insight, SectionHero, Procedencia,
  keyframes, wrap, inner, useIsMobile,
} from './electoral/ui';
import { brandingConfig } from '../config/branding';
import {
  ESTADO, capas, municipios, escuelasResumen, cargarGeo, fmt,
  type Escuela, type Localidad, type Lienzo, type Proc, type Contorno,
} from '../data/campeche';

const { colores } = brandingConfig;
const V = colores.primario;

// ponytail: sin libreria de mapas. datalab entrega x/y ya proyectados (Mercator,
// lado mayor normalizado a 1000) y esto es un <svg> con <circle>. Para un estado
// sin mapa base no hace falta nada mas; MapLibre entraria solo si la logistica de
// campo llega a necesitar calles o satelite.

type Punto = { x: number; y: number };
type EscuelaXY = Escuela & Punto;
type LocalidadXY = Localidad & Punto;

const COLOR_CAPA: Record<string, string> = {
  escuelas_pub: V,
  escuelas_priv: '#0047AB',
  localidades: colores.advertencia,
  sitios: colores.exito,
};

export const MapaCampeche: React.FC = () => {
  const isMobile = useIsMobile();
  const [datos, setDatos] = useState<{
    lienzo: Lienzo;
    contorno: Contorno;
    escuelas: { proc: Proc; items: EscuelaXY[] };
    localidades: { proc: Proc; items: LocalidadXY[] };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activas, setActivas] = useState<Set<string>>(new Set(['limites', 'escuelas_pub', 'localidades']));
  // Solo se ofrecen las capas que tienen geometria. Las que aun no existen no se
  // listan: el panel es un control, no un inventario de lo que falta.
  const capasVisibles = capas.items.filter(c => c.disponible);
  const [municipio, setMunicipio] = useState<string>('');
  const [sel, setSel] = useState<EscuelaXY | LocalidadXY | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarGeo()
      .then(g => { if (vivo) setDatos(g); })
      .catch(e => { if (vivo) setError(String(e.message ?? e)); });
    return () => { vivo = false; };
  }, []);

  const toggle = (id: string) => setActivas(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const filtradas = useMemo(() => {
    if (!datos) return { pub: [], priv: [], locs: [], sitios: [] as EscuelaXY[] };
    const enMuni = <T extends { clave_municipio: string }>(xs: T[]) =>
      municipio ? xs.filter(x => x.clave_municipio === municipio) : xs;
    const esc = enMuni(datos.escuelas.items);
    // Un sitio = un predio. Varios CCT comparten coordenada; la casilla se
    // instala en el predio, no en cada plantel.
    const vistos = new Set<string>();
    const sitios: EscuelaXY[] = [];
    for (const e of esc) {
      if (vistos.has(e.sitioId)) continue;
      vistos.add(e.sitioId);
      sitios.push(e);
    }
    return {
      pub: esc.filter(e => e.sostenimiento === 'PÚBLICO'),
      priv: esc.filter(e => e.sostenimiento === 'PRIVADO'),
      locs: enMuni(datos.localidades.items),
      sitios,
    };
  }, [datos, municipio]);

  const grid = (cols: string): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16,
  });

  const capaPuntos = (id: string): (EscuelaXY | LocalidadXY)[] =>
    id === 'escuelas_pub' ? filtradas.pub
      : id === 'escuelas_priv' ? filtradas.priv
      : id === 'localidades' ? filtradas.locs
      : id === 'sitios' ? filtradas.sitios : [];

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Cuadrito 1 · Mapa maestro"
          title={<>Territorio de <strong style={{ fontWeight: 800 }}>Campeche</strong></>}
          subtitle="Capas activables sobre la geografía del estado. Cada punto muestra su ficha con clave, fuente y fecha de actualización."
          insights={<>
            <Insight kind="Dato" title={`${fmt(escuelasResumen.resumen.planteles)} planteles en ${fmt(escuelasResumen.resumen.sitios)} predios`}>
              Varios centros de trabajo comparten terreno (turnos, primaria y secundaria en el mismo sitio).
              La capa de sitios colapsa esos duplicados: es la que importa para planear casillas.
            </Insight>
            <Insight kind="Dato" title="Ninguna escuela es casilla todavía">
              Todas entran como ubicación potencial. Pasan a histórica al cruzarlas con encartes del INE,
              y a aprobada solo con acuerdo del Consejo Distrital.
            </Insight>
            <Insight kind="Cálculo" title={`${fmt(escuelasResumen.resumen.publicas)} planteles públicos`}>
              El {Math.round(escuelasResumen.resumen.publicas / escuelasResumen.resumen.planteles * 100)}% del
              catálogo es público, que es el universo del que salen las sedes de casilla. Filtra por municipio
              para ver la distribución en cada plaza.
            </Insight>
          </>}
        />

        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 22 }}>
          <Kpi label="Planteles" value={fmt(filtradas.pub.length + filtradas.priv.length)} sub={municipio ? 'en el municipio' : 'en el estado'} />
          <Kpi label="Predios distintos" value={fmt(filtradas.sitios.length)} sub="sitios candidatos" />
          <Kpi label="Localidades" value={fmt(filtradas.locs.length)} sub="con plantel registrado" />
          <Kpi label="Aulas disponibles" value={fmt(filtradas.pub.reduce((s, e) => s + e.aulas, 0))} sub="en planteles públicos" />
        </div>

        <div style={{ ...grid('300px 1fr'), marginBottom: 22, alignItems: 'start' }}>
          {/* Control de capas */}
          <Panel title="Capas" icon={<Layers size={17} color={V} />} proc={capas.proc}>
            <select
              value={municipio}
              onChange={e => { setMunicipio(e.target.value); setSel(null); }}
              style={{
                width: '100%', padding: '9px 11px', borderRadius: 10, marginBottom: 14,
                border: `1px solid ${colores.borde}`, background: colores.fondoClaro,
                color: colores.textoClaro, fontSize: 13, fontWeight: 600,
              }}
            >
              <option value="">Todo el estado</option>
              {municipios.items.map(m => (
                <option key={m.clave_municipio} value={m.clave_municipio}>{m.nombre}</option>
              ))}
            </select>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {capasVisibles.map(c => {
                const on = activas.has(c.id);
                const color = COLOR_CAPA[c.id] ?? V;
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    title={c.fuente}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                      background: on ? `${color}12` : 'transparent',
                      border: `1px solid ${on ? color : colores.borde}`,
                      borderRadius: 10, padding: '9px 10px', cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, flexShrink: 0, background: color,
                      borderRadius: c.tipo === 'punto' ? '50%' : 3,
                    }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: colores.textoClaro }}>
                      {c.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Lienzo */}
          <Panel
            title={municipio ? municipios.items.find(m => m.clave_municipio === municipio)?.nombre : ESTADO.nombre}
            icon={<MapPin size={17} color={V} />}
            proc={escuelasResumen.proc}
            right={<span style={{ fontSize: 12, color: colores.textoOscuro }}>
              {datos ? `${fmt([...activas].reduce((s, id) => s + capaPuntos(id).length, 0))} puntos` : ''}
            </span>}
          >
            {error ? (
              <div style={{ padding: 40, textAlign: 'center', color: colores.peligro, fontSize: 13 }}>
                No se pudo cargar la geometría: {error}
                <div style={{ color: colores.textoOscuro, marginTop: 8, fontSize: 12 }}>
                  Corre <code>python3 backend/datalab/build_campeche.py</code> para generar geo.json.
                </div>
              </div>
            ) : !datos ? (
              <div style={{ padding: 60, textAlign: 'center', color: colores.textoOscuro }}>
                <Loader2 size={26} className="el-spin" />
                <div style={{ fontSize: 13, marginTop: 10 }}>Cargando geometría…</div>
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${datos.lienzo.ancho} ${datos.lienzo.alto}`}
                  style={{ width: '100%', height: 'auto', maxHeight: '72vh', display: 'block', background: colores.fondoSecundario, borderRadius: 12 }}
                  role="img"
                  aria-label={`Mapa de puntos de ${ESTADO.nombre}`}
                >
                  {/* Contorno del estado: trazo continuo, relleno propio. */}
                  {activas.has('limites') && (
                    <path
                      d={datos.contorno.path}
                      fill={`${V}0E`}
                      stroke={V}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      fillRule="evenodd"
                    />
                  )}
                  {['localidades', 'sitios', 'escuelas_priv', 'escuelas_pub']
                    .filter(id => activas.has(id))
                    .map(id => (
                      <g key={id}>
                        {capaPuntos(id).map((p, i) => (
                          <circle
                            key={`${id}-${i}`}
                            cx={p.x} cy={p.y}
                            r={id === 'localidades' ? 3.4 : 2.4}
                            fill={COLOR_CAPA[id]}
                            fillOpacity={sel && sel !== p ? 0.3 : 0.78}
                            stroke={sel === p ? colores.textoClaro : 'none'}
                            strokeWidth={sel === p ? 2.5 : 0}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSel(p)}
                          />
                        ))}
                      </g>
                    ))}
                </svg>
                <div style={{ marginTop: 12 }}>
                  <Procedencia proc={datos.escuelas.proc} />
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* Ficha del punto seleccionado (spec 1.1: nombre, clave, fuente, fecha) */}
        {sel && (
          <Panel
            title="Ficha del elemento"
            icon={'cct' in sel ? <School size={17} color={V} /> : <Building2 size={17} color={V} />}
            proc={datos!.escuelas.proc}
            right={
              <button onClick={() => setSel(null)} style={{
                border: `1px solid ${colores.borde}`, background: 'transparent', color: colores.textoMedio,
                fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
              }}>Cerrar</button>
            }
            style={{ marginBottom: 22 }}
          >
            <div style={grid('repeat(auto-fit, minmax(200px, 1fr))')}>
              {('cct' in sel
                ? [
                    ['Clave del centro de trabajo', sel.cct],
                    ['Nombre', sel.nombre],
                    ['Nivel educativo', `${sel.nivel} · ${sel.servicio}`],
                    ['Sostenimiento', `${sel.sostenimiento} · ${sel.subcontrol}`],
                    ['Turno', sel.turno],
                    ['Municipio', `${sel.municipio} (${sel.clave_municipio})`],
                    ['Localidad', `${sel.localidad} (${sel.clave_localidad})`],
                    ['Domicilio', sel.domicilio],
                    ['Coordenadas', `${sel.lat.toFixed(5)}, ${sel.lon.toFixed(5)}`],
                    ['Alumnos / docentes / aulas', `${sel.alumnos} · ${sel.docentes} · ${sel.aulas}`],
                    ['Estatus como casilla', sel.estatusCasilla],
                    ['Uso histórico como casilla', sel.usoHistoricoCasilla ?? 'sin dato'],
                    ['Predio compartido', `sitio ${sel.sitioId}`],
                  ]
                : [
                    ['Clave de localidad', `${sel.clave_localidad}`],
                    ['Nombre', sel.nombre],
                    ['Municipio', `${sel.municipio} (${sel.clave_municipio})`],
                    ['Planteles', String(sel.escuelas)],
                    ['Coordenada', `${sel.latAprox.toFixed(5)}, ${sel.lonAprox.toFixed(5)}`],
                    ['Validación', sel.estatus_validacion],
                  ]
              ).map(([k, v]) => (
                <div key={k} style={{
                  background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
                  borderRadius: 11, padding: '10px 13px',
                }}>
                  <div style={{ fontSize: 11, color: colores.textoOscuro, fontWeight: 600 }}>{k}</div>
                  <div style={{ fontSize: 13, color: colores.textoClaro, fontWeight: 600, marginTop: 3, wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Distribución por municipio: sustituye al panel de capas faltantes. */}
        <Panel
          title="Cobertura por municipio"
          icon={<Building2 size={17} color={V} />}
          proc={escuelasResumen.proc}
          right={<span style={{ fontSize: 12, color: colores.textoOscuro }}>{municipios.items.length} municipios</span>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[...municipios.items].sort((a, b) => b.escuelas - a.escuelas).map(m => {
              const max = Math.max(...municipios.items.map(x => x.escuelas));
              const activo = municipio === m.clave_municipio;
              return (
                <button
                  key={m.clave_municipio}
                  onClick={() => { setMunicipio(activo ? '' : m.clave_municipio); setSel(null); }}
                  style={{
                    border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: activo ? 800 : 600, color: activo ? V : colores.textoClaro }}>{m.nombre}</span>
                    <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(m.escuelas)} planteles · {fmt(m.sitios)} predios · {fmt(m.localidades)} localidades
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                    <div style={{ width: `${m.escuelas / max * 100}%`, height: '100%', background: activo ? V : `${V}66`, borderRadius: 999 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};
