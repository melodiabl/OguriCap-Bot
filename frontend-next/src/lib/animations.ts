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
  },
  
  // Animaciones de pulso y glow
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  glow: {
    animate: {
      boxShadow: [
        "0 0 20px rgba(99, 102, 241, 0.3)",
        "0 0 30px rgba(99, 102, 241, 0.6)",
        "0 0 20px rgba(99, 102, 241, 0.3)"
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  // Animaciones de carga
  loading: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }
    }
  },
  
  skeleton: {
    animate: {
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  // Animaciones de progreso
  progressBar: {
    initial: { width: 0 },
    animate: { width: "100%" },
    transition: { duration: 1, ease: "easeOut" }
  },
  
  // Animaciones de bounce
  bounce: {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
  
  // Animaciones de shake
  shake: {
    animate: {
      x: [0, -10, 10, -10, 10, 0],
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      }
    }
  },
  
  // Animaciones de flip
  flip: {
    animate: {
      rotateY: [0, 180],
      transition: {
        duration: 0.6,
        ease: "easeInOut"
      }
    }
  },
  
  // Animaciones de typewriter
  typewriter: {
    initial: { width: 0 },
    animate: { width: "100%" },
    transition: { duration: 2, ease: "steps(20, end)" }
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

// Animaciones específicas para componentes
export const componentAnimations = {
  card: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    whileHover: { y: -5, scale: 1.02 },
    transition: { duration: 0.3, ease: "easeOut" }
  },
  
  button: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: { duration: 0.1, ease: "easeOut" }
  },
  
  statCard: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    whileHover: { 
      y: -8, 
      boxShadow: "0 20px 40px rgba(0,0,0,0.1)" 
    },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  chart: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: "easeOut" }
  },
  
  sidebar: {
    initial: { x: -300, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -300, opacity: 0 },
    transition: { duration: 0.3, ease: "easeOut" }
  },
  
  dropdown: {
    initial: { opacity: 0, y: -10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95 },
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

export default animationConfig;