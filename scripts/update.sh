#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
cd "$root"

stage 'ACTUALIZACIÓN SEGURA'
explain 'Primero crearemos una copia de seguridad. Tu .env, sesiones y datos no se borrarán.'
[[ -z "$(git status --porcelain)" ]] || die "Hay archivos modificados manualmente. No se actualizó nada para evitar perderlos. Guarda esos cambios en Git y vuelve a intentarlo."

info "Protegiendo tus datos antes de actualizar..."
"$SCRIPT_DIR/backup.sh" >/dev/null
branch="$(git branch --show-current)"
[[ -n "$branch" ]] || die "Git está en detached HEAD; selecciona una rama antes de actualizar."
info "Buscando una versión nueva en la rama $branch..."
git fetch origin "$branch"
git merge --ff-only "origin/$branch" || die "La rama local se separó de origin/$branch; actualización cancelada sin sobrescribir archivos."

npm_install_dependencies "$root"
ok "OguriCap Bot quedó actualizado y tus datos se conservaron."
