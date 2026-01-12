'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSocketBotStatus } from '@/contexts/SocketContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useBotStatus } from '@/hooks/useRealTime';
import { useNotifications } from '@/contexts/NotificationContext';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useNavParticleBurst } from '@/components/ui/NavParticles';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, type NavColor } from '@/lib/navigation';

const colorClasses: Record<NavColor, string> = {
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

const SidebarNavLink: React.FC<{
  href: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ href, onClose, className, children }) => {
  const { emit, layer } = useNavParticleBurst();
  return (
    <Link
      href={href}
      onClick={(e) => {
        emit();
        onClose();
      }}
      onPointerEnter={() => emit()}
      className={cn('relative', className)}
    >
      {children}
      {layer}
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus(5000);
  const botStatus = useSocketBotStatus();
  const { unreadCount } = useNotifications();
  const { isGloballyOn } = useBotGlobalState();
  const { dashboardStats, botStatus: globalBotStatus, refreshAll } = useGlobalUpdate();

  // Auto-refresh del sidebar - DISABLED to prevent resource exhaustion
  // useAutoRefresh(refreshAll, { interval: 30000 });

  const allowedMenuItems = NAV_ITEMS.filter(item => hasPermission(item.pageKey));
  const isConnected = botStatus?.connected ?? globalBotStatus?.connected ?? pollingConnected;

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
            className="fixed inset-0 overlay-scrim z-40 lg:hidden"
            />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-72',
          'glass-dark border-r border-white/10 sidebar-chrome',
          'flex flex-col',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="relative z-10 flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-600 to-cyan-500 flex items-center justify-center shadow-glow-lg hover-lift-soft overflow-hidden"
            >
              <Image
                src="/oguricap-avatar.png"
                alt="Oguri Cap"
                width={32}
                height={32}
                className="object-cover rounded-2xl"
                priority
              />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold gradient-text">OguriCap Bot</h1>
              <p className="text-xs text-gray-500">Panel de Control de Oguri Cap</p>
            </div>
          </Link>
        </div>

        {/* Bot Status Mini */}
        <div className="mx-4 mt-4 rounded-xl glass hover-outline-gradient hover-glass-bright p-4">
          <div className="flex items-center justify-between mb-2">
            <StatusIndicator
              status={
                !isGloballyOn ? 'offline' :
                isConnecting ? 'connecting' : 
                isConnected ? 'online' : 'offline'
              }
              size="sm"
            />
            <StatusBadge
              tone={!isGloballyOn ? 'neutral' : isConnected ? 'success' : isConnecting ? 'warning' : 'danger'}
              pulse={isConnected && isGloballyOn}
            >
              {!isGloballyOn ? 'OFF' : isConnecting ? 'SYNC' : isConnected ? 'LIVE' : 'DOWN'}
            </StatusBadge>
          </div>
          <div className="text-xs text-gray-400">
            {!isGloballyOn ? 'Bot Desactivado' : 
             isConnected ? 'Bot Conectado' : 'Bot Desconectado'}
          </div>
          {dashboardStats && (
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Grupos: {dashboardStats.totalGrupos || 0}</span>
              <span>Usuarios: {dashboardStats.comunidad?.usuariosWhatsApp || 0}</span>
            </div>
          )}
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
                  <SidebarNavLink
                    href={item.path}
                    onClose={onClose}
                    className={cn(
                      'group focus-ring-animated press-scale hover-outline-gradient',
                      isActive ? 'sidebar-item-active' : 'sidebar-item'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg transition-colors',
                      isActive ? colorClasses[item.color] : 'bg-white/5 group-hover:bg-white/10'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium">{item.label}</span>

                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute right-4 w-2 h-2 rounded-full bg-primary-500 shadow-glow"
                      />
                    )}
                  </SidebarNavLink>
                </motion.div>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10 space-y-3">
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
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors press-scale focus-ring-animated"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
        </div>
      </aside>
    </>
  );
};
