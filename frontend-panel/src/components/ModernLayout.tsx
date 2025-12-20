import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useBotStatus, useConnectionHealth, useNotifications as useServerNotifications } from '../hooks/useRealTime';
import { useSocket } from '../contexts/SocketContext';
import { useSocketBotStatus, useSocketNotifications } from '../hooks/useSocketEvents';
import { useNotifications as usePushNotifications } from '../contexts/NotificationContext';
import { RealTimeBadge, StatusIndicator } from './ui/StatusIndicator';
import {
  Home,
  Bot,
  Users,
  MessageSquare,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Bell,
  FileText,
  BarChart3,
  Image,
  Zap,
  Globe,
  Menu,
  X,
  Search,
  Moon,
  Sun,
  RefreshCw,
  Radio,
} from 'lucide-react';

interface ModernLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { path: '/', icon: Home, label: 'Dashboard', color: 'primary', page: 'dashboard' },
  { path: '/bot', icon: Bot, label: 'Estado del Bot', color: 'success', page: 'bot-status' },
  { path: '/usuarios', icon: Users, label: 'Usuarios', color: 'info', page: 'usuarios' },
  { path: '/subbots', icon: Zap, label: 'SubBots', color: 'warning', page: 'subbots' },
  { path: '/grupos', icon: MessageSquare, label: 'Grupos', color: 'violet', page: 'grupos' },
  { path: '/grupos-management', icon: Globe, label: 'Gestión Global', color: 'cyan', page: 'grupos-management' },
  { path: '/aportes', icon: Package, label: 'Aportes', color: 'success', page: 'aportes' },
  { path: '/pedidos', icon: ShoppingCart, label: 'Pedidos', color: 'warning', page: 'pedidos' },
  { path: '/proveedores', icon: Users, label: 'Proveedores', color: 'info', page: 'proveedores' },
  { path: '/ai-chat', icon: Bot, label: 'AI Chat', color: 'violet', page: 'ai-chat' },
  { path: '/bot-commands', icon: Settings, label: 'Bot Commands', color: 'primary', page: 'bot-commands' },
  { path: '/logs', icon: FileText, label: 'Logs', color: 'danger', page: 'logs' },
  { path: '/notificaciones', icon: Bell, label: 'Notificaciones', color: 'primary', page: 'notificaciones' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics', color: 'violet', page: 'analytics' },
  { path: '/multimedia', icon: Image, label: 'Multimedia', color: 'cyan', page: 'multimedia' },
  { path: '/settings', icon: Settings, label: 'Configuración', color: 'info', page: 'settings' },
];

const colorClasses: Record<string, string> = {
  primary: 'text-primary-400 bg-primary-500/20',
  success: 'text-emerald-400 bg-emerald-500/20',
  warning: 'text-amber-400 bg-amber-500/20',
  danger: 'text-red-400 bg-red-500/20',
  info: 'text-cyan-400 bg-cyan-500/20',
  violet: 'text-violet-400 bg-violet-500/20',
  cyan: 'text-cyan-400 bg-cyan-500/20',
};

export const ModernLayout: React.FC<ModernLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Filtrar elementos del menú basado en permisos
  const allowedMenuItems = menuItems.filter(item => hasPermission(item.page));
  
  // Theme management
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  // Apply theme to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  
  // Real-time data from polling
  const { isConnected: pollingConnected, isConnecting: pollingConnecting } = useBotStatus(5000);
  const { latency } = useConnectionHealth();
  const { notifications, unreadCount } = useServerNotifications(30000);
  const { isConnected: isSocketConnected } = useSocket();
  
  // Push notifications context
  const pushNotifications = usePushNotifications();
  
  // Real-time data from Socket.IO (takes priority)
  const { botStatus: socketBotStatus } = useSocketBotStatus();
  useSocketNotifications();

  // Combine polling and socket data - socket takes priority
  const isConnected = socketBotStatus?.connected ?? pollingConnected;
  const isConnecting = socketBotStatus?.connecting ?? pollingConnecting;

  const currentPage = menuItems.find((item) => item.path === location.pathname);

  // Handle notification click
  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const goToNotifications = () => {
    setShowNotifications(false);
    navigate('/notificaciones');
  };

  return (
    <div className="h-screen overflow-hidden mesh-bg">
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-72
          glass-dark border-r border-white/10
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow"
            >
              <Bot className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Oguri Bot</h1>
              <p className="text-xs text-gray-500">Panel de Control</p>
            </div>
          </Link>
        </div>

        {/* Bot Status Mini */}
        <div className="px-4 py-3 mx-4 mt-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <StatusIndicator
              status={isConnecting ? 'connecting' : isConnected ? 'online' : 'offline'}
              size="sm"
            />
            <RealTimeBadge isActive={isConnected} latency={latency} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {allowedMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl
                      transition-all duration-300 group relative
                      ${isActive
                        ? 'bg-gradient-to-r from-primary-500/20 to-transparent border-l-4 border-primary-500 text-white shadow-inner-glow'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                      }
                    `}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${isActive ? colorClasses[item.color] : 'bg-white/5 group-hover:bg-white/10'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                    
                    {/* Notification badge for notifications page */}
                    {item.path === '/notificaciones' && unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full"
                      >
                        {unreadCount}
                      </motion.span>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className="avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.username || 'Usuario'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.rol || 'usuario'}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={logout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72 h-screen flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 glass-dark border-b border-white/10">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </motion.button>

              <div className="hidden sm:block">
                <h2 className="text-xl font-bold text-white">
                  {currentPage?.label || 'Panel'}
                </h2>
              </div>
            </div>

            {/* Center - Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="input-search w-full"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Socket.IO status */}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                isSocketConnected 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <Radio className={`w-3 h-3 ${isSocketConnected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
                <span className={`text-xs ${isSocketConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isSocketConnected ? 'Real-Time' : 'Offline'}
                </span>
              </div>

              {/* Connection status */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400">
                  {isConnected ? 'Bot Online' : 'Bot Offline'}
                </span>
              </div>

              {/* Notifications */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleNotificationClick}
                  className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="notification-dot">{unreadCount}</span>
                  )}
                </motion.button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="font-semibold text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                            {unreadCount} nuevas
                          </span>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications && notifications.length > 0 ? (
                          notifications.slice(0, 5).map((notif: any, index: number) => (
                            <div
                              key={notif.id || index}
                              className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                                !notif.leida ? 'bg-primary-500/5' : ''
                              }`}
                            >
                              <p className="text-sm text-white font-medium truncate">
                                {notif.titulo || notif.title || 'Notificación'}
                              </p>
                              <p className="text-xs text-gray-400 truncate mt-1">
                                {notif.mensaje || notif.message || notif.contenido || ''}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {notif.fecha ? new Date(notif.fecha).toLocaleString() : ''}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-gray-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay notificaciones</p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-white/10">
                        <button
                          onClick={goToNotifications}
                          className="w-full py-2 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors"
                        >
                          Ver todas las notificaciones
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme toggle */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.button>

              {/* Refresh */}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => window.location.reload()}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>© 2025 Oguri Bot Panel</span>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <RealTimeBadge isActive={isConnected} latency={latency} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ModernLayout;
