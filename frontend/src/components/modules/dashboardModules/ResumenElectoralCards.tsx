import React from 'react';
import { Command, ClipboardList, Bell, ArrowUpRight, ChevronRight } from 'lucide-react';
import { brandingConfig } from '../../../config/branding';
import { porAnio, REPRESENTANTES, ULTIMO, fmt, PARTIDO_COLOR } from '../../../data/electoral';

const { colores } = brandingConfig;
const V = colores.primario;
const D = porAnio[ULTIMO];

type Row = { label: string; value: string; color?: string };

const Card: React.FC<{
  icon: React.ElementType; titulo: string; subtitulo: string; seccion: string;
  onGo?: (s: string) => void; rows: Row[]; cta: string;
}> = ({ icon: Icon, titulo, subtitulo, seccion, onGo, rows, cta }) => (
  <button
    onClick={() => onGo?.(seccion)}
    style={{
      textAlign: 'left', width: '100%', height: '100%', cursor: 'pointer',
      background: colores.fondoClaro, borderRadius: 20, padding: 24,
      border: `1px solid ${colores.borde}`, boxShadow: colores.sombra,
      display: 'flex', flexDirection: 'column', transition: 'transform .18s, box-shadow .18s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = colores.sombraGrande; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = colores.sombra; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${V}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={V} />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: colores.textoClaro, margin: 0 }}>{titulo}</h3>
        <p style={{ fontSize: 12, color: colores.textoOscuro, margin: '2px 0 0' }}>{subtitulo}</p>
      </div>
      <ArrowUpRight size={18} color={colores.textoOscuro} />
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colores.fondoSecundario, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '11px 13px' }}>
          <span style={{ fontSize: 13, color: colores.textoMedio, fontWeight: 500 }}>{r.label}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: r.color || colores.textoClaro, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
        </div>
      ))}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, color: V, fontSize: 13, fontWeight: 700 }}>
      {cta} <ChevronRight size={15} />
    </div>
  </button>
);

export const ResumenElectoralCards: React.FC<{ onSectionChange?: (s: string) => void }> = ({ onSectionChange }) => {
  const topPartidos = Object.entries(D.votosPorPartido).slice(0, 3);
  return (
    <>
      <Card
        icon={Command} titulo="Comando Central" subtitulo={`México · ${ULTIMO}`} seccion="comando" onGo={onSectionChange} cta="Abrir comando"
        rows={[
          { label: 'Municipios ganados PRI', value: `${fmt(D.ganadosPRI)} / ${fmt(D.totalMunicipios)}` },
          { label: 'Votación PRI', value: `${D.sharePRI}%`, color: PARTIDO_COLOR.PRI },
          { label: 'Representantes', value: fmt(REPRESENTANTES.total) },
        ]}
      />
      <Card
        icon={ClipboardList} titulo="Resultados" subtitulo="Elecciones municipales" seccion="resultados" onGo={onSectionChange} cta="Ver resultados"
        rows={topPartidos.map(([p, v]) => ({ label: p, value: `${fmt(v)}`, color: PARTIDO_COLOR[p] }))}
      />
      <Card
        icon={Bell} titulo="Alertas" subtitulo="Focos de atención" seccion="alertas" onGo={onSectionChange} cta="Revisar alertas"
        rows={[
          { label: 'Municipios recuperables', value: fmt(D.recuperables.length), color: V },
          { label: 'Abstención promedio', value: `${D.abstProm}%`, color: colores.advertencia },
          { label: `2ª fuerza (${D.segundaFuerza})`, value: `${D.ganadosSegunda} mun.` },
        ]}
      />
    </>
  );
};
