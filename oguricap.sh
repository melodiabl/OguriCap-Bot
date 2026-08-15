#!/usr/bin/env bash

set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  readonly C_RESET='\033[0m'
  readonly C_BOLD='\033[1m'
  readonly C_DIM='\033[2m'
  readonly C_PURPLE='\033[1;35m'
  readonly C_CYAN='\033[1;36m'
  readonly C_GREEN='\033[1;32m'
  readonly C_YELLOW='\033[1;33m'
  readonly C_RED='\033[1;31m'
else
  readonly C_RESET='' C_BOLD='' C_DIM='' C_PURPLE='' C_CYAN=''
  readonly C_GREEN='' C_YELLOW='' C_RED=''
fi

project_version() {
  node -p "require('$ROOT_DIR/package.json').version" 2>/dev/null || printf 'desconocida\n'
}

platform_label() {
  case "$(detect_platform)" in
    termux) printf '📱 Termux / Android' ;;
    linux) printf '🐧 Linux' ;;
    *) printf '⚠️  Sistema no compatible' ;;
  esac
}

banner() {
  printf '\n%b' "$C_PURPLE"
  cat <<'EOF'
   ╭──────────────────────────────────────────────╮
   │          ✦  O G U R I C A P  B O T  ✦       │
   │       Instalador y administrador universal   │
   ╰──────────────────────────────────────────────╯
EOF
  printf '%b   %-20s %s\n' "$C_RESET$C_DIM" 'Sistema detectado:' "$(platform_label)"
  printf '   %-20s v%s%b\n\n' 'Versión:' "$(project_version)" "$C_RESET"
}

section() {
  printf '\n%b━━ %s ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%b\n' "$C_CYAN" "$1" "$C_RESET"
}

usage() {
  banner
  cat <<'EOF'
Uso: ./oguricap.sh [comando]

  ✨ install          Instalación automática completa (recomendado)
  ⚙️  configure        Configurar bot, panel y base de datos
  🚀 start            Iniciar el bot y el panel habilitado
  🔄 update           Actualizar sin borrar datos
  💾 backup           Respaldar configuración y sesiones
  ♻️  restore ARCHIVO  Restaurar un respaldo
  🩺 doctor           Revisar la instalación
  ❓ help             Mostrar esta ayuda

Sin argumentos abre el menú interactivo.
EOF
}

doctor() {
  local platform status=0
  platform="$(detect_platform)"
  banner
  section 'DIAGNÓSTICO DEL SISTEMA'
  printf '  %-18s %s\n' '🖥️  Plataforma' "$platform"
  printf '  %-18s %s\n' '🧩 Arquitectura' "$(uname -m)"
  printf '  %-18s %s\n\n' '📁 Proyecto' "$ROOT_DIR"

  for command_name in git node npm ffmpeg; do
    if has "$command_name"; then
      printf '  %b✔%b %-14s %s\n' "$C_GREEN" "$C_RESET" "$command_name" "$($command_name --version 2>&1 | head -n 1)"
    else
      printf '  %b✘%b %-14s %bNO INSTALADO%b\n' "$C_RED" "$C_RESET" "$command_name" "$C_RED" "$C_RESET"
      status=1
    fi
  done

  if has magick; then
    printf '  %b✔%b %-14s %s\n' "$C_GREEN" "$C_RESET" 'ImageMagick' "$(magick --version | head -n 1)"
  elif has convert; then
    printf '  %b✔%b %-14s %s\n' "$C_GREEN" "$C_RESET" 'ImageMagick' "$(convert --version | head -n 1)"
  else
    printf '  %b✘%b %-14s %bNO INSTALADO%b\n' "$C_RED" "$C_RESET" 'ImageMagick' "$C_RED" "$C_RESET"
    status=1
  fi

  if has node && (( $(node_major) < OGURI_MIN_NODE_MAJOR )); then
    warn "Node.js debe ser $OGURI_MIN_NODE_MAJOR o superior."
    status=1
  fi
  [[ -f "$ROOT_DIR/.env" ]] || warn "Falta .env; el instalador puede crearlo."
  [[ -d "$ROOT_DIR/node_modules" ]] || warn "Faltan node_modules; ejecuta install."

  if (( status == 0 )); then ok "Dependencias principales disponibles."; fi
  return "$status"
}

