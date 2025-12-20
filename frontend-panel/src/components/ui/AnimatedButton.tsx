import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const variants = {
  primary: `
    bg-gradient-to-r from-primary-500 to-primary-600
    hover:from-primary-400 hover:to-primary-500
    text-white shadow-lg shadow-primary-500/25
    hover:shadow-xl hover:shadow-primary-500/30
  `,
  secondary: `
    bg-white/5 border border-white/20
    hover:bg-white/10 hover:border-primary-400/50
    text-white
  `,
  danger: `
    bg-gradient-to-r from-red-500 to-rose-600
    hover:from-red-400 hover:to-rose-500
    text-white shadow-lg shadow-red-500/25
  `,
  success: `
    bg-gradient-to-r from-emerald-500 to-teal-600
    hover:from-emerald-400 hover:to-teal-500
    text-white shadow-lg shadow-emerald-500/25
  `,
  ghost: `
    bg-transparent hover:bg-white/5
    text-gray-400 hover:text-white
  `,
  glow: `
    bg-gradient-to-r from-cyan-500 to-emerald-500
    text-white shadow-glow-cyan
    hover:shadow-glow-lg
  `,
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  type = 'button',
}) => {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      className={`
        relative inline-flex items-center justify-center
        font-semibold transition-all duration-300
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {/* Shimmer effect on hover */}
      <span className="absolute inset-0 overflow-hidden rounded-xl">
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
      </span>

      {/* Content */}
      <span className="relative flex items-center gap-2">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          icon && iconPosition === 'left' && icon
        )}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </span>
    </motion.button>
  );
};

// ===== Icon Button =====
interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
  className?: string;
}

const iconSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  tooltip,
  className = '',
}) => {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.9 } : undefined}
      title={tooltip}
      className={`
        relative inline-flex items-center justify-center
        rounded-xl transition-all duration-300
        ${variants[variant]}
        ${iconSizes[size]}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
    </motion.button>
  );
};

// ===== Toggle Button =====
interface ToggleButtonProps {
  isOn: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const toggleSizes = {
  sm: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
  md: { track: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' },
  lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
};

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onToggle,
  disabled = false,
  size = 'md',
  label,
}) => {
  const sizeConfig = toggleSizes[size];

  return (
    <div className="flex items-center gap-3">
      <motion.button
        onClick={onToggle}
        disabled={disabled}
        className={`
          relative ${sizeConfig.track} rounded-full
          transition-colors duration-300
          ${isOn 
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-glow-emerald' 
            : 'bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <motion.div
          animate={{ x: isOn ? 24 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`
            absolute top-0.5 ${sizeConfig.thumb} rounded-full
            bg-white shadow-lg
          `}
        />
      </motion.button>
      {label && (
        <span className={`text-sm font-medium ${isOn ? 'text-emerald-400' : 'text-gray-400'}`}>
          {label}
        </span>
      )}
    </div>
  );
};

// ===== Floating Action Button =====
interface FABProps {
  icon: React.ReactNode;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'primary' | 'success' | 'danger';
}

const fabPositions = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'top-right': 'top-6 right-6',
  'top-left': 'top-6 left-6',
};

const fabVariants = {
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 shadow-glow',
  success: 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-glow-emerald',
  danger: 'bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]',
};

export const FAB: React.FC<FABProps> = ({
  icon,
  onClick,
  position = 'bottom-right',
  variant = 'primary',
}) => {
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`
        fixed ${fabPositions[position]} z-50
        w-14 h-14 rounded-full
        flex items-center justify-center
        text-white ${fabVariants[variant]}
        transition-shadow duration-300
      `}
    >
      {icon}
    </motion.button>
  );
};

export default AnimatedButton;
