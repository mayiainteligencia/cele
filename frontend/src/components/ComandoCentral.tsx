import React from 'react';
import { Gauge, Bell, Activity, Vote, Users, MapPin, School } from 'lucide-react';
import {
  Panel, Kpi, Insight, SectionHero, LiveDot, Procedencia,
  keyframes, wrap, inner, useIsMobile,
} from './electoral/ui';
import { brandingConfig } from '../config/branding';
import {
  ESTADO, municipios, secciones, casillasVigentes, casillasHistoricas,
  escuelasResumen, localidadesResumen, controlCalidad, resultadosDe,
  totalListaNominal, fmt, fmtPct, colorPartido, PARTIDOS,
} from '../data/campeche';

const { colores } = brandingConfig;
const V = colores.primario;

// Ultima eleccion de gubernatura: referencia del estado de la plaza.
const GUB = resultadosDe('gubernatura');
const ultimaGub = GUB.items[GUB.items.length - 1];

// Ranking multipartidista: sin protagonista fijo, el orden lo dan los votos.
const posiciones = Object.entries(ultimaGub.votosPorPartido)
  .sort((a, b) => b[1] - a[1])
  .map(([partido, votos]) => ({
    partido, votos, pct: +(votos / ultimaGub.votosValidos * 100).toFixed(1),
  }));

const ACTIVIDAD = [
  { titulo: 'Catálogo de escuelas procesado', meta: `${fmt(escuelasResumen.resumen.planteles)} planteles · SIGED`, cuando: 'hoy' },
  { titulo: 'Localidades derivadas', meta: `${fmt(localidadesResumen.resumen.total)} registros · datalab`, cuando: 'hoy' },
  { titulo: 'Municipios normalizados', meta: `${ESTADO.municipios} claves INEGI · datalab`, cuando: 'hoy' },
  { titulo: 'Bloques sin fuente conectada', meta: `${controlCalidad.items.filter(c => c.estado === 'vacio').length} de ${controlCalidad.items.length}`, cuando: 'hoy' },
];

