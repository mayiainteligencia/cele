import React, { useState, useEffect } from 'react';
import {
  Megaphone, Cog, Mic2, Swords, TrendingUp, Users2, LayoutPanelLeft,
  Database, Rocket, RefreshCw, Play, Download, FileText, CheckCircle2,
  Target, ArrowRight, Zap, Radio, Clock, Volume2, X,
} from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { brandingConfig } from '../config/branding';

const { colores } = brandingConfig;
const V = colores.primario;
const TXT = colores.textoClaro;
const MUT = colores.textoOscuro;
const MED = colores.textoMedio;
const TRACK = `${colores.secundario}12`;

const useIsMobile = (bp = 768) => {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < bp);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [bp]);
  return m;
};

// ── primitivas ──
const sub: React.CSSProperties = {
  background: colores.fondoSecundario, border: `1px solid ${colores.borde}`, borderRadius: 14, padding: 16,
};
const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: MED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>{children}</div>
);
const Chip: React.FC<{ t: string; c: string; solid?: boolean }> = ({ t, c, solid }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
    color: solid ? '#fff' : c, background: solid ? c : `${c}1A`, border: `1px solid ${c}33`,
  }}>{t}</span>
);
const Btn: React.FC<{ icon?: React.ComponentType<{ size?: number; color?: string }>; children: React.ReactNode; solid?: boolean; onClick?: () => void }> = ({ icon: Icon, children, solid, onClick }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 700, padding: '8px 13px', borderRadius: 10, transition: 'all .15s',
    border: `1px solid ${solid ? colores.textoClaro : colores.borde}`,
    background: solid ? colores.textoClaro : colores.fondoClaro,
    color: solid ? colores.textoEnOscuro : MED,
  }}>
    {Icon && <Icon size={14} color={solid ? colores.textoEnOscuro : MED} />}{children}
  </button>
);
const toast = (msg: string) => {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:${colores.textoClaro};color:${colores.textoEnOscuro};padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:${colores.sombraGrande};animation:iel-fadeup .3s ease`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 1800);
  setTimeout(() => el.remove(), 2300);
};

// ════════════════════════ 1. COMERCIAL ════════════════════════
const EVENTOS = [
  { hora: '14:32:07', marca: 'Coca-Cola', producto: 'Coca sin azúcar', emisora: 'Los 40 · 101.7', plat: 'Meta', estado: 'Activada' },
  { hora: '14:28:51', marca: 'Telcel', producto: 'Plan Max Sin Límite', emisora: 'MVS · 102.5', plat: 'Google', estado: 'Activada' },
  { hora: '14:19:33', marca: 'Oxxo', producto: 'Promo Oxxo Premia', emisora: 'La Mejor · 97.7', plat: 'Meta', estado: 'Programada' },
  { hora: '14:11:02', marca: 'Bimbo', producto: 'Pan integral', emisora: 'Radio Amor · 95.3', plat: 'Google', estado: 'Activada' },
];
const DetalleComercial: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={sub}>
    <SubTitle>Flujo en vivo · detección → evento → pauta</SubTitle>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {EVENTOS.map((e, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, flexWrap: 'wrap',
          background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: V, fontWeight: 800, fontSize: 12, minWidth: 78 }}>
            <Clock size={13} color={V} />{e.hora}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
            <Chip t={`📻 ${e.marca}`} c={colores.secundario} />
            <span style={{ fontSize: 11, color: MUT }}>{e.producto} · {e.emisora}</span>
          </div>
          <ArrowRight size={16} color={MUT} />
          <Chip t="Evento de marketing" c="#8B5CF6" />
          <ArrowRight size={16} color={MUT} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Chip t={e.plat === 'Meta' ? 'Meta Ads' : 'Google Ads'} c={e.plat === 'Meta' ? '#0866FF' : '#EA4335'} solid />
            <Chip t={e.estado} c={e.estado === 'Activada' ? colores.exito : colores.advertencia} />
          </span>
        </div>
      ))}
    </div>
    <p style={{ fontSize: 11, color: MUT, margin: '12px 0 0' }}>
      <Zap size={12} color={V} style={{ verticalAlign: 'middle' }} /> Pauta digital sincronizada al momento exacto de transmisión.
    </p>
  </div>
);

// ════════════════════════ 2. PROCESOS AUTOMATIZADOS ════════════════════════
const CLIPS = [
  { marca: 'Telcel', emisora: 'MVS · 102.5', dur: '0:18', hora: '14:28' },
  { marca: 'Coca-Cola', emisora: 'Los 40 · 101.7', dur: '0:24', hora: '14:11' },
  { marca: 'Oxxo', emisora: 'La Mejor · 97.7', dur: '0:12', hora: '13:55' },
];
const Wave: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
    {[8, 16, 22, 12, 26, 18, 10, 24, 14, 20, 9, 17, 23, 11].map((h, i) => (
      <span key={i} style={{ width: 3, height: h, borderRadius: 2, background: i % 3 === 0 ? V : `${colores.secundario}55` }} />
    ))}
  </div>
);
const DetalleProcesos: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={sub}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
      <SubTitle>Clips verificables generados</SubTitle>
      <Btn icon={FileText} solid onClick={() => toast('Generando reporte… ✓')}>Generar reporte</Btn>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {CLIPS.map((c, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap',
          background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '10px 14px',
        }}>
          <button onClick={() => toast(`▶ Reproduciendo clip de ${c.marca}`)} style={{
            width: 36, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: V, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Play size={16} color="#0A0A0A" /></button>
          <Wave />
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TXT }}>{c.marca}</div>
            <div style={{ fontSize: 11, color: MUT }}>{c.emisora} · {c.hora} · {c.dur}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={14} color={colores.exito} />
            <Chip t="Verificable" c={colores.exito} />
          </span>
          <button onClick={() => toast(`↓ Descargando clip de ${c.marca}`)} style={{
            width: 34, height: 34, borderRadius: 9, cursor: 'pointer', flexShrink: 0,
            background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Download size={15} color={MED} /></button>
        </div>
      ))}
    </div>
  </div>
);

// ════════════════════════ 3. TALENTO Y PROGRAMACIÓN ════════════════════════
const PROGRAMAS = [
  { nombre: 'Noticias MVS Primera Emisión', menciones: 142, color: V },
  { nombre: 'La Mañanera Deportiva', menciones: 98, color: '#3B82F6' },
  { nombre: 'Panel Político 102.5', menciones: 76, color: '#8B5CF6' },
  { nombre: 'Tarde Musical Los 40', menciones: 54, color: colores.advertencia },
];
const SEGMENTOS = [
  { loc: 'C. López', w: 32, c: V }, { loc: 'M. Ruiz', w: 24, c: '#3B82F6' },
  { loc: 'Invitado', w: 14, c: '#8B5CF6' }, { loc: 'C. López', w: 18, c: V }, { loc: 'Spots', w: 12, c: MUT },
];
const DetalleTalento: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const max = Math.max(...PROGRAMAS.map(p => p.menciones));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
      <div style={sub}>
        <SubTitle>Menciones por programa</SubTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PROGRAMAS.map((p, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: MED }}>{p.nombre}</span>
                <span style={{ fontWeight: 800, color: TXT }}>{p.menciones}</span>
              </div>
              <div style={{ height: 8, background: TRACK, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(p.menciones / max) * 100}%`, height: '100%', background: p.color, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={sub}>
        <SubTitle>Diarización · segmentos por locutor</SubTitle>
        <div style={{ display: 'flex', height: 22, borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
          {SEGMENTOS.map((s, i) => (
            <div key={i} style={{ width: `${s.w}%`, background: s.c }} title={`${s.loc} · ${s.w}%`} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[...new Map(SEGMENTOS.map(s => [s.loc, s.c])).entries()].map(([loc, c]) => (
            <span key={loc} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MED }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: c as string }} /> {loc}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 11, color: MUT, margin: '12px 0 0' }}>
          <Volume2 size={12} color={V} style={{ verticalAlign: 'middle' }} /> Identificación de voz y tiempo aire por talento.
        </p>
      </div>
    </div>
  );
};

// ════════════════════════ 4. INTELIGENCIA COMPETITIVA ════════════════════════
const COMPETIDORES = [
  { marca: 'MVS', menciones: 420, sov: 34, sent: 'Positivo', tend: '+6%', c: V },
  { marca: 'Competidor A', menciones: 350, sov: 28, sent: 'Neutral', tend: '+2%', c: '#3B82F6' },
  { marca: 'Competidor B', menciones: 270, sov: 22, sent: 'Negativo', tend: '-4%', c: colores.peligro },
  { marca: 'Otros', menciones: 200, sov: 16, sent: 'Neutral', tend: '+1%', c: MUT },
];
const OPORTUNIDADES = [
  'Competidor B con caída -4% en sentimiento: ventana para campaña comparativa.',
  'Franja 7-9 AM sin presencia de Competidor A: alto alcance disponible.',
  'Tema “precio” con sentimiento negativo hacia Competidor B.',
];
const DetalleCompetitiva: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 14 }}>
    <div style={sub}>
      <SubTitle>Comparativa de competidores</SubTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: MUT, textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Marca</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Menc.</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>SoV</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Sentimiento</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Tend.</th>
            </tr>
          </thead>
          <tbody>
            {COMPETIDORES.map((c, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${colores.borde}` }}>
                <td style={{ padding: '9px 8px', fontWeight: 700, color: TXT }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c.c, marginRight: 7 }} />{c.marca}
                </td>
                <td style={{ padding: '9px 8px', color: MED }}>{c.menciones}</td>
                <td style={{ padding: '9px 8px', fontWeight: 700, color: TXT }}>{c.sov}%</td>
                <td style={{ padding: '9px 8px' }}>
                  <Chip t={c.sent} c={c.sent === 'Positivo' ? colores.exito : c.sent === 'Negativo' ? colores.peligro : MUT} />
                </td>
                <td style={{ padding: '9px 8px', fontWeight: 700, color: c.tend.startsWith('-') ? colores.peligro : colores.exito }}>{c.tend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <div style={sub}>
      <SubTitle>Oportunidades comerciales</SubTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OPORTUNIDADES.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '11px 13px' }}>
            <Target size={16} color={V} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MED, lineHeight: 1.4 }}>{o}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ════════════════════════ 5. TRENDING TOPICS ════════════════════════
const TRENDS = [
  { tema: 'Nuevo álbum nacional', vol: '24.1K', plats: ['X', 'IG', 'TikTok'], radio: 70, redes: 95 },
  { tema: 'Debate deportivo', vol: '18.7K', plats: ['X', 'TikTok'], radio: 85, redes: 60 },
  { tema: 'Promo telefonía', vol: '12.3K', plats: ['IG', 'X'], radio: 55, redes: 78 },
  { tema: 'Clima extremo', vol: '9.8K', plats: ['X'], radio: 40, redes: 88 },
];
const PLAT_C: Record<string, string> = { X: '#000000', IG: '#E1306C', TikTok: '#10c4cc' };
const DetalleTrending: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={sub}>
    <SubTitle>Temas emergentes · cruce radio ↔ redes</SubTitle>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {TRENDS.map((t, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap',
          background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '11px 14px',
        }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TXT }}>#{i + 1} {t.tema}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
              {t.plats.map(p => <Chip key={p} t={p} c={PLAT_C[p]} solid />)}
              <span style={{ fontSize: 11, color: MUT, alignSelf: 'center' }}>{t.vol} menciones</span>
            </div>
          </div>
          <div style={{ width: isMobile ? '100%' : 180 }}>
            {[['Radio', t.radio, V], ['Redes', t.redes, '#3B82F6']].map(([l, v, c]) => (
              <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: MUT, width: 36 }}>{l as string}</span>
                <div style={{ flex: 1, height: 6, background: TRACK, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${v as number}%`, height: '100%', background: c as string, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ════════════════════════ 6. HIPERSEGMENTACIÓN ════════════════════════
const EDAD = [{ l: '18-24', v: 22 }, { l: '25-34', v: 34 }, { l: '35-44', v: 24 }, { l: '45-54', v: 13 }, { l: '55+', v: 7 }];
const GENERO = [{ l: 'Mujeres', v: 54, c: '#EC4899' }, { l: 'Hombres', v: 46, c: '#3B82F6' }];
const CLUSTERS = [
  { x: 20, y: 80, z: 400, n: 'Oro' }, { x: 45, y: 60, z: 900, n: 'Premium' },
  { x: 65, y: 40, z: 1400, n: 'Frecuente' }, { x: 80, y: 25, z: 1100, n: 'Casual' },
  { x: 35, y: 35, z: 600, n: 'Nicho' },
];
const DetalleHiper: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
    <div style={sub}>
      <SubTitle>Perfil demográfico</SubTitle>
      <div style={{ fontSize: 11, color: MUT, marginBottom: 6 }}>Edad</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {EDAD.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: MED, width: 44 }}>{e.l}</span>
            <div style={{ flex: 1, height: 8, background: TRACK, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${e.v * 2.6}%`, height: '100%', background: V, borderRadius: 999 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: TXT, width: 28, textAlign: 'right' }}>{e.v}%</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: MUT, marginBottom: 6 }}>Género</div>
      <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden' }}>
        {GENERO.map((g, i) => <div key={i} style={{ width: `${g.v}%`, background: g.c }} title={`${g.l} ${g.v}%`} />)}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        {GENERO.map((g, i) => (
          <span key={i} style={{ fontSize: 11, color: MED, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: g.c }} />{g.l} {g.v}%
          </span>
        ))}
      </div>
    </div>
    <div style={sub}>
      <SubTitle>Clusters de audiencia</SubTitle>
      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke={colores.borde} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="number" dataKey="y" tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <ZAxis type="number" dataKey="z" range={[120, 900]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 10, fontSize: 12 }} />
          <Scatter data={CLUSTERS}>
            {CLUSTERS.map((c, i) => <Cell key={i} fill={c.n === 'Oro' ? colores.advertencia : V} fillOpacity={0.65} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {CLUSTERS.map((c, i) => <Chip key={i} t={c.n} c={c.n === 'Oro' ? colores.advertencia : V} />)}
      </div>
    </div>
  </div>
);

// ════════════════════════ 7. BRAND PORTAL ════════════════════════
const DetalleBrandPortal: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={sub}>
    <SubTitle>Vista previa del portal del cliente</SubTitle>
    <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${colores.borde}`, boxShadow: colores.sombra }}>
      {/* chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: colores.fondoTerciario }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FF5F57' }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FEBC2E' }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#28C840' }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: MUT, background: colores.fondoClaro, padding: '3px 10px', borderRadius: 6 }}>portal.mvs.com/coca-cola</span>
      </div>
      {/* contenido cliente */}
      <div style={{ padding: 16, background: colores.fondoClaro }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#E61A27', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>CC</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: TXT }}>Coca-Cola México</div>
            <div style={{ fontSize: 11, color: MUT }}>Panel del anunciante</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
          {[['Menciones', '342'], ['Clips', '57'], ['Alcance', '4.1M']].map(([l, v], i) => (
            <div key={i} style={{ ...sub, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: TXT }}>{v}</div>
              <div style={{ fontSize: 10, color: MUT, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: MED, marginBottom: 8 }}>Sus clips recientes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {['Los 40 · 101.7 · 0:18', 'MVS · 102.5 · 0:22'].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: colores.fondoSecundario, borderRadius: 10, padding: '9px 12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MED }}><Play size={13} color={V} />{c}</span>
              <Download size={14} color={MUT} />
            </div>
          ))}
        </div>
        <Btn icon={FileText} solid onClick={() => toast('Reporte del cliente generado ✓')}>Descargar reporte</Btn>
      </div>
    </div>
    <p style={{ fontSize: 11, color: MUT, margin: '10px 0 0', textAlign: isMobile ? 'left' : 'center' }}>Self-service: cada anunciante ve solo su marca.</p>
  </div>
);

// ════════════════════════ 8. INRA + AUDIENCIA ════════════════════════
const INRA_PTS = [
  { x: 12, y: 1.2, n: 'Prog. A' }, { x: 28, y: 2.8, n: 'Prog. B' }, { x: 45, y: 3.1, n: 'Prog. C' },
  { x: 60, y: 5.2, n: 'Prog. D' }, { x: 78, y: 6.0, n: 'Prog. E' }, { x: 90, y: 8.4, n: 'Prog. F' },
];
const IMPACTO = [
  { e: 'Prog. F · 102.5', v: 94 }, { e: 'Prog. D · 101.7', v: 76 }, { e: 'Prog. C · 97.7', v: 58 },
];
const DetalleINRA: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 14 }}>
    <div style={sub}>
      <SubTitle>Correlación menciones ↔ audiencia (rating INRA)</SubTitle>
      <ResponsiveContainer width="100%" height={190}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
          <CartesianGrid stroke={colores.borde} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="Menciones" tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="number" dataKey="y" name="Rating" unit=" pts" tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 10, fontSize: 12 }} />
          <Scatter data={INRA_PTS} fill={V} fillOpacity={0.75} />
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: MUT, margin: '4px 0 0' }}>A mayor mención, mayor rating: impacto publicitario medible.</p>
    </div>
    <div style={sub}>
      <SubTitle>Ranking de impacto · valor de pauta</SubTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {IMPACTO.map((r, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: MED }}>{i + 1}. {r.e}</span>
              <span style={{ fontWeight: 800, color: TXT }}>{r.v}</span>
            </div>
            <div style={{ height: 8, background: TRACK, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${r.v}%`, height: '100%', background: `linear-gradient(90deg, ${V}, ${colores.exito})`, borderRadius: 999 }} />
            </div>
          </div>
        ))}
        <div style={{ ...sub, background: colores.fondoClaro, textAlign: 'center', marginTop: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: TXT }}>$4.2M</div>
          <div style={{ fontSize: 11, color: MUT }}>Valor de pauta estimado / mes</div>
        </div>
      </div>
    </div>
  </div>
);

// ════════════════════════ 9. ESTRATEGIA 2027 ════════════════════════
const FASES = [
  { fase: 'Fase 1', periodo: 'Q3 2026', estado: 'Completada', prog: 100, hitos: ['Monitor de medios', 'Detección de menciones'] },
  { fase: 'Fase 2', periodo: 'Q4 2026', estado: 'En curso', prog: 55, hitos: ['Módulos comercial + clips', 'Brand Portal'] },
  { fase: 'Fase 3', periodo: 'Q1 2027', estado: 'Planeada', prog: 10, hitos: ['Inteligencia electoral', 'Trending + redes'] },
  { fase: 'Fase 4', periodo: 'Q2 2027', estado: 'Planeada', prog: 0, hitos: ['Hipersegmentación IA', 'INRA full'] },
];
const DetalleEstrategia: React.FC<{ isMobile: boolean }> = ({ isMobile }) => (
  <div style={sub}>
    <SubTitle>Roadmap por fases</SubTitle>
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: 12 }}>
      {FASES.map((f, i) => {
        const done = f.estado === 'Completada'; const live = f.estado === 'En curso';
        const c = done ? colores.exito : live ? V : MUT;
        return (
          <div key={i} style={{ background: colores.fondoClaro, border: `1px solid ${live ? V : colores.borde}`, borderRadius: 12, padding: 14, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: TXT }}>{f.fase}</span>
              <Chip t={f.estado} c={c} solid={live} />
            </div>
            <div style={{ fontSize: 11, color: MUT, marginBottom: 10 }}>{f.periodo}</div>
            <div style={{ height: 6, background: TRACK, borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${f.prog}%`, height: '100%', background: c, borderRadius: 999 }} />
            </div>
            {f.hitos.map((h, j) => (
              <div key={j} style={{ display: 'flex', gap: 6, fontSize: 11, color: MED, marginBottom: 4 }}>
                <CheckCircle2 size={13} color={done ? colores.exito : MUT} style={{ flexShrink: 0 }} />{h}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  </div>
);

// ════════════════════════ 10. WEB SERVICES INRA ════════════════════════
const LOG = [
  { t: '06:00:01', lvl: 'OK', m: 'Conexión INRA establecida' },
  { t: '06:00:03', lvl: 'INFO', m: 'Descargando dataset audiencia (24,180 registros)' },
  { t: '06:00:19', lvl: 'OK', m: 'Ingestión completada · 24,180 filas' },
  { t: '06:00:21', lvl: 'INFO', m: 'Cruzando con menciones del día' },
  { t: '06:00:34', lvl: 'WARN', m: '3 registros sin match — encolados' },
  { t: '06:00:36', lvl: 'OK', m: 'Dashboard unificado actualizado' },
];
const LVL_C: Record<string, string> = { OK: '#10B981', INFO: '#3B82F6', WARN: '#F59E0B' };
const DetalleWebServices: React.FC<{ isMobile: boolean }> = () => (
  <div style={sub}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
      <SubTitle>Log de sincronización</SubTitle>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: colores.exito, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: colores.exito }} /> Conectado · última sync Hoy 06:00
      </span>
    </div>
    <div style={{ background: '#0E0E0E', borderRadius: 12, padding: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.9, overflowX: 'auto' }}>
      {LOG.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap' }}>
          <span style={{ color: '#6B7280' }}>{l.t}</span>{' '}
          <span style={{ color: LVL_C[l.lvl], fontWeight: 700 }}>[{l.lvl}]</span>{' '}
          <span style={{ color: '#D4D4D4' }}>{l.m}</span>
        </div>
      ))}
      <div style={{ color: V }}>▌</div>
    </div>
  </div>
);

