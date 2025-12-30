#!/bin/bash
# =============================================================================
# POSTGRESQL SECURE ENTRYPOINT WRAPPER
# =============================================================================
# This script wraps the official PostgreSQL entrypoint to ensure proper
# security by running as the postgres user (UID 999) instead of root.
# =============================================================================

set -Eeo pipefail

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [postgres-secure] $*" >&2
}

# Check if we're running as root
if [ "$(id -u)" = "0" ]; then
    log "Running as root, switching to postgres user (UID 999)..."
    
    # Fix permissions on the data directory
    chown -R postgres:postgres /var/lib/postgresql
    
    # Switch to postgres user and re-execute with the official entrypoint
    exec gosu postgres /usr/local/bin/docker-entrypoint.sh "$@"
fi

# If we're already running as postgres user, just call the official entrypoint
log "Running as postgres user (UID $(id -u)), calling official entrypoint..."
exec /usr/local/bin/docker-entrypoint.sh "$@"
