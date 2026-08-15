#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
archive="${1:-}"
[[ -n "$archive" ]] || die "Uso: ./oguricap.sh restore backups/oguricap-data_FECHA.tar.gz"
[[ -f "$archive" ]] || die "No existe el respaldo: $archive"
stage 'RECUPERAR UNA COPIA DE SEGURIDAD'
explain "Archivo seleccionado: $archive"
explain 'Primero comprobaremos el archivo y guardaremos el estado actual por seguridad.'
tar -tzf "$archive" >/dev/null || die "El archivo no es un respaldo tar.gz válido."
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  die "El respaldo contiene rutas inseguras."
fi

printf '\n⚠️  Los datos guardados reemplazarán sus versiones actuales.\n'
printf 'Para confirmar, escribe la palabra RESTAURAR: '
read -r answer
[[ "$answer" == RESTAURAR ]] || die "Restauración cancelada."
cd "$root"
"$SCRIPT_DIR/backup.sh"
tar -xzf "$archive" -C "$root"
ok "Datos recuperados correctamente."
printf '   Vuelve al menú y elige [3] para iniciar el bot.\n'
