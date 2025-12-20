FROM node:20-alpine as build

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa de producción con Caddy
FROM caddy:2-alpine

# Copiar los archivos de la aplicación construida
COPY --from=build /app/dist /usr/share/caddy

# Copiar configuración de Caddy
COPY Caddyfile /etc/caddy/Caddyfile

# Exponer puerto
EXPOSE 80

# Comando de inicio
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
