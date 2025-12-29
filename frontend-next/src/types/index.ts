export interface BotStatus {
  connected: boolean;
  connecting?: boolean;
  lastSeen?: string;
  phone?: string;
  status?: string;
  qrCode?: string;
  uptime?: string;
  lastActivity?: string;
  error?: string;
  isConnected?: boolean;
  timestamp?: string;
}

export interface User {
  id: number;
  username: string;
  rol: string;
  whatsapp_number?: string;
  grupo_registro?: string;
  fecha_registro: string;
  created_at: string;
}

export interface Group {
  id: number;
  wa_jid: string;
  nombre: string;
  descripcion?: string;
  autorizado: boolean;
  bot_enabled?: boolean;
  es_proveedor: boolean;
  autorizado_por?: number;
  created_at: string;
  updated_at: string;
}

export interface Aporte {
  id: number;
  titulo: string;
  descripcion?: string;
  contenido: string;
  tipo: string;
  fuente: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  motivo_rechazo?: string | null;
  grupo_id?: number | null;
  usuario_id?: number | null;
  archivo_path?: string | null;
  fecha?: string;
  fecha_procesado?: string | null;
  procesado_por?: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
  usuario?: {
    id?: number;
    username: string;
  } | null;
  grupo?: {
    id?: number;
    nombre: string;
  } | null;
}

export interface Pedido {
  id: number;
  titulo: string;
  descripcion?: string;
  contenido_solicitado: string;
  estado: 'pendiente' | 'en_proceso' | 'resuelto' | 'cancelado' | 'rechazado';
  prioridad: string;
  grupo_id?: number;
  usuario_id?: number;
  aporte_id?: number | null;
  created_at: string;
  updated_at: string;
  usuario?: { username: string };
  grupo?: { nombre: string };
  aporte?: { titulo: string };
}

export interface Proveedor {
  id: number;
  user_id: number;
  alias: string;
  bio?: string;
  verificado: boolean;
  estado: string;
  created_at: string;
  updated_at: string;
  user?: Partial<User>;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface Notification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  categoria: string;
  leida: boolean;
  fecha: string;
  metadata?: any;
}

export interface DashboardStats {
  totalUsuarios: number;
  totalGrupos: number;
  totalAportes: number;
  totalPedidos: number;
  totalSubbots: number;
  usuariosActivos: number;
  gruposActivos: number;
  aportesHoy: number;
  pedidosHoy: number;
  mensajesHoy: number;
  comandosHoy: number;
  totalMensajes: number;
  totalComandos: number;
  actividadPorHora?: Array<{ label: string; value: number; color?: string }>;
  rendimiento?: {
    tiempoRespuesta: number;
    disponibilidad: number;
    errorRate: number;
    throughput: number;
  };
  tendencias?: {
    usuarios: number;
    grupos: number;
    aportes: number;
    pedidos: number;
    mensajes: number;
    comandos: number;
  };
  comunidad?: {
    usuariosWhatsApp: number;
    usuariosActivos: number;
    mensajesHoy: number;
    comandosHoy: number;
    totalMensajes: number;
    totalComandos: number;
    gruposConBot?: number;
    mensajesRecibidos?: number;
    comandosEjecutados?: number;
  };
}

export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  PROVIDER: 'provider',
  COLLABORATOR: 'collaborator',
  MEMBER: 'member',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
