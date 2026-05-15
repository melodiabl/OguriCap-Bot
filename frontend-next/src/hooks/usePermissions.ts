'use client';

import { useAuth } from '@/contexts/AuthContext';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'dashboard', 'bot', 'usuarios', 'community-users', 'subbots', 'grupos', 'grupos-management',
    'aportes', 'pedidos', 'proveedores', 'ai-chat', 'logs',
    'analytics', 'multimedia', 'configuracion', 'plugins',
    'broadcast', 'tareas', 'alertas', 'recursos',
  ],
  moderator: [
    'dashboard', 'bot', 'grupos', 'aportes', 'pedidos', 'logs', 'alertas',
  ],
  provider: [
    'dashboard', 'aportes', 'pedidos',
  ],
  collaborator: [
    'dashboard', 'aportes', 'pedidos',
  ],
  member: [
    'dashboard',
  ],
  usuario: [
    'dashboard', 'pedidos', 'aportes', 'subbots', 'ai-chat', 'bot',
  ],
};

function normalizeRole(role: string) {
  const r = (role || '').toLowerCase().trim()
  if (!r) return 'member'
  if (r === 'administrador') return 'admin'
  if (r === 'moderador') return 'moderator'
  if (r === 'colaborador') return 'collaborator'
  if (r === 'miembro') return 'member'
  return r
}

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (page: string): boolean => {
    if (!user) return false;
    const role = normalizeRole(user.rol || 'member');
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member;
    return permissions.includes('*') || permissions.includes(page);
  };

  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;
    const userRole = normalizeRole(user.rol || 'member');
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return allowedRoles.map(r => normalizeRole(r)).includes(userRole);
  };

  const isAdmin = (): boolean => {
    return hasRole(['owner', 'admin']);
  };

  const isModerator = (): boolean => {
    return hasRole(['owner', 'admin', 'moderator']);
  };

  return { hasPermission, hasRole, isAdmin, isModerator };
}
