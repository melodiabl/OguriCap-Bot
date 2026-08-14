#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

has node || die "Node.js no está instalado. Ejecuta ./oguricap.sh install."
(( $(node_major) >= OGURI_MIN_NODE_MAJOR )) || die "Se requiere Node.js $OGURI_MIN_NODE_MAJOR o superior."
[[ -d node_modules ]] || die "Faltan dependencias. Ejecuta ./oguricap.sh install."

if [[ "$(detect_platform)" == termux ]] && has termux-wake-lock; then
  termux-wake-lock || warn "No se pudo activar el wake lock."
fi

mkdir -p Sessions/Principal Sessions/SubBot backups logs storage tmp
info "Iniciando OguriCap-Bot..."
exec npm start
