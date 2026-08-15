#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

stage 'INICIANDO OGURICAP BOT'
explain 'Mantén esta terminal abierta mientras quieras que el bot funcione.'
has node || die "Falta Node.js. Abre 'npm run manager' y elige la opción 1."
(( $(node_major) >= OGURI_MIN_NODE_MAJOR )) || die "Se requiere Node.js $OGURI_MIN_NODE_MAJOR o superior."
[[ -d node_modules ]] || die "La instalación no está completa. Abre 'npm run manager' y elige la opción 1."

if [[ "$(detect_platform)" == termux ]] && has termux-wake-lock; then
  termux-wake-lock || warn "No se pudo activar el wake lock."
fi

mkdir -p Sessions/Principal Sessions/SubBot backups logs storage tmp
[[ -f .env ]] || die "Falta la configuración. Abre 'npm run manager' y elige la opción 1."
web_enabled="$(sed -n 's/^OGURI_WEB_ENABLED=[\"'\"']\?\([^\"'\"']*\)[\"'\"']\?$/\1/p' .env | tail -n 1)"
[[ "$web_enabled" == 0 ]] || web_enabled=1

panel_pid=""
cleanup() {
  [[ -z "$panel_pid" ]] || kill "$panel_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ "$web_enabled" == 1 && -d frontend-next/.next ]]; then
  info "Iniciando panel web en http://127.0.0.1:3000..."
  npm --prefix frontend-next start &
  panel_pid=$!
elif [[ "$web_enabled" == 1 ]]; then
  die "El panel aún no está preparado. Abre 'npm run manager' y elige la opción 1."
else
  info "Panel web deshabilitado en .env."
fi

info "Iniciando OguriCap-Bot en http://127.0.0.1:3001..."
npm start
