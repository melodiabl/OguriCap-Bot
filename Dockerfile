# Dockerfile para WhatsApp Bot
FROM node:20-alpine

RUN apk add --no-cache \
  git \
  ffmpeg \
  python3 \
  py3-pip \
  make \
  g++ \
  wget \
  curl

# Instalar yt-dlp para descarga de anime
RUN pip3 install --no-cache-dir yt-dlp || \
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
