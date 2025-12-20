import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from 'react-query';
import { useSocket, SOCKET_EVENTS } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

// Hook para escuchar eventos del bot en tiempo real
export function useSocketBotStatus() {
  const { socket, isConnected, botStatus } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleBotStatus = () => {
      queryClient.invalidateQueries('botStatus');
    };

    const handleBotConnected = (data: any) => {
      toast.success(`Bot conectado: ${data.phone || 'WhatsApp'}`);
      queryClient.invalidateQueries('botStatus');
    };

    const handleBotDisconnected = (data: any) => {
      toast.error(`Bot desconectado: ${data.reason || 'Conexión perdida'}`);
      queryClient.invalidateQueries('botStatus');
    };

    socket.on(SOCKET_EVENTS.BOT_STATUS, handleBotStatus);
    socket.on(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
    socket.on(SOCKET_EVENTS.BOT_DISCONNECTED, handleBotDisconnected);

    return () => {
      socket.off(SOCKET_EVENTS.BOT_STATUS, handleBotStatus);
      socket.off(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
      socket.off(SOCKET_EVENTS.BOT_DISCONNECTED, handleBotDisconnected);
    };
  }, [socket, queryClient]);

  return {
    isSocketConnected: isConnected,
    botStatus,
  };
}

// Hook para escuchar eventos de subbots en tiempo real
export function useSocketSubbots() {
  const { socket, isConnected, lastSubbotEvent } = useSocket();
  const queryClient = useQueryClient();
  const [pendingPairingCode, setPendingPairingCode] = useState<{
    subbotCode: string;
    pairingCode: string;
    phoneNumber?: string;
  } | null>(null);
  const [pendingQR, setPendingQR] = useState<{
    subbotCode: string;
    qr: string;
  } | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleSubbotCreated = (data: any) => {
      toast.success('Subbot creado correctamente');
      queryClient.invalidateQueries('subbots');
      queryClient.invalidateQueries('subbotsStatus');
    };

    const handleSubbotQR = (data: any) => {
      console.log('[useSocketSubbots] QR recibido:', data.subbotCode);
      setPendingQR({
        subbotCode: data.subbotCode,
        qr: data.qr,
      });
      queryClient.invalidateQueries('subbots');
    };

    const handleSubbotPairingCode = (data: any) => {
      console.log('[useSocketSubbots] Pairing code recibido:', data.subbotCode, data.pairingCode);
      setPendingPairingCode({
        subbotCode: data.subbotCode,
        pairingCode: data.pairingCode || data.displayCode,
        phoneNumber: data.phoneNumber,
      });
      toast.success(`Código de pairing generado: ${data.pairingCode || data.displayCode}`);
      queryClient.invalidateQueries('subbots');
    };

    const handleSubbotConnected = (data: any) => {
      toast.success(`Subbot ${data.subbotCode} conectado`);
      setPendingPairingCode(null);
      setPendingQR(null);
      queryClient.invalidateQueries('subbots');
      queryClient.invalidateQueries('subbotsStatus');
    };

    const handleSubbotDisconnected = (data: any) => {
      toast.error(`Subbot ${data.subbotCode} desconectado`);
      queryClient.invalidateQueries('subbots');
      queryClient.invalidateQueries('subbotsStatus');
    };

    const handleSubbotDeleted = (data: any) => {
      toast.success(`Subbot ${data.subbotCode} eliminado`);
      queryClient.invalidateQueries('subbots');
      queryClient.invalidateQueries('subbotsStatus');
    };

    const handleSubbotStatus = () => {
      queryClient.invalidateQueries('subbotsStatus');
    };

    socket.on(SOCKET_EVENTS.SUBBOT_CREATED, handleSubbotCreated);
    socket.on(SOCKET_EVENTS.SUBBOT_QR, handleSubbotQR);
    socket.on(SOCKET_EVENTS.SUBBOT_PAIRING_CODE, handleSubbotPairingCode);
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
    socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, handleSubbotDisconnected);
    socket.on(SOCKET_EVENTS.SUBBOT_DELETED, handleSubbotDeleted);
    socket.on(SOCKET_EVENTS.SUBBOT_STATUS, handleSubbotStatus);

    return () => {
      socket.off(SOCKET_EVENTS.SUBBOT_CREATED, handleSubbotCreated);
      socket.off(SOCKET_EVENTS.SUBBOT_QR, handleSubbotQR);
      socket.off(SOCKET_EVENTS.SUBBOT_PAIRING_CODE, handleSubbotPairingCode);
      socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
      socket.off(SOCKET_EVENTS.SUBBOT_DISCONNECTED, handleSubbotDisconnected);
      socket.off(SOCKET_EVENTS.SUBBOT_DELETED, handleSubbotDeleted);
      socket.off(SOCKET_EVENTS.SUBBOT_STATUS, handleSubbotStatus);
    };
  }, [socket, queryClient]);

  const clearPendingPairingCode = useCallback(() => {
    setPendingPairingCode(null);
  }, []);

  const clearPendingQR = useCallback(() => {
    setPendingQR(null);
  }, []);

  return {
    isSocketConnected: isConnected,
    lastSubbotEvent,
    pendingPairingCode,
    pendingQR,
    clearPendingPairingCode,
    clearPendingQR,
  };
}

