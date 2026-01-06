export type PageKey =
  | 'dashboard'
  | 'bot'
  | 'usuarios'
  | 'community-users'
  | 'subbots'
  | 'grupos'
  | 'grupos-management'
  | 'aportes'
  | 'pedidos'
  | 'proveedores'
  | 'tareas'
  | 'ai-chat'
  | 'alertas'
  | 'recursos'
  | 'configuracion'
  | 'logs'
  | 'analytics'
  | 'multimedia'
  | 'auth'
  | 'maintenance'
  | 'unknown';

export function getPageKeyFromPathname(pathname?: string | null): PageKey {
  const path = (pathname || '/').split('?')[0].split('#')[0] || '/';
  if (path === '/') return 'dashboard';

  if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/reset-password')) return 'auth';
  if (path.startsWith('/maintenance')) return 'maintenance';

  const seg = path.split('/').filter(Boolean)[0] || '';
  switch (seg) {
    case 'bot':
      return 'bot';
    case 'usuarios':
      return 'usuarios';
    case 'community-users':
      return 'community-users';
    case 'subbots':
      return 'subbots';
    case 'grupos':
      return 'grupos';
    case 'grupos-management':
      return 'grupos-management';
    case 'aportes':
      return 'aportes';
    case 'pedidos':
      return 'pedidos';
    case 'proveedores':
      return 'proveedores';
    case 'tareas':
      return 'tareas';
    case 'ai-chat':
      return 'ai-chat';
    case 'alertas':
      return 'alertas';
    case 'recursos':
      return 'recursos';
    case 'configuracion':
      return 'configuracion';
    case 'logs':
      return 'logs';
    case 'analytics':
      return 'analytics';
    case 'multimedia':
      return 'multimedia';
    default:
      return 'unknown';
  }
}

