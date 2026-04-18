import type { ComponentType, SVGProps } from 'react';
import { Home, Bot, Users, MessageSquare, Package, ShoppingCart, Settings, FileText, BarChart3, Image, Zap, Globe, Calendar, AlertTriangle, Send } from 'lucide-react';
import type { PageKey } from './pageTheme';

export type NavColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan' | 'purple';
export type NavSectionKey = 'control' | 'community' | 'operations' | 'intelligence';

export interface NavSectionMeta {
  key: NavSectionKey;
  label: string;
  description: string;
}

export interface NavItem {
  path: string;
  pageKey: PageKey;
  label: string;
  headerLabel?: string;
  description: string;
  section: NavSectionKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: NavColor;
}

export const NAV_SECTIONS: NavSectionMeta[] = [
  {
    key: 'control',
    label: 'Control Central',
    description: 'Estado del bot, ajustes y red principal.',
  },
  {
    key: 'community',
    label: 'Comunidad',
    description: 'Usuarios, grupos y actores del ecosistema.',
  },
  {
    key: 'operations',
    label: 'Operacion',
    description: 'Flujo diario, tareas y contenido activo.',
  },
  {
    key: 'intelligence',
    label: 'Monitoreo',
    description: 'Alertas, logs, analitica y lectura global.',
  },
];

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', pageKey: 'dashboard', label: 'Dashboard', description: 'Resumen vivo del sistema y el panel.', section: 'control', icon: Home, color: 'primary' },
  { path: '/bot', pageKey: 'bot', label: 'Estado del Bot', description: 'Conexion principal, QR y sesion activa.', section: 'control', icon: Bot, color: 'success' },
  { path: '/subbots', pageKey: 'subbots', label: 'SubBots', description: 'Instancias, capacidad y despliegue.', section: 'control', icon: Zap, color: 'warning' },
  { path: '/broadcast', pageKey: 'broadcast', label: 'Broadcast', description: 'Envio de emails y notificaciones push.', section: 'control', icon: Send, color: 'purple' },
  { path: '/configuracion', pageKey: 'configuracion', label: 'Configuración', description: 'Parametros globales y comportamiento base.', section: 'control', icon: Settings, color: 'cyan' },
  { path: '/usuarios', pageKey: 'usuarios', label: 'Usuarios del Panel', headerLabel: 'Usuarios', description: 'Accesos internos, roles y permisos.', section: 'community', icon: Users, color: 'info' },
  { path: '/community-users', pageKey: 'community-users', label: 'Usuarios Comunidad', description: 'Miembros reales del ecosistema WhatsApp.', section: 'community', icon: Users, color: 'violet' },
  { path: '/grupos', pageKey: 'grupos', label: 'Grupos', description: 'Salas activas, metadata y estado.', section: 'community', icon: MessageSquare, color: 'violet' },
  { path: '/grupos-management', pageKey: 'grupos-management', label: 'Gestión Global', description: 'Acciones masivas sobre grupos y red.', section: 'community', icon: Globe, color: 'cyan' },
  { path: '/proveedores', pageKey: 'proveedores', label: 'Proveedores', description: 'Contactos fuente y catalogo operativo.', section: 'community', icon: Users, color: 'info' },
  { path: '/aportes', pageKey: 'aportes', label: 'Aportes', description: 'Ingreso de material y aprobaciones.', section: 'operations', icon: Package, color: 'success' },
  { path: '/pedidos', pageKey: 'pedidos', label: 'Pedidos', description: 'Solicitudes, cola y resolucion.', section: 'operations', icon: ShoppingCart, color: 'warning' },
  { path: '/multimedia', pageKey: 'multimedia', label: 'Multimedia', description: 'Archivos listos para enviar y publicar.', section: 'operations', icon: Image, color: 'cyan' },
  { path: '/tareas', pageKey: 'tareas', label: 'Tareas & Programador', headerLabel: 'Tareas', description: 'Rutinas, ejecuciones y automatizacion.', section: 'operations', icon: Calendar, color: 'primary' },
  { path: '/alertas', pageKey: 'alertas', label: 'Alertas', description: 'Incidentes, avisos y urgencias.', section: 'intelligence', icon: AlertTriangle, color: 'danger' },
  { path: '/recursos', pageKey: 'recursos', label: 'Recursos', description: 'CPU, memoria, disco y salud del host.', section: 'intelligence', icon: BarChart3, color: 'success' },
  { path: '/logs', pageKey: 'logs', label: 'Logs & Sistema', headerLabel: 'Logs', description: 'Eventos tecnicos y trazas del panel.', section: 'intelligence', icon: FileText, color: 'danger' },
  { path: '/analytics', pageKey: 'analytics', label: 'Analytics', description: 'Metricas, tendencias y lectura historica.', section: 'intelligence', icon: BarChart3, color: 'violet' },
  { path: '/ai-chat', pageKey: 'ai-chat', label: 'AI Chat', description: 'Asistencia experimental y apoyo operativo.', section: 'intelligence', icon: Bot, color: 'violet' },
];
