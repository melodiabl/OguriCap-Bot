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
  usuario?: {
    username: string;
  };
  grupo?: {
    nombre: string;
  };
  aporte?: {
    titulo: string;
  };
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

// Constantes para roles de usuario
export const USER_ROLES = {
  OWNER: 'owner',           // Creador/Dueño del sistema
  ADMIN: 'admin',           // Administrador del sistema
  MODERATOR: 'moderator',   // Moderador de contenido
  PROVIDER: 'provider',     // Proveedor de contenido
  COLLABORATOR: 'collaborator', // Colaborador
  MEMBER: 'member',         // Miembro normal
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Constantes para estados de usuario
export const USER_STATES = {
  ACTIVE: 'activo',
  INACTIVE: 'inactivo',
  SUSPENDED: 'suspendido',
  BANNED: 'baneado',
} as const;

export type UserState = typeof USER_STATES[keyof typeof USER_STATES];
