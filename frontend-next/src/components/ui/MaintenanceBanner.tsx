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
        className="bg-oguri-gold/10 border-b border-oguri-gold/20 glass-phantom relative z-50 w-full"
      >
        <div className="lg:pl-72">
          <div className="px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="flex-shrink-0 p-2 rounded-xl bg-oguri-gold/20 shadow-glow-oguri-mixed"
                >
                  <Wrench className="w-5 h-5 text-oguri-gold" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-black text-sm sm:text-base truncate uppercase tracking-tight">
                    Modo Mantenimiento Activo
                  </p>
                  <p className="text-oguri-gold/80 text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate">
                    Solo los administradores pueden acceder al panel
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => window.location.href = '/configuracion'}
                  className="flex items-center space-x-1 bg-oguri-gold/20 hover:bg-oguri-gold/30 border border-oguri-gold/30 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap font-black uppercase tracking-widest shadow-glow-oguri-mixed hover:scale-105"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Configurar</span>
                </button>
                
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-amber-500/20 transition-colors flex-shrink-0"
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
