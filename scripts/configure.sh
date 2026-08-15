#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
env_file="$root/.env"

[[ -f "$env_file" ]] || cp "$root/.env.example" "$env_file"

random_hex() {
  if has openssl; then openssl rand -hex "${1:-32}"
  else node -e "console.log(require('crypto').randomBytes(${1:-32}).toString('hex'))"
  fi
}

env_value() {
  sed -n "s/^$1=[\"']\?\([^\"']*\)[\"']\?$/\1/p" "$env_file" | tail -n 1
}

set_env() {
  local key="$1" value="$2" escaped
  escaped="${value//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  if grep -q "^${key}=" "$env_file"; then
    local tmp_file
    tmp_file="$(mktemp)"
    awk -v key="$key" -v value="$escaped" 'BEGIN { done=0 } $0 ~ "^" key "=" { if (!done) print key "=\"" value "\""; done=1; next } { print }' "$env_file" > "$tmp_file"
    mv "$tmp_file" "$env_file"
  else
    printf '\n%s="%s"\n' "$key" "$escaped" >> "$env_file"
  fi
}

ensure_secret() {
  local key="$1" bytes="${2:-32}" current
  current="$(env_value "$key")"
  if [[ -z "$current" || "$current" == CHANGE_ME* || "$current" == your-* ]]; then
    set_env "$key" "$(random_hex "$bytes")"
  fi
}

admin_user="$(env_value PANEL_ADMIN_USER)"
[[ -n "$admin_user" ]] || admin_user=admin
bot_name="$(env_value BOT_NAME)"
[[ -n "$bot_name" && "$bot_name" != 'WhatsApp Bot Panel' ]] || bot_name='OguriCap Bot'
timezone="$(env_value TZ)"
[[ -n "$timezone" ]] || timezone=UTC
owner_number="$(env_value BOT_OWNER)"
web_enabled="$(env_value OGURI_WEB_ENABLED)"
[[ "$web_enabled" == 0 ]] || web_enabled=1

if [[ -t 0 && "${OGURI_NON_INTERACTIVE:-0}" != 1 ]]; then
  printf '\n╭──────────────────────────────────────────────╮\n'
  printf '│  ASISTENTE FÁCIL DE CONFIGURACIÓN            │\n'
  printf '╰──────────────────────────────────────────────╯\n'
  printf 'No necesitas conocimientos técnicos.\n'
  printf 'Cuando veas un valor entre [corchetes], pulsa Enter para usarlo.\n\n'

  printf 'PASO 1 DE 5 — Nombre del bot\n'
  printf 'Este nombre aparecerá en el panel y en algunos mensajes.\n'
  printf 'Nombre recomendado [%s]: ' "$bot_name"
  read -r answer
  [[ -z "$answer" ]] || bot_name="$answer"
  printf '\nPASO 2 DE 5 — Tu número de WhatsApp\n'
  printf 'Será el propietario (owner): podrá administrar el bot y usar comandos privados.\n'
  printf 'Escríbelo con código de país, sin +, espacios ni guiones.\n'
  printf 'Ejemplo: 5491123456789\n'
  while true; do
    if [[ -n "$owner_number" ]]; then
      printf 'Número owner [%s]: ' "$owner_number"
    else
      printf 'Número owner: '
    fi
    read -r answer
    if [[ -z "$answer" && -n "$owner_number" ]]; then
      break
    fi
    answer="${answer//[^0-9]/}"
    if [[ "$answer" =~ ^[0-9]{8,15}$ ]]; then
      owner_number="$answer"
      break
    fi
    warn 'Número no válido. Usa entre 8 y 15 dígitos, incluido el código del país.'
  done

  printf '\nPASO 3 DE 5 — Panel web\n'
  printf 'El panel es una página privada para controlar el bot desde el navegador.\n'
  printf '¿Quieres instalar y habilitar el panel? [S/n]: '
  read -r answer
  case "${answer,,}" in n|no) web_enabled=0 ;; *) web_enabled=1 ;; esac

  printf '\nPASO 4 DE 5 — Usuario para entrar al panel\n'
  printf 'No es tu número de WhatsApp. Es el nombre que escribirás al iniciar sesión.\n'
  printf 'Usuario recomendado [%s]: ' "$admin_user"
  read -r answer
  [[ -z "$answer" ]] || admin_user="$answer"

  printf '\nPASO 5 DE 5 — Contraseña del panel\n'
  printf 'Pulsa Enter y el instalador creará una contraseña segura automáticamente.\n'
  printf 'Si escribes una propia, no se mostrará en pantalla mientras la escribes.\n'
  printf 'Contraseña [generar automáticamente]: '
  read -rs admin_password
  printf '\n\nGracias. Preparando el resto de la configuración automáticamente...\n'
