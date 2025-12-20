'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSocket } from '@/contexts/SocketContext';
import { useBotStatus, useNotifications } from '@/hooks/useRealTime';
import { StatusIndicator, RealTimeBadge } from '@/components/ui/StatusIndicator';
import {
  Home, Bot, Users, MessageSquare, Package, ShoppingCart, Settings,
  LogOut, Bell, FileText, BarChart3, Image, Zap, Globe, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus(5000);
  const { botStatus } = useSocket();
  const { unreadCount } = useNotifications(30000);

  const allowedMenuItems = menuItems.filter(item => hasPermission(item.page));
  const isConnected = botStatus?.connected ?? pollingConnected;

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-72',
          'glass-dark border-r border-white/10',
          'flex flex-col',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
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
            <RealTimeBadge isActive={isConnected} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {allowedMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl',
                      'transition-all duration-300 group relative',
                      isActive
                        ? 'bg-gradient-to-r from-primary-500/20 to-transparent border-l-4 border-primary-500 text-white shadow-inner-glow'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg transition-colors',
                      isActive ? colorClasses[item.color] : 'bg-white/5 group-hover:bg-white/10'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                    
                    {item.path === '/notificaciones' && unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full"
                      >
                        {unreadCount}
                      </motion.span>
                    )}

                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute right-4 w-2 h-2 rounded-full bg-primary-500 shadow-glow"
                      />
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
    </>
  );
};