import React, { useState } from 'react';
import { Brain, Check, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { brandingConfig } from '../../config/branding';
import type { Proc } from '../../data/campeche';
import { useToast } from './toast';
import { useConfirm } from './confirm';

const { colores } = brandingConfig;
const V = colores.primario;

export const keyframes = `
@keyframes elFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes elPulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes elPop{0%{transform:scale(1)}45%{transform:scale(.97)}100%{transform:scale(1)}}
@keyframes elSpin{to{transform:rotate(360deg)}}
.el-spin{animation:elSpin .9s linear infinite}
@media (prefers-reduced-motion: reduce){.el-anim,.el-pulse,.el-spin{animation:none!important}}
`;

// ── Punto "LIVE" parpadeante ──
export const LiveDot: React.FC<{ label?: string }> = ({ label = 'LIVE' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: colores.exito }}>
    <span className="el-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: colores.exito, animation: 'elPulse 1.4s ease-in-out infinite' }} />
    {label}
  </span>
);

// ── Sello de procedencia ──
// Obligatorio en todo panel que muestre cifras. El spec exige que una estimacion
// nunca se lea como un hecho: aqui la clase, la fuente y la fecha de corte van
// pegadas al dato, no en una nota al pie que nadie mira.
const CLASE_COLOR: Record<Proc['clase'], string> = {
  Dato: colores.exito,
  Calculo: '#0047AB',
  Estimacion: colores.advertencia,
  Inferencia: colores.advertencia,
  Recomendacion: V,
};
const CLASE_LABEL: Record<Proc['clase'], string> = {
  Dato: 'Dato', Calculo: 'Cálculo', Estimacion: 'Estimación',
  Inferencia: 'Inferencia', Recomendacion: 'Recomendación',
};

