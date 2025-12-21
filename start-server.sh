#!/bin/bash

# 🚀 Script de inicio rápido para OguriCap Bot + Panel Next.js
# Uso: ./start-server.sh [production|development]

set -e

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Verificar si PM2 está instalado
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 no está instalado"
        print_status "Instalando PM2..."
        npm install -g pm2
        print_success "PM2 instalado"
    fi
}

# Verificar dependencias
check_dependencies() {
    print_status "Verificando dependencias..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado"
        exit 1
    fi
    
    # Verificar npm
    if ! command -v npm &> /dev/null; then
        print_error "npm no está instalado"
        exit 1
    fi
    
    print_success "Dependencias verificadas"
}

# Instalar dependencias si es necesario
install_dependencies() {
    print_status "Instalando dependencias del bot..."
    npm install
    
    if [ -d "frontend-next" ]; then
        print_status "Instalando dependencias del panel Next.js..."
        cd frontend-next && npm install && cd ..
    else
        print_error "Directorio frontend-next no encontrado"
        exit 1
    fi
    
    print_success "Dependencias instaladas"
}

# Construir panel Next.js
build_panel() {
    print_status "Construyendo panel Next.js..."
    cd frontend-next && npm run build && cd ..
    print_success "Panel construido"
}

# Crear directorios necesarios
create_directories() {
    print_status "Creando directorios necesarios..."
    mkdir -p logs storage/media tmp Sessions
    print_success "Directorios creados"
}

# Configurar variables de entorno
setup_env() {
    if [ ! -f .env ]; then
        print_status "Creando archivo .env..."
        cat > .env << EOF
# Configuración del Bot
NODE_ENV=production
PORT=3001
PANEL_PORT=3001
SERVER_IP=178.156.179.129

# Configuración del Panel Next.js
NEXT_PUBLIC_API_URL=http://178.156.179.129:3001

# Configuración del Panel de Administración
PANEL_API_KEY=your-secret-api-key-$(date +%s)
PANEL_ADMIN_USER=admin
PANEL_ADMIN_PASS=admin123
PANEL_ADMIN_ROLE=owner

# Configuración de la base de datos
DB_PATH=./database.json

# Configuración de logs
LOG_LEVEL=info

# Configuración de WhatsApp
WA_AUTO_RECONNECT=true
WA_MAX_RECONNECT_ATTEMPTS=5

# Configuración de multimedia
MAX_FILE_SIZE=10485760
EOF
        print_success "Archivo .env creado"
        print_warning "¡Edita el archivo .env con tus configuraciones!"
    fi
}

# Iniciar servicios
start_services() {
    local env_mode=${1:-production}
    
    print_status "Iniciando servicios en modo $env_mode..."
    
    # Detener servicios existentes si están corriendo
    pm2 delete ecosystem.config.js 2>/dev/null || true
    
    # Iniciar servicios
    if [ "$env_mode" = "production" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start ecosystem.config.js
    fi
    
    # Guardar configuración de PM2
    pm2 save
    
    print_success "Servicios iniciados"
}

# Mostrar información de acceso
show_access_info() {
    print_success "🎉 ¡Servicios iniciados correctamente!"
    echo ""
    echo "📊 Panel de Administración:"
    echo "   Local:    http://localhost:3000"
    echo "   Público:  http://178.156.179.129:3000"
    echo ""
    echo "🤖 API del Bot:"
    echo "   Local:    http://localhost:3001"
    echo "   Público:  http://178.156.179.129:3001"
    echo ""
    echo "📋 Comandos útiles:"
    echo "   Ver logs:     pm2 logs"
    echo "   Ver estado:   pm2 status"
    echo "   Reiniciar:    pm2 restart all"
    echo "   Parar:        pm2 stop all"
    echo ""
    print_warning "Credenciales por defecto: admin / admin123"
    print_warning "¡Cambia las credenciales en el archivo .env!"
    print_warning "¡Asegúrate de que los puertos 3000 y 3001 estén abiertos en el firewall!"
}

# Función principal
main() {
    local mode=${1:-production}
    
    print_status "🚀 Iniciando OguriCap Bot + Panel Next.js..."
    
    check_dependencies
    check_pm2
    create_directories
    setup_env
    
    # Solo instalar/construir si no existe node_modules
    if [ ! -d "node_modules" ] || [ ! -d "frontend-next/node_modules" ]; then
        install_dependencies
    fi
    
    # Solo construir si no existe el build
    if [ ! -d "frontend-next/.next" ]; then
        build_panel
    fi
    
    start_services "$mode"
    show_access_info
}

# Verificar argumentos
case "${1:-}" in
    "production"|"prod")
        main "production"
        ;;
    "development"|"dev")
        main "development"
        ;;
    "help"|"-h"|"--help")
        echo "Uso: $0 [production|development]"
        echo ""
        echo "Opciones:"
        echo "  production   Iniciar en modo producción (por defecto)"
        echo "  development  Iniciar en modo desarrollo"
        echo "  help         Mostrar esta ayuda"
        exit 0
        ;;
    "")
        main "production"
        ;;
    *)
        print_error "Modo desconocido: $1"
        echo "Usa: $0 help para ver las opciones disponibles"
        exit 1
        ;;
esac