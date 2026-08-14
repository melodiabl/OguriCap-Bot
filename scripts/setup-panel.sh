#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

if grep -Eq '^OGURI_WEB_ENABLED="?1"?$' .env; then
  info "Instalando y compilando el panel web..."
  if [[ -f frontend-next/package-lock.json ]]; then npm --prefix frontend-next ci
  else npm --prefix frontend-next install
  fi
  npm --prefix frontend-next run build
  ok "Panel web preparado."
else
  info "Panel web deshabilitado; se omite su instalación."
fi