// Hook para escuchar eventos de aportes en tiempo real
export function useSocketAportes() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleAporteCreated = () => {
      toast.success('Nuevo aporte recibido');
      queryClient.invalidateQueries('aportes');
      queryClient.invalidateQueries('dashboardStats');
    };

    const handleAporteUpdated = () => {
      queryClient.invalidateQueries('aportes');
    };

    const handleAporteDeleted = () => {
      queryClient.invalidateQueries('aportes');
      queryClient.invalidateQueries('dashboardStats');
    };

    socket.on(SOCKET_EVENTS.APORTE_CREATED, handleAporteCreated);
    socket.on(SOCKET_EVENTS.APORTE_UPDATED, handleAporteUpdated);
    socket.on(SOCKET_EVENTS.APORTE_DELETED, handleAporteDeleted);

    return () => {
      socket.off(SOCKET_EVENTS.APORTE_CREATED, handleAporteCreated);
      socket.off(SOCKET_EVENTS.APORTE_UPDATED, handleAporteUpdated);
      socket.off(SOCKET_EVENTS.APORTE_DELETED, handleAporteDeleted);
    };
  }, [socket, queryClient]);

  return { isSocketConnected: isConnected };
}

// Hook para escuchar eventos de pedidos en tiempo real
export function useSocketPedidos() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handlePedidoCreated = () => {
      toast.success('Nuevo pedido recibido');
      queryClient.invalidateQueries('pedidos');
      queryClient.invalidateQueries('dashboardStats');
    };

    const handlePedidoUpdated = () => {
      queryClient.invalidateQueries('pedidos');
    };

    const handlePedidoDeleted = () => {
      queryClient.invalidateQueries('pedidos');
      queryClient.invalidateQueries('dashboardStats');
    };

    socket.on(SOCKET_EVENTS.PEDIDO_CREATED, handlePedidoCreated);
    socket.on(SOCKET_EVENTS.PEDIDO_UPDATED, handlePedidoUpdated);
    socket.on(SOCKET_EVENTS.PEDIDO_DELETED, handlePedidoDeleted);

    return () => {
      socket.off(SOCKET_EVENTS.PEDIDO_CREATED, handlePedidoCreated);
      socket.off(SOCKET_EVENTS.PEDIDO_UPDATED, handlePedidoUpdated);
      socket.off(SOCKET_EVENTS.PEDIDO_DELETED, handlePedidoDeleted);
    };
  }, [socket, queryClient]);

  return { isSocketConnected: isConnected };
}

// Hook para escuchar eventos de grupos en tiempo real
export function useSocketGrupos() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleGrupoUpdated = () => {
      queryClient.invalidateQueries('grupos');
      queryClient.invalidateQueries('groupsManagement');
    };

    const handleGruposSynced = () => {
      toast.success('Grupos sincronizados');
      queryClient.invalidateQueries('grupos');
      queryClient.invalidateQueries('groupsManagement');
      queryClient.invalidateQueries('dashboardStats');
    };

    socket.on(SOCKET_EVENTS.GRUPO_UPDATED, handleGrupoUpdated);
    socket.on(SOCKET_EVENTS.GRUPO_SYNCED, handleGruposSynced);

    return () => {
      socket.off(SOCKET_EVENTS.GRUPO_UPDATED, handleGrupoUpdated);
      socket.off(SOCKET_EVENTS.GRUPO_SYNCED, handleGruposSynced);
    };
  }, [socket, queryClient]);

  return { isSocketConnected: isConnected };
}

// Hook para escuchar notificaciones en tiempo real
export function useSocketNotifications() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [lastNotification, setLastNotification] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: any) => {
      setLastNotification(data);
      
      // Mostrar toast según el tipo
      const message = data.message || data.title || 'Nueva notificación';
      switch (data.type) {
        case 'success':
          toast.success(message);
          break;
        case 'error':
          toast.error(message);
          break;
        case 'warning':
          toast(message, { icon: '⚠️' });
          break;
        default:
          toast(message, { icon: '🔔' });
      }
      
      queryClient.invalidateQueries('notifications');
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handleNotification);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handleNotification);
    };
  }, [socket, queryClient]);

  return {
    isSocketConnected: isConnected,
    lastNotification,
  };
}

// Hook para escuchar estadísticas del sistema en tiempo real
export function useSocketSystemStats() {
  const { socket, isConnected } = useSocket();
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;

    const handleSystemStats = (data: any) => {
      setSystemStats(data);
    };

    socket.on(SOCKET_EVENTS.SYSTEM_STATS, handleSystemStats);

    return () => {
      socket.off(SOCKET_EVENTS.SYSTEM_STATS, handleSystemStats);
    };
  }, [socket]);

  return {
    isSocketConnected: isConnected,
    systemStats,
  };
}

// Hook para escuchar logs en tiempo real
export function useSocketLogs() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleLogEntry = (data: any) => {
      setRecentLogs(prev => [data, ...prev].slice(0, 100));
      queryClient.invalidateQueries('logs');
    };

    socket.on(SOCKET_EVENTS.LOG_ENTRY, handleLogEntry);

    return () => {
      socket.off(SOCKET_EVENTS.LOG_ENTRY, handleLogEntry);
    };
  }, [socket, queryClient]);

  const clearLogs = useCallback(() => {
    setRecentLogs([]);
  }, []);

  return {
    isSocketConnected: isConnected,
    recentLogs,
    clearLogs,
  };
}

// Hook combinado para todas las actualizaciones en tiempo real
export function useRealTimeSocket() {
  const { isConnected, botStatus, requestBotStatus, requestSubbotStatus, requestStats } = useSocket();
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    requestBotStatus();
    requestSubbotStatus();
    requestStats();
    queryClient.invalidateQueries();
  }, [requestBotStatus, requestSubbotStatus, requestStats, queryClient]);

  return {
    isSocketConnected: isConnected,
    botStatus,
    refreshAll,
  };
}

export default {
  useSocketBotStatus,
  useSocketSubbots,
  useSocketAportes,
  useSocketPedidos,
  useSocketGrupos,
  useSocketNotifications,
  useSocketSystemStats,
  useSocketLogs,
  useRealTimeSocket,
};
