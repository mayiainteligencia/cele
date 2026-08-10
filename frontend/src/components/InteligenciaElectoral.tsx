import React, { useState, useEffect } from 'react';
import {
  Vote, Scale, Activity, TrendingUp, Radio, MessageSquare, Flame,
  ArrowUpRight, ArrowDownRight, Smile, Meh, Frown, Share2, Trophy, Landmark,
  FileText, Network, Mic2, MapPin,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { brandingConfig } from '../config/branding';
import { estadosPaths } from '../data/mexicoPaths';

const { colores } = brandingConfig;
const V = colores.primario; // verde MAYIA
const TXT = colores.textoClaro;
const MUT = colores.textoOscuro;
const TRACK = `${colores.secundario}12`;

// ───────────────────────── DATA DUMMY (la lógica/datos reales van después) ─────────────────────────

const CANDIDATOS = [
  { nombre: 'M. E. Cruz', partido: 'Morena', color: '#9B2247', menciones: 450, sov: 42, sent: { pos: 46, neu: 34, neg: 20 } },
  { nombre: 'R. Salazar', partido: 'PAN', color: '#0047AB', menciones: 320, sov: 30, sent: { pos: 38, neu: 40, neg: 22 } },
  { nombre: 'A. Gutiérrez', partido: 'PRI', color: '#006847', menciones: 210, sov: 19, sent: { pos: 41, neu: 37, neg: 22 } },
  { nombre: 'Otros', partido: 'MC / Indep.', color: '#F58025', menciones: 98, sov: 9, sent: { pos: 33, neu: 45, neg: 22 } },
];

const PARTIDOS = [
  { label: 'Morena', value: 44, color: '#9B2247' },
  { label: 'PAN', value: 26, color: '#0047AB' },
  { label: 'PRI', value: 18, color: '#006847' },
  { label: 'MC', value: 8, color: '#F58025' },
  { label: 'Otros', value: 4, color: '#6B7280' },
];

const EVOLUCION = [
  { sem: 'S1', Cruz: 180, Salazar: 150, Gutierrez: 120 },
  { sem: 'S2', Cruz: 240, Salazar: 170, Gutierrez: 140 },
  { sem: 'S3', Cruz: 210, Salazar: 200, Gutierrez: 130 },
  { sem: 'S4', Cruz: 320, Salazar: 230, Gutierrez: 160 },
  { sem: 'S5', Cruz: 360, Salazar: 250, Gutierrez: 190 },
  { sem: 'S6', Cruz: 410, Salazar: 290, Gutierrez: 200 },
  { sem: 'S7', Cruz: 440, Salazar: 300, Gutierrez: 210 },
  { sem: 'S8', Cruz: 480, Salazar: 320, Gutierrez: 230 },
];

const TEMAS = [
  { tema: 'Seguridad', v: 88 }, { tema: 'Economía', v: 74 },
  { tema: 'Corrupción', v: 61 }, { tema: 'Bienestar', v: 55 },
  { tema: 'Energía', v: 48 }, { tema: 'Educación', v: 42 },
  { tema: 'Migración', v: 35 },
];

const NARRATIVAS = [
  { texto: 'Reforma judicial', delta: 38, vol: '12.4K' },
  { texto: 'Crisis energética', delta: 24, vol: '8.1K' },
  { texto: 'Seguridad fronteriza', delta: 19, vol: '6.7K' },
  { texto: 'Corrupción estatal', delta: -7, vol: '5.2K' },
  { texto: 'Salario mínimo', delta: 12, vol: '4.0K' },
];

// Partidos predefinidos para filtrar el monitoreo ("quiero escuchar sobre…")
const PARTIDOS_FILTRO = [
  { id: 'Morena', color: '#9B2247' },
  { id: 'PAN', color: '#0047AB' },
  { id: 'PRI', color: '#006847' },
  { id: 'MC', color: '#F58025' },
  { id: 'PVEM', color: '#4CA22F' },
  { id: 'PT', color: '#D52B1E' },
];
const PARTIDO_COLOR: Record<string, string> = Object.fromEntries(PARTIDOS_FILTRO.map(p => [p.id, p.color]));

const FEED = [
  { hora: '14:32', estacion: 'MVS Radio 102.5', texto: 'La candidata de Morena presentó hoy su propuesta de seguridad para reducir la incidencia delictiva…', candidato: 'M. E. Cruz', partido: 'Morena', tema: 'Seguridad', sent: 'pos' },
  { hora: '14:18', estacion: 'La Octava 89.9', texto: 'El PAN cuestionó el manejo del presupuesto energético del gobierno actual…', candidato: 'R. Salazar', partido: 'PAN', tema: 'Energía', sent: 'neg' },
  { hora: '14:05', estacion: 'Radio Fórmula 104.1', texto: 'Movimiento Ciudadano propone una reforma al sistema de pensiones para jóvenes…', candidato: 'L. Fernández', partido: 'MC', tema: 'Bienestar', sent: 'pos' },
  { hora: '13:55', estacion: 'Imagen 90.5', texto: 'Se debatió la reforma judicial en el panel matutino con representantes del PRI…', candidato: 'A. Gutiérrez', partido: 'PRI', tema: 'Corrupción', sent: 'neu' },
  { hora: '13:40', estacion: 'MVS Radio 102.5', texto: 'El PVEM destacó avances en materia ambiental y energías limpias en la región…', candidato: 'D. Ramírez', partido: 'PVEM', tema: 'Energía', sent: 'pos' },
  { hora: '13:28', estacion: 'ABC Radio 760', texto: 'Morena defendió su propuesta de bienestar social frente a las críticas de la oposición…', candidato: 'M. E. Cruz', partido: 'Morena', tema: 'Bienestar', sent: 'pos' },
  { hora: '13:14', estacion: 'Radio Fórmula 104.1', texto: 'El PT llamó a fortalecer el salario mínimo en el próximo periodo legislativo…', candidato: 'S. Domínguez', partido: 'PT', tema: 'Economía', sent: 'neu' },
  { hora: '13:02', estacion: 'La Octava 89.9', texto: 'El PAN insistió en la necesidad de mayor seguridad fronteriza ante el fenómeno migratorio…', candidato: 'R. Salazar', partido: 'PAN', tema: 'Migración', sent: 'neg' },
  { hora: '12:48', estacion: 'Imagen 90.5', texto: 'El PRI cuestionó los índices de corrupción estatal en su intervención…', candidato: 'A. Gutiérrez', partido: 'PRI', tema: 'Corrupción', sent: 'neg' },
  { hora: '12:35', estacion: 'MVS Radio 102.5', texto: 'Movimiento Ciudadano abordó la agenda educativa rumbo al proceso electoral…', candidato: 'L. Fernández', partido: 'MC', tema: 'Educación', sent: 'neu' },
];

const CORRELACION = [
  { d: 'Lun', radio: 120, redes: 200 }, { d: 'Mar', radio: 180, redes: 260 },
  { d: 'Mié', radio: 150, redes: 240 }, { d: 'Jue', radio: 320, redes: 480 },
  { d: 'Vie', radio: 280, redes: 520 }, { d: 'Sáb', radio: 210, redes: 410 },
  { d: 'Dom', radio: 260, redes: 460 },
];

const RANKING = [
  { estacion: 'MVS Radio 102.5', impacto: 94 },
  { estacion: 'Radio Fórmula 104.1', impacto: 81 },
  { estacion: 'La Octava 89.9', impacto: 68 },
  { estacion: 'Imagen 90.5', impacto: 57 },
  { estacion: 'ABC Radio 760', impacto: 43 },
];

const SENT_META = {
  pos: { label: 'Positivo', color: colores.exito, Icon: Smile },
  neu: { label: 'Neutral', color: colores.textoOscuro, Icon: Meh },
  neg: { label: 'Negativo', color: colores.peligro, Icon: Frown },
} as const;

// Sentimiento por estación y por programa de radio
const SENT_ESTACION = [
  { nombre: 'MVS Radio 102.5', pos: 44, neu: 38, neg: 18 },
  { nombre: 'Radio Fórmula 104.1', pos: 36, neu: 40, neg: 24 },
  { nombre: 'La Octava 89.9', pos: 30, neu: 39, neg: 31 },
  { nombre: 'Imagen 90.5', pos: 41, neu: 36, neg: 23 },
];
const SENT_PROGRAMA = [
  { nombre: 'Primera Emisión', pos: 47, neu: 33, neg: 20 },
  { nombre: 'Panel Político', pos: 29, neu: 38, neg: 33 },
  { nombre: 'Mesa de Análisis', pos: 38, neu: 42, neg: 20 },
  { nombre: 'Noticiero Nocturno', pos: 34, neu: 40, neg: 26 },
];

// Mapa de narrativa (red temas ↔ actores)
const NARR_NODOS = [
  { id: 'Seguridad', x: 200, y: 55, tipo: 'tema' },
  { id: 'Reforma judicial', x: 200, y: 120, tipo: 'tema' },
  { id: 'Economía', x: 200, y: 185, tipo: 'tema' },
  { id: 'Morena', x: 60, y: 50, tipo: 'actor', color: '#9B2247' },
  { id: 'PAN', x: 340, y: 50, tipo: 'actor', color: '#0047AB' },
  { id: 'PRI', x: 60, y: 190, tipo: 'actor', color: '#006847' },
  { id: 'MC', x: 340, y: 190, tipo: 'actor', color: '#F58025' },
];
const NARR_LINKS: [string, string][] = [
  ['Morena', 'Seguridad'], ['Morena', 'Economía'], ['PAN', 'Seguridad'],
  ['PAN', 'Reforma judicial'], ['PRI', 'Reforma judicial'], ['PRI', 'Economía'],
  ['MC', 'Economía'], ['MC', 'Seguridad'],
];

// Mapa de México · intensidad de menciones políticas por estado (0-100), por id de estadosPaths
const MENCIONES_ESTADO: Record<string, number> = {
  MX_AG: 33, MX_BC: 38, MX_BS: 22, MX_CM: 24, MX_CS: 58, MX_CH: 52, MX_CO: 41, MX_CL: 21,
  MX_DF: 100, MX_DG: 31, MX_GT: 61, MX_GR: 51, MX_HG: 39, MX_JA: 79, MX_EM: 92, MX_MI: 54,
  MX_MO: 35, MX_NA: 26, MX_NL: 88, MX_OA: 57, MX_PU: 63, MX_QT: 48, MX_QR: 37, MX_SL: 44,
  MX_SI: 47, MX_SO: 45, MX_TB: 43, MX_TM: 49, MX_TL: 27, MX_VE: 66, MX_YU: 46, MX_ZA: 28,
};

// ───────────────────────── HELPERS ─────────────────────────

const Badge: React.FC<{ texto: string; color: string; pulse?: boolean }> = ({ texto, color, pulse }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.06em', color, background: `${color}1F`, border: `1px solid ${color}40`,
    padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', whiteSpace: 'nowrap',
  }}>
    {pulse && <span className="iel-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: color }} />}
    {texto}
  </span>
);

