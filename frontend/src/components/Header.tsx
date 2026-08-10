import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Search,
  CalendarDays,
  CornerDownLeft,
} from 'lucide-react';
import { brandingConfig } from '../config/branding';
import { SECCIONES, buscarSeccion } from '../data/asistente';
import { porAnio, ULTIMO, fmt } from '../data/electoral';
import { BrainCanvas } from './modules/dashboardModules/BrainCanvas';
import { useConfirm } from './electoral/confirm';
import { useToast } from './electoral/toast';

interface HeaderProps {
  title: string;
  onSectionChange?: (id: string) => void;
}

interface Notification {
  id: number;
  tipo: 'alerta' | 'exito' | 'info' | 'urgente';
  titulo: string;
  mensaje: string;
  tiempo: string;
  leida: boolean;
  plan?: string;
}

const D = porAnio[ULTIMO];
const notificacionesEstaticas: Notification[] = [
  { id: 1, tipo: 'urgente', titulo: 'Oportunidad: 6 municipios por ≤5 votos',        mensaje: `El PRI quedó a ≤5 votos de ganar en 6 municipios. Un plan de movilización focalizada podría voltearlos. Revisa Alertas.`, tiempo: 'Hace 3 min',  leida: false, plan: 'Desplegar movilización focalizada en los 6 municipios de margen mínimo para intentar voltearlos.' },
  { id: 2, tipo: 'alerta',  titulo: 'Detección en radio · MVS 102.5',               mensaje: `Nueva mención del PRI en Tlacolula, sentimiento positivo. Escucha el testigo en Monitor de Medios.`,                        tiempo: 'Hace 8 min',  leida: false },
  { id: 3, tipo: 'alerta',  titulo: `Abstención crítica (${D.abstProm}%)`, mensaje: `Santo Domingo Ixcatlán registra 96.7% de abstención histórica. Foco de trabajo para movilización.`,                        tiempo: 'Hace 22 min', leida: false, plan: 'Reforzar estructura territorial en las plazas de mayor abstención histórica.' },
  { id: 4, tipo: 'exito',   titulo: 'Cómputo de ganadores completado',              mensaje: `El PRI ganó ${fmt(D.ganadosPRI)} de ${fmt(D.totalMunicipios)} municipios (${D.sharePRI}% de la votación) en ${ULTIMO}.`,     tiempo: 'Hace 1 hora', leida: true  },
  { id: 5, tipo: 'info',    titulo: `${D.segundaFuerza} avanza como 2ª fuerza`,      mensaje: `${D.segundaFuerza} concentra ${D.ganadosSegunda} municipios. Vigilar su avance de cara a la próxima elección.`,           tiempo: 'Hace 2 horas', leida: true  },
];

