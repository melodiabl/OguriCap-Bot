#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

if grep -Eq '^OGURI_WEB_ENABLED="?1"?$' .env; then
  explain 'Prepararemos la página privada desde la que controlarás el bot.'
  info "Instalando el panel web; puede tardar varios minutos..."
  npm_install_dependencies "$root/frontend-next" install
  npm --prefix frontend-next run build
  ok "Panel web preparado."
else
  info "Elegiste no usar el panel web. El bot funcionará normalmente sin él."
fi
