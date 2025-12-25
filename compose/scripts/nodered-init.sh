#!/bin/sh
set -e

echo "[nodered-init] Starting Node-RED SmartHome initialization..."

# Wait for dependencies
echo "[nodered-init] Waiting for Redis..."
timeout 10 sh -c 'until nc -z redis 6379; do sleep 1; done' || echo "[nodered-init] Redis not ready, continuing anyway"

# Run init-wrapper.js to set up Redis cache, metrics, logger
if [ -f /data/init-wrapper.js ]; then
    echo "[nodered-init] Running init-wrapper.js..."
    /usr/local/bin/node /data/init-wrapper.js || echo "[nodered-init] Init wrapper failed (non-fatal)"
else
    echo "[nodered-init] Warning: /data/init-wrapper.js not found, skipping initialization"
fi

echo "[nodered-init] Initialization complete, starting Node-RED..."

# Execute original Node-RED entrypoint
exec npm --no-update-notifier --no-fund start -- --userDir /data
