#!/bin/bash
# MQTT Topic Migration: English -> Slovak room names
# Run once to migrate from old (bedroom, kidroom1...) to new (spalna, detska...)

MQTT_HOST="localhost"

echo "=== MQTT Topic Migration ==="
echo "Migrating from English to Slovak room names..."
echo ""

# Room name mappings
declare -A OLD_TO_NEW=(
  ["bedroom"]="spalna"
  ["kidroom1"]="detska"
  ["living"]="obyvacka"
  ["kitchen"]="kuchyna"
  ["bathroom"]="kupelna"
)

echo "Step 1: Deleting old English room topics..."
for old_room in "${!OLD_TO_NEW[@]}"; do
  echo "  Cleaning up: $old_room"
  
  # Delete old room topics (empty payload + retain = delete)
  mosquitto_pub -h $MQTT_HOST -t "virt/room/$old_room/target_temp" -n -r
  mosquitto_pub -h $MQTT_HOST -t "stat/hvac/$old_room/enabled" -n -r
  mosquitto_pub -h $MQTT_HOST -t "stat/hvac/$old_room/current_temp" -n -r
  mosquitto_pub -h $MQTT_HOST -t "stat/hvac/$old_room/humidity" -n -r
  mosquitto_pub -h $MQTT_HOST -t "virt/boost/$old_room/minutes" -n -r
  mosquitto_pub -h $MQTT_HOST -t "virt/boost/$old_room/target_temp" -n -r
  mosquitto_pub -h $MQTT_HOST -t "virt/room/$old_room/override" -n -r
  mosquitto_pub -h $MQTT_HOST -t "virt/room/$old_room/override_request" -n -r
  mosquitto_pub -h $MQTT_HOST -t "cmd/hvac/$old_room/setpoint" -n -r
  mosquitto_pub -h $MQTT_HOST -t "cmd/hvac/$old_room/override" -n -r
done

echo ""
echo "Step 2: Creating new Slovak room topics with defaults..."
for old_room in "${!OLD_TO_NEW[@]}"; do
  new_room="${OLD_TO_NEW[$old_room]}"
  echo "  Creating: $new_room"
  
  # Create new topics with default values
  mosquitto_pub -h $MQTT_HOST -t "virt/room/$new_room/target_temp" -m "21" -r
  mosquitto_pub -h $MQTT_HOST -t "stat/hvac/$new_room/enabled" -m "true" -r
  mosquitto_pub -h $MQTT_HOST -t "stat/hvac/$new_room/current_temp" -m "20.0" -r
  mosquitto_pub -h $MQTT_HOST -t "stat/hvac/$new_room/humidity" -m "50" -r
  mosquitto_pub -h $MQTT_HOST -t "virt/boost/$new_room/minutes" -m "0" -r
  mosquitto_pub -h $MQTT_HOST -t "virt/room/$new_room/override" -m "false" -r
done

echo ""
echo "Step 3: Setting humidity for rooms with sensors..."
# Spálňa, Detská, Kuchyňa, Kúpeľňa majú humidity sensor
mosquitto_pub -h $MQTT_HOST -t "stat/hvac/spalna/humidity" -m "45" -r
mosquitto_pub -h $MQTT_HOST -t "stat/hvac/detska/humidity" -m "48" -r
mosquitto_pub -h $MQTT_HOST -t "stat/hvac/kuchyna/humidity" -m "52" -r
mosquitto_pub -h $MQTT_HOST -t "stat/hvac/kupelna/humidity" -m "65" -r
# Obývačka NEMÁ humidity sensor - zmazať ak existuje
mosquitto_pub -h $MQTT_HOST -t "stat/hvac/obyvacka/humidity" -n -r

echo ""
echo "=== Migration Complete ==="
echo "Old English topics deleted, new Slovak topics created."
echo "You can verify with: mosquitto_sub -h localhost -t '#' -v"
