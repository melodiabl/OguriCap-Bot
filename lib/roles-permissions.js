// Sistema de Roles y Permisos Granulares

export const PERMISSIONS = {
  // Dashboard y estadísticas
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_STATS: 'dashboard.stats',
  DASHBOARD_SYSTEM_INFO: 'dashboard.system_info',
  
  // Usuarios
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_CHANGE_PASSWORD: 'users.change_password',
  USERS_VIEW_PASSWORD: 'users.view_password',
  USERS_MANAGE_ROLES: 'users.manage_roles',
  
  // Grupos
  GROUPS_VIEW: 'groups.view',
  GROUPS_CREATE: 'groups.create',
  GROUPS_EDIT: 'groups.edit',
  GROUPS_DELETE: 'groups.delete',
  GROUPS_TOGGLE_BOT: 'groups.toggle_bot',
  GROUPS_MANAGE_PROVIDERS: 'groups.manage_providers',
  
  // Bot principal
  BOT_VIEW_STATUS: 'bot.view_status',
  BOT_RESTART: 'bot.restart',
  BOT_DISCONNECT: 'bot.disconnect',
  BOT_VIEW_QR: 'bot.view_qr',
  BOT_GLOBAL_CONTROL: 'bot.global_control',
  BOT_EXECUTE_COMMANDS: 'bot.execute_commands',
  
  // SubBots
  SUBBOTS_VIEW: 'subbots.view',
  SUBBOTS_CREATE: 'subbots.create',
  SUBBOTS_DELETE: 'subbots.delete',
  SUBBOTS_VIEW_QR: 'subbots.view_qr',
  SUBBOTS_MANAGE: 'subbots.manage',
  
  // Aportes
  APORTES_VIEW: 'aportes.view',
  APORTES_CREATE: 'aportes.create',
  APORTES_EDIT: 'aportes.edit',
  APORTES_DELETE: 'aportes.delete',
  APORTES_APPROVE: 'aportes.approve',
  APORTES_REJECT: 'aportes.reject',
  
  // Pedidos
  PEDIDOS_VIEW: 'pedidos.view',
  PEDIDOS_CREATE: 'pedidos.create',
  PEDIDOS_EDIT: 'pedidos.edit',
  PEDIDOS_DELETE: 'pedidos.delete',
  PEDIDOS_RESOLVE: 'pedidos.resolve',
  PEDIDOS_VOTE: 'pedidos.vote',
  
  // Proveedores
  PROVIDERS_VIEW: 'providers.view',
  PROVIDERS_CREATE: 'providers.create',
  PROVIDERS_EDIT: 'providers.edit',
  PROVIDERS_DELETE: 'providers.delete',
  
  // Multimedia
  MULTIMEDIA_VIEW: 'multimedia.view',
  MULTIMEDIA_UPLOAD: 'multimedia.upload',
  MULTIMEDIA_DELETE: 'multimedia.delete',
  
  // Notificaciones
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_CREATE: 'notifications.create',
  NOTIFICATIONS_DELETE: 'notifications.delete',
  NOTIFICATIONS_MARK_READ: 'notifications.mark_read',
  
  // Logs y auditoría
  LOGS_VIEW: 'logs.view',
  LOGS_CLEAR: 'logs.clear',
  LOGS_EXPORT: 'logs.export',
  AUDIT_VIEW: 'audit.view',
  
  // Sistema
  SYSTEM_VIEW_CONFIG: 'system.view_config',
  SYSTEM_EDIT_CONFIG: 'system.edit_config',
  SYSTEM_MAINTENANCE: 'system.maintenance',
  SYSTEM_BACKUP: 'system.backup',
  SYSTEM_STATS: 'system.stats',
  
  // Comandos en tiempo real
  COMMANDS_VIEW: 'commands.view',
  COMMANDS_MONITOR: 'commands.monitor',
  
  // API
  API_ACCESS: 'api.access',
  API_ADMIN: 'api.admin',
};

