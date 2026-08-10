import React, { useState } from 'react';
import { PieChart as PieIcon, TrendingUp, Vote, Users } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Panel, Kpi, Insight, SectionHero, keyframes, wrap, inner, useIsMobile } from './electoral/ui';
import { brandingConfig } from '../config/branding';
import {
  RESULTADOS, resultadosDe, fmt, fmtPct, colorPartido, PARTIDOS,
  type TipoEleccion,
} from '../data/campeche';

const { colores } = brandingConfig;
const V = colores.primario;

const ETIQUETA: Record<TipoEleccion, string> = {
  gubernatura: 'Gubernatura',
  ayuntamientos: 'Ayuntamientos',
  diputaciones_loc: 'Dip. locales',
  diputaciones_fed: 'Dip. federales',
  senado: 'Senado',
  presidencia: 'Presidencia',
};
const TIPOS = Object.keys(RESULTADOS) as TipoEleccion[];

export const ResultadosElectorales: React.FC = () => {
  const isMobile = useIsMobile();
  const [tipo, setTipo] = useState<TipoEleccion>('gubernatura');
  const bloque = resultadosDe(tipo);
  const serie = bloque.items;
  const [anio, setAnio] = useState<number | null>(null);
  const D = serie.find(r => r.anio === anio) ?? serie[serie.length - 1];

  const grid = (cols: string): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16,
  });

  const ranking = Object.entries(D.votosPorPartido)
    .map(([partido, votos]) => ({ partido, votos, pct: +(votos / D.votosValidos * 100).toFixed(1) }))
    .sort((a, b) => b.votos - a.votos);

  // Evolucion multipartidista: una linea por partido, sin protagonista.
  const evolucion = serie.map(r => ({
    anio: String(r.anio),
    ...Object.fromEntries(PARTIDOS.map(p => [p, +(r.votosPorPartido[p] / r.votosValidos * 100).toFixed(1)])),
  }));

  const btn = (activo: boolean): React.CSSProperties => ({
    border: 'none', cursor: 'pointer', padding: '8px 15px', borderRadius: 9,
    fontSize: 13, fontWeight: 700, transition: 'all .2s',
    background: activo ? '#fff' : 'transparent',
    color: activo ? colores.textoClaro : 'rgba(255,255,255,.75)',
  });

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Análisis Electoral"
          title={<>Resultados <strong style={{ fontWeight: 800 }}>Electorales</strong></>}
          subtitle="Histórico por tipo de elección. Selecciona cargo y año para comparar la evolución del voto entre todas las fuerzas."
          right={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: 'rgba(255,255,255,.12)', padding: 5, borderRadius: 12 }}>
              {TIPOS.map(t => (
                <button key={t} style={btn(t === tipo)}
                  onClick={() => { setTipo(t); setAnio(null); }}>
                  {ETIQUETA[t]}
                </button>
              ))}
            </div>
          }
          insights={<>
            <Insight kind="Estimación" title="Cifras de ejemplo, no resultados oficiales">
              Los años del calendario electoral son reales, pero la votación es simulada. Se sustituye al conectar
              el SICEE del INE; hasta entonces ninguna de estas cifras describe una elección real.
            </Insight>
            <Insight kind="Cálculo" title={`Abstencionismo ${fmtPct(D.abstencionismo)} en ${D.anio}`}>
              Calculado como 1 − (votación total ÷ lista nominal), según la fórmula del anexo 1.6.
            </Insight>
          </>}
        />

        {/* Selector de año */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {serie.map(r => (
            <button key={r.anio} onClick={() => setAnio(r.anio)} style={{
              border: `1px solid ${r.anio === D.anio ? V : colores.borde}`,
              background: r.anio === D.anio ? `${V}12` : colores.fondoClaro,
              color: r.anio === D.anio ? V : colores.textoMedio,
              fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
            }}>{r.anio}</button>
          ))}
        </div>

        {/* KPIs */}
        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 22 }}>
          <Kpi label="Ganador" value={D.ganador} sub={`2º: ${D.segundo} · margen ${D.margenPuntos} pp`} pendiente />
          <Kpi label="Votos emitidos" value={fmt(D.votosEmitidos)} sub={`${fmt(D.votosNulos)} nulos`} pendiente />
          <Kpi label="Participación" value={fmtPct(D.participacion)} sub={`lista nominal ${fmt(D.listaNominal)}`} pendiente />
          <Kpi label="Abstencionismo" value={fmtPct(D.abstencionismo)} sub="1 − (votación / lista nominal)" pendiente />
        </div>

        {/* Distribución + evolución */}
        <div style={{ ...grid('1fr 1.3fr'), marginBottom: 22 }}>
          <Panel title={`Distribución del voto · ${D.anio}`} icon={<PieIcon size={17} color={V} />} proc={bloque.proc}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ width: 150, height: 150, position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={ranking} dataKey="votos" nameKey="partido" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {ranking.map(d => <Cell key={d.partido} fill={colorPartido(d.partido)} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [`${fmt(v)} votos`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: colores.textoClaro }}>{fmt(D.votosValidos)}</span>
                  <span style={{ fontSize: 11, color: colores.textoOscuro }}>válidos</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
                {ranking.map((d, i) => (
                  <div key={d.partido} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: colores.textoOscuro, fontSize: 11, width: 14 }}>{i + 1}.</span>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: colorPartido(d.partido), flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: colores.textoClaro, flex: 1 }}>{d.partido}</span>
                    <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title={`Evolución por partido · ${ETIQUETA[tipo]}`} icon={<TrendingUp size={17} color={V} />} proc={bloque.proc}>
            <div style={{ height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={evolucion} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colores.borde} vertical={false} />
                  <XAxis dataKey="anio" tick={{ fontSize: 12, fill: colores.textoOscuro }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: colores.textoOscuro }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip formatter={(v: number, n: string) => [`${v}%`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                  {PARTIDOS.map(p => (
                    <Line key={p} type="monotone" dataKey={p} stroke={colorPartido(p)} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Votos por partido + participación */}
        <div style={grid('1.3fr 1fr')}>
          <Panel title={`Votos por partido · ${D.anio}`} icon={<Vote size={17} color={V} />} proc={bloque.proc}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {ranking.map(d => (
                <div key={d.partido}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: colores.textoClaro }}>{d.partido}</span>
                    <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.votos)} · {d.pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background: colorPartido(d.partido), borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Participación y abstencionismo" icon={<Users size={17} color={V} />} proc={bloque.proc}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {serie.map(r => (
                <div key={r.anio}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, color: colores.textoClaro }}>{r.anio}</span>
                    <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>
                      part. {r.participacion}% · abst. {r.abstencionismo}%
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${r.participacion}%`, background: V }} title={`Participación ${r.participacion}%`} />
                    <div style={{ width: `${r.abstencionismo}%`, background: colores.advertencia }} title={`Abstencionismo ${r.abstencionismo}%`} />
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
