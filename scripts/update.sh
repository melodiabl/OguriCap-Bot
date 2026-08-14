#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

[[ -z "$(git status --porcelain)" ]] || die "Hay cambios locales. Confírmalos con Git o guárdalos antes de actualizar; no se modificó nada."

info "Creando respaldo preventivo..."
"$SCRIPT_DIR/backup.sh" >/dev/null
branch="$(git branch --show-current)"
[[ -n "$branch" ]] || die "Git está en detached HEAD; selecciona una rama antes de actualizar."
info "Descargando la rama $branch..."
git fetch origin "$branch"
git merge --ff-only "origin/$branch" || die "La rama local se separó de origin/$branch; actualización cancelada sin sobrescribir archivos."

npm_install_dependencies "$root"
ok "OguriCap-Bot actualizado de forma segura."
