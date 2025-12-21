#!/bin/bash

# 🚀 Script de instalación automática para OguriCap Bot
# Compatible con Ubuntu, Debian, Alpine Linux, CentOS

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con colores
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detectar sistema operativo
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    print_status "Sistema detectado: $OS $VER"
}

# Actualizar sistema
update_system() {
    print_status "Actualizando sistema..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt update && apt upgrade -y
        apt install -y curl wget git build-essential python3 python3-pip
    elif [[ "$OS" == *"Alpine"* ]]; then
        apk update && apk upgrade
        apk add curl wget git build-base python3 py3-pip nodejs npm
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum update -y
        yum groupinstall -y "Development Tools"
        yum install -y curl wget git python3 python3-pip
    fi
    
    print_success "Sistema actualizado"
}

# Instalar Node.js
install_nodejs() {
    print_status "Instalando Node.js 20 LTS..."
    
    if [[ "$OS" == *"Alpine"* ]]; then
        apk add nodejs npm
    else
        # Usar NodeSource para otras distribuciones
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
            apt-get install -y nodejs
        elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
            yum install -y nodejs npm
        fi
    fi
    
    # Verificar instalación
    node_version=$(node --version)
    npm_version=$(npm --version)
    print_success "Node.js $node_version y npm $npm_version instalados"
}

# Instalar PM2
install_pm2() {
    print_status "Instalando PM2..."
    npm install -g pm2
    
    # Configurar PM2 para inicio automático
    pm2 startup
    print_success "PM2 instalado y configurado"
}

# Instalar FFmpeg (para multimedia)
install_ffmpeg() {
    print_status "Instalando FFmpeg..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt install -y ffmpeg
    elif [[ "$OS" == *"Alpine"* ]]; then
        apk add ffmpeg
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        # Instalar EPEL y RPM Fusion para FFmpeg
        yum install -y epel-release
        yum install -y https://download1.rpmfusion.org/free/el/rpmfusion-free-release-7.noarch.rpm
        yum install -y ffmpeg
    fi
    
    print_success "FFmpeg instalado"
}

# Configurar swap (para VPS con poca RAM)
setup_swap() {
    print_status "Configurando swap de 1GB..."
    
    # Verificar si ya existe swap
    if swapon --show | grep -q "/swapfile"; then
        print_warning "Swap ya existe, saltando..."
        return
    fi
    
    # Crear archivo de swap
    fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1024 count=1048576
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    
    # Hacer permanente
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Optimizar swappiness
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
    
    print_success "Swap configurado"
}

# Configurar firewall básico
setup_firewall() {
    print_status "Configurando firewall básico..."
    
    if command -v ufw >/dev/null 2>&1; then
        ufw --force enable
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 3001/tcp  # Puerto del panel
        print_success "UFW configurado"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-port=3001/tcp
        firewall-cmd --reload
        print_success "Firewalld configurado"
    else
        print_warning "No se encontró firewall, saltando configuración"
    fi
}

# Crear directorios necesarios
create_directories() {
    print_status "Creando directorios..."
    
    mkdir -p logs
    mkdir -p storage/media
    mkdir -p tmp
    mkdir -p Sessions
    
    # Permisos
    chmod 755 logs storage tmp Sessions
    
    print_success "Directorios creados"
}

# Instalar dependencias del bot
install_bot_dependencies() {
    print_status "Instalando dependencias del bot..."
    
    # Instalar dependencias principales
    npm install
    
    # Instalar dependencias de frontend si existen
    if [ -d "frontend-next" ]; then
        print_status "Instalando dependencias de Next.js..."
        cd frontend-next && npm install && cd ..
    fi
    
    if [ -d "frontend-panel" ]; then
        print_status "Instalando dependencias del panel..."
        cd frontend-panel && npm install && cd ..
    fi
    
    print_success "Dependencias instaladas"
}

# Construir frontends
build_frontends() {
    print_status "Construyendo frontends..."
    
    if [ -d "frontend-next" ]; then
        print_status "Construyendo Next.js..."
        cd frontend-next && npm run build && cd ..
    fi
    
    if [ -d "frontend-panel" ]; then
        print_status "Construyendo panel..."
        cd frontend-panel && npm run build && cd ..
    fi
    
    print_success "Frontends construidos"
}

# Configurar variables de entorno
setup_env() {
    print_status "Configurando variables de entorno..."
    
    if [ ! -f .env ]; then
        cat > .env << EOF
# Configuración del Bot
NODE_ENV=production
PORT=3001
PANEL_PORT=3001

# Configuración del Panel
PANEL_API_KEY=your-secret-api-key-here
PANEL_ADMIN_USER=admin
PANEL_ADMIN_PASS=admin123
PANEL_ADMIN_ROLE=owner

# Configuración de la base de datos
DB_PATH=./database.json

# Configuración de logs
LOG_LEVEL=info
LOG_FILE=./logs/bot.log

# Configuración de memoria
MAX_OLD_SPACE_SIZE=512
MEMORY_LIMIT=400

# Configuración de WhatsApp
WA_SESSION_PATH=./Sessions
WA_AUTO_RECONNECT=true
WA_MAX_RECONNECT_ATTEMPTS=5

# Configuración de multimedia
MEDIA_PATH=./storage/media
MAX_FILE_SIZE=10485760

# Configuración de seguridad
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF
        print_success "Archivo .env creado"
        print_warning "¡IMPORTANTE! Edita el archivo .env con tus configuraciones"
    else
        print_warning "Archivo .env ya existe, no se sobrescribió"
    fi
}

# Configurar servicio systemd (alternativa a PM2)
setup_systemd() {
    print_status "Configurando servicio systemd..."
    
    cat > /etc/systemd/system/oguri-bot.service << EOF
[Unit]
Description=OguriCap WhatsApp Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_PATH=/usr/lib/node_modules
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=oguri-bot

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable oguri-bot
    
    print_success "Servicio systemd configurado"
    print_status "Usa: systemctl start oguri-bot para iniciar"
}

# Optimizar sistema para VPS pequeños
optimize_system() {
    print_status "Optimizando sistema para VPS pequeño..."
    
    # Configurar límites de memoria
    echo '* soft nofile 65536' >> /etc/security/limits.conf
    echo '* hard nofile 65536' >> /etc/security/limits.conf
    
    # Optimizar kernel
    cat >> /etc/sysctl.conf << EOF
# Optimizaciones para VPS pequeño
vm.overcommit_memory=1
net.core.somaxconn=65535
net.ipv4.tcp_max_syn_backlog=65535
net.core.netdev_max_backlog=5000
EOF
    
    sysctl -p
    
    print_success "Sistema optimizado"
}

# Función principal
main() {
    print_status "🚀 Iniciando instalación de OguriCap Bot..."
    
    # Verificar si se ejecuta como root
    if [[ $EUID -ne 0 ]]; then
        print_error "Este script debe ejecutarse como root"
        exit 1
    fi
    
    detect_os
    update_system
    install_nodejs
    install_pm2
    install_ffmpeg
    setup_swap
    setup_firewall
    create_directories
    install_bot_dependencies
    build_frontends
    setup_env
    optimize_system
    
    print_success "🎉 ¡Instalación completada!"
    print_status "Próximos pasos:"
    echo "1. Edita el archivo .env con tus configuraciones"
    echo "2. Inicia el bot con: npm run pm2:start"
    echo "3. Monitorea con: npm run pm2:logs"
    echo "4. Panel disponible en: http://tu-ip:3001"
    
    print_warning "¡No olvides cambiar las credenciales por defecto!"
}

# Ejecutar función principal
main "$@"