# Dockerfile para el Bot de WhatsApp (Node.js)
FROM node:20-slim

# Instalar dependencias del sistema necesarias + screen para interactividad
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    ffmpeg \
    screen \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copiar archivos de configuración y dependencias
COPY package.json package-lock.json ./
COPY settings.js ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# El bot usa el puerto 8080 por defecto para la API/Socket.io (si aplica)
EXPOSE 8080

# Comando de inicio: Usar screen para poder interactuar
CMD ["screen", "-S", "bot", "-dm", "npm", "run", "prod"]
