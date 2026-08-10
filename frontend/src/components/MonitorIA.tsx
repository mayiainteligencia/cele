import React, { useState, useEffect } from 'react';
import {
  Megaphone, Cog, Mic2, Swords, TrendingUp, Users2, LayoutPanelLeft,
  Database, Rocket, RefreshCw, Radio, Activity,
  ArrowUpRight, ArrowDownRight, CircleDot,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, RadialBarChart, RadialBar,
} from 'recharts';
import { brandingConfig } from '../config/branding';
import { ModuloDetalleModal } from './MonitorIADetalles';

const { colores } = brandingConfig;

const PALETA = ['#7C3AED', '#1A1A1A', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

// ───────────────────────── DATA DUMMY (la lógica/datos reales van después) ─────────────────────────

type Viz =
  | { tipo: 'area'; data: { x: string; v: number }[] }
  | { tipo: 'barsH'; data: { label: string; value: number }[] }
  | { tipo: 'donut'; data: { label: string; value: number }[] }
  | { tipo: 'gauge'; value: number }
  | { tipo: 'sparkbars'; data: number[] };

interface Modulo {
  num: number;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tag: string;
  titulo: string;
  descripcion: string;
  badge: { texto: string; color: string };
  kpis: { label: string; value: string; delta?: number }[];
  semanas: string;
  viz: Viz;
}

const serie = (vals: number[]): { x: string; v: number }[] =>
  vals.map((v, i) => ({ x: `${i}`, v }));

const MODULOS: Modulo[] = [
  {
    num: 1, icon: Megaphone, tag: 'Comercial',
    titulo: 'Activación automática de campañas',
    descripcion: 'Detecta menciones en radio y dispara pauta en Meta / Google sincronizada.',
    badge: { texto: 'EN VIVO', color: colores.exito },
    kpis: [
      { label: 'Campañas activas', value: '24', delta: 12 },
      { label: 'Marcas detectadas', value: '187', delta: 8 },
      { label: 'Sync APIs', value: '99.2%' },
    ],
    semanas: '8–10 sem',
    viz: { tipo: 'donut', data: [{ label: 'Meta Ads', value: 58 }, { label: 'Google Ads', value: 42 }] },
  },
  {
    num: 2, icon: Cog, tag: 'Automatización',
    titulo: 'Centros de procesos automatizados',
    descripcion: 'Corte automático de audio, clips verificables y reportes sin intervención manual.',
    badge: { texto: 'AUTOMÁTICO', color: colores.primario },
    kpis: [
      { label: 'Clips generados', value: '1,342', delta: 23 },
      { label: 'Reportes/día', value: '96', delta: 5 },
      { label: 'Alertas auto', value: '418' },
    ],
    semanas: '6 sem',
    viz: { tipo: 'sparkbars', data: [40, 65, 50, 80, 72, 95, 88, 120, 110, 140] },
  },
  {
    num: 3, icon: Mic2, tag: 'Editorial',
    titulo: 'Talento y programación',
    descripcion: 'Diarización de voz, tiempo aire por locutor y desempeño por programa.',
    badge: { texto: 'ANÁLISIS', color: '#8B5CF6' },
    kpis: [
      { label: 'Locutores', value: '38' },
      { label: 'Hrs aire/sem', value: '612', delta: 4 },
      { label: 'Engagement', value: '74%', delta: 9 },
    ],
    semanas: '10 sem',
    viz: {
      tipo: 'barsH', data: [
        { label: 'C. López', value: 92 }, { label: 'M. Ruiz', value: 78 },
        { label: 'A. Vega', value: 64 }, { label: 'J. Soto', value: 51 },
      ],
    },
  },
  {
    num: 4, icon: Swords, tag: 'Competencia',
    titulo: 'Inteligencia competitiva',
    descripcion: 'Share of Voice de competidores y detección de oportunidades comerciales.',
    badge: { texto: 'SHARE OF VOICE', color: colores.advertencia },
    kpis: [
      { label: 'Marcas rastreadas', value: '52' },
      { label: 'Tu SoV', value: '34%', delta: 6 },
      { label: 'Oportunidades', value: '17' },
    ],
    semanas: '6 sem',
    viz: {
      tipo: 'donut', data: [
        { label: 'MVS', value: 34 }, { label: 'Comp. A', value: 28 },
        { label: 'Comp. B', value: 22 }, { label: 'Otros', value: 16 },
      ],
    },
  },
  {
    num: 5, icon: TrendingUp, tag: 'Trending',
    titulo: 'Trending topics radio + redes',
    descripcion: 'Cruce de conversación entre radio y X, Instagram y TikTok en tiempo real.',
    badge: { texto: 'TENDENCIAS', color: colores.exito },
    kpis: [
      { label: 'Temas activos', value: '29', delta: 14 },
      { label: 'Volumen 24h', value: '84K', delta: 31 },
      { label: 'Pico correlación', value: '+62%' },
    ],
    semanas: '8 sem',
    viz: { tipo: 'area', data: serie([20, 35, 28, 50, 44, 70, 62, 88, 76, 110]) },
  },
  {
    num: 6, icon: Users2, tag: 'Audiencias',
    titulo: 'Hipersegmentación de audiencias',
    descripcion: 'Clustering avanzado, perfilamiento demográfico y detección de “audiencia oro”.',
    badge: { texto: 'ML CLUSTERING', color: '#3B82F6' },
    kpis: [
      { label: 'Clústeres', value: '12' },
      { label: 'Audiencia oro', value: '8.4%', delta: 3 },
      { label: 'Perfiles', value: '2.1M' },
    ],
    semanas: '18 sem',
    viz: {
      tipo: 'donut', data: [
        { label: 'Oro', value: 8 }, { label: 'Premium', value: 22 },
        { label: 'Frecuente', value: 41 }, { label: 'Casual', value: 29 },
      ],
    },
  },
  {
    num: 7, icon: LayoutPanelLeft, tag: 'Brand Portal',
    titulo: 'Portal para clientes',
    descripcion: 'Dashboard self-service para anunciantes: menciones, clips y reportes.',
    badge: { texto: 'SELF-SERVICE', color: colores.primario },
    kpis: [
      { label: 'Clientes activos', value: '46', delta: 10 },
      { label: 'Clips descargados', value: '3,907' },
      { label: 'Reportes enviados', value: '512' },
    ],
    semanas: '6 sem',
    viz: { tipo: 'sparkbars', data: [30, 45, 38, 60, 72, 65, 90, 84, 100, 118] },
  },
  {
    num: 8, icon: Database, tag: 'INRA',
    titulo: 'Integración con INRA y audiencia',
    descripcion: 'Cruce de monitoreo con métricas de audiencia: impacto y valor de pauta.',
    badge: { texto: 'DATA SYNC', color: '#8B5CF6' },
    kpis: [
      { label: 'Valor pauta', value: '$4.2M', delta: 7 },
      { label: 'Ranking impacto', value: 'Top 8' },
      { label: 'Cobertura', value: '91%' },
    ],
    semanas: '8 sem',
    viz: {
      tipo: 'barsH', data: [
        { label: 'Estación A', value: 88 }, { label: 'Estación B', value: 71 },
        { label: 'Estación C', value: 55 }, { label: 'Estación D', value: 40 },
      ],
    },
  },
  {
    num: 9, icon: Rocket, tag: 'Roadmap',
    titulo: 'Estrategia hacia el 2027',
    descripcion: 'Plan evolutivo de la plataforma y nuevas líneas de producto.',
    badge: { texto: 'PLANEACIÓN', color: colores.advertencia },
    kpis: [
      { label: 'Fases', value: '4' },
      { label: 'Avance', value: '35%', delta: 5 },
      { label: 'Hitos', value: '11' },
    ],
    semanas: '10–15 sem',
    viz: { tipo: 'gauge', value: 35 },
  },
  {
    num: 10, icon: RefreshCw, tag: 'Web Services',
    titulo: 'Integración Web Services INRA',
    descripcion: 'Ingestión y actualización diaria automática en un dashboard unificado.',
    badge: { texto: 'SYNC DIARIO', color: colores.exito },
    kpis: [
      { label: 'Uptime', value: '99.9%' },
      { label: 'Última sync', value: 'Hoy 06:00' },
      { label: 'Registros/día', value: '24K' },
    ],
    semanas: '4 sem',
    viz: { tipo: 'gauge', value: 99 },
  },
];

// ───────────────────────── UI HELPERS ─────────────────────────

const Badge: React.FC<{ texto: string; color: string; pulse?: boolean }> = ({ texto, color, pulse }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
    color, background: `${color}1A`, border: `1px solid ${color}40`,
    padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }}>
    {pulse && <span className="mia-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: color }} />}
    {texto}
  </span>
);

