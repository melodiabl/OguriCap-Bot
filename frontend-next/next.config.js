/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  sw: 'sw.js',
  customWorkerSrc: 'worker',
  fallbacks: {
    document: '/offline',
  },
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^\/api\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
        },
      },
      {
        urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|avif|ico)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'image-cache',
          expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: /\.(js|css|woff2?)$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-cache',
          expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
    ],
  },
});

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    return config;
  },

  experimental: {
    serverComponentsExternalPackages: [],
  },

  output: 'standalone',

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns,
  },

  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/media/:path*', destination: `${apiUrl}/media/:path*` },
    ];
  },

  compress: true,
  trailingSlash: false,
  poweredByHeader: false,
  swcMinify: true,
  generateEtags: false,
};

module.exports = withPWA(nextConfig);
