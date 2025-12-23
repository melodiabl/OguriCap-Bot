# Dockerfile para Next.js - Optimizado para Docker
# Ubicación: frontend-next/Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de Next.js
RUN npm run build

# Etapa de producción
FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Copiar build desde la etapa anterior
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 🔥 CRÍTICO: Exponer puerto y escuchar en 0.0.0.0
EXPOSE 3000

# 🔥 IMPORTANTE: Comando para iniciar Next.js en producción
CMD ["npm", "start"]
