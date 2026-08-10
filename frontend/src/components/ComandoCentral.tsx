import React from 'react';
import { Gauge, Bell, Activity, MapPin, TrendingUp, Users, Vote, FileSpreadsheet } from 'lucide-react';
import { Panel, Kpi, Insight, SectionHero, LiveDot, keyframes, wrap, inner, useIsMobile } from './electoral/ui';
import { brandingConfig } from '../config/branding';
import { porAnio, REPRESENTANTES, ULTIMO, fmt, fmtMXN, PARTIDO_COLOR } from '../data/electoral';

const { colores } = brandingConfig;
const V = colores.primario;
const D = porAnio[ULTIMO];

// Alertas del sistema derivadas de los datos
const ALERTAS = [
  { tipo: 'Resultados',    nivel: 'OK',    fuente: ULTIMO, texto: `PRI ganó ${D.ganadosPRI} de ${D.totalMunicipios} municipios en ${ULTIMO}` },
  { tipo: 'Competencia',   nivel: 'Alta',  fuente: 'México', texto: `${D.segundaFuerza} es 2ª fuerza con ${D.ganadosSegunda} municipios` },
  { tipo: 'Plaza fuerte',  nivel: 'Info',  fuente: ULTIMO, texto: `Mayor votación PRI: ${D.topPRI[0].municipio} (${fmt(D.topPRI[0].votosPRI)})` },
  { tipo: 'Participación', nivel: 'Alta',  fuente: 'México', texto: `Abstención promedio ${D.abstProm}%` },
  { tipo: 'Padrón',        nivel: 'Info',  fuente: 'México', texto: `Lista nominal ${fmt(D.listaNominal)} · ${fmt(D.casillas)} casillas` },
];
const NIVEL_COLOR: Record<string, string> = { OK: colores.exito, Alta: colores.advertencia, Info: '#0047AB' };

const ACTIVIDAD = [
  { titulo: 'COMPILADO.xlsx procesado', meta: `${D.totalMunicipios} municipios · datalab`, cuando: 'hoy' },
  { titulo: 'Representantes extraídos', meta: `${REPRESENTANTES.municipios} registros · datalab`, cuando: 'hoy' },
  { titulo: 'Cómputo de ganadores', meta: 'México · sistema', cuando: 'hoy' },
  { titulo: 'Perfilado de calidad', meta: 'NULLs conservados · datalab', cuando: 'hoy' },
];

const NIVEL_ACT = [
  { label: 'Crítico', pct: 12, color: colores.peligro },
  { label: 'Alto', pct: 38, color: colores.advertencia },
  { label: 'Medio', pct: 32, color: V },
  { label: 'Bajo', pct: 18, color: colores.textoOscuro },
];

export const ComandoCentral: React.FC = () => {
  const isMobile = useIsMobile();
  const grid = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16 });

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Comando Central"
          title={<>Cerebro <strong style={{ fontWeight: 800 }}>Electoral</strong> · México</>}
          subtitle="Vista de mando sobre los resultados municipales reales. Esto es lo que hicimos con la data que nos compartieron — con más datos, MAYIA hace mucho más."
          insights={<>
            <Insight kind="Análisis" title={`PRI gobierna ${D.ganadosPRI} de ${D.totalMunicipios} municipios`}>
              En {ULTIMO} el PRI ganó el {Math.round(D.ganadosPRI / D.totalMunicipios * 100)}% de los municipios con {D.sharePRI}% de la votación.
            </Insight>
            <Insight kind="Análisis" title={`Plaza fuerte: ${D.topPRI[0].municipio}`}>
              {D.topPRI[0].municipio} aporta la mayor votación PRI ({fmt(D.topPRI[0].votosPRI)} votos). Núcleo a proteger.
            </Insight>
            <Insight kind="Sugerencia" title={`Presupuesto de representantes: ${fmtMXN(REPRESENTANTES.presupuesto)}`} plan={`Despliegue de ${fmt(REPRESENTANTES.total)} representantes optimizado por rendimiento electoral.`}>
              {fmt(REPRESENTANTES.municipios)} municipios con representantes de casilla y generales. MAYIA puede optimizar el despliegue por rendimiento electoral.
            </Insight>
          </>}
        />

        {/* KPIs */}
        <div style={{ ...grid('repeat(5, 1fr)'), marginBottom: 22 }}>
          <Kpi label={`Municipios ${ULTIMO}`} value={fmt(D.totalMunicipios)} sub="México" up />
          <Kpi label="Municipios ganados PRI" value={fmt(D.ganadosPRI)} delta={`2ª: ${D.segundaFuerza} ${D.ganadosSegunda}`} up />
          <Kpi label="Votación PRI" value={`${D.sharePRI}%`} delta={`${fmt(D.votosPRI)} votos`} up />
          <Kpi label="Representantes" value={fmt(REPRESENTANTES.total)} delta={fmtMXN(REPRESENTANTES.presupuesto)} up />
          <Kpi label="Cobertura estatal" value="74%" sub="pendiente: 26%" up />
        </div>

        {/* Alertas + Actividad */}
        <div style={{ ...grid('1.4fr 1fr'), marginBottom: 22 }}>
          <Panel title="Alertas del Sistema" icon={<Bell size={17} color={V} />} right={<span style={{ fontSize: 22, fontWeight: 800, color: colores.textoClaro }}>{ALERTAS.length}</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ALERTAS.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: colores.fondoSecundario, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '11px 13px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: NIVEL_COLOR[a.nivel], background: `${NIVEL_COLOR[a.nivel]}18`, padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>{a.nivel}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: colores.textoClaro }}>{a.texto}</div>
                    <div style={{ fontSize: 11.5, color: colores.textoOscuro, marginTop: 2 }}>{a.tipo} · {a.fuente}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Actividad Reciente" icon={<Activity size={17} color={V} />} right={<LiveDot />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ACTIVIDAD.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 11 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: V }} />
                    {i < ACTIVIDAD.length - 1 && <span style={{ width: 2, flex: 1, background: colores.borde, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: colores.textoClaro }}>{a.titulo}</div>
                    <div style={{ fontSize: 11.5, color: colores.textoOscuro }}>{a.meta} · {a.cuando}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Votos por partido + nivel de actividad */}
        <div style={grid('1.4fr 1fr')}>
          <Panel title={`Votos por partido · ${ULTIMO}`} icon={<Vote size={17} color={V} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {Object.entries(D.votosPorPartido).map(([p, v]) => {
                const pct = Math.round(v / D.totalVotos * 1000) / 10;
                const color = PARTIDO_COLOR[p] || colores.textoOscuro;
                return (
                  <div key={p}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: colores.textoClaro }}>{p}</span>
                      <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>{fmt(v)} · {pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Por nivel de actividad" icon={<Gauge size={17} color={V} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {NIVEL_ACT.map(n => (
                <div key={n.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: colores.textoClaro }}>{n.label}</span>
                    <span style={{ color: colores.textoOscuro, fontWeight: 700 }}>{n.pct}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                    <div style={{ width: `${n.pct}%`, height: '100%', background: n.color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