const Delta: React.FC<{ v: number }> = ({ v }) => {
  const up = v >= 0;
  const c = up ? colores.exito : colores.peligro;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: c, fontSize: 11, fontWeight: 700 }}>
      <Icon size={12} color={c} /> {Math.abs(v)}%
    </span>
  );
};

const tooltipStyle = {
  background: colores.secundario, border: 'none', borderRadius: 10,
  fontSize: 12, color: '#fff', padding: '6px 10px',
} as const;

const MiniViz: React.FC<{ viz: Viz; id: number }> = ({ viz, id }) => {
  if (viz.tipo === 'area') {
    return (
      <ResponsiveContainer width="100%" height={88}>
        <AreaChart data={viz.data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`ar${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colores.primario} stopOpacity={0.5} />
              <stop offset="100%" stopColor={colores.primario} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={colores.primario} strokeWidth={2.5}
            fill={`url(#ar${id})`} dot={false} isAnimationActive />
          <Tooltip contentStyle={tooltipStyle} cursor={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (viz.tipo === 'sparkbars') {
    const data = viz.data.map((v, i) => ({ x: i, v }));
    return (
      <ResponsiveContainer width="100%" height={88}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? colores.primario : `${colores.secundario}33`} />
            ))}
          </Bar>
          <Tooltip contentStyle={tooltipStyle} cursor={false} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (viz.tipo === 'barsH') {
    const max = Math.max(...viz.data.map(d => d.value));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        {viz.data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: colores.textoMedio, width: 64, flexShrink: 0 }}>{d.label}</span>
            <div style={{ flex: 1, height: 8, background: `${colores.secundario}12`, borderRadius: 999, overflow: 'hidden' }}>
              <div className="mia-grow" style={{
                width: `${(d.value / max) * 100}%`, height: '100%', borderRadius: 999,
                background: `linear-gradient(90deg, ${colores.primario}, ${colores.exito})`,
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: colores.textoClaro, width: 24, textAlign: 'right' }}>{d.value}</span>
          </div>
        ))}
      </div>
    );
  }
  if (viz.tipo === 'donut') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ResponsiveContainer width="50%" height={92}>
          <PieChart>
            <Pie data={viz.data} dataKey="value" innerRadius={26} outerRadius={42} paddingAngle={3} stroke="none">
              {viz.data.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
          {viz.data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETA[i % PALETA.length] }} />
              <span style={{ color: colores.textoMedio, flex: 1 }}>{d.label}</span>
              <span style={{ fontWeight: 700, color: colores.textoClaro }}>{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (viz.tipo !== 'gauge') return null;
  const data = [{ value: viz.value, fill: colores.primario }];
  return (
    <div style={{ position: 'relative', height: 92 }}>
      <ResponsiveContainer width="100%" height={92}>
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
          <RadialBar background={{ fill: `${colores.secundario}14` }} dataKey="value" cornerRadius={999} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: colores.textoClaro }}>{viz.value}%</span>
      </div>
    </div>
  );
};

