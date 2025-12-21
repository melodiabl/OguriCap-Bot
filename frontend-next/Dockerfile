# Dockerfile para el Panel de Administración (Next.js)
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copiar archivos de configuración y dependencias
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar la aplicación Next.js
RUN npm run build

# Usar una imagen más pequeña para la fase de producción
FROM node:20-slim AS runner

WORKDIR /usr/src/app

# Instalar solo las dependencias de producción
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/package.json ./package.json

# Crear directorio public si no existe (opcional para Next.js)
RUN mkdir -p public

# El panel de Next.js se ejecuta por defecto en el puerto 3000
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
