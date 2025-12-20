import React, { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';
import { NotificationContainer, PushNotificationData } from '../components/ui/PushNotification';
import { useSocket, SOCKET_EVENTS } from './SocketContext';

interface NotificationContextType {
  notifications: PushNotificationData[];
  addNotification: (notification: Omit<PushNotificationData, 'id' | 'timestamp'>) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  // Helpers
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
  warning: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
  bot: (title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  maxNotifications?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ 
  children, 
  maxNotifications = 5 
}) => {
  const [notifications, setNotifications] = useState<PushNotificationData[]>([]);
  const { socket } = useSocket();

  const addNotification = useCallback((notification: Omit<PushNotificationData, 'id' | 'timestamp'>) => {
    const newNotification: PushNotificationData = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });
    
    // Reproducir sonido de notificación
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
    
    return newNotification.id;
  }, [maxNotifications]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Helpers
  const success = useCallback((title: string, message: string) => {
    addNotification({ type: 'success', title, message });
  }, [addNotification]);

  const error = useCallback((title: string, message: string) => {
    addNotification({ type: 'error', title, message, duration: 8000 });
  }, [addNotification]);

  const warning = useCallback((title: string, message: string) => {
    addNotification({ type: 'warning', title, message, duration: 6000 });
  }, [addNotification]);

  const info = useCallback((title: string, message: string) => {
    addNotification({ type: 'info', title, message });
  }, [addNotification]);

  const bot = useCallback((title: string, message: string) => {
    addNotification({ type: 'bot', title, message });
  }, [addNotification]);

  // Escuchar eventos de Socket.IO para notificaciones en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: any) => {
      const type = data.type || 'info';
      addNotification({
        type: type as PushNotificationData['type'],
        title: data.title || 'Notificación',
        message: data.message || '',
        duration: data.duration,
        persistent: data.persistent,
      });
    };

    const handleBotConnected = (data: any) => {
      addNotification({
        type: 'success',
        title: '🤖 Bot Conectado',
        message: `El bot se ha conectado correctamente${data.phone ? ` (${data.phone})` : ''}`,
      });
    };

    const handleBotDisconnected = (data: any) => {
      addNotification({
        type: 'error',
        title: '🔌 Bot Desconectado',
        message: data.reason || 'La conexión con WhatsApp se ha perdido',
        duration: 10000,
      });
    };

    const handleSubbotConnected = (data: any) => {
      addNotification({
        type: 'bot',
        title: '✨ Subbot Conectado',
        message: `Subbot ${data.subbotCode} conectado${data.phone ? ` (${data.phone})` : ''}`,
      });
    };

    const handleSubbotDisconnected = (data: any) => {
      addNotification({
        type: 'warning',
        title: '⚠️ Subbot Desconectado',
        message: `Subbot ${data.subbotCode} se ha desconectado`,
      });
    };

    const handleSubbotDeleted = (data: any) => {
      addNotification({
        type: 'info',
        title: '🗑️ Subbot Eliminado',
        message: `Subbot ${data.subbotCode} ha sido eliminado`,
      });
    };

    const handleAporteCreated = (data: any) => {
      addNotification({
        type: 'success',
        title: '📥 Nuevo Aporte',
        message: data.aporte?.titulo || 'Se ha recibido un nuevo aporte',
      });
    };

    const handlePedidoCreated = (data: any) => {
      addNotification({
        type: 'message',
        title: '📋 Nuevo Pedido',
        message: data.pedido?.titulo || 'Se ha recibido un nuevo pedido',
      });
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handleNotification);
    socket.on(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
    socket.on(SOCKET_EVENTS.BOT_DISCONNECTED, handleBotDisconnected);
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
    socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, handleSubbotDisconnected);
    socket.on(SOCKET_EVENTS.SUBBOT_DELETED, handleSubbotDeleted);
    socket.on(SOCKET_EVENTS.APORTE_CREATED, handleAporteCreated);
    socket.on(SOCKET_EVENTS.PEDIDO_CREATED, handlePedidoCreated);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handleNotification);
      socket.off(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
      socket.off(SOCKET_EVENTS.BOT_DISCONNECTED, handleBotDisconnected);
      socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
      socket.off(SOCKET_EVENTS.SUBBOT_DISCONNECTED, handleSubbotDisconnected);
      socket.off(SOCKET_EVENTS.SUBBOT_DELETED, handleSubbotDeleted);
      socket.off(SOCKET_EVENTS.APORTE_CREATED, handleAporteCreated);
      socket.off(SOCKET_EVENTS.PEDIDO_CREATED, handlePedidoCreated);
    };
  }, [socket, addNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        dismissNotification,
        clearAll,
        success,
        error,
        warning,
        info,
        bot,
      }}
    >
      {children}
      <NotificationContainer
        notifications={notifications}
        onDismiss={dismissNotification}
        position="top-right"
      />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications debe ser usado dentro de NotificationProvider');
  }
  return context;
};

export default NotificationContext;