const ModuloCard: React.FC<{ m: Modulo; i: number; onOpen: (num: number) => void }> = ({ m, i, onOpen }) => {
  const Icon = m.icon;
  return (
    <div className="mia-card" role="button" tabIndex={0}
      onClick={() => onOpen(m.num)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(m.num); } }}
      style={{
        background: colores.fondoClaro, borderRadius: 20, padding: 20, cursor: 'pointer',
        border: `1px solid ${colores.borde}`, boxShadow: colores.sombra,
        display: 'flex', flexDirection: 'column', gap: 14,
        animationDelay: `${i * 0.05}s`,
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: colores.gradientePrimario,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <Icon size={20} color="#fff" />
            <span style={{
              position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 999,
              background: colores.primario, color: '#0A0A0A', fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.num}</span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: colores.primario, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.tag}</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: colores.textoClaro, margin: '2px 0 0', lineHeight: 1.2 }}>{m.titulo}</h3>
          </div>
        </div>
        <Badge texto={m.badge.texto} color={m.badge.color} pulse={m.badge.texto === 'EN VIVO'} />
      </div>

      <p style={{ fontSize: 12.5, color: colores.textoOscuro, margin: 0, lineHeight: 1.45 }}>{m.descripcion}</p>

      <div style={{ display: 'flex', gap: 8 }}>
        {m.kpis.map((k, j) => (
          <div key={j} style={{
            flex: 1, background: colores.fondoSecundario, borderRadius: 12, padding: '10px 12px',
            border: `1px solid ${colores.borde}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: colores.textoClaro, lineHeight: 1 }}>{k.value}</span>
              {k.delta !== undefined && <Delta v={k.delta} />}
            </div>
            <div style={{ fontSize: 10, color: colores.textoOscuro, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <MiniViz viz={m.viz} id={m.num} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <span style={{ fontSize: 10, color: colores.textoOscuro, display: 'flex', alignItems: 'center', gap: 4 }}>
          <CircleDot size={11} color={colores.primario} /> Desarrollo · {m.semanas}
        </span>
        <span className="mia-vermas" style={{ fontSize: 11, fontWeight: 800, color: colores.primario }}>Ver detalle →</span>
      </div>
    </div>
  );
};

// ───────────────────────── COMPONENTE PRINCIPAL ─────────────────────────

export const MonitorIA: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [openNum, setOpenNum] = useState<number | null>(null);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const kpisTop = [
    { icon: Radio, label: 'Estaciones monitoreadas', value: '42', delta: 3 },
    { icon: Activity, label: 'Menciones hoy', value: '12,480', delta: 18 },
    { icon: Megaphone, label: 'Campañas activas', value: '24', delta: 12 },
    { icon: Users2, label: 'Audiencia analizada', value: '2.1M', delta: 6 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: colores.fondoPrincipal, padding: isMobile ? 16 : 32 }}>
      <style>{`
        @keyframes mia-fadeup { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mia-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.7); } }
        @keyframes mia-grow { from { width: 0; } }
        .mia-card { animation: mia-fadeup .5s ease both; }
        .mia-card:hover { box-shadow: ${colores.sombraGrande}; transform: translateY(-3px); }
        .mia-card:hover .mia-vermas { letter-spacing: .03em; }
        .mia-card:focus-visible { outline: 2px solid ${colores.primario}; outline-offset: 2px; }
        .mia-card { transition: transform .2s ease, box-shadow .2s ease; }
        @keyframes mia-modal { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: none; } }
        .mia-pulse { animation: mia-pulse 1.4s ease-in-out infinite; }
        .mia-grow { animation: mia-grow 1s ease both; }
      `}</style>

      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* HERO */}
        <div style={{
          background: colores.gradientePrimario, borderRadius: 24, padding: isMobile ? 20 : 32,
          marginBottom: 24, position: 'relative', overflow: 'hidden',
          boxShadow: colores.sombraGrande,
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: 999,
            background: `radial-gradient(circle, ${colores.primario}55, transparent 70%)`,
          }} />
          <Badge texto="EN VIVO" color={colores.primario} pulse />
          <h1 style={{ fontSize: isMobile ? 26 : 38, fontWeight: 300, color: '#fff', margin: '14px 0 6px', letterSpacing: '-0.5px' }}>
            Cerebro <span style={{ fontWeight: 800, color: colores.primario }}>Electoral</span>
          </h1>
          <p style={{ fontSize: isMobile ? 14 : 16, color: 'rgba(255,255,255,0.7)', margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
            Plataforma de inteligencia mediática: del audio en radio al análisis semántico, comercial y político en tiempo real.
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
            gap: 12, marginTop: 24, position: 'relative',
          }}>
            {kpisTop.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16, padding: 16, backdropFilter: 'blur(6px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Icon size={18} color={colores.primario} />
                    <Delta v={k.delta} />
                  </div>
                  <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#fff', marginTop: 10, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{k.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN MÓDULOS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: colores.textoClaro, margin: 0 }}>Módulos de inteligencia</h2>
          <span style={{ fontSize: 12, color: colores.textoOscuro }}>10 módulos · plataforma extendida</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 20, marginBottom: 32,
        }}>
          {MODULOS.map((m, i) => <ModuloCard key={m.num} m={m} i={i} onOpen={setOpenNum} />)}
        </div>
      </div>

      {/* DETALLE EN MODAL AL HACER CLIC */}
      <ModuloDetalleModal num={openNum} onClose={() => setOpenNum(null)} />
    </div>
  );
};
