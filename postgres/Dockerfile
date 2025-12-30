# =============================================================================
# SECURE POSTGRESQL DOCKERFILE WITH NON-ROOT USER
# =============================================================================
# This Dockerfile creates a PostgreSQL container that runs as a non-root user
# for enhanced security. It uses the existing postgres user (UID 999) from the
# official postgres image but adds security configurations.
# =============================================================================

FROM postgres:17-trixie

# Install gosu for secure user switching
RUN apt-get update && apt-get install -y gosu && apt-get clean && rm -rf /var/lib/apt/lists/*

# The official postgres image already creates a postgres user with UID 999
# We'll use that user instead of creating a new one for better compatibility

# Copy custom entrypoint script that wraps the official entrypoint
COPY docker-entrypoint.sh /usr/local/bin/custom-entrypoint.sh
RUN chmod +x /usr/local/bin/custom-entrypoint.sh

# Set environment variables
ENV PGDATA=/var/lib/postgresql/data

# Expose PostgreSQL port
EXPOSE 5432

# Use custom entrypoint that calls the official one
ENTRYPOINT ["custom-entrypoint.sh"]
CMD ["postgres"]
