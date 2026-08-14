#!/usr/bin/env bash
# Restore a PostgreSQL backup into oguricap-postgres container
# Usage: ./scripts/restore-backup.sh [backup_file.sql.gz]
#        If no file given, lists available backups.

set -euo pipefail

CONTAINER="oguricap-postgres"
DB="oguribot"
USER="bot_user"
BACKUP_DIR="/backups"

list_backups() {
  echo "Available backups:"
  docker exec "$CONTAINER" ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none found)"
}

if [[ $# -eq 0 ]]; then
  list_backups
  echo ""
  echo "Usage: $0 <backup_file.sql.gz>"
  exit 0
fi

BACKUP_FILE="$1"

# Accept bare filename or full path inside the container
if [[ "$BACKUP_FILE" != /* ]]; then
  BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

echo "=== OguriCap-Bot PostgreSQL Restore ==="
echo "Container : $CONTAINER"
echo "Database  : $DB"
echo "Backup    : $BACKUP_FILE"
echo ""

# Verify backup exists inside container
if ! docker exec "$CONTAINER" test -f "$BACKUP_FILE"; then
  echo "❌ Backup not found inside container: $BACKUP_FILE"
  list_backups
  exit 1
fi

echo "⚠️  This will DROP and recreate the database '$DB'."
read -r -p "Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "→ Dropping and recreating database..."
docker exec "$CONTAINER" psql -U "$USER" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS $DB;" \
  -c "CREATE DATABASE $DB OWNER $USER;" 2>&1

echo "→ Restoring from backup..."
docker exec "$CONTAINER" bash -c "gunzip -c '$BACKUP_FILE' | psql -U '$USER' -d '$DB'" 2>&1

echo ""
echo "✅ Restore complete from $BACKUP_FILE"
echo "   Restart containers: docker compose up -d"
