'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SOCKET_EVENTS, useSocketConnection } from '@/contexts/SocketContext';

interface SmartRefreshOptions {
  // Función que se ejecuta para refrescar los datos
  refreshFunction: () => Promise<void> | void;
  // Eventos de Socket.IO que deben triggear el refresh
  socketEvents?: string[];
  // Intervalo de fallback en milisegundos (0 = sin fallback)
  fallbackInterval?: number;
  // Tiempo mínimo entre refreshes en milisegundos
  minRefreshInterval?: number;
  // Nombre para debugging
  name?: string;
}

export function useSmartRefresh({
  refreshFunction,
  socketEvents = [],
  fallbackInterval = 0,
  minRefreshInterval = 5000, // 5 segundos mínimo entre refreshes
  name = 'SmartRefresh'
}: SmartRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { socket, isConnected } = useSocketConnection();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función de refresh con throttling
  const throttledRefresh = useCallback(async () => {
    const now = new Date();
    
    // Verificar si ha pasado suficiente tiempo desde el último refresh
    if (lastRefresh && (now.getTime() - lastRefresh.getTime()) < minRefreshInterval) {
      console.log(`${name}: Refresh throttled, too soon`);
      return;
    }

    if (isRefreshing) {
      console.log(`${name}: Refresh already in progress`);
      return;
    }

    try {
      setIsRefreshing(true);
      console.log(`${name}: Refreshing data...`);
      await refreshFunction();
      setLastRefresh(now);
    } catch (error) {
      console.error(`${name}: Error during refresh:`, error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFunction, lastRefresh, minRefreshInterval, isRefreshing, name]);

  // Función de refresh manual (sin throttling)
  const manualRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log(`${name}: Manual refresh triggered`);
      await refreshFunction();
      setLastRefresh(new Date());
    } catch (error) {
      console.error(`${name}: Error during manual refresh:`, error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFunction, name]);

  // Escuchar eventos de Socket.IO
  useEffect(() => {
    if (!socket || !isConnected || socketEvents.length === 0) return;

    const handlers: Record<string, (data?: any) => void> = {};

    // Registrar todos los eventos
    socketEvents.forEach((eventName) => {
      const handler = (data?: any) => {
        console.log(`${name}: Socket event '${eventName}' received`, data);

        // Usar timeout para evitar múltiples refreshes simultáneos
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }

        refreshTimeoutRef.current = setTimeout(() => {
          throttledRefresh();
        }, 1000); // Esperar 1 segundo antes de refrescar
      };

      handlers[eventName] = handler;
      socket.on(eventName, handler);
    });

    return () => {
      // Limpiar eventos
      socketEvents.forEach((eventName) => {
        const handler = handlers[eventName];
        if (handler) socket.off(eventName, handler);
      });
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [socket, isConnected, socketEvents, throttledRefresh, name]);

  // Fallback sin intervalos (solo si no hay Socket.IO)
  useEffect(() => {
    if (isConnected || fallbackInterval === 0) return;

    const onFocus = () => {
      console.log(`${name}: Fallback refresh (focus)`);
      throttledRefresh();
    };

    const onOnline = () => {
      console.log(`${name}: Fallback refresh (online)`);
      throttledRefresh();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [isConnected, fallbackInterval, throttledRefresh, name]);

  return {
    isRefreshing,
    lastRefresh,
    manualRefresh,
    isSocketConnected: isConnected
  };
}

// Hook específico para grupos
export function useGroupsSmartRefresh(refreshFunction: () => Promise<void> | void) {
  return useSmartRefresh({
    refreshFunction,
    socketEvents: [
      SOCKET_EVENTS.BOT_CONNECTED,
      SOCKET_EVENTS.BOT_DISCONNECTED,
      SOCKET_EVENTS.GRUPO_UPDATED,
      SOCKET_EVENTS.SUBBOT_CONNECTED,
      SOCKET_EVENTS.SUBBOT_DISCONNECTED
    ],
    fallbackInterval: 10 * 60 * 1000, // 10 minutos de fallback
    minRefreshInterval: 3000, // 3 segundos mínimo
    name: 'GroupsRefresh'
  });
}

// Hook específico para aportes
export function useAportesSmartRefresh(refreshFunction: () => Promise<void> | void) {
  return useSmartRefresh({
    refreshFunction,
    socketEvents: [
      SOCKET_EVENTS.APORTE_CREATED,
      SOCKET_EVENTS.APORTE_UPDATED
    ],
    fallbackInterval: 5 * 60 * 1000, // 5 minutos de fallback
    minRefreshInterval: 2000, // 2 segundos mínimo
    name: 'AportesRefresh'
  });
}

// Hook específico para pedidos
export function usePedidosSmartRefresh(refreshFunction: () => Promise<void> | void) {
  return useSmartRefresh({
    refreshFunction,
    socketEvents: [
      SOCKET_EVENTS.PEDIDO_CREATED,
      SOCKET_EVENTS.PEDIDO_UPDATED
    ],
    fallbackInterval: 5 * 60 * 1000, // 5 minutos de fallback
    minRefreshInterval: 2000, // 2 segundos mínimo
    name: 'PedidosRefresh'
  });
}

// Hook específico para bot status
export function useBotStatusSmartRefresh(refreshFunction: () => Promise<void> | void) {
  return useSmartRefresh({
    refreshFunction,
    socketEvents: [
      SOCKET_EVENTS.BOT_CONNECTED,
      SOCKET_EVENTS.BOT_DISCONNECTED,
      SOCKET_EVENTS.BOT_QR,
      SOCKET_EVENTS.SUBBOT_CONNECTED,
      SOCKET_EVENTS.SUBBOT_DISCONNECTED
    ],
    fallbackInterval: 30 * 1000, // 30 segundos de fallback para bot status
    minRefreshInterval: 1000, // 1 segundo mínimo
    name: 'BotStatusRefresh'
  });
}
