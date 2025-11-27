#!/bin/bash
# Cleanup old English room name MQTT topics
# These are obsolete after Slovak localization in modes.yaml v3

set -e

MOSQUITTO_HOST="localhost"
ENGLISH_ROOMS=("living" "bedroom" "kidroom1" "kitchen" "bathroom")

echo "[$(date)] Starting cleanup of English room topics..."

for room in "${ENGLISH_ROOMS[@]}"; do
    echo "Cleaning up room: $room"
    
    # Virtual topics
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/room/$room/target_temp" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/room/$room/enabled" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/room/$room/override" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/room/$room/override_request" -n -r
    
    # Status topics
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "stat/hvac/$room/enabled" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "stat/hvac/$room/current_temp" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "stat/hvac/$room/humidity" -n -r
    
    # Boost topics
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/boost/$room/minutes" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/boost/$room/target_temp" -n -r
    
    # Offset topics
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "virt/offset/$room/value" -n -r
    
    # Command topics
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "cmd/hvac/$room/setpoint" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "cmd/hvac/$room/override" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "cmd/hvac/$room/override_duration" -n -r
    mosquitto_pub -h "$MOSQUITTO_HOST" -t "cmd/hvac/$room/enabled" -n -r
    
    echo "  ✓ Cleared 14 topics for $room"
done

echo "[$(date)] Cleanup complete! Cleared topics for ${#ENGLISH_ROOMS[@]} rooms (70 topics total)"
