#!/bin/bash

cleanup() {
    echo "Caught SIGTERM signal, shutting down..."
    kill -TERM "$child" 2>/dev/null
    exit 0
}

trap cleanup SIGTERM

# Set APP_VERSION from VERSION file
if [ -f /app/VERSION ]; then
    export APP_VERSION=$(cat /app/VERSION | tr -d '\n')
    echo "App version: $APP_VERSION"
else
    export APP_VERSION="unknown"
    echo "Warning: VERSION file not found, using 'unknown'"
fi

# Generate Prisma client in development (schema may have changed)
# In production, Prisma client is already generated during build
if [ "$NODE_ENV" != "production" ]; then
    echo "Generating Prisma client..."
    npx prisma generate
fi

# Run migrations in production
if [ "$NODE_ENV" = "production" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy
    if [ $? -ne 0 ]; then
        echo "ERROR: Database migration failed!"
        exit 1
    fi
    echo "Database migrations completed successfully."
fi

echo "Starting command: $@"
"$@" 2>&1 &
child=$!

wait "$child"

exit $?
