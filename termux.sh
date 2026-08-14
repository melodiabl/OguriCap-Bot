#!/data/data/com.termux/files/usr/bin/bash
# Entrada compatible con la documentación histórica.
# El instalador compartido detecta Termux o Linux automáticamente.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if (( $# == 0 )); then set -- install; fi
exec bash "$SCRIPT_DIR/oguricap.sh" "$@"
