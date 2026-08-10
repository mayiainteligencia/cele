import React, { useState } from 'react';
import { BarChart3, PieChart as PieIcon, TrendingUp, Trophy, Vote } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Panel, Kpi, Insight, SectionHero, keyframes, wrap, inner, useIsMobile } from './electoral/ui';
import { brandingConfig } from '../config/branding';
import { porAnio, ANIOS, ULTIMO, fmt, PARTIDO_COLOR, proyeccionPRI } from '../data/electoral';

const { colores } = brandingConfig;
const V = colores.primario;

const tendencia = ANIOS.map(a => ({ anio: String(a), share: porAnio[String(a)].sharePRI, ganados: porAnio[String(a)].ganadosPRI }));

export const ResultadosElectorales: React.FC = () => {
  const isMobile = useIsMobile();
  const [anio, setAnio] = useState(ULTIMO);
  const D = porAnio[anio];
  const proj = proyeccionPRI();
  const grid = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16 });

  const ganadosData = Object.entries(D.ganados).sort((a, b) => b[1] - a[1]);
  const pieData = ganadosData.map(([p, v]) => ({ name: p, value: v }));

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Análisis Electoral"
          title={<>Resultados <strong style={{ fontWeight: 800 }}>Electorales</strong></>}
          subtitle="Elecciones municipales. Selecciona el año para comparar la evolución del voto."
          right={
            <div style={{ display: 'inline-flex', gap: 6, background: 'rgba(255,255,255,.12)', padding: 5, borderRadius: 12 }}>
              {ANIOS.map(a => {
                const on = String(a) === anio;
                return (
                  <button key={a} onClick={() => setAnio(String(a))} style={{
                    border: 'none', cursor: 'pointer', padding: '8px 20px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                    background: on ? '#fff' : 'transparent', color: on ? colores.textoClaro : 'rgba(255,255,255,.75)', transition: 'all .2s',
                  }}>{a}</button>
                );
              })}
            </div>
          }
          insights={<>
            <Insight kind="Predicción" title={`Proyección PRI: ~${proj}% próxima elección`}>
              La votación PRI pasó de {porAnio[String(ANIOS[0])].sharePRI}% ({ANIOS[0]}) a {porAnio[ULTIMO].sharePRI}% ({ULTIMO}). MAYIA proyecta ~{proj}% si la tendencia se mantiene.
            </Insight>
            <Insight kind="Análisis" title={`${D.segundaFuerza} es la 2ª fuerza (${D.ganadosSegunda} municipios)`}>
              Tras el PRI, {D.segundaFuerza} concentra {D.ganadosSegunda} municipios. Vigilar su avance en la próxima elección.
            </Insight>
          </>}
        />

        {/* KPIs */}
        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 22 }}>
          <Kpi label="Alcance PRI" value={`${Math.round(D.ganadosPRI / D.totalMunicipios * 100)}%`} sub="municipios ganados" up />
          <Kpi label="Ganados PRI" value={fmt(D.ganadosPRI)} delta={`de ${fmt(D.totalMunicipios)}`} up />
          <Kpi label="Votos totales" value={fmt(D.totalVotos)} sub={`share PRI ${D.sharePRI}%`} up />
          <Kpi label="Abstención" value={`${D.abstProm}%`} sub="promedio estado" up={false} />
        </div>

        {/* Ganados (dona) + Tendencia histórica */}
        <div style={{ ...grid('1fr 1.3fr'), marginBottom: 22 }}>
          <Panel title={`Municipios ganados · ${anio}`} icon={<PieIcon size={17} color={V} />}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ width: 150, height: 150, position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {pieData.map(d => <Cell key={d.name} fill={PARTIDO_COLOR[d.name] || colores.textoOscuro} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [`${v} municipios`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: colores.textoClaro }}>{fmt(D.totalMunicipios)}</span>
                  <span style={{ fontSize: 11, color: colores.textoOscuro }}>total</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
                {ganadosData.map(([p, v]) => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: PARTIDO_COLOR[p] || colores.textoOscuro, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: colores.textoClaro, flex: 1 }}>{p}</span>
                    <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>{v} · {Math.round(v / D.totalMunicipios * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Tendencia histórica PRI" icon={<TrendingUp size={17} color={V} />}>
            <div style={{ height: 210 }}>
              <ResponsiveContainer>
                <LineChart data={tendencia} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colores.borde} vertical={false} />
                  <XAxis dataKey="anio" tick={{ fontSize: 12, fill: colores.textoOscuro }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: colores.textoOscuro }} axisLine={false} tickLine={false} unit="%" domain={[0, 60]} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Share PRI']} />
                  <Line type="monotone" dataKey="share" stroke={V} strokeWidth={3} dot={{ r: 5, fill: V }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6 }}>
              {tendencia.map(t => (
                <div key={t.anio} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: colores.textoClaro }}>{t.ganados}</div>
                  <div style={{ fontSize: 11.5, color: colores.textoOscuro }}>municipios · {t.anio}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Votos por partido + Top municipios */}
        <div style={grid('1fr 1fr')}>
          <Panel title={`Votos por partido · ${anio}`} icon={<Vote size={17} color={V} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {Object.entries(D.votosPorPartido).map(([p, v]) => {
                const pct = Math.round(v / D.totalVotos * 1000) / 10;
                return (
                  <div key={p}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: colores.textoClaro }}>{p}</span>
                      <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>{fmt(v)} · {pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: PARTIDO_COLOR[p] || colores.textoOscuro, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title={`Top municipios PRI · ${anio}`} icon={<Trophy size={17} color={V} />} right={<span style={{ fontSize: 12, color: colores.textoOscuro }}>{D.topPRI.length} registros</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {D.topPRI.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: colores.fondoSecundario, border: `1px solid ${colores.borde}`, borderRadius: 11, padding: '10px 12px' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: colores.textoClaro, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colores.textoClaro, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.municipio}</div>
                    <div style={{ fontSize: 11.5, color: colores.textoOscuro }}>{fmt(m.votosPRI)} votos PRI</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: PARTIDO_COLOR[m.ganador] || V, background: `${PARTIDO_COLOR[m.ganador] || V}18`, padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>{m.ganador}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
