#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

platform="$(detect_platform)"
[[ "$platform" != unsupported ]] || die "Sistema no compatible. Usa Termux o una distribución Linux."
info "Sistema detectado: $platform"

install_termux() {
  info "Actualizando paquetes de Termux..."
  pkg update -y
  pkg upgrade -y
  pkg install -y git nodejs-lts ffmpeg imagemagick python make clang pkg-config
}

install_linux() {
  if has apt-get; then
    local sudo_cmd=()
    [[ "$EUID" -eq 0 ]] || { has sudo || die "Se necesita sudo para instalar paquetes."; sudo_cmd=(sudo); }
    "${sudo_cmd[@]}" apt-get update
    "${sudo_cmd[@]}" apt-get install -y git curl ca-certificates nodejs npm ffmpeg imagemagick build-essential python3 pkg-config
  elif has dnf; then
    local sudo_cmd=()
    [[ "$EUID" -eq 0 ]] || { has sudo || die "Se necesita sudo para instalar paquetes."; sudo_cmd=(sudo); }
    "${sudo_cmd[@]}" dnf install -y git curl ca-certificates nodejs npm ffmpeg ImageMagick gcc-c++ make python3 pkgconf-pkg-config
  elif has pacman; then
    local sudo_cmd=()
    [[ "$EUID" -eq 0 ]] || { has sudo || die "Se necesita sudo para instalar paquetes."; sudo_cmd=(sudo); }
    "${sudo_cmd[@]}" pacman -Syu --needed --noconfirm git curl ca-certificates nodejs npm ffmpeg imagemagick base-devel python pkgconf
  elif has apk; then
    local sudo_cmd=()
    [[ "$EUID" -eq 0 ]] || { has sudo || die "Se necesita sudo para instalar paquetes."; sudo_cmd=(sudo); }
    "${sudo_cmd[@]}" apk add git curl ca-certificates nodejs npm ffmpeg imagemagick build-base python3 pkgconf
  else
    die "Gestor de paquetes no reconocido. Instala Node.js 20+, npm, Git, FFmpeg e ImageMagick."
  fi
}

if [[ "$platform" == termux ]]; then
  install_termux
else
  install_linux
fi

has git || die "Git no quedó instalado."

root="$(repo_root 2>/dev/null || true)"
if [[ -z "$root" ]]; then
  install_dir="${OGURI_INSTALL_DIR:-$HOME/OguriCap-Bot}"
  [[ ! -e "$install_dir" ]] || die "Ya existe $install_dir. Entra allí y ejecuta ./oguricap.sh install."
  info "Clonando OguriCap-Bot en $install_dir..."
  git clone "$OGURI_REPO_URL" "$install_dir"
  root="$install_dir"
fi

if ! has node || (( $(node_major) < OGURI_MIN_NODE_MAJOR )); then
  die "Se requiere Node.js $OGURI_MIN_NODE_MAJOR o superior. Versión detectada: $(node --version 2>/dev/null || echo ninguna)."
fi

cd "$root"
info "Instalando dependencias del bot con npm ci..."
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  warn "Se creó .env. Cambia las contraseñas y claves marcadas como CHANGE_ME antes de producción."
fi

mkdir -p Sessions/Principal Sessions/SubBot backups logs storage tmp
ok "Instalación terminada en $root"
printf '\nSiguiente paso:\n  cd %q\n  ./oguricap.sh start\n' "$root"
