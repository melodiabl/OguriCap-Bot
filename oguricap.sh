#!/usr/bin/env bash

set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "$ROOT_DIR/scripts/lib/common.sh"

usage() {
  cat <<'EOF'
OguriCap Bot — administrador universal para Termux y Linux

Uso: ./oguricap.sh [comando]

  install          Detectar sistema, actualizar paquetes e instalar el bot
  configure        Configurar owner, panel, claves y base de datos
  start            Iniciar el bot
  update           Actualizar código y dependencias sin borrar datos
  backup           Respaldar configuración, base de datos y sesiones
  restore ARCHIVO  Restaurar un respaldo
  doctor           Revisar sistema, programas y configuración
  help             Mostrar esta ayuda

Sin argumentos abre el menú interactivo.
EOF
}

doctor() {
  local platform status=0
  platform="$(detect_platform)"
  printf 'Sistema:       %s\n' "$platform"
  printf 'Arquitectura:  %s\n' "$(uname -m)"
  printf 'Proyecto:      %s\n' "$ROOT_DIR"

  for command_name in git node npm ffmpeg; do
    if has "$command_name"; then
      printf '%-14s %s\n' "$command_name:" "$($command_name --version 2>&1 | head -n 1)"
    else
      printf '%-14s %s\n' "$command_name:" 'NO INSTALADO'
      status=1
    fi
  done

  if has magick; then
    printf '%-14s %s\n' 'ImageMagick:' "$(magick --version | head -n 1)"
  elif has convert; then
    printf '%-14s %s\n' 'ImageMagick:' "$(convert --version | head -n 1)"
  else
    printf '%-14s %s\n' 'ImageMagick:' 'NO INSTALADO'
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
    printf '\n\033[1;35mOguriCap Bot\033[0m — sistema detectado: %s\n' "$(detect_platform)"
    cat <<'EOF'
  1) Instalar o reparar dependencias
  2) Configurar bot y panel
  3) Iniciar bot y panel
  4) Actualizar bot
  5) Crear respaldo
  6) Restaurar respaldo
  7) Diagnosticar instalación
  0) Salir
EOF
    printf 'Selecciona una opción: '
    read -r choice
    case "$choice" in
      1) bash "$ROOT_DIR/scripts/install.sh" ;;
      2) bash "$ROOT_DIR/scripts/configure.sh" && bash "$ROOT_DIR/scripts/setup-postgres.sh" && bash "$ROOT_DIR/scripts/setup-panel.sh" ;;
      3) bash "$ROOT_DIR/scripts/start.sh" ;;
      4) bash "$ROOT_DIR/scripts/update.sh" ;;
      5) bash "$ROOT_DIR/scripts/backup.sh" ;;
      6)
        printf 'Ruta del respaldo: '
        read -r archive
        bash "$ROOT_DIR/scripts/restore.sh" "$archive"
        ;;
      7) doctor || true ;;
      0) exit 0 ;;
      *) warn "Opción inválida." ;;
    esac
  done
}

if (( $# == 0 )); then menu; else run_action "$@"; fi
