/** @type {import('next').NextConfig} */
const safeParseUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

const parsedApiUrl = safeParseUrl(process.env.NEXT_PUBLIC_API_URL || process.env.PANEL_URL || '')
const apiHostname = parsedApiUrl?.hostname || null
const apiProtocol = parsedApiUrl?.protocol ? parsedApiUrl.protocol.replace(':', '') : null
const apiPort = parsedApiUrl?.port || ''

const imageDomains = ['localhost', '127.0.0.1']
if (apiHostname && !imageDomains.includes(apiHostname)) imageDomains.push(apiHostname)

const remotePatterns = [
  {
    protocol: 'http',
    hostname: 'localhost',
    port: apiHostname === 'localhost' && apiProtocol === 'http' && apiPort ? apiPort : '8080',
    pathname: '/media/**',
  },
  {
    protocol: 'http',
    hostname: '127.0.0.1',
    port: apiHostname === '127.0.0.1' && apiProtocol === 'http' && apiPort ? apiPort : '8080',
    pathname: '/media/**',
  },
]

if (apiHostname && !['localhost', '127.0.0.1'].includes(apiHostname) && apiProtocol) {
  remotePatterns.push({
    protocol: apiProtocol,
    hostname: apiHostname,
    port: apiPort,
    pathname: '/media/**',
  })
}

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
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
    domains: imageDomains,
    remotePatterns,
    // Deshabilitar optimización para archivos locales en /media/
    unoptimized: true,
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
