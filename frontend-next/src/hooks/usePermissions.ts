'use client';

import { useAuth } from '@/contexts/AuthContext';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'dashboard', 'bot-status', 'usuarios', 'subbots', 'grupos', 'grupos-management',
    'aportes', 'pedidos', 'proveedores', 'ai-chat', 'bot-commands', 'logs',
    'notificaciones', 'analytics', 'multimedia', 'settings'
  ],
  moderator: [
    'dashboard', 'bot-status', 'grupos', 'aportes', 'pedidos', 'notificaciones', 'logs'
  ],
  provider: [
    'dashboard', 'aportes', 'pedidos', 'notificaciones'
  ],
  collaborator: [
    'dashboard', 'aportes', 'pedidos', 'notificaciones'
  ],
  member: [
    'dashboard', 'notificaciones'
  ],
  usuario: [
    'dashboard',
    'pedidos',
    'aportes',
    'subbots',
    'ai-chat',
    'bot-status',
    'notificaciones',
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
