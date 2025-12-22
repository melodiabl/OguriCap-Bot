# Dockerfile para el Panel de Administración (Next.js) - Optimizado para animaciones
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copiar archivos de configuración y dependencias
COPY package.json package-lock.json ./

# Instalar dependencias con optimizaciones
RUN npm ci --no-audit --no-fund

# Copiar el resto del código
COPY . .

# Variables de entorno para optimizar build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compilar la aplicación Next.js con optimizaciones para animaciones
RUN npm run build

# Usar una imagen más pequeña para la fase de producción
FROM node:20-slim AS runner

# Instalar curl para healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Variables de entorno para producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Instalar solo las dependencias de producción
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/next.config.js ./next.config.js

# Crear directorio public si no existe
RUN mkdir -p public

# El panel de Next.js se ejecuta por defecto en el puerto 3000
EXPOSE 3000

# Comando de inicio optimizado
CMD ["npm", "start"]
