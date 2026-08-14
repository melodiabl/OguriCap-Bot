#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
root="$(require_repo)"
# shellcheck disable=SC1091
source "$root/.env"

db_name="${POSTGRES_DB:-oguribot}"
db_user="${POSTGRES_USER:-bot_user}"
db_password="${POSTGRES_PASSWORD:-}"
[[ -n "$db_password" ]] || die "POSTGRES_PASSWORD no está configurada."
[[ "$db_name" =~ ^[a-zA-Z0-9_]+$ && "$db_user" =~ ^[a-zA-Z0-9_]+$ ]] || die "Nombre de base de datos o usuario inválido."

sql_password="${db_password//\'/\'\'}"
platform="$(detect_platform)"

if [[ "$platform" == termux ]]; then
  pg_data="${PREFIX}/var/lib/postgresql"
  [[ -f "$pg_data/PG_VERSION" ]] || initdb "$pg_data"
  pg_ctl -D "$pg_data" status >/dev/null 2>&1 || pg_ctl -D "$pg_data" -l "$root/logs/postgresql.log" start
  psql -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$db_user') THEN
    CREATE ROLE $db_user LOGIN PASSWORD '$sql_password';
  ELSE
    ALTER ROLE $db_user PASSWORD '$sql_password';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE $db_name OWNER $db_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_name')\gexec
SQL
else
  system_admin=()
  if [[ "$EUID" -ne 0 ]]; then
    has sudo || die "Se necesita sudo para configurar PostgreSQL."
    system_admin=(sudo)
  fi
  if has postgresql-setup && [[ ! -f /var/lib/pgsql/data/PG_VERSION ]]; then
    "${system_admin[@]}" postgresql-setup --initdb >/dev/null
  fi
  if has rc-service; then
    "${system_admin[@]}" rc-service postgresql status >/dev/null 2>&1 || {
      "${system_admin[@]}" rc-service postgresql setup
      "${system_admin[@]}" rc-service postgresql start
    }
  elif has systemctl; then
    if ! "${system_admin[@]}" systemctl enable --now postgresql 2>/dev/null; then
      if [[ -d /var/lib/postgres && ! -f /var/lib/postgres/data/PG_VERSION ]]; then
        "${system_admin[@]}" install -d -o postgres -g postgres /var/lib/postgres/data
        if [[ "$EUID" -eq 0 ]]; then runuser -u postgres -- initdb -D /var/lib/postgres/data
        else sudo -u postgres initdb -D /var/lib/postgres/data
        fi
      fi
      "${system_admin[@]}" systemctl enable --now postgresql.service
    fi
  elif has service; then
    "${system_admin[@]}" service postgresql start
  fi
  if has runuser && [[ "$EUID" -eq 0 ]]; then pg_admin=(runuser -u postgres -- psql)
  elif has sudo; then pg_admin=(sudo -u postgres psql)
  else die "No se puede administrar PostgreSQL. Ejecuta como root o instala sudo."; fi
  "${pg_admin[@]}" -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$db_user') THEN
    CREATE ROLE $db_user LOGIN PASSWORD '$sql_password';
  ELSE
    ALTER ROLE $db_user PASSWORD '$sql_password';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE $db_name OWNER $db_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_name')\gexec
SQL
fi

PGPASSWORD="$db_password" psql -h "${POSTGRES_HOST:-127.0.0.1}" -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 -f "$root/database/init/01-schema.sql"
PGPASSWORD="$db_password" psql -h "${POSTGRES_HOST:-127.0.0.1}" -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 -f "$root/database/init/02-notifications.sql"
ok "PostgreSQL configurado y esquema aplicado."
