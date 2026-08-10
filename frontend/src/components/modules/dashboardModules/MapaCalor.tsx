import React, { useState } from 'react';
import { MapPin, TrendingUp, TrendingDown, X, Users, Pill } from 'lucide-react';
import { brandingConfig } from '../../../config/branding';
import { estadosPaths } from '../../../data/mexicoPaths';

// ── Datos dummy por estado ─────────────────────────────────────────────────────

interface EstadoInfo {
  id: string;
  nombre: string;
  casos: number;
  tendencia: number;
  padecimiento: string;
  sucursales: number;
  stockCritico: number;
  region: string;
}

const estadosData: Record<string, EstadoInfo> = {
  MX_AG: { id: 'MX_AG', nombre: 'Aguascalientes',      casos: 312,  tendencia: +8,  padecimiento: 'Respiratoria',     sucursales: 48,  stockCritico: 2,  region: 'Centro-Norte' },
  MX_BC: { id: 'MX_BC', nombre: 'Baja California',     casos: 587,  tendencia: +12, padecimiento: 'Alérgica',         sucursales: 134, stockCritico: 5,  region: 'Noroeste' },
  MX_BS: { id: 'MX_BS', nombre: 'Baja California Sur',  casos: 198,  tendencia: -4,  padecimiento: 'Gastrointestinal', sucursales: 42,  stockCritico: 1,  region: 'Noroeste' },
  MX_CM: { id: 'MX_CM', nombre: 'Campeche',             casos: 224,  tendencia: +6,  padecimiento: 'Viral',            sucursales: 38,  stockCritico: 2,  region: 'Sureste' },
  MX_CS: { id: 'MX_CS', nombre: 'Chiapas',              casos: 743,  tendencia: +21, padecimiento: 'Gastrointestinal', sucursales: 198, stockCritico: 8,  region: 'Sur' },
  MX_CH: { id: 'MX_CH', nombre: 'Chihuahua',            casos: 612,  tendencia: +14, padecimiento: 'Respiratoria',     sucursales: 167, stockCritico: 6,  region: 'Norte' },
  MX_CO: { id: 'MX_CO', nombre: 'Coahuila',             casos: 534,  tendencia: +9,  padecimiento: 'Crónica',          sucursales: 143, stockCritico: 4,  region: 'Norte' },
  MX_CL: { id: 'MX_CL', nombre: 'Colima',               casos: 187,  tendencia: -2,  padecimiento: 'Alérgica',         sucursales: 31,  stockCritico: 1,  region: 'Occidente' },
  MX_DF: { id: 'MX_DF', nombre: 'Ciudad de México',     casos: 1820, tendencia: +18, padecimiento: 'Respiratoria',     sucursales: 612, stockCritico: 14, region: 'Centro' },
  MX_DG: { id: 'MX_DG', nombre: 'Durango',              casos: 298,  tendencia: +5,  padecimiento: 'Respiratoria',     sucursales: 67,  stockCritico: 2,  region: 'Norte' },
  MX_GT: { id: 'MX_GT', nombre: 'Guanajuato',           casos: 876,  tendencia: +16, padecimiento: 'Respiratoria',     sucursales: 287, stockCritico: 9,  region: 'Bajío' },
  MX_GR: { id: 'MX_GR', nombre: 'Guerrero',             casos: 654,  tendencia: +11, padecimiento: 'Gastrointestinal', sucursales: 143, stockCritico: 7,  region: 'Sur' },
  MX_HG: { id: 'MX_HG', nombre: 'Hidalgo',              casos: 487,  tendencia: +8,  padecimiento: 'Viral',            sucursales: 112, stockCritico: 4,  region: 'Centro' },
  MX_JA: { id: 'MX_JA', nombre: 'Jalisco',              casos: 1243, tendencia: +22, padecimiento: 'Viral',            sucursales: 389, stockCritico: 11, region: 'Occidente' },
  MX_EM: { id: 'MX_EM', nombre: 'Estado de México',     casos: 1987, tendencia: +28, padecimiento: 'Gastrointestinal', sucursales: 743, stockCritico: 18, region: 'Centro' },
  MX_MI: { id: 'MX_MI', nombre: 'Michoacán',            casos: 712,  tendencia: +13, padecimiento: 'Respiratoria',     sucursales: 198, stockCritico: 7,  region: 'Occidente' },
  MX_MO: { id: 'MX_MO', nombre: 'Morelos',              casos: 387,  tendencia: +7,  padecimiento: 'Alérgica',         sucursales: 98,  stockCritico: 3,  region: 'Centro' },
  MX_NA: { id: 'MX_NA', nombre: 'Nayarit',              casos: 243,  tendencia: -3,  padecimiento: 'Viral',            sucursales: 54,  stockCritico: 2,  region: 'Occidente' },
  MX_NL: { id: 'MX_NL', nombre: 'Nuevo León',           casos: 934,  tendencia: +17, padecimiento: 'Respiratoria',     sucursales: 312, stockCritico: 8,  region: 'Norte' },
  MX_OA: { id: 'MX_OA', nombre: 'Oaxaca',               casos: 567,  tendencia: +9,  padecimiento: 'Gastrointestinal', sucursales: 167, stockCritico: 5,  region: 'Sur' },
  MX_PU: { id: 'MX_PU', nombre: 'Puebla',               casos: 987,  tendencia: +19, padecimiento: 'Respiratoria',     sucursales: 298, stockCritico: 10, region: 'Centro' },
  MX_QT: { id: 'MX_QT', nombre: 'Querétaro',            casos: 423,  tendencia: +10, padecimiento: 'Viral',            sucursales: 123, stockCritico: 3,  region: 'Bajío' },
  MX_QR: { id: 'MX_QR', nombre: 'Quintana Roo',         casos: 334,  tendencia: +6,  padecimiento: 'Alérgica',         sucursales: 87,  stockCritico: 3,  region: 'Sureste' },
  MX_SL: { id: 'MX_SL', nombre: 'San Luis Potosí',      casos: 478,  tendencia: +8,  padecimiento: 'Crónica',          sucursales: 134, stockCritico: 4,  region: 'Centro-Norte' },
  MX_SI: { id: 'MX_SI', nombre: 'Sinaloa',              casos: 543,  tendencia: +11, padecimiento: 'Gastrointestinal', sucursales: 156, stockCritico: 5,  region: 'Noroeste' },
  MX_SO: { id: 'MX_SO', nombre: 'Sonora',               casos: 498,  tendencia: +9,  padecimiento: 'Alérgica',         sucursales: 143, stockCritico: 4,  region: 'Noroeste' },
  MX_TB: { id: 'MX_TB', nombre: 'Tabasco',              casos: 412,  tendencia: +14, padecimiento: 'Gastrointestinal', sucursales: 98,  stockCritico: 4,  region: 'Sureste' },
  MX_TM: { id: 'MX_TM', nombre: 'Tamaulipas',           casos: 623,  tendencia: +12, padecimiento: 'Respiratoria',     sucursales: 187, stockCritico: 6,  region: 'Norte' },
  MX_TL: { id: 'MX_TL', nombre: 'Tlaxcala',             casos: 267,  tendencia: +5,  padecimiento: 'Viral',            sucursales: 67,  stockCritico: 2,  region: 'Centro' },
  MX_VE: { id: 'MX_VE', nombre: 'Veracruz',             casos: 1842, tendencia: +34, padecimiento: 'Respiratoria',     sucursales: 523, stockCritico: 16, region: 'Sur' },
  MX_YU: { id: 'MX_YU', nombre: 'Yucatán',              casos: 312,  tendencia: -5,  padecimiento: 'Alérgica',         sucursales: 87,  stockCritico: 2,  region: 'Sureste' },
  MX_ZA: { id: 'MX_ZA', nombre: 'Zacatecas',            casos: 287,  tendencia: +4,  padecimiento: 'Crónica',          sucursales: 67,  stockCritico: 2,  region: 'Centro-Norte' },
};