export const Header: React.FC<HeaderProps> = ({ title, onSectionChange }) => {
  const { colores, empresa } = brandingConfig;

  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notification[]>(notificacionesEstaticas);
  const notifRef = useRef<HTMLDivElement>(null);
  const confirmar = useConfirm();
  const { push } = useToast();

  const activarPlanNotif = async (n: Notification) => {
    if (n.plan && await confirmar({ titulo: n.titulo, descripcion: n.plan })) {
      marcarComoLeida(n.id);
      push({ kind: 'success', title: 'Plan activado', msg: n.plan });
    }
  };

  const [query, setQuery] = useState('');
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultados = query.trim() ? buscarSeccion(query) : SECCIONES;

  const irASeccion = (id: string) => {
    onSectionChange?.(id);
    setBuscadorAbierto(false);
    setQuery('');
    inputRef.current?.blur();
  };

  // Mini-jarvis: va al dashboard (donde vive el asistente) y lo abre.
  const abrirJarvis = () => {
    onSectionChange?.('dashboard');
    setTimeout(() => window.dispatchEvent(new CustomEvent('jarvis:open')), 350);
  };

  const fecha = new Date();
  const fechaFormateada = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotificacionesAbiertas(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node))
        setBuscadorAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notificacionesNoLeidas = notificaciones.filter(n => !n.leida).length;

  const getIconoPorTipo = (tipo: Notification['tipo']) => {
    switch (tipo) {
      case 'alerta':  return <AlertTriangle size={16} color="#F59E0B" />;
      case 'exito':   return <CheckCircle   size={16} color="#10B981" />;
      case 'urgente': return <AlertTriangle size={16} color="#EF4444" />;
      case 'info':    return <Info          size={16} color="#3B82F6" />;
    }
  };

  const marcarComoLeida = (id: number) =>
    setNotificaciones(notificaciones.map(n => n.id === id ? { ...n, leida: true } : n));

  const marcarTodasComoLeidas = () =>
    setNotificaciones(notificaciones.map(n => ({ ...n, leida: true })));

  return (
    <>
      <header
        style={{
          height: '72px',
          backgroundColor: colores.fondoSecundario,
          borderBottom: `1px solid ${colores.borde}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          gap: '8px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 300,
        }}
      >
        {/* ── IZQUIERDA: Buscador de secciones ── */}
        <div
          ref={searchWrapRef}
          style={{ flex: 1, maxWidth: '540px', position: 'relative' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 14px',
              height: '44px',
              borderRadius: buscadorAbierto && resultados.length ? '14px 14px 0 0' : '999px',
              backgroundColor: buscadorAbierto ? colores.fondoPrincipal : colores.fondoTerciario,
              border: `1px solid ${buscadorAbierto ? colores.primario : colores.borde}`,
              transition: 'border-radius 0.15s, background-color 0.2s',
              boxShadow: buscadorAbierto ? `0 0 0 3px ${colores.primario}28` : 'none',
              position: 'relative',
              zIndex: 310,
            }}
          >
            <Search size={17} style={{ color: colores.primario, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setBuscadorAbierto(true); }}
              onFocus={() => setBuscadorAbierto(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && resultados[0]) irASeccion(resultados[0].id);
                if (e.key === 'Escape') { setBuscadorAbierto(false); inputRef.current?.blur(); }
              }}
              placeholder="Buscar sección…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: '14px', color: colores.textoClaro,
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
              >
                <X size={16} style={{ color: colores.textoMedio }} />
              </button>
            )}
          </div>

          {/* Resultados */}
          {buscadorAbierto && (
            <div
              style={{
                position: 'absolute', top: '43px', left: 0, right: 0,
                backgroundColor: colores.fondoPrincipal,
                border: `1px solid ${colores.primario}`,
                borderTop: `1px solid ${colores.borde}`,
                borderRadius: '0 0 16px 16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                overflow: 'hidden', zIndex: 305,
                maxHeight: 'calc(100vh - 130px)', overflowY: 'auto',
              }}
            >
              {resultados.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '13px', color: colores.textoMedio }}>
                  Sin coincidencias para "{query}"
                </div>
              ) : (
                resultados.map(s => (
                  <button
                    key={s.id}
                    onClick={() => irASeccion(s.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '11px 16px', border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${colores.borde}`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = colores.fondoTerciario)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Search size={15} style={{ color: colores.textoOscuro, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: colores.textoClaro }}>{s.titulo}</span>
                    <CornerDownLeft size={14} style={{ color: colores.textoOscuro }} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── CENTRO: Logo ── */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px',
          padding: '4px 16px', display: 'flex', alignItems: 'center',
          flexShrink: 0, height: '64px', overflow: 'hidden',
        }}>
          <img
            src={empresa.logo}
            alt={`${empresa.nombre} logo`}
            style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* ── DERECHA: Jarvis + Fecha + Bell + Avatar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mini-jarvis (átomo) — acceso rápido al asistente */}
          <button
            onClick={abrirJarvis}
            title="Abrir MAYIA"
            aria-label="Abrir asistente MAYIA"
            style={{
              width: '46px', height: '46px', borderRadius: '50%',
              backgroundColor: colores.fondoTerciario, border: `1px solid ${colores.borde}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0, transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = `0 0 0 3px ${colores.primario}28`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 60, height: 60, pointerEvents: 'none' }}>
              <BrainCanvas accent={colores.primario} height={60} nodes={55} />
            </div>
          </button>

          {/* Fecha pegada a la campana */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '7px 14px', borderRadius: '999px',
            backgroundColor: colores.fondoTerciario,
            border: `1px solid ${colores.borde}`,
            marginRight: '4px',
          }}>
            <CalendarDays size={14} style={{ color: colores.textoMedio }} />
            <span style={{ fontSize: '13px', fontWeight: '500', color: colores.textoClaro }}>
              {fechaFormateada}
            </span>
          </div>

          {/* Notificaciones */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setNotificacionesAbiertas(!notificacionesAbiertas)}
              style={iconBtnStyle(colores.fondoTerciario)}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colores.fondoPrincipal)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = colores.fondoTerciario)}
            >
              <Bell size={19} style={{ color: colores.textoClaro }} />
              {notificacionesNoLeidas > 0 && (
                <span style={{
                  position: 'absolute', top: '6px', right: '6px',
                  minWidth: '17px', height: '17px', borderRadius: '10px',
                  backgroundColor: '#EF4444', border: `2px solid ${colores.fondoSecundario}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', padding: '0 3px',
                }}>
                  {notificacionesNoLeidas}
                </span>
              )}
            </button>

            {notificacionesAbiertas && (
              <div style={{
                position: 'absolute', top: '56px', right: '0',
                width: '370px', maxHeight: '480px',
                backgroundColor: colores.fondoSecundario,
                borderRadius: '14px', border: `1px solid ${colores.borde}`,
                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                overflow: 'hidden', zIndex: 1000,
              }}>
                <div style={{
                  padding: '14px 18px', borderBottom: `1px solid ${colores.borde}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: colores.textoClaro }}>Notificaciones</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: colores.textoMedio }}>{notificacionesNoLeidas} sin leer</p>
                  </div>
                  {notificacionesNoLeidas > 0 && (
                    <button onClick={marcarTodasComoLeidas}
                      style={{ background: 'none', border: 'none', color: colores.primario, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      Marcar todas
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  {notificaciones.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => marcarComoLeida(notif.id)}
                      style={{
                        padding: '14px 18px', borderBottom: `1px solid ${colores.borde}`,
                        backgroundColor: notif.leida ? 'transparent' : colores.fondoTerciario + '44',
                        cursor: 'pointer', transition: 'background-color 0.15s', display: 'flex', gap: '10px',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colores.fondoTerciario)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = notif.leida ? 'transparent' : colores.fondoTerciario + '44')}
                    >
                      <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIconoPorTipo(notif.tipo)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: notif.leida ? '500' : '700', color: colores.textoClaro }}>
                            {notif.titulo}
                          </h4>
                          {!notif.leida && (
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: colores.primario, flexShrink: 0, marginLeft: '8px', marginTop: '4px' }} />
                          )}
                        </div>
                        <p style={{ margin: '2px 0', fontSize: '12px', color: colores.textoMedio, lineHeight: '1.4' }}>{notif.mensaje}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: '11px', color: colores.textoOscuro }}>{notif.tiempo}</span>
                          {notif.plan && (
                            <button
                              onClick={e => { e.stopPropagation(); activarPlanNotif(notif); }}
                              style={{ border: 'none', background: colores.primario, color: '#fff', fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                            >
                              Activar plan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 18px', borderTop: `1px solid ${colores.borde}`, textAlign: 'center' }}>
                  <button style={{ background: 'none', border: 'none', color: colores.primario, fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%', padding: '6px' }}>
                    Ver todas las notificaciones
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Avatar */}
          <button
            style={{
              width: '52px', height: '52px', borderRadius: '50%',
              backgroundColor: '#FFFFFF', border: `2px solid ${colores.borde}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden', padding: '4px',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <img
              src={empresa.logo}
              alt={empresa.nombre}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const container = target.parentElement;
                if (container) {
                  container.style.background = `linear-gradient(135deg, ${colores.primario}, ${colores.secundario})`;
                  container.style.fontSize = '16px';
                  container.style.fontWeight = 'bold';
                  container.style.color = '#FFFFFF';
                  container.textContent = 'M';
                }
              }}
            />
          </button>
        </div>
      </header>
    </>
  );
};

const iconBtnStyle = (bg: string): React.CSSProperties => ({
  width: '40px', height: '40px', borderRadius: '50%',
  backgroundColor: bg, border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  position: 'relative', transition: 'background-color 0.2s',
});