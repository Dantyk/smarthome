#!/bin/bash
#
# SmartHome Restore Script
# 
# Obnoví zálohu vytvorenú pomocou backup.sh
#
# Usage: ./restore.sh <backup_archive.tar.gz>

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate input
if [ $# -eq 0 ]; then
    log_error "Usage: $0 <backup_archive.tar.gz>"
    exit 1
fi

BACKUP_ARCHIVE="$1"

if [ ! -f "$BACKUP_ARCHIVE" ]; then
    log_error "Backup archive not found: $BACKUP_ARCHIVE"
    exit 1
fi

log_info "Restoring from: $BACKUP_ARCHIVE"

# Extract archive
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_info "Extracting archive to temporary directory..."
tar -xzf "$BACKUP_ARCHIVE" -C "$TEMP_DIR"

# Find backup directory
BACKUP_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)

if [ -z "$BACKUP_DIR" ]; then
    log_error "Invalid backup archive structure"
    exit 1
fi

# Verify manifest
if [ ! -f "$BACKUP_DIR/manifest.json" ]; then
    log_warn "Manifest not found, proceeding with caution"
else
    log_info "Backup manifest found:"
    cat "$BACKUP_DIR/manifest.json" | grep -E '(timestamp|date|version)' || true
fi

# Confirmation prompt
echo ""
echo -e "${YELLOW}WARNING: This will overwrite existing configuration files.${NC}"
echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
read -r

# Stop services
log_info "Stopping Docker services..."
cd "$PROJECT_ROOT/compose"
docker compose down || log_warn "Could not stop services (may not be running)"

# 1. Restore modes.yaml
if [ -f "$BACKUP_DIR/modes.yaml" ]; then
    log_info "Restoring modes.yaml..."
    cp "$BACKUP_DIR/modes.yaml" "$PROJECT_ROOT/config/modes.yaml"
    log_info "✓ modes.yaml restored"
fi

# 2. Restore Node-RED flows
if [ -f "$BACKUP_DIR/flows.json" ]; then
    log_info "Restoring flows.json..."
    cp "$BACKUP_DIR/flows.json" "$PROJECT_ROOT/flows/nodered/flows.json"
    [ -f "$BACKUP_DIR/flows_cred.json" ] && cp "$BACKUP_DIR/flows_cred.json" "$PROJECT_ROOT/flows/nodered/flows_cred.json"
    log_info "✓ flows.json restored"
fi

# 3. Restore Node-RED context
if [ -d "$BACKUP_DIR/context" ]; then
    log_info "Restoring Node-RED context..."
    rm -rf "$PROJECT_ROOT/flows/nodered/context"
    mkdir -p "$PROJECT_ROOT/flows/nodered/context"
    cp -r "$BACKUP_DIR/context/"* "$PROJECT_ROOT/flows/nodered/context/" 2>/dev/null || true
    log_info "✓ Node-RED context restored"
fi

# 4. Restore Grafana configuration
if [ -d "$BACKUP_DIR/grafana" ]; then
    log_info "Restoring Grafana data..."
    rm -rf "$PROJECT_ROOT/compose/data/grafana"
    mkdir -p "$PROJECT_ROOT/compose/data/grafana"
    cp -r "$BACKUP_DIR/grafana/"* "$PROJECT_ROOT/compose/data/grafana/" 2>/dev/null || true
    log_info "✓ Grafana data restored"
fi

# 5. Restore Zigbee2MQTT configuration
if [ -d "$BACKUP_DIR/zigbee2mqtt" ]; then
    log_info "Restoring Zigbee2MQTT configuration..."
    cp "$BACKUP_DIR/zigbee2mqtt/configuration.yaml" "$PROJECT_ROOT/compose/config/zigbee2mqtt/configuration.yaml"
    log_info "✓ Zigbee2MQTT config restored"
fi

# 6. Restore InfluxDB (requires manual intervention)
if [ -d "$BACKUP_DIR/influxdb" ]; then
    log_info "InfluxDB backup found"
    log_warn "InfluxDB restore requires manual intervention:"
    log_warn "  1. Start InfluxDB container: cd compose && docker compose up -d influxdb"
    log_warn "  2. Copy backup: docker cp $BACKUP_DIR/influxdb smarthome-influxdb-1:/tmp/"
    log_warn "  3. Restore: docker exec smarthome-influxdb-1 influx restore /tmp/influxdb"
fi

# 7. Start services
log_info "Starting Docker services..."
cd "$PROJECT_ROOT/compose"
docker compose up -d

# 8. Restore MQTT retained messages
if [ -f "$BACKUP_DIR/mqtt_retained.txt" ]; then
    log_info "Waiting for MQTT broker to start..."
    sleep 5
    
    log_info "Restoring MQTT retained messages..."
    MQTT_CONTAINER="smarthome-mosquitto-1"
    
    # Publish each retained message
    while IFS= read -r line; do
        if [[ "$line" =~ ^([^ ]+)\ (.*)$ ]]; then
            topic="${BASH_REMATCH[1]}"
            payload="${BASH_REMATCH[2]}"
            docker exec "$MQTT_CONTAINER" mosquitto_pub -h localhost -t "$topic" -m "$payload" -r 2>/dev/null || true
        fi
    done < "$BACKUP_DIR/mqtt_retained.txt"
    
    log_info "✓ MQTT retained messages restored"
fi

log_info "✓ Restore complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Restore Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Services are starting up."
echo "Check logs: cd compose && docker compose logs -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