const Delta: React.FC<{ v: number }> = ({ v }) => {
  const up = v >= 0; const c = up ? colores.exito : colores.peligro;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: c, fontSize: 11, fontWeight: 700 }}>
      <Icon size={12} color={c} /> {Math.abs(v)}%
    </span>
  );
};

const tooltipStyle = {
  background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderRadius: 10,
  fontSize: 12, color: TXT, padding: '6px 10px', boxShadow: colores.sombraMedia,
} as const;

const card: React.CSSProperties = {
  background: colores.fondoClaro, border: `1px solid ${colores.borde}`,
  borderRadius: 18, padding: 20, boxShadow: colores.sombra,
};

const Panel: React.FC<{
  icon: React.ComponentType<{ size?: number; color?: string }>;
  titulo: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties;
}> = ({ icon: Icon, titulo, sub, children, style }) => (
  <div className="iel-panel" style={{ ...card, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${V}1F`, border: `1px solid ${V}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={V} />
      </div>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: TXT, margin: 0 }}>{titulo}</h3>
        {sub && <p style={{ fontSize: 11, color: MUT, margin: '1px 0 0' }}>{sub}</p>}
      </div>
    </div>
    {children}
  </div>
);

// ───────────────────────── PÁGINA ─────────────────────────

export const InteligenciaElectoral: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const col = (n: number) => (isMobile ? '1fr' : `repeat(${n}, 1fr)`);
  const maxSov = Math.max(...CANDIDATOS.map(c => c.sov));

  const kpis = [
    { Icon: MessageSquare, label: 'Menciones políticas hoy', value: '3,842', delta: 21 },
    { Icon: Vote, label: 'Candidatos monitoreados', value: '18', delta: 0 },
    { Icon: Landmark, label: 'Partidos / coaliciones', value: '7' },
    { Icon: Radio, label: 'Estaciones en cobertura', value: '42', delta: 4 },
  ];

  const generarReporte = () => {
    const el = document.createElement('div');
    el.textContent = '📄 Generando reporte semanal electoral… ✓';
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:${colores.textoClaro};color:${colores.textoEnOscuro};padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:${colores.sombraGrande}`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 1800);
    setTimeout(() => el.remove(), 2300);
  };

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? 16 : 32, background: colores.fondoPrincipal }}>
      <style>{`
        @keyframes iel-fadeup { from { opacity:0; transform: translateY(14px);} to {opacity:1; transform:none;} }
        @keyframes iel-pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.35;transform:scale(.7);} }
        @keyframes iel-grow { from { width:0; } }
        .iel-panel { animation: iel-fadeup .5s ease both; }
        .iel-grow { animation: iel-grow 1s ease both; }
        .iel-pulse { animation: iel-pulse 1.4s ease-in-out infinite; }
        .iel-feed:hover { background: ${colores.fondoSecundario}; }
      `}</style>

      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* HERO */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: V, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Vote size={26} color="#0A0A0A" />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: isMobile ? 24 : 34, fontWeight: 800, color: TXT, margin: 0, letterSpacing: '-0.5px' }}>
                Inteligencia Electoral <span style={{ color: V }}>2027</span>
              </h1>
              <Badge texto="EN VIVO" color={V} pulse />
            </div>
            <p style={{ fontSize: isMobile ? 13 : 15, color: colores.textoMedio, margin: '6px 0 0', maxWidth: 720, lineHeight: 1.5 }}>
              Análisis en tiempo real del discurso electoral en radio y su correlación con la conversación digital rumbo a las elecciones de México 2027.
            </p>
          </div>
          <button onClick={generarReporte} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, padding: '11px 18px', borderRadius: 12, alignSelf: 'center',
            border: 'none', background: colores.textoClaro, color: colores.textoEnOscuro, boxShadow: colores.sombra,
          }}>
            <FileText size={16} color={colores.textoEnOscuro} /> Reporte semanal
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {kpis.map((k, i) => (
            <div key={i} className="iel-panel" style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <k.Icon size={18} color={V} />
                {k.delta !== undefined && <Delta v={k.delta} />}
              </div>
              <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, color: TXT, marginTop: 10, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: MUT, marginTop: 5 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* FILA 1: SoV candidatos + partidos + evolución */}
        <div style={{ display: 'grid', gridTemplateColumns: col(3), gap: 16, marginBottom: 16 }}>
          <Panel icon={Scale} titulo="Share of Voice" sub="Participación mediática por candidato">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {CANDIDATOS.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: colores.textoMedio, width: 78, flexShrink: 0 }}>{c.nombre}</span>
                  <div style={{ flex: 1, height: 10, background: TRACK, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="iel-grow" style={{ width: `${(c.sov / maxSov) * 100}%`, height: '100%', background: c.color, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: TXT, width: 34, textAlign: 'right' }}>{c.sov}%</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon={Landmark} titulo="Presencia por partido" sub="Distribución de menciones">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ResponsiveContainer width="55%" height={150}>
                <PieChart>
                  <Pie data={PARTIDOS} dataKey="value" innerRadius={38} outerRadius={62} paddingAngle={3} stroke="none">
                    {PARTIDOS.map((p, i) => <Cell key={i} fill={p.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {PARTIDOS.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color }} />
                    <span style={{ color: colores.textoMedio, flex: 1 }}>{p.label}</span>
                    <span style={{ fontWeight: 800, color: TXT }}>{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel icon={TrendingUp} titulo="Evolución semanal" sub="Menciones por candidato (8 sem)">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={EVOLUCION} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colores.borde} />
                <XAxis dataKey="sem" tick={{ fill: MUT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Cruz" stroke="#9B2247" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Salazar" stroke="#0047AB" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Gutierrez" stroke="#006847" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* FILA 2: Sentimiento por candidato + Agenda temática */}
        <div style={{ display: 'grid', gridTemplateColumns: col(2), gap: 16, marginBottom: 16 }}>
          <Panel icon={Smile} titulo="Sentimiento por candidato" sub="Positivo · Neutral · Negativo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CANDIDATOS.map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: TXT, fontWeight: 600 }}>{c.nombre}</span>
                    <span style={{ fontSize: 11, color: MUT }}>{c.partido}</span>
                  </div>
                  <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${c.sent.pos}%`, background: colores.exito }} title={`Positivo ${c.sent.pos}%`} />
                    <div style={{ width: `${c.sent.neu}%`, background: colores.fondoTerciario }} title={`Neutral ${c.sent.neu}%`} />
                    <div style={{ width: `${c.sent.neg}%`, background: colores.peligro }} title={`Negativo ${c.sent.neg}%`} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
                {(['pos', 'neu', 'neg'] as const).map(k => {
                  const m = SENT_META[k];
                  return (
                    <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUT }}>
                      <m.Icon size={13} color={m.color} /> {m.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel icon={Flame} titulo="Agenda temática" sub="Temas que dominan el discurso">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMAS.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: colores.textoMedio, width: 86, flexShrink: 0 }}>{t.tema}</span>
                  <div style={{ flex: 1, height: 9, background: TRACK, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="iel-grow" style={{ width: `${t.v}%`, height: '100%', background: `linear-gradient(90deg, ${V}, ${colores.exito})`, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TXT, width: 30, textAlign: 'right' }}>{t.v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* FILA 2b: Sentimiento por estación y por programa */}
        <div style={{ display: 'grid', gridTemplateColumns: col(2), gap: 16, marginBottom: 16 }}>
          <Panel icon={Radio} titulo="Sentimiento por estación" sub="Tono del discurso por emisora">
            <SentList items={SENT_ESTACION} />
          </Panel>
          <Panel icon={Mic2} titulo="Sentimiento por programa" sub="Tono del discurso por programa">
            <SentList items={SENT_PROGRAMA} />
          </Panel>
        </div>

        {/* FILA 3: Narrativas emergentes + Correlación radio/redes */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.3fr', gap: 16, marginBottom: 16 }}>
          <Panel icon={Flame} titulo="Narrativas emergentes" sub="NLP · cambios en la agenda">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NARRATIVAS.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: colores.fondoSecundario, border: `1px solid ${colores.borde}`, borderRadius: 12, padding: '11px 13px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TXT }}>{n.texto}</div>
                    <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{n.vol} menciones</div>
                  </div>
                  <Delta v={n.delta} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon={Share2} titulo="Correlación radio + redes" sub="Pico mediático: radio vs X / TikTok / Facebook">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={CORRELACION} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="iel-radio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={V} stopOpacity={0.5} /><stop offset="100%" stopColor={V} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="iel-redes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colores.borde} />
                <XAxis dataKey="d" tick={{ fill: MUT, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: TXT }} />
                <Area type="monotone" name="Radio" dataKey="radio" stroke={V} strokeWidth={2.5} fill="url(#iel-radio)" />
                <Area type="monotone" name="Redes" dataKey="redes" stroke="#3B82F6" strokeWidth={2.5} fill="url(#iel-redes)" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* FILA 4: Feed de detecciones + Ranking estaciones */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 16 }}>
          <MonitoreoDiscurso />

          <Panel icon={Trophy} titulo="Ranking de presencia mediática" sub="Impacto por estación">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={RANKING} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="estacion" width={120} tick={{ fill: colores.textoMedio, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: TRACK }} />
                <Bar dataKey="impacto" radius={[0, 6, 6, 0]} barSize={18}>
                  {RANKING.map((_, i) => <Cell key={i} fill={i === 0 ? V : `${V}${(80 - i * 12).toString(16)}`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* FILA 5: Mapa de narrativa + Mapa geográfico */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Panel icon={Network} titulo="Mapa de narrativa" sub="Red de actores ↔ temas del discurso">
            <MapaNarrativa />
          </Panel>
          <Panel icon={MapPin} titulo="Mapa de México" sub="Intensidad de menciones por estado">
            <MapaMexico isMobile={isMobile} />
          </Panel>
        </div>
      </div>
    </div>
  );
};

// ── Sentimiento (lista de barras apiladas reutilizable) ──
const SentList: React.FC<{ items: { nombre: string; pos: number; neu: number; neg: number }[] }> = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {items.map((s, i) => (
      <div key={i}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: TXT, fontWeight: 600 }}>{s.nombre}</span>
          <span style={{ fontSize: 11, color: MUT }}>{s.pos}% pos</span>
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${s.pos}%`, background: colores.exito }} title={`Positivo ${s.pos}%`} />
          <div style={{ width: `${s.neu}%`, background: colores.fondoTerciario }} title={`Neutral ${s.neu}%`} />
          <div style={{ width: `${s.neg}%`, background: colores.peligro }} title={`Negativo ${s.neg}%`} />
        </div>
      </div>
    ))}
  </div>
);

// ── Mapa de narrativa (SVG network) ──
const MapaNarrativa: React.FC = () => {
  const pos = (id: string) => NARR_NODOS.find(n => n.id === id)!;
  return (
    <svg viewBox="0 0 400 240" style={{ width: '100%', height: 'auto' }}>
      {NARR_LINKS.map(([a, b], i) => {
        const A = pos(a), B = pos(b);
        return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={colores.borde} strokeWidth={1.5} />;
      })}
      {NARR_NODOS.map((n, i) => {
        const tema = n.tipo === 'tema';
        const fill = tema ? V : (n.color ?? V);
        const r = tema ? 8 : 14;
        return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={r} fill={fill} fillOpacity={tema ? 1 : 0.9} />
            <text x={n.x} y={n.y - (tema ? 14 : 22)} textAnchor="middle"
              fontSize={tema ? 11 : 12} fontWeight={tema ? 600 : 800}
              fill={colores.textoClaro}>{n.id}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Mapa de México · choropleth con SVG real (geometría de mexicoPaths) ──
const tonoVerde = (v: number) => `rgba(154,194,79,${(0.12 + (v / 100) * 0.88).toFixed(2)})`;
const MapaMexico: React.FC<{ isMobile: boolean }> = () => {
  const [hover, setHover] = useState<{ x: number; y: number; id: string } | null>(null);
  const nombre = (id: string) => estadosPaths.find(e => e.id === id)?.label ?? id;

  return (
    <div style={{ position: 'relative' }}>
      {hover && (
        <div style={{
          position: 'absolute', left: hover.x + 12, top: hover.y - 10, zIndex: 10, pointerEvents: 'none',
          background: colores.textoClaro, color: colores.textoEnOscuro, padding: '5px 10px',
          borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: colores.sombraMedia,
        }}>
          {nombre(hover.id)} · {MENCIONES_ESTADO[hover.id] ?? 0} menciones
        </div>
      )}
      <svg viewBox="0 0 959 593" style={{ width: '100%', height: 'auto' }}
        onMouseLeave={() => setHover(null)}>
        {estadosPaths.map(e => {
          const v = MENCIONES_ESTADO[e.id] ?? 0;
          const activo = hover?.id === e.id;
          return (
            <path
              key={e.id}
              d={e.path}
              fill={activo ? V : tonoVerde(v)}
              stroke={colores.fondoClaro}
              strokeWidth={activo ? 1.4 : 0.7}
              style={{ cursor: 'pointer', transition: 'fill .15s' }}
              onMouseMove={ev => {
                const r = (ev.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                setHover({ x: ev.clientX - r.left, y: ev.clientY - r.top, id: e.id });
              }}
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: MUT }}>Menos</span>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: `linear-gradient(90deg, ${tonoVerde(5)}, ${tonoVerde(100)})` }} />
        <span style={{ fontSize: 10, color: MUT }}>Más menciones</span>
      </div>
    </div>
  );
};

const Chip: React.FC<{ texto: string; color: string }> = ({ texto, color }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, color, background: `${color}1A`,
    border: `1px solid ${color}33`, padding: '3px 8px', borderRadius: 999,
  }}>{texto}</span>
);

// ── Monitoreo de discurso político — estilo Monitor de Medios con filtros de partido ──
const MonitoreoDiscurso: React.FC = () => {
  // Por defecto escucha TODOS los partidos predefinidos
  const [activos, setActivos] = useState<string[]>(PARTIDOS_FILTRO.map(p => p.id));

  const toggle = (id: string) =>
    setActivos(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const feed = FEED.filter(f => activos.includes(f.partido));

  return (
    <Panel icon={Activity} titulo="Monitoreo de discurso político" sub="Detección automática de entidades en transmisión">
      {/* Filtros de partido — "quiero escuchar sobre…" */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Escuchando partidos
          </span>
          <span style={{ fontSize: 11, color: MUT }}>{feed.length} detecciones</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PARTIDOS_FILTRO.map(p => {
            const on = activos.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, transition: 'all .2s',
                  border: `1.5px solid ${on ? p.color : colores.borde}`,
                  background: on ? p.color : colores.fondoSecundario,
                  color: on ? '#fff' : colores.textoOscuro,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: on ? '#fff' : p.color,
                }} />
                {p.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed de detecciones */}
      {feed.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 0' }}>
          <Radio size={36} color={MUT} strokeWidth={1} />
          <p style={{ fontSize: 13, color: colores.textoMedio, margin: 0 }}>Selecciona al menos un partido para escuchar</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
          {feed.map((f, i) => {
            const sm = SENT_META[f.sent as keyof typeof SENT_META];
            const pc = PARTIDO_COLOR[f.partido] ?? colores.secundario;
            return (
              <div key={i} className="iel-feed" style={{
                display: 'flex', gap: 12, padding: '12px 13px', borderRadius: 12,
                background: colores.fondoSecundario, border: `1px solid ${colores.borde}`,
                borderLeft: `4px solid ${pc}`, transition: 'background .2s',
                animation: 'iel-fadeup .3s ease both',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: V }}>{f.hora}</span>
                  <sm.Icon size={16} color={sm.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ background: pc, color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>
                      {f.partido}
                    </span>
                    <span style={{ fontSize: 11, color: MUT }}>{f.estacion}</span>
                  </div>
                  <div style={{ fontSize: 13, color: colores.textoMedio, fontStyle: 'italic', lineHeight: 1.4 }}>“{f.texto}”</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <Chip texto={f.candidato} color={colores.secundario} />
                    <Chip texto={f.tema} color={colores.advertencia} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
};
