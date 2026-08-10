// Fuente unica del menu. Sidebar (desktop), ResponsiveLayout (bottom nav movil)
// y el titulo del Header salen todos de aqui. Antes eran tres listas mantenidas
// a mano que ya habian divergido entre si.
import {
  LayoutDashboard, Radio, BrainCircuit, Vote, Globe, Command, ClipboardList,
  Bell, Shield, GraduationCap, Code2, Map,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MenuItem = {
  id: string;
  nombre: string;
  icono: LucideIcon;
  /** 'principal' sale en el nav; 'extra' va en la seccion secundaria del sidebar. */
  grupo: 'principal' | 'extra';
};

export const menuItems: MenuItem[] = [
  { id: 'dashboard',      nombre: 'Dashboard General',      icono: LayoutDashboard, grupo: 'principal' },
  { id: 'comando',        nombre: 'Comando Central',        icono: Command,         grupo: 'principal' },
  { id: 'mapa',           nombre: 'Mapa Maestro',           icono: Map,             grupo: 'principal' },
  { id: 'resultados',     nombre: 'Resultados',             icono: ClipboardList,   grupo: 'principal' },
  { id: 'alertas',        nombre: 'Alertas y Forensia',     icono: Bell,            grupo: 'principal' },
  { id: 'monitor',        nombre: 'Monitor de Medios',      icono: Radio,           grupo: 'principal' },
  { id: 'monitoria',      nombre: 'Cerebro Electoral',      icono: BrainCircuit,    grupo: 'principal' },
  { id: 'digital',        nombre: 'Monitor Digital',        icono: Globe,           grupo: 'principal' },
  { id: 'electoral',      nombre: 'Inteligencia Electoral', icono: Vote,            grupo: 'principal' },
  { id: 'ciberseguridad', nombre: 'CiberSeguridad',         icono: Shield,          grupo: 'extra' },
  { id: 'playground',     nombre: 'Playground',             icono: Code2,           grupo: 'extra' },
  { id: 'academia',       nombre: 'Academia',               icono: GraduationCap,   grupo: 'extra' },
];

export const menuPrincipal = menuItems.filter(m => m.grupo === 'principal');
export const menuExtra = menuItems.filter(m => m.grupo === 'extra');

export const tituloDe = (id: string) =>
  menuItems.find(m => m.id === id)?.nombre ?? 'Dashboard';
