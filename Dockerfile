# Dockerfile para WhatsApp Bot
FROM node:20-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    wget \
    curl

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p Sessions storage/media logs

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Comando de inicio
CMD ["node", "index.js"]
