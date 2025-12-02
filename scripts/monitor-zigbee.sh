#!/bin/bash
# Monitor Zigbee2MQTT container status and publish to MQTT

CONTAINER="compose-zigbee2mqtt-1"
MQTT_HOST="localhost"
MQTT_TOPIC="meta/alert/zigbee_monitor"
STATE_FILE="/tmp/zigbee_last_status"

# Get current status
STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")

# Read last status
LAST_STATUS=$(cat "$STATE_FILE" 2>/dev/null || echo "")

# Save current status
echo "$STATUS" > "$STATE_FILE"

# If restarting or not running, send emergency alert
if [ "$STATUS" = "restarting" ] && [ "$LAST_STATUS" != "restarting" ]; then
    mosquitto_pub -h "$MQTT_HOST" -t "$MQTT_TOPIC" -m '{
        "severity":"emergency",
        "type":"zigbee_offline",
        "location":"system",
        "message":"🔌 ZIGBEE ADAPTER CRASHUJE: Kontajner v Restarting stave",
        "timestamp":"'$(date -Iseconds)'",
        "actions":["pushover_emergency"]
    }'
    echo "[$(date)] Zigbee monitor: sent emergency alert (status=$STATUS)"
fi

# If recovered
if [ "$STATUS" = "running" ] && [ "$LAST_STATUS" = "restarting" ]; then
    mosquitto_pub -h "$MQTT_HOST" -t "$MQTT_TOPIC" -m '{
        "severity":"info",
        "type":"zigbee_online",
        "location":"system",
        "message":"✅ ZIGBEE ADAPTER OBNOVENÝ: Kontajner beží normálne",
        "timestamp":"'$(date -Iseconds)'",
        "actions":[]
    }'
    echo "[$(date)] Zigbee monitor: sent recovery notification (status=$STATUS)"
fi
