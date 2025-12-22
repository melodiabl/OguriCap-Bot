'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimationWrapperProps {
  children: React.ReactNode;
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  className?: string;
  delay?: number;
  disabled?: boolean;
}

export const AnimationWrapper: React.FC<AnimationWrapperProps> = ({
  children,
  initial = { opacity: 0, y: 20 },
  animate = { opacity: 1, y: 0 },
  exit,
  transition = { duration: 0.3 },
  className,
  delay = 0,
  disabled = false
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Pequeño delay para asegurar que la hidratación esté completa
    const timer = setTimeout(() => {
      setShouldAnimate(true);
    }, 50 + (delay * 1000));

    return () => clearTimeout(timer);
  }, [delay]);

  // Si las animaciones están deshabilitadas o no está montado, renderizar sin animación
  if (disabled || !isMounted || !shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={{
        ...transition,
        delay: delay
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
}> = ({ children, delay = 0, className, disabled = false }) => (
  <AnimationWrapper
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    delay={delay}
    className={className}
    disabled={disabled}
  >
    {children}
  </AnimationWrapper>
);

export const SlideUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
}> = ({ children, delay = 0, className, disabled = false }) => (
  <AnimationWrapper
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    delay={delay}
    className={className}
    disabled={disabled}
  >
    {children}
  </AnimationWrapper>
);

export const SlideIn: React.FC<{
  children: React.ReactNode;
  direction?: 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
}> = ({ children, direction = 'left', delay = 0, className, disabled = false }) => (
  <AnimationWrapper
    initial={{ opacity: 0, x: direction === 'left' ? -30 : 30 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    delay={delay}
    className={className}
    disabled={disabled}
  >
    {children}
  </AnimationWrapper>
);

export const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
}> = ({ children, delay = 0, className, disabled = false }) => (
  <AnimationWrapper
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    delay={delay}
    className={className}
    disabled={disabled}
  >
    {children}
  </AnimationWrapper>
);

// Hook para detectar si estamos en producción y deshabilitar animaciones si es necesario
export const useAnimations = () => {
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useEffect(() => {
    // Detectar si el usuario prefiere reducir las animaciones
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Detectar si estamos en un dispositivo de bajo rendimiento
    const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    
    // Deshabilitar animaciones si el usuario lo prefiere o si es un dispositivo de bajo rendimiento
    if (prefersReducedMotion || isLowEndDevice) {
      setAnimationsEnabled(false);
    }
  }, []);

  return { animationsEnabled };
};

export default AnimationWrapper;