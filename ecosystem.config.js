module.exports = {
  apps: [
    // 🤖 Bot principal de WhatsApp
    {
      name: 'oguri-bot',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      
      // Sin limitaciones de memoria (tienes 2GB RAM)
      max_memory_restart: '1G',
      
      // Variables de entorno
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        PANEL_PORT: 3001,
        SERVER_IP: '178.156.179.129'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        PANEL_PORT: 3001,
        SERVER_IP: '178.156.179.129'
      },
      
      // Configuración de logs
      log_file: './logs/bot-combined.log',
      out_file: './logs/bot-out.log',
      error_file: './logs/bot-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Configuración de reinicio
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      
      // Configuración adicional
      kill_timeout: 5000,
      listen_timeout: 3000,
      merge_logs: true,
      time: true,
      
      // Ignorar archivos para watch
      ignore_watch: [
        'node_modules',
        'logs',
        'Sessions',
        'storage',
        'tmp',
        '.git',
        'frontend-next',
        'frontend-panel'
      ]
    },

    // 🎨 Panel Next.js (Acceso Público)
    {
      name: 'oguri-panel-next',
      script: 'npm',
      args: 'start',
      cwd: './frontend-next',
      instances: 1,
      exec_mode: 'fork',
      
      // Sin limitaciones de memoria (tienes 2GB RAM)
      max_memory_restart: '800M',
      
      // Variables de entorno
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_API_URL: 'http://178.156.179.129',
        SERVER_IP: '178.156.179.129'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_API_URL: 'http://178.156.179.129',
        SERVER_IP: '178.156.179.129'
      },
      
      // Configuración de logs
      log_file: './logs/panel-next-combined.log',
      out_file: './logs/panel-next-out.log',
      error_file: './logs/panel-next-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Configuración de reinicio
      autorestart: true,
      watch: false,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 3000,
      
      // Configuración adicional
      kill_timeout: 5000,
      merge_logs: true,
      time: true,
      
      // Solo iniciar si existe el directorio
      ignore_watch: ['node_modules', '.next', 'logs']
    }
  ]
};