#!/bin/sh
#
# Restore a PostgreSQL database backup into the running `db` container.
#
# Usage:
#   scripts/restore.sh <backup-file> [-y|--yes]
#
# Accepts either a plain .sql dump or a gzipped .sql.gz dump (as produced by
# backup.sh). This DROPS and recreates the public schema before restoring, so
# all existing data is replaced. Pass -y/--yes to skip the confirmation prompt.
#
set -eu

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

service="db"
backup_file="${1:-}"
assume_yes="no"

if [ "${2:-}" = "-y" ] || [ "${2:-}" = "--yes" ]; then
    assume_yes="yes"
fi

if [ "$backup_file" = "" ]; then
    echo "Usage: scripts/restore.sh <backup-file> [-y|--yes]" >&2
    exit 1
fi
if [ ! -f "$backup_file" ]; then
    echo "Backup file not found: $backup_file" >&2
    exit 1
fi

if [ "$assume_yes" != "yes" ]; then
    printf "This will REPLACE all data in the database with '%s'. Continue? [y/N] " "$backup_file"
    read -r answer
    case "$answer" in
        y|Y|yes|YES) ;;
        *) echo "Aborted."; exit 0 ;;
    esac
fi

echo "Restoring backup from: $backup_file"

backup_filename="$(basename -- "$backup_file")"
container_path="/tmp/${backup_filename}"

# Copy the backup into the container.
docker compose cp "$backup_file" "${service}:${container_path}"

# Ensure the temp file is removed even if the restore fails.
cleanup() {
    docker compose exec -T "$service" rm -f "$container_path" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Dropping existing schema..."
docker compose exec -T "$service" sh -c \
    'PGPASSWORD="${POSTGRES_PASSWORD}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

case "$backup_file" in
    *.gz)
        docker compose exec -T "$service" sh -c \
            'PGPASSWORD="${POSTGRES_PASSWORD}" gunzip < '"$container_path"' | psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"'
        ;;
    *)
        docker compose exec -T "$service" sh -c \
            'PGPASSWORD="${POSTGRES_PASSWORD}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f '"$container_path"
        ;;
esac

echo "Backup restored successfully."
