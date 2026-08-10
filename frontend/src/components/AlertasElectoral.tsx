import React, { useState } from 'react';
import { AlertTriangle, Download, Target, TrendingDown, Swords, Check, Zap } from 'lucide-react';
import { Panel, Kpi, Insight, SectionHero, keyframes, wrap, inner, useIsMobile } from './electoral/ui';
import { brandingConfig } from '../config/branding';
import { porAnio, ULTIMO, fmt, PARTIDO_COLOR } from '../data/electoral';
import { useToast } from './electoral/toast';
import { useConfirm } from './electoral/confirm';

const { colores } = brandingConfig;
const V = colores.primario;
const D = porAnio[ULTIMO];
const recuperablesCerca = D.recuperables.filter(r => r.margen <= 5).length;

const RecuperableRow: React.FC<{ m: typeof D.recuperables[number] }> = ({ m }) => {
  const { push } = useToast();
  const confirmar = useConfirm();
  const [activo, setActivo] = useState(false);
  const plan = `${m.municipio}: plan focalizado para recuperar ${m.margen} ${m.margen === 1 ? 'voto' : 'votos'} y voltear el municipio.`;
  const activar = async () => {
    if (await confirmar({ titulo: `Movilización · ${m.municipio}`, descripcion: plan })) {
      setActivo(true);
      push({ kind: 'success', title: 'Movilización activada', msg: plan });
    }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: activo ? `${V}0D` : colores.fondoSecundario, border: `1px solid ${activo ? V : colores.borde}`, borderRadius: 12, padding: '11px 13px', transition: 'all .3s' }} className="el-anim">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: colores.textoClaro, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.municipio}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: PARTIDO_COLOR[m.gano] || colores.textoOscuro, background: `${PARTIDO_COLOR[m.gano] || colores.textoOscuro}18`, padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>{m.gano}</span>
        </div>
        <div style={{ fontSize: 11.5, color: colores.textoOscuro, marginTop: 2 }}>PRI: {fmt(m.votosPRI)} · perdió por {m.margen} {m.margen === 1 ? 'voto' : 'votos'}</div>
      </div>
      {activo ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: colores.exito, flexShrink: 0 }}><Check size={15} /> Activo</span>
      ) : (
        <button onClick={activar}
          style={{ border: 'none', background: V, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '7px 15px', borderRadius: 9, cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Zap size={13} /> Activar
        </button>
      )}
    </div>
  );
};

