'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

export const SOCKET_EVENTS = {
  BOT_STATUS: 'bot:status',
  BOT_QR: 'bot:qr',
  BOT_CONNECTED: 'bot:connected',
  BOT_DISCONNECTED: 'bot:disconnected',
  BOT_MESSAGE: 'bot:message',
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
  botStatus: BotStatus | null;
  lastSubbotEvent: SubbotEvent | null;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  requestBotStatus: () => void;
  requestSubbotStatus: () => void;
  requestStats: () => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [lastSubbotEvent, setLastSubbotEvent] = useState<SubbotEvent | null>(null);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 30000,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      newSocket.emit('request:botStatus');
      newSocket.emit('request:subbotStatus');
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

  return (
    <SocketContext.Provider
      value={{
        socket, isConnected, connectionError, botStatus, lastSubbotEvent,
        subscribe, unsubscribe, requestBotStatus, requestSubbotStatus, requestStats, on, off,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket debe ser usado dentro de SocketProvider');
  return context;
};