'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Wrench, RefreshCw, Clock, AlertTriangle, Bot, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function MaintenancePage() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const reduceMotion = useReducedMotion();

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      setLastCheck(new Date());
      setIsOnline(true);
      
      if (response.ok && !data.maintenanceMode) {
        // El mantenimiento terminó, redirigir al dashboard
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
      setIsOnline(false);
      setLastCheck(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  // Verificar cuando se vuelve al foco / vuelve la red
  useEffect(() => {
    checkStatus();

    const onFocus = () => checkStatus();
    const onOnline = () => checkStatus();

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // Verificar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatLastCheck = () => {
    if (!lastCheck) return 'Nunca';
    return lastCheck.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={reduceMotion ? { opacity: 1 } : { x: [0, 100, 0], y: [0, -50, 0] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 20, ease: 'linear' }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={reduceMotion ? { opacity: 1 } : { x: [0, -100, 0], y: [0, 50, 0] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 25, ease: 'linear' }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="max-w-lg w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass-card p-8 text-center"
        >
          {/* Logo y icono animado */}
          <div className="flex items-center justify-center mb-6">
            <motion.div
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mr-4"
            >
              <Wrench className="w-8 h-8 text-orange-400" />
            </motion.div>
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-6 h-6 text-primary-400" />
                <span className="text-xl font-bold gradient-text">Oguri Bot</span>
              </div>
              <p className="text-sm text-gray-400">Panel de Control</p>
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-white mb-4">
            Sistema en Mantenimiento
          </h1>

          {/* Descripción */}
          <p className="text-gray-300 mb-6 leading-relaxed">
            Estamos realizando mejoras importantes en el sistema para brindarte una mejor experiencia. 
            El servicio estará disponible nuevamente en breve.
          </p>

          {/* Estado de conexión */}
          <div className="flex items-center justify-center mb-6">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isOnline 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Conectado' : 'Sin conexión'}
            </div>
          </div>

          {/* Información adicional */}
          <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center justify-center text-gray-400">
              <Clock className="w-4 h-4 mr-2" />
              <span className="text-sm">Tiempo estimado: Unos minutos</span>
            </div>
            <div className="flex items-center justify-center text-gray-400">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm">Disculpa las molestias ocasionadas</span>
            </div>
            {lastCheck && (
              <div className="flex items-center justify-center text-gray-500 text-xs pt-2 border-t border-white/10">
                <RefreshCw className="w-3 h-3 mr-1" />
                Última verificación: {formatLastCheck()}
              </div>
            )}
          </div>

          {/* Botón de verificar */}
          <Button
            onClick={checkStatus}
            disabled={isChecking}
            variant="primary"
            className="w-full mb-4"
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Verificando estado...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Verificar Estado del Sistema
              </>
            )}
          </Button>

          {/* Información adicional */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>El sistema se verifica automáticamente cada 30 segundos</p>
            <p>Serás redirigido automáticamente cuando termine el mantenimiento</p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500">
              © 2026 Oguri Bot Panel - Sistema de Gestión Avanzado
            </p>
          </div>
        </motion.div>

        {/* Indicador de progreso */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 text-center"
        >
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                      }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }
                }
                className="w-2 h-2 bg-orange-400 rounded-full"
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Trabajando en las mejoras...</p>
        </motion.div>
      </div>
    </div>
  );
}
