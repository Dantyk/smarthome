#!/bin/bash
# Baïkal entrypoint wrapper - ensures correct permissions on startup

set -e

echo "[baikal-entrypoint] Setting up database permissions..."

# Wait a moment for volumes to mount
sleep 2

# Ensure db directory exists
DB_DIR="/var/www/baikal/Specific/db"
if [ ! -d "$DB_DIR" ]; then
    echo "[baikal-entrypoint] Creating $DB_DIR directory..."
    mkdir -p "$DB_DIR"
fi

# Set ownership and permissions (exclude read-only config)
chown -R www-data:www-data /var/www/baikal/Specific
chmod 755 /var/www/baikal/Specific
chmod 775 "$DB_DIR"

# If db.sqlite exists, set its permissions
if [ -f "$DB_DIR/db.sqlite" ]; then
    chmod 664 "$DB_DIR/db.sqlite"
    echo "[baikal-entrypoint] ✅ Database permissions set"
else
    echo "[baikal-entrypoint] Database not found, will be created on first access"
fi

echo "[baikal-entrypoint] Starting Baïkal..."

# Execute original docker-entrypoint, but skip problematic permission fixing
# Set env var to skip the broken permission script
export SKIP_CHOWN=1

# Execute original entrypoint
exec docker-entrypoint.sh "$@"
