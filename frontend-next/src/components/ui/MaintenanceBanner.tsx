'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, X, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

export const MaintenanceBanner: React.FC = () => {
  const { user } = useAuth();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    checkMaintenanceStatus();
  }, []);

  const checkMaintenanceStatus = async () => {
    try {
      const config = await api.getSystemConfig();
      setIsMaintenanceMode(config.maintenanceMode || false);
    } catch (error) {
      // Si hay error, asumir que no está en mantenimiento
      setIsMaintenanceMode(false);
    }
  };

  const isAdmin = user && ['owner', 'admin', 'administrador'].includes(user.rol);

  if (!isMaintenanceMode || !isAdmin || !isVisible) {
    return null;
  }

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
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
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
                  onClick={() => window.location.href = '/configuracion'}
                  className="flex items-center space-x-1 rounded-xl border border-oguri-gold/30 bg-oguri-gold/20 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:scale-105 hover:bg-oguri-gold/30 sm:text-sm"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Configurar</span>
                </button>
                
                <button
                  onClick={() => setIsVisible(false)}
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
