#!/bin/bash
#
# SmartHome Backup Script
# 
# Zálohuje kritické súbory:
# - modes.yaml (konfigurácia režimov)
# - flows.json (Node-RED flows)
# - MQTT retained messages (export cez mosquitto)
# - Grafana dashboards
# - InfluxDB snapshots
#
# Usage: ./backup.sh [destination_dir]

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${1:-$PROJECT_ROOT/backups/$TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"
log_info "Backup directory: $BACKUP_DIR"

# 1. Backup modes.yaml
log_info "Backing up modes.yaml..."
if [ -f "$PROJECT_ROOT/config/modes.yaml" ]; then
    cp "$PROJECT_ROOT/config/modes.yaml" "$BACKUP_DIR/modes.yaml"
    log_info "✓ modes.yaml backed up"
else
    log_warn "modes.yaml not found"
fi

# 2. Backup modes schema
if [ -f "$PROJECT_ROOT/config/modes.schema.json" ]; then
    cp "$PROJECT_ROOT/config/modes.schema.json" "$BACKUP_DIR/modes.schema.json"
fi

# 3. Backup Node-RED flows
log_info "Backing up Node-RED flows..."
if [ -f "$PROJECT_ROOT/flows/nodered/flows.json" ]; then
    cp "$PROJECT_ROOT/flows/nodered/flows.json" "$BACKUP_DIR/flows.json"
    cp "$PROJECT_ROOT/flows/nodered/flows_cred.json" "$BACKUP_DIR/flows_cred.json" 2>/dev/null || log_warn "flows_cred.json not found"
    log_info "✓ flows.json backed up"
else
    log_warn "flows.json not found"
fi

# 4. Backup Node-RED context
log_info "Backing up Node-RED context..."
if [ -d "$PROJECT_ROOT/flows/nodered/context" ]; then
    mkdir -p "$BACKUP_DIR/context"
    cp -r "$PROJECT_ROOT/flows/nodered/context/"* "$BACKUP_DIR/context/" 2>/dev/null || true
    log_info "✓ Node-RED context backed up"
fi

# 5. Export MQTT retained messages
log_info "Exporting MQTT retained messages..."
MQTT_CONTAINER="smarthome-mosquitto-1"
if docker ps --format '{{.Names}}' | grep -q "^${MQTT_CONTAINER}$"; then
    # Use mosquitto_sub to dump retained messages
    timeout 10 docker exec "$MQTT_CONTAINER" mosquitto_sub -h localhost -t '#' -v --retained-only > "$BACKUP_DIR/mqtt_retained.txt" 2>/dev/null || log_warn "MQTT export timed out or failed"
    log_info "✓ MQTT retained messages exported"
else
    log_warn "Mosquitto container not running"
fi

# 6. Backup Grafana dashboards (if mounted as volume)
log_info "Backing up Grafana configuration..."
if [ -d "$PROJECT_ROOT/compose/data/grafana" ]; then
    mkdir -p "$BACKUP_DIR/grafana"
    cp -r "$PROJECT_ROOT/compose/data/grafana/"* "$BACKUP_DIR/grafana/" 2>/dev/null || true
    log_info "✓ Grafana data backed up"
fi

# 7. Export InfluxDB snapshot
log_info "Exporting InfluxDB data..."
INFLUX_CONTAINER="smarthome-influxdb-1"
if docker ps --format '{{.Names}}' | grep -q "^${INFLUX_CONTAINER}$"; then
    # Create backup using influx CLI
    docker exec "$INFLUX_CONTAINER" influx backup /tmp/influxdb_backup -t "${INFLUXDB_ADMIN_TOKEN:-}" 2>/dev/null || log_warn "InfluxDB backup failed (may need token)"
    docker cp "$INFLUX_CONTAINER:/tmp/influxdb_backup" "$BACKUP_DIR/influxdb" 2>/dev/null || true
    docker exec "$INFLUX_CONTAINER" rm -rf /tmp/influxdb_backup 2>/dev/null || true
    log_info "✓ InfluxDB snapshot created"
else
    log_warn "InfluxDB container not running"
fi

# 8. Backup Zigbee2MQTT configuration
log_info "Backing up Zigbee2MQTT configuration..."
if [ -f "$PROJECT_ROOT/compose/config/zigbee2mqtt/configuration.yaml" ]; then
    mkdir -p "$BACKUP_DIR/zigbee2mqtt"
    cp "$PROJECT_ROOT/compose/config/zigbee2mqtt/configuration.yaml" "$BACKUP_DIR/zigbee2mqtt/"
    log_info "✓ Zigbee2MQTT config backed up"
fi

# 9. Create backup manifest
log_info "Creating backup manifest..."
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "project_root": "$PROJECT_ROOT",
  "files": [
$(find "$BACKUP_DIR" -type f -not -name "manifest.json" | sed 's|'"$BACKUP_DIR"'/||' | sed 's/.*/"    &"/' | paste -sd ',' -)
  ],
  "version": "1.0",
  "checksum": "$(find "$BACKUP_DIR" -type f -not -name "manifest.json" -exec md5sum {} \; | md5sum | cut -d' ' -f1)"
}
EOF

# 10. Create compressed archive
log_info "Creating compressed archive..."
ARCHIVE_NAME="smarthome_backup_${TIMESTAMP}.tar.gz"
tar -czf "$PROJECT_ROOT/backups/$ARCHIVE_NAME" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"

# Calculate archive size
ARCHIVE_SIZE=$(du -h "$PROJECT_ROOT/backups/$ARCHIVE_NAME" | cut -f1)

log_info "✓ Backup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Backup Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Location:  $BACKUP_DIR"
echo "Archive:   $PROJECT_ROOT/backups/$ARCHIVE_NAME"
echo "Size:      $ARCHIVE_SIZE"
echo "Timestamp: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To restore: ./scripts/restore.sh $PROJECT_ROOT/backups/$ARCHIVE_NAME"
