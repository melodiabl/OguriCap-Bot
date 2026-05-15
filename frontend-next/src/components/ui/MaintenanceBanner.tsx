'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, X, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketConnection, SOCKET_EVENTS } from '@/contexts/SocketContext';
import api from '@/services/api';

export const MaintenanceBanner: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { socket } = useSocketConnection();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isAdmin = user && ['owner', 'admin', 'administrador'].includes(user.rol);

  const checkAndRedirect = useCallback((enabled: boolean) => {
    setIsMaintenanceMode(enabled);
    setIsDismissed(false);
    if (enabled && !isAdmin) {
      router.push('/maintenance');
    }
  }, [isAdmin, router]);

  useEffect(() => {
    api.getSystemConfig()
      .then((config) => checkAndRedirect(config?.maintenanceMode ?? false))
      .catch(() => {});
  }, [checkAndRedirect]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { enabled: boolean }) => {
      checkAndRedirect(data.enabled);
    };
    socket.on(SOCKET_EVENTS.SYSTEM_MAINTENANCE, handler);
    return () => { socket.off(SOCKET_EVENTS.SYSTEM_MAINTENANCE, handler); };
  }, [socket, checkAndRedirect]);

  if (!isMaintenanceMode || !isAdmin || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="relative z-50 w-full border-b border-oguri-gold/20 bg-oguri-gold/10 backdrop-blur-xl"
      >
        <div className="lg:pl-72">
          <div className="px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="flex-shrink-0 p-2 rounded-xl bg-oguri-gold/20 shadow-glow-oguri-mixed"
                >
                  <Wrench className="w-5 h-5 text-oguri-gold" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black uppercase tracking-tight text-foreground sm:text-base">
                    Modo Mantenimiento Activo
                  </p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--text-secondary))] sm:text-xs">
                    Solo los administradores pueden acceder al panel
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4">
                <button
                  onClick={() => router.push('/configuracion')}
                  className="flex items-center space-x-1 rounded-xl border border-oguri-gold/30 bg-oguri-gold/20 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:scale-105 hover:bg-oguri-gold/30 sm:text-sm"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Configurar</span>
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="flex-shrink-0 rounded-lg p-1.5 text-[rgb(var(--text-secondary))] transition-colors hover:bg-amber-500/20 hover:text-foreground"
                  title="Ocultar banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
