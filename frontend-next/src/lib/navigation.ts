import type { ComponentType, SVGProps } from 'react';
import { Home, Bot, Users, MessageSquare, Package, ShoppingCart, Settings, FileText, BarChart3, Image, Zap, Globe, Calendar, AlertTriangle } from 'lucide-react';
import type { PageKey } from './pageTheme';

export type NavColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan';

export interface NavItem {
  path: string;
  pageKey: PageKey;
  label: string;
  headerLabel?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: NavColor;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', pageKey: 'dashboard', label: 'Dashboard', icon: Home, color: 'primary' },
  { path: '/bot', pageKey: 'bot', label: 'Estado del Bot', icon: Bot, color: 'success' },
  { path: '/usuarios', pageKey: 'usuarios', label: 'Usuarios del Panel', headerLabel: 'Usuarios', icon: Users, color: 'info' },
  { path: '/community-users', pageKey: 'community-users', label: 'Usuarios Comunidad', icon: Users, color: 'violet' },
  { path: '/subbots', pageKey: 'subbots', label: 'SubBots', icon: Zap, color: 'warning' },
  { path: '/grupos', pageKey: 'grupos', label: 'Grupos', icon: MessageSquare, color: 'violet' },
  { path: '/grupos-management', pageKey: 'grupos-management', label: 'Gestión Global', icon: Globe, color: 'cyan' },
  { path: '/aportes', pageKey: 'aportes', label: 'Aportes', icon: Package, color: 'success' },
  { path: '/pedidos', pageKey: 'pedidos', label: 'Pedidos', icon: ShoppingCart, color: 'warning' },
  { path: '/proveedores', pageKey: 'proveedores', label: 'Proveedores', icon: Users, color: 'info' },
  { path: '/tareas', pageKey: 'tareas', label: 'Tareas & Programador', headerLabel: 'Tareas', icon: Calendar, color: 'primary' },
  { path: '/ai-chat', pageKey: 'ai-chat', label: 'AI Chat', icon: Bot, color: 'violet' },
  { path: '/alertas', pageKey: 'alertas', label: 'Alertas', icon: AlertTriangle, color: 'danger' },
  { path: '/recursos', pageKey: 'recursos', label: 'Recursos', icon: BarChart3, color: 'success' },
  { path: '/configuracion', pageKey: 'configuracion', label: 'Configuración', icon: Settings, color: 'cyan' },
  { path: '/logs', pageKey: 'logs', label: 'Logs & Sistema', headerLabel: 'Logs', icon: FileText, color: 'danger' },
  { path: '/analytics', pageKey: 'analytics', label: 'Analytics', icon: BarChart3, color: 'violet' },
  { path: '/multimedia', pageKey: 'multimedia', label: 'Multimedia', icon: Image, color: 'cyan' },
];
