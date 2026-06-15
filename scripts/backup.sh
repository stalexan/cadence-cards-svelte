#!/bin/sh
#
# Create a PostgreSQL database backup from the running `db` container.
#
# Usage:
#   scripts/backup.sh [output-file]
#
# With no argument, writes a gzipped dump to backups/backup-<timestamp>.sql.gz.
# Uses `docker compose`, so it honours COMPOSE_FILE / .env in the project root.
# No host PostgreSQL client or Node toolchain required.
#
set -eu

# Run from the project root (parent of this scripts/ directory).
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

service="db"

if [ "${1:-}" != "" ]; then
    output_path="$1"
else
    mkdir -p backups
    timestamp="$(date +%Y-%m-%dT%H-%M-%S)"
    output_path="backups/backup-${timestamp}.sql.gz"
fi

output_file="$(basename -- "$output_path")"

echo "Creating backup: $output_path"

# Dump inside the container (POSTGRES_* come from the container env), gzip to /tmp.
docker compose exec -T "$service" sh -c \
    'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F p | gzip > /tmp/'"$output_file"

# Copy the dump out of the container, then clean up.
docker compose cp "${service}:/tmp/${output_file}" "$output_path"
docker compose exec -T "$service" rm -f "/tmp/${output_file}" || true

echo "Backup created: $output_path"
