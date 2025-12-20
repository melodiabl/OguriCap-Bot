import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0', // Permitir acceso desde cualquier IP
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        'aditya-pilpulistic-malaysia.ngrok-free.dev',
        'oguri-frontend.loca.lt',
        'oguri-panel.loca.lt',
        'oguri-api.loca.lt',
        '.loca.lt',
        '.serveousercontent.com',
        '.ngrok.io',
        '.ngrok-free.dev'
      ],
      strictPort: true,
      hmr: {
        port: 5173,
        host: 'localhost'
      },
      watch: {
        usePolling: true,
        interval: 1000
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/media': {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['@chakra-ui/react', '@chakra-ui/icons']
          }
        }
      }
    },
    define: {
      'process.env': {}
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@chakra-ui/react', '@chakra-ui/icons']
    }
  }
})
