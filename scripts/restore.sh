#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
archive="${1:-}"
[[ -n "$archive" ]] || die "Uso: ./oguricap.sh restore backups/oguricap-data_FECHA.tar.gz"
[[ -f "$archive" ]] || die "No existe el respaldo: $archive"
tar -tzf "$archive" >/dev/null || die "El archivo no es un respaldo tar.gz válido."
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  die "El respaldo contiene rutas inseguras."
fi

printf 'Esto sobrescribirá los datos incluidos en el respaldo. Escribe RESTAURAR para continuar: '
read -r answer
[[ "$answer" == RESTAURAR ]] || die "Restauración cancelada."
cd "$root"
"$SCRIPT_DIR/backup.sh"
tar -xzf "$archive" -C "$root"
ok "Datos restaurados. Reinicia el bot."