else
  admin_password=""
fi

current_password="$(env_value PANEL_ADMIN_PASS)"
if [[ -z "${admin_password:-}" ]]; then
  if [[ -z "$current_password" || "$current_password" == CHANGE_ME* || "$current_password" == your-* ]]; then
    admin_password="$(random_hex 12)"
  else
    admin_password="$current_password"
  fi
fi

set_env PANEL_ADMIN_USER "$admin_user"
set_env PANEL_ADMIN_PASS "$admin_password"
set_env PANEL_ADMIN_ROLE owner
set_env BOT_NAME "$bot_name"
set_env BOT_VERSION "$(node -p "require('$root/package.json').version" 2>/dev/null || printf '2.1.0')"
set_env TZ "${OGURI_TIMEZONE:-$timezone}"
set_env NODE_ENV production
set_env PANEL_HOST 0.0.0.0
set_env PANEL_PORT 3001
set_env PANEL_URL "${OGURI_PANEL_URL:-http://127.0.0.1:3001}"
set_env CORS_ORIGIN "${OGURI_CORS_ORIGIN:-http://localhost:3000,http://127.0.0.1:3000}"
set_env TURNSTILE_DISABLED "${OGURI_TURNSTILE_DISABLED:-1}"
set_env OGURI_WEB_ENABLED "$web_enabled"
set_env POSTGRES_HOST "${OGURI_POSTGRES_HOST:-127.0.0.1}"
set_env POSTGRES_PORT "${OGURI_POSTGRES_PORT:-5432}"
set_env POSTGRES_DB "${OGURI_POSTGRES_DB:-oguribot}"
set_env POSTGRES_USER "${OGURI_POSTGRES_USER:-bot_user}"
set_env POSTGRES_MAX_CONNECTIONS 20
set_env POSTGRES_SSL false
set_env POSTGRES_SSL_REJECT_UNAUTHORIZED false
set_env DATABASE_PATH ./database.json
set_env LOG_LEVEL info
set_env LOG_DIR ./logs
set_env BACKUP_DIR ./backups
set_env BACKUP_RETENTION_DAYS 30
set_env PANEL_SERVE_FRONTEND "$web_enabled"
set_env DEBUG false
set_env VERBOSE_LOGGING false
[[ -z "$owner_number" ]] || set_env BOT_OWNER "$owner_number"

ensure_secret JWT_SECRET 32
ensure_secret DB_ENCRYPTION_KEY 32
ensure_secret INTERNAL_BOT_SECRET 32
ensure_secret PANEL_API_KEY 24
ensure_secret PANEL_PASSWORD_ENC_KEY 32
ensure_secret BACKUP_ENCRYPTION_KEY 32
ensure_secret POSTGRES_PASSWORD 24

cat > "$root/frontend-next/.env.local" <<EOF
NEXT_PUBLIC_API_URL=${OGURI_PANEL_URL:-http://127.0.0.1:3001}
EOF
chmod 600 "$env_file" "$root/frontend-next/.env.local"

ok "Configuración segura preparada automáticamente."
printf '\nResumen de acceso\n'
printf '  Bot:         %s\n' "$bot_name"
printf '  Usuario web: %s\n' "$admin_user"
printf '  Contraseña:  %s\n' "$admin_password"
printf '  Panel web:   %s\n' "$([[ "$web_enabled" == 1 ]] && echo habilitado || echo deshabilitado)"
printf '  Config:      %s\n\n' "$env_file"
warn "Guarda la contraseña. Las claves se generaron solas y .env no se publica en Git."
