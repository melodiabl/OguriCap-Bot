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
owner_number="$(env_value BOT_OWNER)"
web_enabled="$(env_value OGURI_WEB_ENABLED)"
[[ "$web_enabled" == 0 ]] || web_enabled=1

if [[ -t 0 && "${OGURI_NON_INTERACTIVE:-0}" != 1 ]]; then
  printf 'Usuario administrador del panel [%s]: ' "$admin_user"
  read -r answer
  [[ -z "$answer" ]] || admin_user="$answer"
  printf 'Número owner con código de país, solo dígitos [%s]: ' "${owner_number:-omitir}"
  read -r answer
  [[ -z "$answer" ]] || owner_number="${answer//[^0-9]/}"
  printf '¿Habilitar el panel web? [S/n]: '
  read -r answer
  case "${answer,,}" in n|no) web_enabled=0 ;; *) web_enabled=1 ;; esac
  printf 'Contraseña del panel (vacío = generar una segura): '
  read -rs admin_password
  printf '\n'
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
set_env NODE_ENV production
set_env PANEL_HOST 0.0.0.0
set_env PANEL_PORT 3001
set_env PANEL_URL "${OGURI_PANEL_URL:-http://127.0.0.1:3001}"
set_env CORS_ORIGIN "${OGURI_CORS_ORIGIN:-http://localhost:3000,http://127.0.0.1:3000}"
set_env TURNSTILE_DISABLED "${OGURI_TURNSTILE_DISABLED:-1}"
set_env OGURI_WEB_ENABLED "$web_enabled"
set_env POSTGRES_HOST "${OGURI_POSTGRES_HOST:-127.0.0.1}"
set_env POSTGRES_SSL false
set_env POSTGRES_SSL_REJECT_UNAUTHORIZED false
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

ok "Configuración segura preparada en .env."
printf 'Usuario del panel: %s\n' "$admin_user"
printf 'Contraseña del panel: %s\n' "$admin_password"
printf 'Panel web: %s\n' "$([[ "$web_enabled" == 1 ]] && echo habilitado || echo deshabilitado)"
warn "Guarda esa contraseña. El archivo .env no se publica en Git."
