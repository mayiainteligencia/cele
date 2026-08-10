import React, { useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  TrendingUp,
  Shield,
  GraduationCap,
  Code2,
  Radio,
  BrainCircuit,
  Vote,
  Globe,
  Command,
  ClipboardList,
  Bell,
} from 'lucide-react';
import { brandingConfig } from '../config/branding';

// Import anterior por si llegase a utilizarse nuevamente
/* import { 
  LayoutDashboard,
  Users,
  DollarSign,
  Package,
  TrendingUp,
  Cpu,
  Building2,
  Shield,
  GraduationCap,
  Code2,
} from 'lucide-react'; */
 

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}
// Dejamos el menú anterior por si alguna de las secciones o todas las secciones se llegasen a requerir después
/* const menuItems = [
  { id: 'dashboard', nombre: 'Dashboard General', icono: LayoutDashboard },
  { id: 'rh', nombre: 'Recursos Humanos', icono: Users },
  { id: 'finanzas', nombre: 'Finanzas y Contabilidad', icono: DollarSign },
  { id: 'operaciones', nombre: 'Operaciones', icono: Package },
  { id: 'ventas', nombre: 'Ventas y Marketing', icono: TrendingUp },
  { id: 'ti', nombre: 'Tecnologías de la Información', icono: Cpu },
  { id: 'administracion', nombre: 'Administración', icono: Building2 },
  { id: 'analiticos', nombre: 'Analíticos', icono: TrendingUp}
];
 */

const menuItems = [
  { id: 'dashboard', nombre: 'Dashboard General', icono: LayoutDashboard },
  // { id: 'analiticos', nombre: 'Analíticos', icono: TrendingUp},
  { id: 'monitor', nombre: 'Monitor de Medios', icono: Radio },  // ← NUEVO
  { id: 'monitoria', nombre: 'Cerebro Electoral', icono: BrainCircuit },
  { id: 'comando', nombre: 'Comando Central', icono: Command },
  { id: 'resultados', nombre: 'Resultados', icono: ClipboardList },
  { id: 'alertas', nombre: 'Alertas', icono: Bell },
  { id: 'digital', nombre: 'Monitor Digital', icono: Globe },
  { id: 'electoral', nombre: 'Inteligencia Electoral', icono: Vote },
];


const extraSections = [
  { id: 'ciberseguridad', nombre: 'CiberSeguridad', icono: Shield },
  { id: 'playground', nombre: 'Playground', icono: Code2 },
  { id: 'academia', nombre: 'Academia', icono: GraduationCap },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const { empresa, colores } = brandingConfig;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        width: collapsed ? '76px' : '240px',
        height: '100vh',
        backgroundColor: colores.fondoSecundario,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s ease',
        flexShrink: 0,
      }}
    >
      {/* Toggle colapsar */}
      <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', padding: collapsed ? '12px 0 0' : '12px 12px 0' }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${colores.borde}`,
            background: colores.fondoTerciario, color: colores.textoMedio, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Logo */}
      <div style={{ padding: collapsed ? '12px 12px' : '16px 24px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              height: collapsed ? '48px' : '120px',
              transition: 'height 0.22s ease',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img
              src={empresa.logo}
              alt={empresa.nombre}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                // Fallback al SVG si la imagen no carga
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const container = target.parentElement;
                if (container) {
                  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                  svg.setAttribute('width', '24');
                  svg.setAttribute('height', '24');
                  svg.setAttribute('viewBox', '0 0 24 24');
                  svg.setAttribute('fill', 'none');
                  
                  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                  path.setAttribute('d', 'M7 7L17 17M7 17L17 7');
                  path.setAttribute('stroke', 'white');
                  path.setAttribute('stroke-width', '2.5');
                  path.setAttribute('stroke-linecap', 'round');
                  
                  svg.appendChild(path);
                  container.appendChild(svg);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Label DEPARTAMENTOS */}
      <div style={{ padding: '0 16px 8px 16px', display: collapsed ? 'none' : 'block' }}>
        <span style={{
          fontSize: '11px', 
          fontWeight: '600', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          color: colores.textoOscuro 
        }}>
          DEPARTAMENTOS
        </span>
      </div>

      {/* Menú Principal */}
      <nav style={{ flex: '0 0 auto', padding: '0 12px', overflow: 'auto' }}>
        {menuItems.map((item) => {
          const Icon = item.icono;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              title={collapsed ? item.nombre : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsed ? '8px' : '12px 16px',
                borderRadius: '12px',
                marginBottom: '4px',
                backgroundColor: isActive ? colores.primario : 'transparent',
                color: isActive ? '#FFFFFF' : colores.textoMedio,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = colores.fondoTerciario;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colores.fondoTerciario,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              {!collapsed && (
                <span style={{ fontSize: '14px', fontWeight: '500', textAlign: 'left' }}>
                  {item.nombre}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer buttons - Secciones Extra */}
      <div style={{ padding: '12px', borderTop: `1px solid ${colores.borde}`, flexShrink: 0 }}>
        {extraSections.map((section) => {
          const Icon = section.icono;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              title={collapsed ? section.nombre : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsed ? '8px' : '12px 16px',
                borderRadius: '12px',
                marginBottom: '8px',
                backgroundColor: isActive ? colores.primario : colores.fondoTerciario,
                color: isActive ? '#FFFFFF' : colores.textoMedio,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colores.fondoPrincipal;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colores.fondoTerciario;
                }
              }}
            >
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colores.fondoPrincipal,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} />
              </div>
              {!collapsed && (
                <span style={{ fontSize: '14px', fontWeight: '500', flex: 1, textAlign: 'left' }}>
                  {section.nombre}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};