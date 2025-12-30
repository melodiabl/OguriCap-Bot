'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useBotGlobalState } from './BotGlobalStateContext';
import api from '@/services/api';

interface GlobalUpdateContextType {
  // Estados globales
  dashboardStats: any;
  botStatus: any;
  systemStats: any;
  notifications: any[];
  
  // Funciones de actualización
  refreshAll: () => Promise<void>;
  refreshDashboard: () => Promise<any>;
  refreshBotStatus: () => Promise<any>;
  refreshSystemStats: () => Promise<any>;
  refreshNotifications: () => Promise<any>;
  
  // Estados de carga
  isRefreshing: boolean;
  lastUpdate: Date | null;
}

const GlobalUpdateContext = createContext<GlobalUpdateContextType | undefined>(undefined);

export const GlobalUpdateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [botStatus, setBotStatus] = useState<any>(null);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { socket, isConnected } = useSocket();
  const { isGloballyOn } = useBotGlobalState();

  // Función para actualizar estadísticas del dashboard
  const refreshDashboard = async () => {
    try {
      const stats = await api.getStats();
      setDashboardStats(stats);
      return stats;
    } catch (error) {
      console.error('Error refreshing dashboard stats:', error);
      return null;
    }
  };

  // Función para actualizar estado del bot
  const refreshBotStatus = async () => {
    try {
      const status = await api.getMainBotStatus();
      setBotStatus(status);
      return status;
    } catch (error) {
      console.error('Error refreshing bot status:', error);
      return null;
    }
  };

  // Función para actualizar estadísticas del sistema
  const refreshSystemStats = async () => {
    try {
      const stats = await api.getSystemStats();
      setSystemStats(stats);
      return stats;
    } catch (error) {
      console.error('Error refreshing system stats:', error);
      return null;
    }
  };

  // Función para actualizar notificaciones
  const refreshNotifications = async () => {
    try {
      const response = await api.getNotificaciones(1, 10);
      setNotifications(response?.notificaciones || []);
      return response;
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      return null;
    }
  };

  // Función para actualizar todo
  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshDashboard(),
        refreshBotStatus(),
        refreshSystemStats(),
        refreshNotifications()
      ]);
      setLastUpdate(new Date());
      
      // Emitir evento personalizado para que otros componentes se actualicen
      window.dispatchEvent(new CustomEvent('globalDataUpdated', {
        detail: { timestamp: new Date() }
      }));
      
    } catch (error) {
      console.error('Error in refreshAll:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh inicial
  useEffect(() => {
    console.log('🚀 GlobalUpdateContext initialized');
    refreshAll();
  }, []);

  // Auto-refresh cuando cambia el estado global del bot
  useEffect(() => {
    refreshAll();
  }, [isGloballyOn]);

  // Auto-refresh cuando se reconecta el socket
  useEffect(() => {
    if (isConnected) {
      refreshAll();
    }
  }, [isConnected]);

  // Escuchar eventos de Socket.IO para actualizaciones en tiempo real
  useEffect(() => {
    if (!socket) return;

    // Variables para almacenar el último estado conocido
    let lastKnownBotStatus: any = null;
    let lastKnownStats: any = null;
    let lastKnownNotificationId: string | null = null;
    let lastKnownLogId: string | null = null;
    let lastGroupUpdateTime = 0;
    let lastSubbotUpdateTime = 0;

    const handleBotStatusChange = (data: any) => {
      console.log('🤖 Bot status changed via Socket.IO:', data);
      
      // Solo actualizar si hay cambios reales en el estado
      const hasChanges = !lastKnownBotStatus || 
        lastKnownBotStatus.connected !== data.connected ||
        lastKnownBotStatus.status !== data.status ||
        lastKnownBotStatus.phone !== data.phone ||
        lastKnownBotStatus.qrCode !== data.qrCode;
      
      if (hasChanges) {
        lastKnownBotStatus = { ...data };
        setBotStatus(prev => ({ ...prev, ...data }));
        setLastUpdate(new Date());
      }
    };

    const handleStatsUpdate = (data: any) => {
      console.log('📊 Stats updated via Socket.IO:', data);
      
      // Solo actualizar si hay cambios significativos en las estadísticas
      const hasChanges = !lastKnownStats ||
        JSON.stringify(lastKnownStats) !== JSON.stringify(data);
      
      if (hasChanges) {
        lastKnownStats = { ...data };
        setDashboardStats(prev => ({ ...prev, ...data }));
        setLastUpdate(new Date());
      }
    };

    const handleNotificationUpdate = (data: any) => {
      console.log('🔔 New notification via Socket.IO:', data);
      
      // Solo agregar si es una notificación nueva
      if (data && data.id && data.id !== lastKnownNotificationId) {
        lastKnownNotificationId = data.id;
        setNotifications(prev => [data, ...prev.slice(0, 9)]);
        setLastUpdate(new Date());
      }
    };

    const handleGlobalStateChange = (data: any) => {
      console.log('🌐 Global state changed via Socket.IO:', data);
      // Actualizar todo cuando cambie el estado global (esto es importante)
      setTimeout(() => {
        refreshAll();
      }, 500);
    };

    const handleGroupUpdate = (data: any) => {
      console.log('👥 Group updated via Socket.IO:', data);
      
      // Throttle más inteligente: Solo actualizar si han pasado al menos 5 segundos
      const now = Date.now();
      if (now - lastGroupUpdateTime > 5000) {
        lastGroupUpdateTime = now;
        refreshDashboard();
      }
    };

    const handleSubbotUpdate = (data: any) => {
      console.log('⚡ Subbot updated via Socket.IO:', data);
      
      // Throttle más inteligente: Solo actualizar si han pasado al menos 5 segundos
      const now = Date.now();
      if (now - lastSubbotUpdateTime > 5000) {
        lastSubbotUpdateTime = now;
        refreshDashboard();
      }
    };

    const handleLogEntry = (data: any) => {
      console.log('📝 New log entry via Socket.IO:', data);
      
      // Solo actualizar si es realmente un log nuevo con ID diferente
      if (data && data.id && data.id !== lastKnownLogId) {
        lastKnownLogId = data.id;
        // No actualizar dashboard por cada log, solo emitir evento personalizado
        window.dispatchEvent(new CustomEvent('newLogEntry', {
          detail: { log: data, timestamp: new Date() }
        }));
      }
    };

    // Registrar listeners para eventos en tiempo real
    socket.on('bot:statusChanged', handleBotStatusChange);
    socket.on('bot:connected', handleBotStatusChange);
    socket.on('bot:disconnected', handleBotStatusChange);
    socket.on('bot:globalStateChanged', handleGlobalStateChange);
    socket.on('stats:updated', handleStatsUpdate);
    socket.on('stats:update', handleStatsUpdate);
    socket.on('notification:created', handleNotificationUpdate);
    socket.on('group:updated', handleGroupUpdate);
    socket.on('subbot:created', handleSubbotUpdate);
    socket.on('subbot:connected', handleSubbotUpdate);
    socket.on('subbot:disconnected', handleSubbotUpdate);
    socket.on('subbot:deleted', handleSubbotUpdate);
    socket.on('log:entry', handleLogEntry);

    return () => {
      socket.off('bot:statusChanged', handleBotStatusChange);
      socket.off('bot:connected', handleBotStatusChange);
      socket.off('bot:disconnected', handleBotStatusChange);
      socket.off('bot:globalStateChanged', handleGlobalStateChange);
      socket.off('stats:updated', handleStatsUpdate);
      socket.off('stats:update', handleStatsUpdate);
      socket.off('notification:created', handleNotificationUpdate);
      socket.off('group:updated', handleGroupUpdate);
      socket.off('subbot:created', handleSubbotUpdate);
      socket.off('subbot:connected', handleSubbotUpdate);
      socket.off('subbot:disconnected', handleSubbotUpdate);
      socket.off('subbot:deleted', handleSubbotUpdate);
      socket.off('log:entry', handleLogEntry);
    };
  }, [socket]);

  // Auto-refresh periódico (solo como respaldo, intervalos más largos)
  useEffect(() => {
    // Solo hacer polling si no hay conexión Socket.IO
    if (isConnected) return; // Si hay Socket.IO, no hacer polling
    
    const onFocus = () => {
      if (!isRefreshing) refreshAll();
    };

    const onOnline = () => {
      if (!isRefreshing) refreshAll();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [isRefreshing, isConnected]);

  // Escuchar eventos personalizados del navegador
  useEffect(() => {
    const handleCustomUpdate = () => {
      refreshAll();
    };

    window.addEventListener('forceGlobalUpdate', handleCustomUpdate);
    
    return () => {
      window.removeEventListener('forceGlobalUpdate', handleCustomUpdate);
    };
  }, []);

  return (
    <GlobalUpdateContext.Provider
      value={{
        dashboardStats,
        botStatus,
        systemStats,
        notifications,
        refreshAll,
        refreshDashboard,
        refreshBotStatus,
        refreshSystemStats,
        refreshNotifications,
        isRefreshing,
        lastUpdate,
      }}
    >
      {children}
    </GlobalUpdateContext.Provider>
  );
};

export const useGlobalUpdate = () => {
  const context = useContext(GlobalUpdateContext);
  if (!context) {
    throw new Error('useGlobalUpdate must be used within a GlobalUpdateProvider');
  }
  return context;
};
