'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

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
  SUBBOT_UPDATED: 'subbot:updated',
  SUBBOT_STATUS: 'subbot:status',
  STATS_UPDATE: 'stats:update',
  APORTE_CREATED: 'aporte:created',
  APORTE_UPDATED: 'aporte:updated',
  APORTE_DELETED: 'aporte:deleted',
  PEDIDO_CREATED: 'pedido:created',
  PEDIDO_UPDATED: 'pedido:updated',
  PEDIDO_DELETED: 'pedido:deleted',
  GRUPO_UPDATED: 'grupo:updated',
  GRUPO_SYNCED: 'grupo:synced',
  USUARIO_CREATED: 'usuario:created',
  USUARIO_UPDATED: 'usuario:updated',
  NOTIFICATION: 'notification',
  SYSTEM_STATS: 'system:stats',
  LOG_ENTRY: 'log:entry',
  TERMINAL_LINE: 'terminal:line',
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_EXECUTED: 'task:executed',
  SYSTEM_MAINTENANCE: 'system:maintenance',
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
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const botStatusRef = useRef<BotStatus | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [lastSubbotEvent, setLastSubbotEvent] = useState<SubbotEvent | null>(null);

  const updateBotStatus = useCallback((updater: BotStatus | ((prev: BotStatus | null) => BotStatus | null)) => {
    setBotStatus(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(next);
      if (prevStr === nextStr) return prev;
      botStatusRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const envUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
    let serverUrl = '';
    
    if (process.env.NODE_ENV === 'production') {
      const origin = typeof window !== 'undefined' ? window.location.origin : envUrl;
      serverUrl = origin.replace(':3000', ':3001');
    } else {
      serverUrl = envUrl || 'http://localhost:8080';
    }
    
    const newSocket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 15000,
      autoConnect: true,
      auth: { token },
    });

    let connectAttempts = 0;

    const requestData = () => {
      newSocket.emit('request:botStatus');
      newSocket.emit('request:subbotStatus');
      newSocket.emit('request:stats');
      newSocket.emit('request:resourceMetrics');
    };

    newSocket.on('connect', () => {
      connectAttempts = 0;
      setIsConnected(true);
      setConnectionError(null);
      requestData();
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('connect_error', (error) => {
      connectAttempts++;
      if (connectAttempts > 1) {
        setConnectionError(`Error de conexión: ${error.message}`);
      }
      setIsConnected(false);
    });

    const handleOnline = () => { if (!newSocket.connected) newSocket.connect(); };
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    newSocket.on(SOCKET_EVENTS.BOT_STATUS, (data: BotStatus) => updateBotStatus(data));

    newSocket.on(SOCKET_EVENTS.BOT_QR, (data: any) => {
      updateBotStatus(prev => ({
        ...(prev ?? {} as BotStatus),
        qrCode: data?.qr ?? null,
        connecting: true,
      }));
    });

    newSocket.on(SOCKET_EVENTS.BOT_CONNECTED, (data: any) => {
      updateBotStatus(prev => ({
        ...(prev ?? {} as BotStatus),
        connected: true, isConnected: true, connecting: false,
        phone: data?.phone ?? null, qrCode: null,
      }));
    });

    newSocket.on(SOCKET_EVENTS.BOT_DISCONNECTED, () => {
      updateBotStatus(prev => ({
        ...(prev ?? {} as BotStatus),
        connected: false, isConnected: false, connecting: false, qrCode: null,
      }));
    });

    newSocket.on(SOCKET_EVENTS.SUBBOT_STATUS, (data: any) => setLastSubbotEvent(prev =>
      JSON.stringify(prev) === JSON.stringify(data) ? prev : data
    ));
    newSocket.on(SOCKET_EVENTS.SUBBOT_QR, (data: SubbotEvent) => setLastSubbotEvent(prev =>
      JSON.stringify(prev) === JSON.stringify(data) ? prev : data
    ));
    newSocket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, (data: SubbotEvent) => setLastSubbotEvent(prev =>
      JSON.stringify(prev) === JSON.stringify(data) ? prev : data
    ));
    newSocket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, (data: SubbotEvent) => setLastSubbotEvent(prev =>
      JSON.stringify(prev) === JSON.stringify(data) ? prev : data
    ));

    setSocket(newSocket);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      newSocket.disconnect();
    };
  }, [token, updateBotStatus]);

  const subscribe = useCallback((channels: string[]) => { socket?.emit('subscribe', channels); }, [socket]);
  const unsubscribe = useCallback((channels: string[]) => { socket?.emit('unsubscribe', channels); }, [socket]);
  const requestBotStatus = useCallback(() => { socket?.emit('request:botStatus'); }, [socket]);
  const requestSubbotStatus = useCallback(() => { socket?.emit('request:subbotStatus'); }, [socket]);
  const requestStats = useCallback(() => { socket?.emit('request:stats'); }, [socket]);
  const on = useCallback((event: string, callback: (data: any) => void) => { socket?.on(event, callback); }, [socket]);
  const off = useCallback((event: string, callback: (data: any) => void) => { socket?.off(event, callback); }, [socket]);

  const connectionValue = React.useMemo<SocketConnectionContextType>(() => ({
    socket, isConnected, connectionError, subscribe, unsubscribe,
    requestBotStatus, requestSubbotStatus, requestStats, on, off,
  }), [socket, isConnected, connectionError, subscribe, unsubscribe,
      requestBotStatus, requestSubbotStatus, requestStats, on, off]);

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

export function useSocket() {
  const conn = useSocketConnection();
  const botStatus = useSocketBotStatus();
  const lastSubbotEvent = useLastSubbotEvent();
  return React.useMemo(
    () => ({ ...conn, botStatus, lastSubbotEvent }),
    [conn, botStatus, lastSubbotEvent]
  );
}