export const AlertasElectoral: React.FC = () => {
  const isMobile = useIsMobile();
  const { push } = useToast();
  const grid = (cols: string): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16 });
  const dif = D.ganadosPRI - D.ganadosSegunda;
  const maxAbst = D.riesgoAbst[0]?.abst || 100;

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Sistema de Alerta"
          title={<>Focos de <strong style={{ fontWeight: 800 }}>Atención</strong></>}
          subtitle={`${ULTIMO} · prioridades detectadas sobre la data real. Cada foco es accionable — MAYIA arma el plan.`}
          right={
            <button onClick={() => push({ kind: 'info', title: 'Reporte exportado', msg: 'Focos de atención listos para descarga.' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: '#fff', color: colores.textoClaro, fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 11, cursor: 'pointer' }}>
              <Download size={15} /> Exportar reporte
            </button>
          }
          insights={<>
            <Insight kind="Sugerencia" title={`${recuperablesCerca} municipios perdidos por 5 votos o menos`} plan={`Movilización focalizada en ${recuperablesCerca} municipios de margen mínimo.`}>
              MAYIA detectó {recuperablesCerca} municipios donde el PRI quedó a ≤5 votos de ganar. Un plan de movilización focalizada podría voltearlos.
            </Insight>
            <Insight kind="Análisis" title={`Abstención ${D.abstProm}%`} plan={`Refuerzo de estructura territorial en plazas de mayor abstención.`}>
              La abstención promedio de {ULTIMO} es {D.abstProm}%. MAYIA recomienda reforzar la estructura territorial en las plazas de mayor abstención.
            </Insight>
          </>}
        />

        {/* KPIs */}
        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 22 }}>
          <Kpi label="Municipios PRI" value={fmt(D.ganadosPRI)} sub="ganados" up />
          <Kpi label="2ª fuerza" value={D.segundaFuerza} sub={`${D.ganadosSegunda} municipios`} />
          <Kpi label="Abstención" value={`${D.abstProm}%`} sub="promedio estado" up={false} />
          <Kpi label="Oportunidades" value={fmt(D.recuperables.length)} sub="municipios recuperables" up />
        </div>

        {/* Recuperables + Riesgo abstención */}
        <div style={{ ...grid('1fr 1fr'), marginBottom: 22 }}>
          <Panel title="Municipios recuperables" icon={<Target size={17} color={V} />} right={<span style={{ fontSize: 22, fontWeight: 800, color: colores.textoClaro }}>{D.recuperables.length}</span>}>
            <p style={{ fontSize: 12.5, color: colores.textoOscuro, margin: '0 0 14px', lineHeight: 1.4 }}>Municipios donde el PRI perdió por 6 votos o menos. Activa un plan de movilización para cada uno.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {D.recuperables.map((m, i) => <RecuperableRow key={i} m={m} />)}
            </div>
          </Panel>

          <Panel title="Riesgo de baja participación" icon={<TrendingDown size={17} color={colores.advertencia} />}>
            <p style={{ fontSize: 12.5, color: colores.textoOscuro, margin: '0 0 14px', lineHeight: 1.4 }}>Municipios con mayor abstención histórica. Foco de trabajo para movilización.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {D.riesgoAbst.map((m, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: colores.textoClaro, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>{m.municipio}</span>
                    <span style={{ color: colores.peligro, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.abst}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                    <div style={{ width: `${m.abst / maxAbst * 100}%`, height: '100%', background: colores.advertencia, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Competencia */}
        <Panel title={`Análisis de competencia · ${ULTIMO}`} icon={<Swords size={17} color={V} />}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: PARTIDO_COLOR.PRI, padding: '5px 12px', borderRadius: 999 }}>PRI · {D.ganadosPRI}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: PARTIDO_COLOR[D.segundaFuerza] || colores.textoOscuro, padding: '5px 12px', borderRadius: 999 }}>{D.segundaFuerza} · {D.ganadosSegunda}</span>
          </div>
          <div style={{ height: 14, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${D.ganadosPRI / D.totalMunicipios * 100}%`, background: PARTIDO_COLOR.PRI }} title={`PRI ${D.ganadosPRI}`} />
            <div style={{ width: `${D.ganadosSegunda / D.totalMunicipios * 100}%`, background: PARTIDO_COLOR[D.segundaFuerza] || colores.textoOscuro }} title={`${D.segundaFuerza} ${D.ganadosSegunda}`} />
          </div>
          <p style={{ fontSize: 13, color: colores.textoMedio, lineHeight: 1.5, margin: '14px 0 0' }}>
            En {ULTIMO}, el PRI ganó {D.ganadosPRI} municipios de {D.totalMunicipios} totales. La segunda fuerza es {D.segundaFuerza} con {D.ganadosSegunda} municipios. Diferencia: {dif} plazas.
          </p>
          <div style={{ ...grid('repeat(4, 1fr)'), marginTop: 16 }}>
            {[
              { n: fmt(D.totalMunicipios), l: 'Municipios en disputa' },
              { n: fmt(D.ganadosPRI), l: 'Ganados PRI' },
              { n: fmt(D.ganadosSegunda), l: `Ganados ${D.segundaFuerza}` },
              { n: fmt(dif), l: 'Diferencia' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', background: colores.fondoSecundario, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '14px 8px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: colores.textoClaro }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: colores.textoOscuro, marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
