#!/bin/bash
# Node-RED entrypoint s graceful shutdown support

set -e

echo "[Entrypoint] Starting Node-RED with graceful shutdown support"

# Validate config before starting
if [ -f "/config/modes.yaml" ]; then
  echo "[Entrypoint] Validating modes.yaml configuration..."
  node /data/lib/../scripts/validate-config.js || {
    echo "[Entrypoint] ERROR: Configuration validation failed!"
    exit 1
  }
fi

# Install dependencies if needed
if [ ! -d "/data/node_modules" ] || [ ! -f "/data/node_modules/winston/package.json" ]; then
  echo "[Entrypoint] Installing Node-RED dependencies..."
  cd /data
  npm install --production --no-audit
fi

# Create logs directory
mkdir -p /data/logs

# Start Node-RED with proper signal handling
echo "[Entrypoint] Starting Node-RED..."
exec node-red --userDir /data "$@"
