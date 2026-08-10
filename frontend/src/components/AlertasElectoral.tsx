import React from 'react';
import { AlertTriangle, Download, ShieldAlert, ListChecks, Layers } from 'lucide-react';
import { Panel, Kpi, Insight, SectionHero, keyframes, wrap, inner, useIsMobile } from './electoral/ui';
import { brandingConfig } from '../config/branding';
import { alertas, forensia, secciones, casillasHistoricas, fmt } from '../data/campeche';
import { useToast } from './electoral/toast';

const { colores } = brandingConfig;
const V = colores.primario;

// Semaforo del Cuadrito 2. El color es una conclusion sobre la evidencia, no un
// juicio: naranja exige fuente identificada y rojo exige documento oficial.
const SEMAFORO = [
  { nivel: 'verde',    label: 'Verde',    color: colores.exito,       desc: 'Comportamiento dentro del rango histórico.' },
  { nivel: 'amarillo', label: 'Amarillo', color: '#EAB308',           desc: 'Desviación que requiere revisión.' },
  { nivel: 'naranja',  label: 'Naranja',  color: colores.advertencia, desc: 'Anomalía significativa con fuente identificada.' },
  { nivel: 'rojo',     label: 'Rojo',     color: colores.peligro,     desc: 'Incidencia confirmada por documentación oficial.' },
] as const;

// Niveles del tablero unificado (Cuadrito 12).
const NIVELES = ['informativa', 'preventiva', 'media', 'alta', 'critica'] as const;
const NIVEL_COLOR: Record<string, string> = {
  informativa: colores.textoOscuro, preventiva: '#0047AB', media: '#EAB308',
  alta: colores.advertencia, critica: colores.peligro,
};

export const AlertasElectoral: React.FC = () => {
  const isMobile = useIsMobile();
  const { push } = useToast();
  const grid = (cols: string): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16,
  });

  // Sin fuente conectada todos los conteos son cero-por-desconocimiento, no
  // cero-por-ausencia-de-anomalias. La UI tiene que decir cuál de los dos es.
  const conteo = (n: string) => alertas.items.filter(a => a.nivel === n).length;
  const sinFuente = alertas.proc.fuente === 'pendiente';

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Forensia y Alertas"
          title={<>Detección de <strong style={{ fontWeight: 800 }}>Anomalías</strong></>}
          subtitle="Inconsistencias estadísticas que ameritan revisión documental. Una anomalía matemática no es una acusación: el semáforo sube de color solo cuando hay fuente y documento que lo respalden."
          right={
            <button onClick={() => push({ kind: 'info', title: 'Sin datos que exportar', msg: 'El módulo de forensia no tiene fuente conectada todavía.' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: '#fff', color: colores.textoClaro, fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 11, cursor: 'pointer' }}>
              <Download size={15} /> Exportar reporte
            </button>
          }
          insights={<>
            <Insight kind="Estimación" title="Sin fuente conectada: cero alertas no significa cero anomalías">
              Los contadores están en cero porque no hay datos cargados, no porque el proceso esté limpio.
              Las {forensia.items.length} comprobaciones del Cuadrito 2 quedan listadas abajo con su insumo pendiente.
            </Insight>
            <Insight kind="Recomendación" title="Primer insumo a conectar: cómputos y PREP">
              La comparación PREP ↔ cómputos distritales ↔ resultados definitivos habilita seis de las
              {' '}{forensia.items.length} comprobaciones de una sola vez. Sujeto a autorización.
            </Insight>
          </>}
        />

        {/* Tablero unificado de alertas (Cuadrito 12) */}
        <div style={{ ...grid('repeat(5, 1fr)'), marginBottom: 22 }}>
          {NIVELES.map(n => (
            <Kpi key={n} label={n[0].toUpperCase() + n.slice(1)} value={sinFuente ? '—' : fmt(conteo(n))}
              sub={sinFuente ? 'pendiente · sin fuente' : 'alertas abiertas'} pendiente={sinFuente} />
          ))}
        </div>

        {/* Semáforo + comprobaciones */}
        <div style={{ ...grid('1fr 1.5fr'), marginBottom: 22 }}>
          <Panel title="Semáforo de forensia" icon={<ShieldAlert size={17} color={V} />} proc={alertas.proc}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {SEMAFORO.map(s => (
                <div key={s.nivel} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
                  borderLeft: `4px solid ${s.color}`, borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: colores.textoClaro }}>{s.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: s.color, background: `${s.color}18`,
                        padding: '2px 8px', borderRadius: 999, fontVariantNumeric: 'tabular-nums',
                      }}>{sinFuente ? '—' : 0}</span>
                    </div>
                    <div style={{ fontSize: 12, color: colores.textoOscuro, marginTop: 3, lineHeight: 1.45 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Comprobaciones de forensia"
            icon={<ListChecks size={17} color={V} />}
            proc={forensia.proc}
            right={<span style={{ fontSize: 12, color: colores.textoOscuro }}>{forensia.items.length} definidas</span>}
          >
            <p style={{ fontSize: 12.5, color: colores.textoOscuro, margin: '0 0 14px', lineHeight: 1.45 }}>
              Cada comprobación del Cuadrito 2 con el insumo que necesita. Ninguna puede correr todavía.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflow: 'auto' }}>
              {forensia.items.map(c => (
                <div key={c.id} style={{
                  display: 'flex', gap: 11, alignItems: 'flex-start',
                  background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
                  borderRadius: 11, padding: '10px 12px', opacity: 0.85,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: colores.textoOscuro,
                    flexShrink: 0, marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colores.textoClaro }}>{c.nombre}</div>
                    <div style={{ fontSize: 11.5, color: colores.textoOscuro, marginTop: 2 }}>
                      granularidad: {c.granularidad} · insumo: {c.insumo}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, color: colores.textoOscuro,
                    background: colores.fondoTerciario, padding: '3px 9px', borderRadius: 999, flexShrink: 0,
                  }}>sin datos</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Por qué no puede correr todavía */}
        <Panel title="Granularidad requerida" icon={<Layers size={17} color={colores.advertencia} />} proc={secciones.proc}>
          <p style={{ fontSize: 13, color: colores.textoMedio, lineHeight: 1.55, margin: '0 0 14px' }}>
            La forensia compara casillas cercanas entre sí y detecta variaciones sección a sección. Eso exige los
            registros reales de cada nivel: un número estimado desde el municipio no sirve para esta comparación,
            y por eso estos bloques se mantienen vacíos en lugar de rellenarse.
          </p>
          <div style={grid('1fr 1fr')}>
            {[secciones, casillasHistoricas].map(b => (
              <div key={b.hoja} style={{
                background: colores.fondoSecundario, border: `1px dashed ${colores.borde}`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AlertTriangle size={14} color={colores.advertencia} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: colores.textoClaro }}>{b.hoja}</span>
                </div>
                <div style={{ fontSize: 12, color: colores.textoOscuro, lineHeight: 1.5 }}>{b.nota}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
