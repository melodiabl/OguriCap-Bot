/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configuración para acceso público
  experimental: {
    serverComponentsExternalPackages: [],
  },
  
  // Configuración de imágenes
  images: {
    domains: ['localhost', '127.0.0.1', '178.156.179.129'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '178.156.179.129',
        port: '3001',
        pathname: '/media/**',
      }
    ],
  },
  
  // Configuración de headers para CORS
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
        ],
      },
    ];
  },
  
  // Configuración de rewrites para API
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://178.156.179.129:3001';
    
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
  
  // Configuración de output para producción
  output: 'standalone',
  
  // Configuración de compresión
  compress: true,
  
  // Configuración de trailing slash
  trailingSlash: false,
  
  // Configuración de poweredByHeader
  poweredByHeader: false,
};

module.exports = nextConfig;