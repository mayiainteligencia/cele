import React from 'react';
import { Command, ClipboardList, Bell, ArrowUpRight, ChevronRight } from 'lucide-react';
import { brandingConfig } from '../../../config/branding';
import {
  ESTADO, localidadesResumen, controlCalidad, municipios,
  forensia, resultadosDe, fmt, colorPartido,
} from '../../../data/campeche';

const { colores } = brandingConfig;
const V = colores.primario;

// `pendiente` apaga el valor: sin fuente real, la cifra no puede leerse igual
// que un dato verificado (mismo criterio que <Kpi pendiente> del kit).
type Row = { label: string; value: string; color?: string; pendiente?: boolean };

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
          <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.pendiente ? colores.textoOscuro : (r.color || colores.textoClaro) }}>{r.value}</span>
        </div>
      ))}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, color: V, fontSize: 13, fontWeight: 700 }}>
      {cta} <ChevronRight size={15} />
    </div>
  </button>
);

export const ResumenElectoralCards: React.FC<{ onSectionChange?: (s: string) => void }> = ({ onSectionChange }) => {
  const gub = resultadosDe('gubernatura');
  const ultima = gub.items[gub.items.length - 1];
  const top3 = Object.entries(ultima.votosPorPartido)
    .sort((a, b) => b[1] - a[1]).slice(0, 3);
  const pendientes = controlCalidad.items.filter(c => c.estado === 'vacio').length;

  return (
    <>
      <Card
        icon={Command} titulo="Comando Central" subtitulo={`${ESTADO.nombre} · INEGI 2020`} seccion="comando" onGo={onSectionChange} cta="Abrir comando"
        rows={[
          { label: 'Población total', value: fmt(ESTADO.poblacion2020) },
          { label: 'Municipios', value: String(municipios.items.length) },
          { label: 'Localidades', value: fmt(localidadesResumen.resumen.total) },
        ]}
      />
      <Card
        icon={ClipboardList} titulo="Resultados" subtitulo={`Gubernatura ${ultima.anio} · ejemplo`} seccion="resultados" onGo={onSectionChange} cta="Ver resultados"
        rows={top3.map(([p, v]) => ({ label: p, value: fmt(v), color: colorPartido(p), pendiente: true }))}
      />
      <Card
        icon={Bell} titulo="Alertas y forensia" subtitulo="Cuadrito 2" seccion="alertas" onGo={onSectionChange} cta="Revisar alertas"
        rows={[
          { label: 'Comprobaciones definidas', value: String(forensia.items.length), color: V },
          { label: 'Bloques sin fuente', value: `${pendientes} / ${controlCalidad.items.length}`, color: colores.advertencia },
          { label: 'Alertas abiertas', value: '—', pendiente: true },
        ]}
      />
    </>
  );
};