export const Procedencia: React.FC<{ proc: Proc; compact?: boolean }> = ({ proc, compact }) => {
  const c = CLASE_COLOR[proc.clase];
  return (
    <div
      title={`${CLASE_LABEL[proc.clase]} · fuente: ${proc.fuente} · corte: ${proc.fechaCorte} · confianza ${proc.confianza}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        fontSize: 10.5, fontWeight: 600, color: colores.textoOscuro, lineHeight: 1.4,
      }}
    >
      <span style={{
        fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase',
        color: c, background: `${c}18`, padding: '2px 7px', borderRadius: 999,
      }}>
        {CLASE_LABEL[proc.clase]}
      </span>
      {!compact && (
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proc.fuente} · corte {proc.fechaCorte} · confianza {proc.confianza}
        </span>
      )}
    </div>
  );
};

// ── Panel / tarjeta contenedora ──
export const Panel: React.FC<{ title?: string; icon?: React.ReactNode; right?: React.ReactNode; proc?: Proc; children: React.ReactNode; style?: React.CSSProperties }> =
({ title, icon, right, proc, children, style }) => (
  <section style={{
    background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 18,
    padding: 20, boxShadow: colores.sombra, animation: 'elFadeUp .4s ease both', ...style,
  }} className="el-anim">
    {(title || right) && (
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {icon}
          {title && <h3 style={{ fontSize: 15, fontWeight: 700, color: colores.textoClaro, margin: 0 }}>{title}</h3>}
        </div>
        {right}
      </header>
    )}
    {children}
    {proc && (
      <footer style={{ marginTop: 14, paddingTop: 11, borderTop: `1px solid ${colores.borde}` }}>
        <Procedencia proc={proc} />
      </footer>
    )}
  </section>
);

// ── KPI tile ──
// `pendiente` marca una cifra que no tiene fuente real todavia. El spec exige
// que ninguna cifra se presente sin fuente: apagarla visualmente es la diferencia
// entre "no lo sabemos" y "vale cero".
export const Kpi: React.FC<{ label: string; value: string; delta?: string; up?: boolean; sub?: string; pendiente?: boolean }> =
({ label, value, delta, up, sub, pendiente }) => (
  <div style={{
    background: colores.fondoClaro, border: `1px dashed ${colores.borde}`, borderRadius: 14,
    padding: 16, boxShadow: colores.sombra,
    ...(pendiente ? {} : { borderStyle: 'solid' }),
  }}>
    <div style={{ fontSize: 12, color: colores.textoOscuro, fontWeight: 600, marginBottom: 8 }}>{label}</div>
    <div style={{
      fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      color: pendiente ? colores.textoOscuro : colores.textoClaro,
    }}>{value}</div>
    {(delta || sub) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12, color: up === false ? colores.peligro : colores.exito, fontWeight: 600 }}>
        {up !== undefined && (up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
        <span style={{ color: delta ? undefined : colores.textoOscuro }}>{delta || sub}</span>
        {delta && sub && <span style={{ color: colores.textoOscuro, fontWeight: 500 }}>· {sub}</span>}
      </div>
    )}
  </div>
);

// ── Tarjeta de insight de MAYIA ──
// Las clases son las de la "regla central" del spec: toda salida del copiloto
// declara si es un dato de fuente, un cálculo, la salida de un modelo, una
// interpretación o una acción sujeta a autorización humana.
type InsightKind = 'Dato' | 'Cálculo' | 'Estimación' | 'Inferencia' | 'Recomendación';
export const Insight: React.FC<{ kind: InsightKind; title: string; children: React.ReactNode; plan?: string }> =
({ kind, title, children, plan }) => {
  const { push } = useToast();
  const confirmar = useConfirm();
  const [state, setState] = useState<'idle' | 'activo' | 'descartado'>('idle');
  const activar = async () => {
    if (await confirmar({ titulo: title, descripcion: plan! })) {
      setState('activo');
      push({ kind: 'success', title: 'Plan activado', msg: plan! });
    }
  };
  // Mismo codigo de color que <Procedencia>: la clase se lee igual en todo el sistema.
  const kindColor = ({
    Dato: colores.exito, 'Cálculo': '#0047AB', 'Estimación': colores.advertencia,
    'Inferencia': colores.advertencia, 'Recomendación': V,
  } as Record<InsightKind, string>)[kind];

  if (state === 'descartado') return null;

  return (
    <div className="el-anim" style={{
      background: state === 'activo' ? `${V}0D` : colores.fondoSecundario,
      border: `1px solid ${state === 'activo' ? V : colores.borde}`,
      borderRadius: 14, padding: 15, transition: 'background .3s, border-color .3s', animation: state === 'activo' ? 'elPop .35s ease' : undefined,
    }}>
      <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: kindColor, marginBottom: 7 }}>{kind}</span>
      <div style={{ fontSize: 14, fontWeight: 700, color: colores.textoClaro, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, color: colores.textoMedio, lineHeight: 1.5, margin: 0 }}>{children}</p>
      {plan && (
        state === 'activo' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, color: colores.exito, fontSize: 13, fontWeight: 700 }}>
            <Check size={16} /> Plan activado
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={activar}
              style={{ border: 'none', background: V, color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' }}>
              Activar plan
            </button>
            <button onClick={() => setState('descartado')}
              style={{ border: `1px solid ${colores.borde}`, background: 'transparent', color: colores.textoMedio, fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' }}>
              Descartar
            </button>
          </div>
        )
      )}
    </div>
  );
};

// ── Cabecera de sección con panel "MAYIA · análisis en vivo" ──
export const SectionHero: React.FC<{ eyebrow: string; title: React.ReactNode; subtitle: string; right?: React.ReactNode; insights: React.ReactNode }> =
({ eyebrow, title, subtitle, right, insights }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 18, marginBottom: 22 }} className="el-hero">
    <div style={{
      background: colores.gradientePrimario, borderRadius: 22, padding: 26, color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${V}55, transparent 70%)` }} />
      <div style={{ position: 'relative' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: `${V}` }}>{eyebrow}</span>
        <h1 style={{ fontSize: 30, fontWeight: 300, margin: '10px 0 6px', letterSpacing: '-0.5px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.72)', margin: 0, maxWidth: 560, lineHeight: 1.5 }}>{subtitle}</p>
        {right && <div style={{ marginTop: 16 }}>{right}</div>}
      </div>
    </div>
    <Panel title="MAYIA · análisis" icon={<div style={{ width: 30, height: 30, borderRadius: 9, background: `${V}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Brain size={17} color={V} /></div>} right={<LiveDot label="análisis en vivo" />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{insights}</div>
    </Panel>
  </div>
);

export const wrap = (isMobile: boolean): React.CSSProperties => ({
  minHeight: '100%', padding: isMobile ? 16 : 30, background: colores.fondoPrincipal,
});
export const inner: React.CSSProperties = { maxWidth: 1500, margin: '0 auto' };

export function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(() => {
    const f = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}
