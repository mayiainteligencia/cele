import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Radio, CheckCircle2, Lightbulb, X } from 'lucide-react';
import { brandingConfig } from '../../config/branding';

const { colores } = brandingConfig;
const V = colores.primario;

export type ToastKind = 'alert' | 'info' | 'success' | 'suggestion';
export type Toast = { id: number; kind: ToastKind; title: string; msg: string };

const META: Record<ToastKind, { Icon: React.ElementType; color: string }> = {
  alert:      { Icon: AlertTriangle, color: colores.advertencia },
  info:       { Icon: Radio,         color: V },
  success:    { Icon: CheckCircle2,  color: colores.exito },
  suggestion: { Icon: Lightbulb,     color: V },
};

type Ctx = { push: (t: Omit<Toast, 'id'>) => void };
const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

// "Eventos en vivo": estado real del sistema mientras no haya fuentes conectadas.
// Un toast con un hallazgo electoral inventado se lee igual que uno real — por eso
// aqui solo van hechos sobre el propio dataset, no sobre la eleccion.
const LIVE: Omit<Toast, 'id'>[] = [
  { kind: 'info', title: 'Catálogo territorial listo', msg: '2 274 planteles del SIGED cargados como ubicaciones potenciales de casilla.' },
  { kind: 'alert', title: 'Bloques sin fuente', msg: 'Secciones, casillas y distritos siguen vacíos: la forensia no puede correr.' },
  { kind: 'info', title: 'Casillas 2027', msg: 'Pendientes de aprobación oficial del INE. No se rellenan con la cifra de 2024.' },
  { kind: 'suggestion', title: 'MAYIA sugiere', msg: 'Conectar PREP y cómputos distritales habilita seis comprobaciones de forensia de una sola vez.' },
  { kind: 'alert', title: 'Resultados de ejemplo', msg: 'La votación cargada es simulada. No usarla para decidir hasta conectar el SICEE.' },
];

export const ToastProvider: React.FC<{ children: React.ReactNode; live?: boolean }> = ({ children, live = true }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++idRef.current;
    setToasts(ts => [...ts, { ...t, id }].slice(-4)); // máx 4 visibles
    timers.current[id] = setTimeout(() => remove(id), 6000);
  }, [remove]);

  // Emisor de eventos en vivo
  useEffect(() => {
    if (!live) return;
    let i = 0;
    const first = setTimeout(() => push(LIVE[0]), 3500);
    const iv = setInterval(() => { i = (i + 1) % LIVE.length; push(LIVE[i]); }, 14000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [live, push]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" aria-atomic="false" style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
        display: 'flex', flexDirection: 'column-reverse', gap: 10, width: 'min(360px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}>
        <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
          @media (prefers-reduced-motion: reduce){.toast-el{animation:none!important}}`}</style>
        {toasts.map(t => {
          const { Icon, color } = META[t.kind];
          return (
            <div key={t.id} role="status" className="toast-el" style={{
              pointerEvents: 'auto', display: 'flex', gap: 11, alignItems: 'flex-start',
              background: colores.fondoClaro, border: `1px solid ${colores.borde}`, borderLeft: `4px solid ${color}`,
              borderRadius: 12, padding: '13px 14px', boxShadow: colores.sombraGrande,
              animation: 'toastIn .28s cubic-bezier(.16,1,.3,1)',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colores.textoClaro, marginBottom: 2 }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: colores.textoMedio, lineHeight: 1.4 }}>{t.msg}</div>
              </div>
              <button onClick={() => remove(t.id)} aria-label="Cerrar" style={{
                border: 'none', background: 'transparent', cursor: 'pointer', color: colores.textoOscuro, padding: 2, flexShrink: 0,
              }}><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
};
