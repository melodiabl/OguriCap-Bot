/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configuración de webpack para resolver paths
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    
    return config;
  },
  
  // Configuración experimental básica
  experimental: {
    serverComponentsExternalPackages: [],
  },
  
  // Configuración para Docker (standalone output)
  output: 'standalone',
  
  // Configuración del compilador
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // Configuración de imágenes
  images: {
    domains: ['localhost', '127.0.0.1', 'melodiaauris.qzz.io'],
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
        protocol: 'https',
        hostname: 'melodiaauris.qzz.io',
        port: '',
        pathname: '/media/**',
      }
    ],
  },
  
  // Configuración de rewrites para API
  async rewrites() {
    // En producción con Docker, las rutas API van directamente a nginx
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    
    // Solo en desarrollo, redirigir a localhost:8080
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
  
  // Configuración básica de producción
  compress: true,
  trailingSlash: false,
  poweredByHeader: false,
  swcMinify: true,
  generateEtags: false,
};

module.exports = nextConfig;
