'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

export const SOCKET_EVENTS = {
  BOT_STATUS: 'bot:status',
  BOT_QR: 'bot:qr',
  BOT_PAIRING_CODE: 'bot:pairingCode',
  BOT_CONNECTED: 'bot:connected',
  BOT_DISCONNECTED: 'bot:disconnected',
  BOT_MESSAGE: 'bot:message',
  BOT_GLOBAL_STATE_CHANGED: 'bot:globalStateChanged',
  BOT_GLOBAL_SHUTDOWN: 'bot:globalShutdown',
  BOT_GLOBAL_STARTUP: 'bot:globalStartup',
  SUBBOT_CREATED: 'subbot:created',
  SUBBOT_QR: 'subbot:qr',
  SUBBOT_PAIRING_CODE: 'subbot:pairingCode',
  SUBBOT_CONNECTED: 'subbot:connected',
  SUBBOT_DISCONNECTED: 'subbot:disconnected',
  SUBBOT_DELETED: 'subbot:deleted',
  SUBBOT_STATUS: 'subbot:status',
  STATS_UPDATE: 'stats:update',
  APORTE_CREATED: 'aporte:created',
  APORTE_UPDATED: 'aporte:updated',
  PEDIDO_CREATED: 'pedido:created',
  PEDIDO_UPDATED: 'pedido:updated',
  GRUPO_UPDATED: 'grupo:updated',
  NOTIFICATION: 'notification',
  SYSTEM_STATS: 'system:stats',
  LOG_ENTRY: 'log:entry',
} as const;

interface BotStatus {
  connected: boolean;
  isConnected: boolean;
  connecting: boolean;
  status: string;
  connectionStatus: string;
  phone: string | null;
  qrCode: string | null;
  pairingCode?: string | null;
  pairingPhone?: string | null;
  uptime: string;
  lastSeen: string | null;
  timestamp: string;
}

interface BotPairingCodeEvent {
  pairingCode?: string | null;
  displayCode?: string | null;
  phoneNumber?: string | null;
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

interface SocketConnectionContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  requestBotStatus: () => void;
  requestSubbotStatus: () => void;
  requestStats: () => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
}

const SocketConnectionContext = createContext<SocketConnectionContextType | undefined>(undefined);
const BotStatusContext = createContext<BotStatus | null | undefined>(undefined);
const SubbotEventContext = createContext<SubbotEvent | null | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [lastSubbotEvent, setLastSubbotEvent] = useState<SubbotEvent | null>(null);

  useEffect(() => {
    // En producción, usar el dominio configurado con HTTPS
    // En desarrollo, usar localhost
    const envUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
    const serverUrl = process.env.NODE_ENV === 'production'
      ? (typeof window !== 'undefined' ? window.location.origin : (envUrl || ''))
      : (envUrl || 'http://localhost:8080');
    
    const newSocket = io(serverUrl, {
      transports: ['polling', 'websocket'], // Polling primero, luego websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 30000,
      autoConnect: true,
      upgrade: true, // Permitir upgrade a websocket después de polling
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      newSocket.emit('request:botStatus');
      newSocket.emit('request:subbotStatus');
      newSocket.emit('request:stats');
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('connect_error', (error) => {
      setConnectionError(`No se puede conectar: ${error.message}`);
      setIsConnected(false);
    });

    newSocket.on(SOCKET_EVENTS.BOT_STATUS, (data: BotStatus) => setBotStatus(data));

    newSocket.on(SOCKET_EVENTS.BOT_QR, (data) => {
      setBotStatus(prev => prev ? { ...prev, qrCode: data.qr } : null);
    });

    newSocket.on(SOCKET_EVENTS.BOT_PAIRING_CODE, (data: BotPairingCodeEvent) => {
      setBotStatus(prev => prev ? {
        ...prev,
        pairingCode: data?.pairingCode ?? null,
        pairingPhone: data?.phoneNumber ?? prev.pairingPhone ?? null,
      } : prev);
      newSocket.emit('request:botStatus');
    });

    newSocket.on(SOCKET_EVENTS.BOT_CONNECTED, (data) => {
      setBotStatus(prev => prev ? { 
        ...prev, connected: true, isConnected: true, connecting: false, phone: data.phone, qrCode: null 
      } : null);
    });

    newSocket.on(SOCKET_EVENTS.BOT_DISCONNECTED, () => {
      setBotStatus(prev => prev ? { ...prev, connected: false, isConnected: false, connecting: false } : null);
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_QR, (data: SubbotEvent) => setLastSubbotEvent(data));
    newSocket.on(SOCKET_EVENTS.SUBBOT_PAIRING_CODE, (data: SubbotEvent) => setLastSubbotEvent(data));
    newSocket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, (data: SubbotEvent) => setLastSubbotEvent(data));
    newSocket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, (data: SubbotEvent) => setLastSubbotEvent(data));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    socket?.emit('subscribe', channels);
  }, [socket]);

  const unsubscribe = useCallback((channels: string[]) => {
    socket?.emit('unsubscribe', channels);
  }, [socket]);

  const requestBotStatus = useCallback(() => {
    socket?.emit('request:botStatus');
  }, [socket]);

  const requestSubbotStatus = useCallback(() => {
    socket?.emit('request:subbotStatus');
  }, [socket]);

  const requestStats = useCallback(() => {
    socket?.emit('request:stats');
  }, [socket]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    socket?.on(event, callback);
  }, [socket]);

  const off = useCallback((event: string, callback: (data: any) => void) => {
    socket?.off(event, callback);
  }, [socket]);

  const connectionValue = React.useMemo<SocketConnectionContextType>(() => ({
    socket,
    isConnected,
    connectionError,
    subscribe,
    unsubscribe,
    requestBotStatus,
    requestSubbotStatus,
    requestStats,
    on,
    off,
  }), [socket, isConnected, connectionError, subscribe, unsubscribe, requestBotStatus, requestSubbotStatus, requestStats, on, off]);

  return (
    <SocketConnectionContext.Provider value={connectionValue}>
      <BotStatusContext.Provider value={botStatus}>
        <SubbotEventContext.Provider value={lastSubbotEvent}>
          {children}
        </SubbotEventContext.Provider>
      </BotStatusContext.Provider>
    </SocketConnectionContext.Provider>
  );
};

export function useSocketConnection() {
  const context = useContext(SocketConnectionContext);
  if (!context) throw new Error('useSocketConnection debe ser usado dentro de SocketProvider');
  return context;
}

export function useSocketBotStatus() {
  const context = useContext(BotStatusContext);
  if (context === undefined) throw new Error('useSocketBotStatus debe ser usado dentro de SocketProvider');
  return context;
}

export function useLastSubbotEvent() {
  const context = useContext(SubbotEventContext);
  if (context === undefined) throw new Error('useLastSubbotEvent debe ser usado dentro de SocketProvider');
  return context;
}

// Backwards-compatible aggregate hook (avoid in hot paths: subscribe to granular hooks instead).
export function useSocket() {
  const conn = useSocketConnection();
  const botStatus = useSocketBotStatus();
  const lastSubbotEvent = useLastSubbotEvent();
  return React.useMemo(
    () => ({ ...conn, botStatus, lastSubbotEvent }),
    [conn, botStatus, lastSubbotEvent]
  );
}
