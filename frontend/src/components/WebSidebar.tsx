import React from 'react';
import {
  LayoutDashboard, Radio, BrainCircuit, Vote, Globe, Command, ClipboardList,
  Bell, Shield, GraduationCap, Code2, Map, Home,
} from 'lucide-react';

interface WebSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const NAV = [
  { id: 'inicio',         icon: Home,            label: 'Inicio',                 libre: true },
  { id: 'dashboard',      icon: LayoutDashboard, label: 'Dashboard',              libre: true },
  { id: 'mapa',           icon: Map,             label: 'Mapa Maestro',           libre: true },
  { id: 'resultados',     icon: ClipboardList,   label: 'Resultados',             libre: false },
  { id: 'alertas',        icon: Bell,            label: 'Alertas y Forensia',     libre: false },
  { id: 'monitor',        icon: Radio,           label: 'Monitor de Medios',      libre: false },
  { id: 'monitoria',      icon: BrainCircuit,    label: 'Cerebro Electoral (IA)', libre: false },
  { id: 'digital',        icon: Globe,           label: 'Monitor Digital',        libre: false },
  { id: 'electoral',      icon: Vote,            label: 'Inteligencia Electoral', libre: false },
  { id: 'comando',        icon: Command,         label: 'Comando Central',        libre: false },
  { id: 'ciberseguridad', icon: Shield,          label: 'CiberSeguridad',         libre: false },
  { id: 'playground',     icon: Code2,           label: 'Playground',             libre: false },
  { id: 'academia',       icon: GraduationCap,   label: 'Academia',               libre: false },
];

export const WebSidebar: React.FC<WebSidebarProps> = ({ activeSection, onSectionChange }) => {
  return (
    <nav className="sidebar" id="sidebar" aria-label="Navegación principal">
      {/* Avatar / perfil */}
      <div className="sidebar__avatar">
        <button
          className="avatar avatar--sm"
          aria-label="Perfil"
          title="Perfil"
          style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          CE
        </button>
      </div>

      {/* Lista de secciones */}
      <ul className="sidebar__nav" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const clases = [
            'sidebar__icon',
            isActive ? 'sidebar__icon--active' : '',
          ].filter(Boolean).join(' ');

          return (
            <li key={item.id}>
              <button
                className={clases}
                data-tooltip={item.label}
                onClick={() => onSectionChange(item.id)}
                aria-label={item.label}
                title={item.label}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Icon size={20} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Botón de inicio */}
      <button
        className="sidebar__icon sidebar__logout"
        data-tooltip="Inicio"
        aria-label="Ir a inicio"
        title="Ir a inicio"
        onClick={() => window.location.href = '../web/index.html'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 'auto' }}
      >
        <Home size={20} />
      </button>
    </nav>
  );
};