// ── Color por intensidad ───────────────────────────────────────────────────────

const getColor = (casos: number, max: number, hovered: boolean, selected: boolean): string => {
  const t = casos / max;
  if (selected) return '#008CAE';
  if (hovered)  return '#3BA5C9';
  if (t > 0.8)  return '#EF4444';
  if (t > 0.6)  return '#F97316';
  if (t > 0.4)  return '#F59E0B';
  if (t > 0.2)  return '#84CC16';
  return '#10B981';
};

// ── Paths SVG reales de México (jqvmap mex_es) ────────────────────────────────
// El viewBox original del mapa es "0 0 959 593"


// ── Componente principal ───────────────────────────────────────────────────────

export const MapaCalorEstados: React.FC = () => {
  const { colores } = brandingConfig;
  const [hoveredEstado, setHoveredEstado] = useState<string | null>(null);
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string } | null>(null);
  const [filtroRegion, setFiltroRegion] = useState<string>('Todos');

  const maxCasos = Math.max(...Object.values(estadosData).map(e => e.casos));

  const regiones = ['Todos', 'Norte', 'Centro', 'Bajío', 'Occidente', 'Sur', 'Sureste', 'Noroeste', 'Centro-Norte'];

  const estadoDetalle = selectedEstado ? estadosData[selectedEstado] : null;

  // Top 5 estados con más casos
  const top5 = Object.values(estadosData)
    .sort((a, b) => b.casos - a.casos)
    .slice(0, 5);

  return (
    <div
      style={{
        background: colores.fondoSecundario,
        borderRadius: '24px',
        padding: '28px',
        border: `1px solid ${colores.borde}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: '#EF4444', boxShadow: '0 0 8px #EF4444',
                animation: 'pulseMapa 2s infinite',
              }}
            />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: colores.textoClaro, margin: 0, letterSpacing: '-0.3px' }}>
              Mapa de Calor Epidemiológico
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: colores.textoMedio, margin: '4px 0 0 20px' }}>
            Concentración de casos por estado · México · {Object.values(estadosData).reduce((s, e) => s + e.casos, 0).toLocaleString()} casos totales
          </p>
        </div>

        {/* Filtro región */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '320px' }}>
          {regiones.map(r => (
            <button
              key={r}
              onClick={() => setFiltroRegion(r)}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: filtroRegion === r ? colores.primario : colores.fondoTerciario,
                color: filtroRegion === r ? '#fff' : colores.textoMedio,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Layout mapa + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '20px', alignItems: 'start' }}>

        {/* SVG Mapa */}
        <div style={{ position: 'relative' }}>
          {/* Tooltip */}
          {tooltip && estadosData[tooltip.id] && (
            <div
              style={{
                position: 'absolute',
                left: tooltip.x + 10,
                top: tooltip.y - 30,
                background: '#1a1a2e',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                pointerEvents: 'none',
                zIndex: 10,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {estadosData[tooltip.id].nombre}
              <span style={{ marginLeft: '6px', color: getColor(estadosData[tooltip.id].casos, maxCasos, false, false) }}>
                {estadosData[tooltip.id].casos.toLocaleString()} casos
              </span>
            </div>
          )}

          <svg
            viewBox="0 0 959 593"
            style={{ width: '100%', height: 'auto', cursor: 'pointer' }}
          >
            {estadosPaths.map(({ id, path }) => {
              const data = estadosData[id];
              if (!data) return null;
              const filtrado = filtroRegion !== 'Todos' && data.region !== filtroRegion;
              const color = filtrado
                ? colores.fondoTerciario
                : getColor(data.casos, maxCasos, hoveredEstado === id, selectedEstado === id);

              return (
                <path
                  key={id}
                  d={path}
                  fill={color}
                  stroke={colores.fondoSecundario}
                  strokeWidth="1"
                  style={{
                    transition: 'fill 0.25s ease',
                    opacity: filtrado ? 0.3 : 1,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    setHoveredEstado(id);
                    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
                    const pt = svgEl.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgP = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
                    // Use mouse position relative to the container div
                    const containerRect = (e.currentTarget.closest('div') as HTMLElement).getBoundingClientRect();
                    setTooltip({
                      x: e.clientX - containerRect.left,
                      y: e.clientY - containerRect.top,
                      id,
                    });
                  }}
                  onMouseMove={(e) => {
                    const containerRect = (e.currentTarget.closest('div') as HTMLElement).getBoundingClientRect();
                    setTooltip({
                      x: e.clientX - containerRect.left,
                      y: e.clientY - containerRect.top,
                      id,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredEstado(null);
                    setTooltip(null);
                  }}
                  onClick={() => setSelectedEstado(prev => prev === id ? null : id)}
                />
              );
            })}
          </svg>

          {/* Leyenda escala */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            <span style={{ fontSize: '10px', color: colores.textoMedio }}>Bajo</span>
            {['#10B981', '#84CC16', '#F59E0B', '#F97316', '#EF4444'].map(c => (
              <div key={c} style={{ flex: 1, height: '6px', borderRadius: '3px', background: c }} />
            ))}
            <span style={{ fontSize: '10px', color: colores.textoMedio }}>Alto</span>
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Detalle estado seleccionado */}
          {estadoDetalle ? (
            <div
              style={{
                background: colores.fondoTerciario,
                borderRadius: '16px',
                padding: '16px',
                border: `1px solid ${colores.primario}40`,
                animation: 'fadeInMapa 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color={colores.primario} />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: colores.textoClaro }}>
                    {estadoDetalle.nombre}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEstado(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: colores.textoMedio, padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>

              {[
                { label: 'Casos activos',     valor: estadoDetalle.casos.toLocaleString(), color: '#EF4444' },
                { label: 'Tendencia',         valor: `${estadoDetalle.tendencia > 0 ? '+' : ''}${estadoDetalle.tendencia}%`, color: estadoDetalle.tendencia > 0 ? '#EF4444' : '#10B981' },
                { label: 'Padecimiento',      valor: estadoDetalle.padecimiento, color: colores.primario },
                { label: 'Sucursales',        valor: estadoDetalle.sucursales.toString(), color: colores.textoClaro },
                { label: 'SKUs críticos',     valor: estadoDetalle.stockCritico.toString(), color: '#F59E0B' },
                { label: 'Región',            valor: estadoDetalle.region, color: colores.textoMedio },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: colores.textoMedio }}>{row.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: row.color }}>{row.valor}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: colores.fondoTerciario,
                borderRadius: '16px',
                padding: '16px',
                border: `1px solid ${colores.borde}`,
                textAlign: 'center',
              }}
            >
              <MapPin size={24} color={colores.textoOscuro} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '12px', color: colores.textoMedio, margin: 0 }}>
                Selecciona un estado en el mapa para ver el detalle
              </p>
            </div>
          )}

          {/* Top 5 estados */}
          <div
            style={{
              background: colores.fondoTerciario,
              borderRadius: '16px',
              padding: '16px',
              border: `1px solid ${colores.borde}`,
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '800', color: colores.textoClaro, display: 'block', marginBottom: '12px' }}>
              Top 5 Estados
            </span>
            {top5.map((e, i) => {
              const pct = Math.round((e.casos / maxCasos) * 100);
              return (
                <div key={e.id} style={{ marginBottom: '10px', cursor: 'pointer' }} onClick={() => setSelectedEstado(e.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '18px', height: '18px', borderRadius: '5px',
                          background: getColor(e.casos, maxCasos, false, false),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: '800', color: '#fff', flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: colores.textoClaro }}>
                        {e.nombre.length > 16 ? e.nombre.slice(0, 14) + '…' : e.nombre}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', color: e.tendencia > 0 ? '#EF4444' : '#10B981' }}>
                      {e.tendencia > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {e.tendencia > 0 ? '+' : ''}{e.tendencia}%
                    </div>
                  </div>
                  <div style={{ height: '4px', borderRadius: '4px', background: `${colores.borde}`, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: getColor(e.casos, maxCasos, false, false), borderRadius: '4px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats rápidos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Sucursales', valor: '9,600+', icono: <Users size={14} />, color: colores.primario },
              { label: 'SKUs críticos', valor: '156', icono: <Pill size={14} />, color: '#F59E0B' },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  background: colores.fondoTerciario,
                  borderRadius: '12px',
                  padding: '12px',
                  border: `1px solid ${colores.borde}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>{s.icono}</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: colores.textoClaro }}>{s.valor}</div>
                <div style={{ fontSize: '10px', color: colores.textoMedio }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulseMapa {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.4); }
        }
        @keyframes fadeInMapa {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};