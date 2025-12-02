#!/bin/bash
# Monitor Zigbee2MQTT container status and publish to MQTT

CONTAINER="compose-zigbee2mqtt-1"
MQTT_HOST="localhost"
MQTT_TOPIC="meta/alert/zigbee_monitor"
STATE_FILE="/tmp/zigbee_last_status"
ALERT_TIME_FILE="/tmp/zigbee_last_alert_time"

# Get current status
STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")

# Read last status
LAST_STATUS=$(cat "$STATE_FILE" 2>/dev/null || echo "")

# Save current status
echo "$STATUS" > "$STATE_FILE"

# Check if restarting
if [ "$STATUS" = "restarting" ]; then
    # Check quiet hours (22:00 - 07:00)
    HOUR=$(date +%H)
    if [ "$HOUR" -ge 22 ] || [ "$HOUR" -lt 7 ]; then
        echo "[$(date)] Zigbee monitor: alert suppressed (quiet hours $HOUR:xx)"
        exit 0
    fi
    
    # Check rate limiting (3 hours = 10800 seconds)
    NOW=$(date +%s)
    LAST_ALERT=$(cat "$ALERT_TIME_FILE" 2>/dev/null || echo 0)
    ELAPSED=$((NOW - LAST_ALERT))
    
    if [ "$ELAPSED" -lt 10800 ]; then
        MINUTES=$((ELAPSED / 60))
        echo "[$(date)] Zigbee monitor: alert rate-limited (last: ${MINUTES}min ago)"
        exit 0
    fi
    
    # Send alert and save timestamp
    echo "$NOW" > "$ALERT_TIME_FILE"
    mosquitto_pub -h "$MQTT_HOST" -t "$MQTT_TOPIC" -m '{
        "severity":"warning",
        "type":"zigbee_offline",
        "location":"system",
        "message":"🔌 ZIGBEE ADAPTER CRASHUJE: Kontajner v Restarting stave",
        "timestamp":"'$(date -Iseconds)'",
        "actions":["pushover"]
    }'
    echo "[$(date)] Zigbee monitor: sent warning alert (status=$STATUS)"
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