export const ComandoCentral: React.FC = () => {
  const isMobile = useIsMobile();
  const grid = (cols: string): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : cols, gap: 16,
  });

  const pendientes = controlCalidad.items.filter(c => c.estado === 'vacio');

  return (
    <div style={wrap(isMobile)}>
      <style>{keyframes}</style>
      <div style={inner}>
        <SectionHero
          eyebrow="Comando Central"
          title={<>Inteligencia <strong style={{ fontWeight: 800 }}>Electoral</strong> · Campeche</>}
          subtitle="Situación general del estado en menos de 30 segundos. Cada panel declara su fuente, fecha de corte y nivel de confianza."
          insights={<>
            <Insight kind="Dato" title={`${ESTADO.municipios} municipios · ${fmt(ESTADO.poblacion2020)} habitantes`}>
              Censo 2020 del INEGI. El estado se divide en {ESTADO.municipios} municipios y {fmt(localidadesResumen.resumen.total)} localidades
              con plantel educativo registrado.
            </Insight>
            <Insight kind="Estimación" title={`${pendientes.length} bloques sin fuente conectada`}>
              De {controlCalidad.items.length} bloques del libro maestro, {pendientes.length} siguen sin fuente real —
              entre ellos secciones, casillas y distritos. Los indicadores que dependen de ellos aparecen como pendientes,
              no estimados.
            </Insight>
            <Insight kind="Estimación" title="Resultados históricos aún sin verificar">
              Las cifras de votación son de ejemplo. Se sustituyen al conectar el SICEE del INE; hasta entonces
              no deben usarse para decidir.
            </Insight>
          </>}
        />

        {/* Indicadores principales del spec. Lo que no tiene fuente se declara pendiente. */}
        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 16 }}>
          <Kpi label="Población total" value={fmt(ESTADO.poblacion2020)} sub="INEGI · Censo 2020" />
          <Kpi label="Municipios" value={String(ESTADO.municipios)} sub="INEGI · claves oficiales" />
          <Kpi label="Localidades" value={fmt(localidadesResumen.resumen.total)} sub="con plantel registrado" />
          <Kpi label="Planteles educativos" value={fmt(escuelasResumen.resumen.planteles)} sub={`${fmt(escuelasResumen.resumen.sitios)} sitios distintos`} />
        </div>
        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 16 }}>
          <Kpi label="Lista nominal" value={fmt(totalListaNominal)} sub="simulada · fuente real: INE" pendiente />
          <Kpi label="Secciones electorales" value="—" sub="pendiente · Marco Geográfico del INE" pendiente />
          <Kpi label="Casillas último proceso" value="—" sub="pendiente · encartes del INE" pendiente />
          <Kpi label="Casillas 2027" value="—" sub="pendiente de aprobación oficial" pendiente />
        </div>
        <div style={{ ...grid('repeat(4, 1fr)'), marginBottom: 22 }}>
          <Kpi label="Participación histórica" value={fmtPct(ultimaGub.participacion)} sub={`gubernatura ${ultimaGub.anio} · ejemplo`} pendiente />
          <Kpi label="Abstencionismo" value={fmtPct(ultimaGub.abstencionismo)} sub="1 − (votación / lista nominal)" pendiente />
          <Kpi label="Encuestas agregadas" value="—" sub="pendiente · alta vía Cuadrito 6" pendiente />
          <Kpi label="Alertas críticas" value="—" sub="pendiente · sin fuente conectada" pendiente />
        </div>

        {/* Posición pública por partido + actividad */}
        <div style={{ ...grid('1.4fr 1fr'), marginBottom: 22 }}>
          <Panel
            title={`Posición por partido · gubernatura ${ultimaGub.anio}`}
            icon={<Vote size={17} color={V} />}
            proc={GUB.proc}
            right={<span style={{ fontSize: 12, color: colores.textoOscuro }}>{PARTIDOS.length} partidos</span>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {posiciones.map((p, i) => (
                <div key={p.partido}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: colores.textoClaro }}>
                      <span style={{ color: colores.textoOscuro, marginRight: 6 }}>{i + 1}.</span>{p.partido}
                    </span>
                    <span style={{ color: colores.textoOscuro, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(p.votos)} · {p.pct}%
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: colores.fondoTerciario, overflow: 'hidden' }}>
                    <div style={{ width: `${p.pct}%`, height: '100%', background: colorPartido(p.partido), borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Actividad reciente" icon={<Activity size={17} color={V} />} right={<LiveDot />}>
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

        {/* Municipios + estado de las fuentes */}
        <div style={grid('1.4fr 1fr')}>
          <Panel
            title="Municipios"
            icon={<MapPin size={17} color={V} />}
            proc={municipios.proc}
            right={<span style={{ fontSize: 12, color: colores.textoOscuro }}>{municipios.items.length} registros</span>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 340, overflow: 'auto' }}>
              {municipios.items.map(m => (
                <div key={m.clave_municipio} style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: colores.fondoSecundario,
                  border: `1px solid ${colores.borde}`, borderRadius: 11, padding: '9px 12px',
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: colores.textoOscuro, background: colores.fondoTerciario,
                    padding: '2px 7px', borderRadius: 6, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                  }}>{m.clave_municipio}</span>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: colores.textoClaro,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{m.nombre}</span>
                  <span style={{ fontSize: 11.5, color: colores.textoOscuro, flexShrink: 0, display: 'flex', gap: 10 }}>
                    <span title="planteles educativos"><School size={11} style={{ verticalAlign: -1 }} /> {m.escuelas}</span>
                    <span title="población estimada"><Users size={11} style={{ verticalAlign: -1 }} /> {fmt(m.poblacion)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Estado de las fuentes"
            icon={<Gauge size={17} color={V} />}
            proc={controlCalidad.proc}
            right={<span style={{ fontSize: 22, fontWeight: 800, color: colores.textoClaro }}>
              {controlCalidad.items.length - pendientes.length}/{controlCalidad.items.length}
            </span>}
          >
            <p style={{ fontSize: 12.5, color: colores.textoOscuro, margin: '0 0 13px', lineHeight: 1.4 }}>
              Hoja 27 del libro maestro. Un bloque vacío se muestra vacío: nunca se rellena con
              una cifra derivada de otro nivel geográfico.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 290, overflow: 'auto' }}>
              {controlCalidad.items.map(c => (
                <div key={c.bloque} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  opacity: c.estado === 'vacio' ? 0.62 : 1,
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: c.estado === 'vacio' ? colores.textoOscuro
                      : c.clase === 'Dato' ? colores.exito : colores.advertencia,
                  }} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12, color: colores.textoClaro,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{c.hoja}</span>
                  <span style={{ fontSize: 11, color: colores.textoOscuro, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {c.estado === 'vacio' ? 'pendiente' : fmt(c.registros ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Bloques pendientes: el spec exige que la ausencia de dato sea visible. */}
        <Panel
          title="Sin fuente conectada"
          icon={<Bell size={17} color={colores.advertencia} />}
          proc={secciones.proc}
          style={{ marginTop: 22 }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[secciones, casillasHistoricas, casillasVigentes].map(b => (
              <span key={b.hoja} style={{
                fontSize: 12, fontWeight: 600, color: colores.textoMedio,
                background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
                padding: '7px 12px', borderRadius: 999,
              }}>{b.hoja}</span>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: colores.textoOscuro, margin: '13px 0 0', lineHeight: 1.5 }}>
            {casillasVigentes.nota}
          </p>
        </Panel>

        <div style={{ marginTop: 18 }}>
          <Procedencia proc={ESTADO.proc} />
        </div>
      </div>
    </div>
  );
};
