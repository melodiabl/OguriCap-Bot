#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

stage 'CREANDO COPIA DE SEGURIDAD'
explain 'Guardaremos configuración, sesiones y datos. El código y las dependencias no se duplicarán.'

output_dir="${OGURI_BACKUP_DIR:-$root/backups}"
mkdir -p "$output_dir"
stamp="$(date +%Y%m%d_%H%M%S)"
archive="$output_dir/oguricap-data_$stamp.tar.gz"
items=()
for item in .env database.json settings.js Sessions storage .config; do
  [[ -e "$item" ]] && items+=("$item")
done
(( ${#items[@]} > 0 )) || die "No se encontraron datos para respaldar."

tar -czf "$archive" --exclude='Sessions/*/logs' "${items[@]}"
ok 'Copia de seguridad terminada.'
printf '   Archivo: %s\n' "$archive"
printf '   Guárdalo en un lugar seguro si vas a cambiar de dispositivo.\n'
