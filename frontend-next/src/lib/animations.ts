// Configuración de animaciones optimizada para producción

export const animationConfig = {
  // Configuración base para todas las animaciones
  default: {
    duration: 0.3,
    ease: "easeOut"
  },
  
  // Animaciones de entrada
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: "easeOut" }
  },
  
  // Animaciones de lista (stagger)
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  },
  
  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  // Animaciones de hover
  hover: {
    scale: 1.02,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  
  tap: {
    scale: 0.98,
    transition: { duration: 0.1, ease: "easeOut" }
  },
  
  // Animaciones de modal
  modal: {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
    transition: { duration: 0.2, ease: "easeOut" }
  },
  
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },
  
  // Animaciones de notificación
  notification: {
    initial: { opacity: 0, x: 100, scale: 0.95 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 100, scale: 0.95 },
    transition: { duration: 0.3, ease: "easeOut" }
  }
};

// Función para crear animaciones con delay
export const withDelay = (animation: any, delay: number) => ({
  ...animation,
  transition: {
    ...animation.transition,
    delay
  }
});

// Función para deshabilitar animaciones en producción si es necesario
export const getAnimation = (animationName: keyof typeof animationConfig, forceDisable = false) => {
  if (forceDisable || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    return {
      initial: {},
      animate: {},
      transition: { duration: 0 }
    };
  }
  
  return animationConfig[animationName];
};

// Configuración de Framer Motion optimizada para producción
export const motionConfig = {
  // Reducir el número de re-renders
  layoutDependency: false,
  
  // Optimizar animaciones para dispositivos de bajo rendimiento
  reducedMotion: "user",
  
  // Configuración de spring optimizada
  spring: {
    type: "spring",
    damping: 25,
    stiffness: 120,
    mass: 1
  },
  
  // Configuración de easing optimizada
  easing: {
    ease: [0.25, 0.1, 0.25, 1],
    easeIn: [0.4, 0, 1, 1],
    easeOut: [0, 0, 0.2, 1],
    easeInOut: [0.4, 0, 0.2, 1]
  }
};

export default animationConfig;