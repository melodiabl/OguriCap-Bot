// Configuración en tiempo de ejecución para el frontend
export const RUNTIME_CONFIG = {
  // URL base de la API - usar variable de entorno o fallback al mismo origen
  // Usamos base relativa para que Caddy proxyee /api → backend:3001 sin CORS
  API_BASE_URL: import.meta.env.VITE_API_URL || '',

  // Configuración de la aplicación
  APP_NAME: 'WhatsApp Bot Panel',
  APP_VERSION: '1.0.0',

  // Configuración de features
  ENABLE_ANALYTICS: false,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_REAL_TIME: true,
};
