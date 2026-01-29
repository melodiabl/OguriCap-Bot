# Dockerfile para WhatsApp Bot
FROM node:20-alpine

RUN apk add --no-cache \
  git \
  ffmpeg \
  python3 \
  make \
  g++ \
  wget \
  curl \
  openjdk17-jre

ENV JAVA_HOME=/usr/lib/jvm/default-jvm
ENV PATH="$JAVA_HOME/bin:$PATH"

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p Sessions storage/media logs tmp

# ✅ Puerto real del servicio
EXPOSE 3001

# ✅ Healthcheck robusto (sin depender de localhost)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health | grep -qi "ok" || exit 1

CMD ["node", "index.js"]
