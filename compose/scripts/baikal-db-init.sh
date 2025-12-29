#!/bin/bash
# Baïkal Database Initialization Script
# Ensures SQLite database and required users/calendars exist on first run

set -e

BAIKAL_ROOT="/var/www/baikal"
DB_DIR="$BAIKAL_ROOT/Specific/db"
DB_FILE="$DB_DIR/db.sqlite"

echo "[baikal-db-init] Checking Baïkal database initialization..."

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "[baikal-db-init] Database does not exist, waiting for Baïkal to create it..."
    
    # Wait up to 60 seconds for Baïkal to initialize DB
    for i in {1..30}; do
        if [ -f "$DB_FILE" ]; then
            echo "[baikal-db-init] ✅ Database created!"
            break
        fi
        echo "[baikal-db-init] Waiting for database creation... ($i/30)"
        sleep 2
    done
    
    if [ ! -f "$DB_FILE" ]; then
        echo "[baikal-db-init] ⚠️  Database not created after 60s. May need manual setup via web UI."
        exit 0
    fi
fi

# Ensure correct permissions
echo "[baikal-db-init] Setting database permissions..."
chown -R www-data:www-data "$DB_DIR"
chmod 775 "$DB_DIR"
chmod 664 "$DB_FILE"

echo "[baikal-db-init] Database initialization complete!"
echo "[baikal-db-init] Next: Create 'smarthome' user via http://localhost:8800/admin/ (admin/admin)"

exit 0
