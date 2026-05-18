# Dockerfile para WhatsApp Bot
# node:20-slim (Debian) — necesario para compatibilidad glibc con el binario de Claude Code
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  ffmpeg \
  python3 \
  python3-pip \
  make \
  g++ \
  wget \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp para descarga de anime
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp || \
    wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN mkdir -p Sessions storage/media logs tmp

# ✅ Puerto real del servicio
EXPOSE 3001

# ✅ Healthcheck robusto (sin depender de localhost)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health | grep -qi "ok" || exit 1

CMD ["node", "index.js"]
