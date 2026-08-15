#!/usr/bin/env bash

set -Eeuo pipefail

readonly OGURI_REPO_URL="${OGURI_REPO_URL:-https://github.com/melodiabl/OguriCap-Bot.git}"
readonly OGURI_MIN_NODE_MAJOR=20

info() { printf '\033[1;36m[INFO]\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

stage() {
  printf '\n\033[1;35m━━ %s\033[0m\n' "$*"
}

explain() {
  printf '   %s\n' "$*"
}

detect_platform() {
  if [[ -n "${TERMUX_VERSION:-}" || "${PREFIX:-}" == *com.termux* ]]; then
    printf 'termux\n'
  elif [[ "$(uname -s)" == "Linux" ]]; then
    printf 'linux\n'
  else
    printf 'unsupported\n'
  fi
}
repo_root() {
  local source_dir
  source_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  if git -C "$source_dir" rev-parse --show-toplevel >/dev/null 2>&1; then
    git -C "$source_dir" rev-parse --show-toplevel
  else
    return 1
  fi
}

node_major() {
  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0\n'
}

require_repo() {
  local root
  root="$(repo_root)" || die "Ejecuta este script desde un clon de OguriCap-Bot."
  [[ -f "$root/package.json" && -f "$root/index.js" ]] || die "No parece un repositorio válido de OguriCap-Bot."
  printf '%s\n' "$root"
}

npm_install_dependencies() {
  local target_dir="$1"
  local npm_args=(--legacy-peer-deps)

  if npm install --help 2>&1 | grep -q -- '--allow-git'; then
    npm_args+=(--allow-git=all)
  fi

  explain 'npm descargará y ajustará las piezas necesarias automáticamente.'
  (cd "$target_dir" && npm install "${npm_args[@]}")
}
