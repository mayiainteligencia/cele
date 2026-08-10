import React, { useEffect, useState } from 'react';
import { MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { brandingConfig } from '../../../config/branding';
import {
  ESTADO, municipios, escuelasResumen, cargarGeo, fmt,
  type Lienzo, type Contorno, type Escuela, type Localidad,
} from '../../../data/campeche';

const { colores } = brandingConfig;
const V = colores.primario;

type Geo = {
  lienzo: Lienzo; contorno: Contorno;
  escuelas: { items: (Escuela & { x: number; y: number })[] };
  localidades: { items: (Localidad & { x: number; y: number })[] };
};

/** Vista compacta del mapa para el Dashboard. Comparte cargarGeo() con la sección
 *  Mapa Maestro: la descarga se hace una sola vez y navegar allá ya es instantáneo. */
export const MapaCampecheCard: React.FC<{ onSectionChange?: (s: string) => void }> = ({ onSectionChange }) => {
  const [geo, setGeo] = useState<Geo | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarGeo().then(g => { if (vivo) setGeo(g as Geo); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Un punto por predio: 1469 circulos en lugar de 2274 encimados.
  const sitios = React.useMemo(() => {
    if (!geo) return [];
    const vistos = new Set<string>();
    const out: (Escuela & { x: number; y: number })[] = [];
    for (const e of geo.escuelas.items) {
      if (vistos.has(e.sitioId)) continue;
      vistos.add(e.sitioId);
      out.push(e);
    }
    return out;
  }, [geo]);

  const dato = (n: string, l: string) => (
    <div key={l}>
      <div style={{ fontSize: 19, fontWeight: 800, color: colores.textoClaro, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 11, color: colores.textoOscuro, marginTop: 1 }}>{l}</div>
    </div>
  );

  return (
    <div style={{
      background: colores.fondoClaro, borderRadius: 20, padding: 24,
      border: `1px solid ${colores.borde}`, boxShadow: colores.sombra,
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${V}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={20} color={V} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: colores.textoClaro, margin: 0 }}>Territorio · {ESTADO.nombre}</h3>
          <p style={{ fontSize: 12, color: colores.textoOscuro, margin: '2px 0 0' }}>
            {fmt(escuelasResumen.resumen.planteles)} planteles en {municipios.items.length} municipios
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        {!geo ? (
          <Loader2 size={22} className="el-spin" color={colores.textoOscuro} />
        ) : (
          <svg
            viewBox={`0 0 ${geo.lienzo.ancho} ${geo.lienzo.alto}`}
            style={{ width: '100%', height: 'auto', maxHeight: 340, display: 'block' }}
            role="img"
            aria-label={`Mapa de ${ESTADO.nombre} con ${sitios.length} predios`}
          >
            <path d={geo.contorno.path} fill={`${V}12`} stroke={V} strokeWidth={2.6} strokeLinejoin="round" fillRule="evenodd" />
            {sitios.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={2.6} fill={V} fillOpacity={0.55} />
            ))}
          </svg>
        )}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        borderTop: `1px solid ${colores.borde}`, paddingTop: 15, marginTop: 15,
      }}>
        {dato(fmt(escuelasResumen.resumen.sitios), 'predios distintos')}
        {dato(fmt(escuelasResumen.resumen.publicas), 'planteles públicos')}
        {dato(String(municipios.items.length), 'municipios')}
      </div>

      <button
        onClick={() => onSectionChange?.('mapa')}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 15, border: 'none',
          background: 'transparent', color: V, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
        }}
      >
        Abrir mapa maestro <ChevronRight size={15} />
      </button>
    </div>
  );
};
