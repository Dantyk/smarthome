#!/bin/bash
# Vyčisti starý flow "Planner: Edge-Based Scheduling" z anglických názvov
# Odstráni legacy test nodes: planner_test_inject, planner_prepare_schedules,
# planner_living, planner_bedroom, planner_kitchen, planner_kidroom1,
# planner_mqtt_living, planner_mqtt_bedroom, planner_mqtt_kitchen, planner_mqtt_kidroom1

set -e

FLOWS_FILE="/home/pi/smarthome/flows/nodered/flows.json"
BACKUP_FILE="/home/pi/smarthome/flows/nodered/flows.json.bak_$(date +%s)"

echo "[$(date)] Zálohujem flows.json → $BACKUP_FILE"
cp "$FLOWS_FILE" "$BACKUP_FILE"

echo "[$(date)] Odstraňujem legacy planner test nodes s anglickými názvami..."

# Node IDs na zmazanie
REMOVE_IDS=(
  "planner_test_inject"
  "planner_prepare_schedules"
  "planner_living"
  "planner_bedroom"
  "planner_kitchen"
  "planner_kidroom1"
  "planner_mqtt_living"
  "planner_mqtt_bedroom"
  "planner_mqtt_kitchen"
  "planner_mqtt_kidroom1"
)

# jq filter na odstránenie uzlov podľa ID
FILTER='map(select('
for id in "${REMOVE_IDS[@]}"; do
  FILTER="${FILTER}.id != \"$id\" and "
done
FILTER="${FILTER%% and }))' # remove trailing " and "

jq "$FILTER" "$FLOWS_FILE" > "${FLOWS_FILE}.tmp"
mv "${FLOWS_FILE}.tmp" "$FLOWS_FILE"

echo "[$(date)] ✓ Odstránených ${#REMOVE_IDS[@]} legacy uzlov"
echo "[$(date)] Reštartuj Node-RED: cd compose && docker compose restart nodered"