export const ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    label: 'Super Administrador',
    description: 'Acceso completo a todas las funcionalidades del sistema',
    color: 'purple',
    icon: 'Crown',
    permissions: Object.values(PERMISSIONS), // Todos los permisos
    hierarchy: 100
  },
  
  OWNER: {
    name: 'owner',
    label: 'Propietario',
    description: 'Propietario del bot con acceso completo',
    color: 'violet',
    icon: 'Crown',
    permissions: Object.values(PERMISSIONS).filter(p => !p.includes('system.maintenance')), // Casi todos excepto mantenimiento crítico
    hierarchy: 90
  },
  
  ADMIN: {
    name: 'admin',
    label: 'Administrador',
    description: 'Administrador con permisos avanzados',
    color: 'red',
    icon: 'Shield',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DASHBOARD_STATS,
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_EDIT,
      PERMISSIONS.USERS_CHANGE_PASSWORD,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.GROUPS_EDIT,
      PERMISSIONS.GROUPS_TOGGLE_BOT,
      PERMISSIONS.BOT_VIEW_STATUS,
      PERMISSIONS.BOT_RESTART,
      PERMISSIONS.BOT_VIEW_QR,
      PERMISSIONS.SUBBOTS_VIEW,
      PERMISSIONS.SUBBOTS_CREATE,
      PERMISSIONS.SUBBOTS_DELETE,
      PERMISSIONS.APORTES_VIEW,
      PERMISSIONS.APORTES_APPROVE,
      PERMISSIONS.APORTES_REJECT,
      PERMISSIONS.PEDIDOS_VIEW,
      PERMISSIONS.PEDIDOS_RESOLVE,
      PERMISSIONS.PROVIDERS_VIEW,
      PERMISSIONS.PROVIDERS_EDIT,
      PERMISSIONS.MULTIMEDIA_VIEW,
      PERMISSIONS.MULTIMEDIA_UPLOAD,
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.LOGS_VIEW,
      PERMISSIONS.SYSTEM_VIEW_CONFIG,
      PERMISSIONS.COMMANDS_VIEW,
      PERMISSIONS.API_ACCESS,
    ],
    hierarchy: 80
  },
  
  MODERATOR: {
    name: 'moderador',
    label: 'Moderador',
    description: 'Moderador con permisos de gestión de contenido',
    color: 'cyan',
    icon: 'UserCheck',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.BOT_VIEW_STATUS,
      PERMISSIONS.APORTES_VIEW,
      PERMISSIONS.APORTES_APPROVE,
      PERMISSIONS.APORTES_REJECT,
      PERMISSIONS.PEDIDOS_VIEW,
      PERMISSIONS.PEDIDOS_EDIT,
      PERMISSIONS.PROVIDERS_VIEW,
      PERMISSIONS.MULTIMEDIA_VIEW,
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.NOTIFICATIONS_MARK_READ,
      PERMISSIONS.COMMANDS_VIEW,
    ],
    hierarchy: 60
  },
  
  SUPPORT: {
    name: 'soporte',
    label: 'Soporte',
    description: 'Personal de soporte con acceso limitado',
    color: 'blue',
    icon: 'Headphones',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.BOT_VIEW_STATUS,
      PERMISSIONS.APORTES_VIEW,
      PERMISSIONS.PEDIDOS_VIEW,
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.LOGS_VIEW,
      PERMISSIONS.COMMANDS_VIEW,
    ],
    hierarchy: 40
  },
  
  USER: {
    name: 'usuario',
    label: 'Usuario',
    description: 'Usuario básico con permisos limitados',
    color: 'emerald',
    icon: 'Users',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.APORTES_VIEW,
      PERMISSIONS.APORTES_CREATE,
      PERMISSIONS.PEDIDOS_VIEW,
      PERMISSIONS.PEDIDOS_CREATE,
      PERMISSIONS.PEDIDOS_VOTE,
      PERMISSIONS.NOTIFICATIONS_VIEW,
      PERMISSIONS.NOTIFICATIONS_MARK_READ,
    ],
    hierarchy: 20
  },
  
  VIEWER: {
    name: 'viewer',
    label: 'Observador',
    description: 'Solo lectura, sin permisos de modificación',
    color: 'gray',
    icon: 'Eye',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.APORTES_VIEW,
      PERMISSIONS.PEDIDOS_VIEW,
      PERMISSIONS.NOTIFICATIONS_VIEW,
    ],
    hierarchy: 10
  }
};

// Funciones de utilidad
export function getRoleByName(roleName) {
  return Object.values(ROLES).find(role => role.name === roleName) || ROLES.USER;
}

export function hasPermission(userRole, permission) {
  const role = getRoleByName(userRole);
  return role.permissions.includes(permission);
}

export function hasAnyPermission(userRole, permissions) {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole, permissions) {
  return permissions.every(permission => hasPermission(userRole, permission));
}

export function canAccessResource(userRole, requiredPermissions) {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return hasAnyPermission(userRole, requiredPermissions);
}

export function getRoleHierarchy(roleName) {
  const role = getRoleByName(roleName);
  return role.hierarchy;
}

export function canManageUser(managerRole, targetRole) {
  const managerHierarchy = getRoleHierarchy(managerRole);
  const targetHierarchy = getRoleHierarchy(targetRole);
  return managerHierarchy > targetHierarchy;
}

export function getAvailableRoles(userRole) {
  const userHierarchy = getRoleHierarchy(userRole);
  return Object.values(ROLES).filter(role => role.hierarchy < userHierarchy);
}

export function validateRoleTransition(currentRole, newRole, managerRole) {
  // El manager debe poder gestionar ambos roles
  if (!canManageUser(managerRole, currentRole) || !canManageUser(managerRole, newRole)) {
    return { valid: false, reason: 'Permisos insuficientes para gestionar estos roles' };
  }
  
  // No se puede asignar un rol superior al del manager
  const managerHierarchy = getRoleHierarchy(managerRole);
  const newRoleHierarchy = getRoleHierarchy(newRole);
  
  if (newRoleHierarchy >= managerHierarchy) {
    return { valid: false, reason: 'No puedes asignar un rol igual o superior al tuyo' };
  }
  
  return { valid: true };
}

// Middleware para verificar permisos
export function requirePermissions(permissions) {
  return (req, res, next) => {
    const userRole = req.user?.rol || 'usuario';
    
    if (!canAccessResource(userRole, permissions)) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        required: permissions,
        userRole: userRole
      });
    }
    
    next();
  };
}

// Función para obtener permisos de un usuario
export function getUserPermissions(userRole) {
  const role = getRoleByName(userRole);
  return role.permissions;
}

// Función para verificar si un rol puede realizar una acción específica
export function canPerformAction(userRole, action, resource) {
  const permission = `${resource}.${action}`;
  return hasPermission(userRole, permission);
}

export default {
  PERMISSIONS,
  ROLES,
  getRoleByName,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessResource,
  getRoleHierarchy,
  canManageUser,
  getAvailableRoles,
  validateRoleTransition,
  requirePermissions,
  getUserPermissions,
  canPerformAction
};