/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configuración de webpack para resolver paths y optimizar animaciones
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    
    // Optimizaciones para Framer Motion en producción
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'framer-motion': 'framer-motion/dist/framer-motion',
      };
    }
    
    return config;
  },
  
  // Configuración experimental para mejorar animaciones
  experimental: {
    serverComponentsExternalPackages: [],
    optimizeCss: true,
    scrollRestoration: true,
  },
  
  // Configuración del compilador para optimizar animaciones
  compiler: {
    // Remover console.log en producción pero mantener animaciones
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // Configuración de imágenes
  images: {
    domains: ['localhost', '127.0.0.1', '178.156.179.129'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8080',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '178.156.179.129',
        port: '8080',
        pathname: '/media/**',
      }
    ],
  },
  
  // Configuración de headers para CORS y animaciones
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // Headers para mejorar animaciones
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Configuración de rewrites para API
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${apiUrl}/media/:path*`,
      },
    ];
  },
  
  // Configuración de output para producción optimizada
  output: 'standalone',
  
  // Configuración de compresión
  compress: true,
  
  // Configuración de trailing slash
  trailingSlash: false,
  
  // Configuración de poweredByHeader
  poweredByHeader: false,
  
  // Optimizaciones adicionales para animaciones
  swcMinify: true,
  
  // Configuración de páginas estáticas
  generateEtags: false,
  
  // Configuración de desarrollo para animaciones suaves
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
};

module.exports = nextConfig;