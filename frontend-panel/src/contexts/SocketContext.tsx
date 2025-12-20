import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { RUNTIME_CONFIG } from '../config/runtime-config';

// Eventos de Socket.IO
export const SOCKET_EVENTS = {
  // Bot principal
  BOT_STATUS: 'bot:status',
  BOT_QR: 'bot:qr',
  BOT_CONNECTED: 'bot:connected',
  BOT_DISCONNECTED: 'bot:disconnected',
  BOT_MESSAGE: 'bot:message',
  
  // Subbots
  SUBBOT_CREATED: 'subbot:created',
  SUBBOT_QR: 'subbot:qr',
  SUBBOT_PAIRING_CODE: 'subbot:pairingCode',
  SUBBOT_CONNECTED: 'subbot:connected',
  SUBBOT_DISCONNECTED: 'subbot:disconnected',
  SUBBOT_DELETED: 'subbot:deleted',
  SUBBOT_STATUS: 'subbot:status',
  
  // Dashboard
  STATS_UPDATE: 'stats:update',
  
  // Aportes
  APORTE_CREATED: 'aporte:created',
  APORTE_UPDATED: 'aporte:updated',
  APORTE_DELETED: 'aporte:deleted',
  
  // Pedidos
  PEDIDO_CREATED: 'pedido:created',
  PEDIDO_UPDATED: 'pedido:updated',
  PEDIDO_DELETED: 'pedido:deleted',
  
  // Grupos
  GRUPO_UPDATED: 'grupo:updated',
  GRUPO_SYNCED: 'grupo:synced',
  
  // Usuarios
  USUARIO_CREATED: 'usuario:created',
  USUARIO_UPDATED: 'usuario:updated',
  
  // Notificaciones
  NOTIFICATION: 'notification',
  
  // Sistema
  SYSTEM_STATS: 'system:stats',
  LOG_ENTRY: 'log:entry',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

interface BotStatus {
  connected: boolean;
  isConnected: boolean;
  connecting: boolean;
  status: string;
  connectionStatus: string;
  phone: string | null;
  qrCode: string | null;
  uptime: string;
  lastSeen: string | null;
  timestamp: string;
}

interface SubbotEvent {
  subbotCode: string;
  qr?: string;
  pairingCode?: string;
  displayCode?: string;
  phoneNumber?: string;
  phone?: string;
  reason?: string;
  timestamp: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  
  // Estado del bot
  botStatus: BotStatus | null;
  
  // Eventos de subbots
  lastSubbotEvent: SubbotEvent | null;
  
  // Métodos
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  requestBotStatus: () => void;
  requestSubbotStatus: () => void;
  requestStats: () => void;
  
  // Event listeners
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [lastSubbotEvent, setLastSubbotEvent] = useState<SubbotEvent | null>(null);

  useEffect(() => {
    // Obtener URL del servidor - usar localhost:3001 para desarrollo local
    const serverUrl = RUNTIME_CONFIG.API_BASE_URL || 'http://localhost:3001';
    
    console.log('[Socket.IO] Conectando a:', serverUrl);
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      autoConnect: true,
      forceNew: false,
      upgrade: true,
    });

    newSocket.on('connect', () => {
      console.log('[Socket.IO] Conectado:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Solicitar estado inicial
      newSocket.emit('request:botStatus');
      newSocket.emit('request:subbotStatus');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Desconectado:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket.IO] Error de conexión:', error.message);
      setConnectionError(`No se puede conectar al servidor: ${error.message}`);
      setIsConnected(false);
    });

    // Escuchar eventos del bot
    newSocket.on(SOCKET_EVENTS.BOT_STATUS, (data: BotStatus) => {
      console.log('[Socket.IO] Bot status:', data);
      setBotStatus(data);
    });

    newSocket.on(SOCKET_EVENTS.BOT_QR, (data) => {
      console.log('[Socket.IO] Bot QR recibido');
      setBotStatus(prev => prev ? { ...prev, qrCode: data.qr } : null);
    });

    newSocket.on(SOCKET_EVENTS.BOT_CONNECTED, (data) => {
      console.log('[Socket.IO] Bot conectado:', data.phone);
      setBotStatus(prev => prev ? { 
        ...prev, 
        connected: true, 
        isConnected: true, 
        connecting: false,
        phone: data.phone,
        qrCode: null 
      } : null);
    });

    newSocket.on(SOCKET_EVENTS.BOT_DISCONNECTED, (data) => {
      console.log('[Socket.IO] Bot desconectado:', data.reason);
      setBotStatus(prev => prev ? { 
        ...prev, 
        connected: false, 
        isConnected: false, 
        connecting: false 
      } : null);
    });

    // Escuchar eventos de subbots
    newSocket.on(SOCKET_EVENTS.SUBBOT_CREATED, (data) => {
      console.log('[Socket.IO] Subbot creado:', data);
      setLastSubbotEvent({ ...data, subbotCode: data.subbot?.code || 'unknown' });
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_QR, (data: SubbotEvent) => {
      console.log('[Socket.IO] Subbot QR:', data.subbotCode);
      setLastSubbotEvent(data);
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_PAIRING_CODE, (data: SubbotEvent) => {
      console.log('[Socket.IO] Subbot pairing code:', data.subbotCode, data.pairingCode);
      setLastSubbotEvent(data);
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, (data: SubbotEvent) => {
      console.log('[Socket.IO] Subbot conectado:', data.subbotCode);
      setLastSubbotEvent(data);
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, (data: SubbotEvent) => {
      console.log('[Socket.IO] Subbot desconectado:', data.subbotCode);
      setLastSubbotEvent(data);
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_DELETED, (data: SubbotEvent) => {
      console.log('[Socket.IO] Subbot eliminado:', data.subbotCode);
      setLastSubbotEvent(data);
    });

    setSocket(newSocket);

    return () => {
      console.log('[Socket.IO] Desconectando...');
      newSocket.disconnect();
    };
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    if (socket) {
      socket.emit('subscribe', channels);
    }
  }, [socket]);

  const unsubscribe = useCallback((channels: string[]) => {
    if (socket) {
      socket.emit('unsubscribe', channels);
    }
  }, [socket]);

  const requestBotStatus = useCallback(() => {
    if (socket) {
      socket.emit('request:botStatus');
    }
  }, [socket]);

  const requestSubbotStatus = useCallback(() => {
    if (socket) {
      socket.emit('request:subbotStatus');
    }
  }, [socket]);

  const requestStats = useCallback(() => {
    if (socket) {
      socket.emit('request:stats');
    }
  }, [socket]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionError,
        botStatus,
        lastSubbotEvent,
        subscribe,
        unsubscribe,
        requestBotStatus,
        requestSubbotStatus,
        requestStats,
        on,
        off,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket debe ser usado dentro de SocketProvider');
  }
  return context;
};

export default SocketContext;
