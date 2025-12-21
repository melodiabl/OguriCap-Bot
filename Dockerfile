# Dockerfile para OguriCap Bot - Optimizado para producción
FROM node:20-alpine

# Información del mantenedor
LABEL maintainer="melodiabl"
LABEL description="OguriCap WhatsApp Bot with Admin Panel"
LABEL version="1.8.2"

# Instalar dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S oguri -u 1001

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY ecosystem.config.js ./

# Instalar dependencias
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código fuente
COPY --chown=oguri:nodejs . .

# Crear directorios necesarios
RUN mkdir -p logs storage/media tmp Sessions && \
    chown -R oguri:nodejs logs storage tmp Sessions

# Construir frontends si existen
RUN if [ -d "frontend-next" ]; then \
        cd frontend-next && \
        npm ci && \
        npm run build && \
        rm -rf node_modules && \
        cd ..; \
    fi

RUN if [ -d "frontend-panel" ]; then \
        cd frontend-panel && \
        npm ci && \
        npm run build && \
        rm -rf node_modules && \
        cd ..; \
    fi

# Cambiar a usuario no-root
USER oguri

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001
ENV PANEL_PORT=3001

# Comando de inicio
CMD ["node", "--max-old-space-size=512", "index.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"