// ════════════════════════ REGISTRO + MODAL ════════════════════════
export const META = [
  { num: 1, icon: Megaphone, tag: 'Comercial', titulo: 'Activación automática de campañas', Comp: DetalleComercial },
  { num: 2, icon: Cog, tag: 'Automatización', titulo: 'Centros de procesos automatizados', Comp: DetalleProcesos },
  { num: 3, icon: Mic2, tag: 'Editorial', titulo: 'Talento y programación', Comp: DetalleTalento },
  { num: 4, icon: Swords, tag: 'Competencia', titulo: 'Inteligencia competitiva', Comp: DetalleCompetitiva },
  { num: 5, icon: TrendingUp, tag: 'Trending', titulo: 'Trending topics radio + redes', Comp: DetalleTrending },
  { num: 6, icon: Users2, tag: 'Audiencias', titulo: 'Hipersegmentación de audiencias', Comp: DetalleHiper },
  { num: 7, icon: LayoutPanelLeft, tag: 'Brand Portal', titulo: 'Portal para clientes', Comp: DetalleBrandPortal },
  { num: 8, icon: Database, tag: 'INRA', titulo: 'Integración con INRA y audiencia', Comp: DetalleINRA },
  { num: 9, icon: Rocket, tag: 'Roadmap', titulo: 'Estrategia hacia el 2027', Comp: DetalleEstrategia },
  { num: 10, icon: RefreshCw, tag: 'Web Services', titulo: 'Integración Web Services INRA', Comp: DetalleWebServices },
];

export const ModuloDetalleModal: React.FC<{ num: number | null; onClose: () => void }> = ({ num, onClose }) => {
  const isMobile = useIsMobile();
  useEffect(() => {
    if (num == null) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [num, onClose]);

  if (num == null) return null;
  const m = META.find(x => x.num === num);
  if (!m) return null;
  const { icon: Icon, tag, titulo, Comp } = m;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,10,10,0.55)',
      backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: isMobile ? 12 : 32, overflowY: 'auto', animation: 'iel-fadeup .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: colores.fondoClaro, borderRadius: 20, border: `1px solid ${colores.borde}`,
        boxShadow: colores.sombraGrande, width: '100%', maxWidth: 920, padding: isMobile ? 16 : 26,
        animation: 'mia-modal .25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: colores.gradientePrimario, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
            <Icon size={20} color="#fff" />
            <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 999, background: V, color: '#0A0A0A', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{num}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: V, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tag}</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: TXT, margin: '2px 0 0' }}>{titulo}</h3>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            width: 36, height: 36, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
            background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={18} color={MED} /></button>
        </div>
        <Comp isMobile={isMobile} />
      </div>
    </div>
  );
};
