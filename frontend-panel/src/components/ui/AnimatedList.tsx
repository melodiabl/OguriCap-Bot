import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className = '',
  staggerDelay = 0.1,
}) => {
  return (
    <motion.div className={className}>
      <AnimatePresence>
        {React.Children.map(children, (child, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{
              duration: 0.3,
              delay: index * staggerDelay,
              ease: 'easeOut',
            }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

// ===== Animated Grid =====
interface AnimatedGridProps {
  children: React.ReactNode[];
  columns?: number;
  gap?: number;
  className?: string;
}

export const AnimatedGrid: React.FC<AnimatedGridProps> = ({
  children,
  columns = 3,
  gap = 6,
  className = '',
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
      className={`grid ${gridCols[columns as keyof typeof gridCols]} gap-${gap} ${className}`}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20, scale: 0.95 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
              },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// ===== Animated Table Row =====
interface AnimatedTableRowProps {
  children: React.ReactNode;
  index?: number;
  onClick?: () => void;
  className?: string;
}

export const AnimatedTableRow: React.FC<AnimatedTableRowProps> = ({
  children,
  index = 0,
  onClick,
  className = '',
}) => {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
      onClick={onClick}
      className={`transition-colors duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.tr>
  );
};

// ===== Notification Item =====
interface NotificationItemProps {
  title: string;
  message: string;
  time: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  isRead?: boolean;
  onClick?: () => void;
  onDismiss?: () => void;
}

const notificationColors = {
  info: 'border-l-cyan-500 bg-cyan-500/5',
  success: 'border-l-emerald-500 bg-emerald-500/5',
  warning: 'border-l-amber-500 bg-amber-500/5',
  error: 'border-l-red-500 bg-red-500/5',
};

const notificationIcons = {
  info: '💡',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  title,
  message,
  time,
  type = 'info',
  isRead = false,
  onClick,
  onDismiss,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50, height: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border-l-4
        ${notificationColors[type]}
        ${!isRead ? 'bg-white/5' : 'bg-transparent'}
        ${onClick ? 'cursor-pointer' : ''}
        transition-all duration-300
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{notificationIcons[type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`font-semibold truncate ${!isRead ? 'text-white' : 'text-gray-400'}`}>
              {title}
            </h4>
            {!isRead && (
              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{message}</p>
          <span className="text-xs text-gray-500 mt-2 block">{time}</span>
        </div>
        {onDismiss && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-500 hover:text-white transition-colors"
          >
            ✕
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// ===== Activity Item =====
interface ActivityItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  color?: string;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  icon,
  title,
  description,
  time,
  color = 'primary',
}) => {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-500/20 text-primary-400',
    success: 'bg-emerald-500/20 text-emerald-400',
    warning: 'bg-amber-500/20 text-amber-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-cyan-500/20 text-cyan-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
    >
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white truncate">{title}</h4>
        <p className="text-sm text-gray-400 truncate">{description}</p>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{time}</span>
    </motion.div>
  );
};

export default AnimatedList;