run_action() {
  case "${1:-}" in
    install) exec bash "$ROOT_DIR/scripts/install.sh" ;;
    configure)
      bash "$ROOT_DIR/scripts/configure.sh"
      bash "$ROOT_DIR/scripts/setup-postgres.sh"
      exec bash "$ROOT_DIR/scripts/setup-panel.sh"
      ;;
    start) exec bash "$ROOT_DIR/scripts/start.sh" ;;
    update) exec bash "$ROOT_DIR/scripts/update.sh" ;;
    backup) exec bash "$ROOT_DIR/scripts/backup.sh" ;;
    restore)
      [[ -n "${2:-}" ]] || die "Indica el archivo: ./oguricap.sh restore backups/archivo.tar.gz"
      exec bash "$ROOT_DIR/scripts/restore.sh" "$2"
      ;;
    doctor) doctor ;;
    help|-h|--help) usage ;;
    *) die "Comando desconocido: ${1:-}. Usa ./oguricap.sh help." ;;
  esac
}

menu() {
  while true; do
    banner
    printf '%b   ¿Qué deseas hacer?%b\n\n' "$C_BOLD" "$C_RESET"
    cat <<'EOF'
   [1] ✨ PREPARAR TODO AUTOMÁTICAMENTE  ← recomendado la primera vez
       Instala programas, crea la configuración, la base de datos y la web.

   [2] ⚙️  CAMBIAR LA CONFIGURACIÓN
       Cambia el nombre, owner, acceso y activación del panel web.

   [3] 🚀 INICIAR EL BOT Y EL PANEL
   [4] 🔄 ACTUALIZAR SIN PERDER DATOS
   [5] 💾 CREAR UNA COPIA DE SEGURIDAD
   [6] ♻️  RECUPERAR UNA COPIA DE SEGURIDAD
   [7] 🩺 COMPROBAR SI TODO ESTÁ BIEN
   [0] 👋 SALIR
EOF
    printf '\n%b   Selecciona una opción › %b' "$C_PURPLE" "$C_RESET"
    read -r choice
    printf '\n'
    case "$choice" in
      1)
        section 'INSTALACIÓN AUTOMÁTICA COMPLETA'
        printf '   Se prepararán sistema, .env, claves, PostgreSQL y panel web.\n\n'
        bash "$ROOT_DIR/scripts/install.sh"
        ;;
      2) bash "$ROOT_DIR/scripts/configure.sh" && bash "$ROOT_DIR/scripts/setup-postgres.sh" && bash "$ROOT_DIR/scripts/setup-panel.sh" ;;
      3) bash "$ROOT_DIR/scripts/start.sh" ;;
      4) bash "$ROOT_DIR/scripts/update.sh" ;;
      5) bash "$ROOT_DIR/scripts/backup.sh" ;;
      6)
        shopt -s nullglob
        backup_files=("$ROOT_DIR"/backups/*.tar.gz)
        shopt -u nullglob
        if (( ${#backup_files[@]} > 0 )); then
          section 'COPIAS DISPONIBLES'
          for backup_file in "${backup_files[@]}"; do
            printf '   • %s\n' "$(basename "$backup_file")"
          done
          archive="${backup_files[${#backup_files[@]}-1]}"
          printf '\n   Pulsa Enter para recuperar la más reciente:\n   %s\n' "$(basename "$archive")"
          printf '   O escribe la ruta de otra copia: '
        else
          warn 'No hay copias en la carpeta backups. Puedes escribir la ruta de una copia externa.'
          printf 'Ruta del archivo .tar.gz: '
          archive=''
        fi
        read -r archive
        if [[ -z "$archive" ]]; then
          if (( ${#backup_files[@]} == 0 )); then
            warn 'No seleccionaste ningún archivo; recuperación cancelada.'
            continue
          fi
          archive="${backup_files[${#backup_files[@]}-1]}"
        fi
        if [[ -n "$archive" && ! -f "$archive" && -f "$ROOT_DIR/backups/$archive" ]]; then
          archive="$ROOT_DIR/backups/$archive"
        fi
        bash "$ROOT_DIR/scripts/restore.sh" "$archive"
        ;;
      7) doctor || true ;;
      0) printf '%b   👋 Hasta pronto.%b\n' "$C_GREEN" "$C_RESET"; exit 0 ;;
      *) warn "Opción inválida." ;;
    esac
  done
}

if (( $# == 0 )); then menu; else run_action "$@"; fi
