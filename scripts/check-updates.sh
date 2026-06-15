#!/bin/sh
#
# Check for dependency and image updates for this project.
#
# Usage:
#   scripts/check-updates.sh
#
# Checks, in order:
#   1. Outdated npm packages (runs npm-check-updates inside the web container)
#   2. CVEs in the built images via Docker Scout (if `docker scout` is available)
#
# This is a convenience wrapper around `docker compose` and `docker scout`;
# it makes no changes. To apply safe npm bumps afterwards, run inside the
# container:  npx npm-check-updates --target minor -u && npm install
#
set -eu

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "==> Checking for outdated npm packages (web container)..."
docker compose exec -T web npx npm-check-updates || \
    echo "  (skipped: web container not running, or npm-check-updates unavailable)"

echo
echo "==> Scanning images for CVEs with Docker Scout..."
if docker scout version >/dev/null 2>&1; then
    for image in $(docker compose config --images 2>/dev/null); do
        echo "--- $image ---"
        docker scout cves "$image" || true
    done
else
    echo "  (skipped: 'docker scout' not installed; install with scripts/update-docker-scout.sh)"
fi
