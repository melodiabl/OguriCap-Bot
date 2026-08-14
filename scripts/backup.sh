#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

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
ok "Respaldo creado: $archive"
