# Multi-stage build para Next.js
FROM node:20-alpine AS deps

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm ci

# ============================================
# Builder stage
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Argumentos de build
ARG NEXT_PUBLIC_API_URL=https://melodiaauris.qzz.io
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copiar dependencias desde deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build de Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================
# Runner stage
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar wget para healthcheck
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos necesarios
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar archivos del servidor necesarios para Server Actions
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./.next/server

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
