import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, X, CheckCircle, AlertCircle, Info, AlertTriangle,
  Bot, Users, MessageSquare, Settings, Zap
} from 'lucide-react';

export interface PushNotificationData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'bot' | 'user' | 'message' | 'system';
  title: string;
  message: string;
  timestamp: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  persistent?: boolean;
}

interface PushNotificationProps {
  notification: PushNotificationData;
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  bot: Bot,
  user: Users,
  message: MessageSquare,
  system: Settings,
};

const colorMap = {
  success: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-400',
  error: 'from-red-500/20 to-red-600/10 border-red-500/40 text-red-400',
  warning: 'from-amber-500/20 to-amber-600/10 border-amber-500/40 text-amber-400',
  info: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-400',
  bot: 'from-violet-500/20 to-violet-600/10 border-violet-500/40 text-violet-400',
  user: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40 text-cyan-400',
  message: 'from-pink-500/20 to-pink-600/10 border-pink-500/40 text-pink-400',
  system: 'from-gray-500/20 to-gray-600/10 border-gray-500/40 text-gray-400',
};

const PushNotification: React.FC<PushNotificationProps> = ({ notification, onDismiss }) => {
  const Icon = iconMap[notification.type] || Bell;
  const colors = colorMap[notification.type] || colorMap.info;

  useEffect(() => {
    if (!notification.persistent && notification.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      className={`relative w-80 p-4 rounded-xl border backdrop-blur-xl bg-gradient-to-br ${colors} shadow-2xl`}
    >
      <button
        onClick={() => onDismiss(notification.id)}
        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white/10">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-sm">{notification.title}</h4>
          <p className="text-xs text-gray-300 mt-1 line-clamp-2">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-2">
            {new Date(notification.timestamp).toLocaleTimeString('es-ES')}
          </p>
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-xs font-medium hover:underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>
      </div>
      
      {!notification.persistent && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: (notification.duration || 5000) / 1000, ease: 'linear' }}
          className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 origin-left rounded-b-xl"
        />
      )}
    </motion.div>
  );
};

// Container para múltiples notificaciones
interface NotificationContainerProps {
  notifications: PushNotificationData[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss,
  position = 'top-right'
}) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-[100] flex flex-col gap-3`}>
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <PushNotification
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook para manejar notificaciones
export function useNotifications(maxNotifications = 5) {
  const [notifications, setNotifications] = useState<PushNotificationData[]>([]);

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
    
    return newNotification.id;
  }, [maxNotifications]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, addNotification, dismissNotification, clearAll };
}

export default PushNotification;
