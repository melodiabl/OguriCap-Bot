#!/bin/bash

echo "🔒 Configurando SSL para OguriCap.ooguy.com..."

# Crear directorio para certificados
mkdir -p ./ssl

# Instalar certbot si no está instalado
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

# Detener nginx temporalmente
echo "⏹️ Deteniendo contenedores..."
docker-compose down

# Generar certificados SSL
echo "🔐 Generando certificados SSL..."
sudo certbot certonly --standalone \
    --preferred-challenges http \
    -d OguriCap.ooguy.com \
    --email admin@ooguy.com \
    --agree-tos \
    --non-interactive

# Copiar certificados al directorio del proyecto
echo "📋 Copiando certificados..."
sudo cp /etc/letsencrypt/live/OguriCap.ooguy.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/OguriCap.ooguy.com/privkey.pem ./ssl/
sudo chown $USER:$USER ./ssl/*.pem

# Actualizar configuración de nginx con certificados
echo "⚙️ Actualizando configuración de nginx..."
sed -i 's|# ssl_certificate /path/to/certificate.crt;|ssl_certificate /etc/nginx/ssl/fullchain.pem;|g' nginx/default.conf
sed -i 's|# ssl_certificate_key /path/to/private.key;|ssl_certificate_key /etc/nginx/ssl/privkey.pem;|g' nginx/default.conf

# Actualizar docker-compose para montar certificados
cat >> docker-compose.yml << 'EOF'
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
EOF

echo "🚀 Reiniciando contenedores con SSL..."
docker-compose up -d --build

echo "✅ SSL configurado correctamente!"
echo "🌐 El sitio ahora está disponible en: https://OguriCap.ooguy.com"
echo ""
echo "📝 Para renovar certificados automáticamente, agrega esto al crontab:"
echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx"