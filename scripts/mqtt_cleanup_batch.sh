#!/bin/bash

# Batch 1: virt/room topics
mosquitto_pub -h localhost -t "virt/room/living/override" -n -r
mosquitto_pub -h localhost -t "virt/room/living/override_request" -n -r
mosquitto_pub -h localhost -t "virt/room/bedroom/override" -n -r
mosquitto_pub -h localhost -t "virt/room/bedroom/override_request" -n -r
mosquitto_pub -h localhost -t "virt/room/kidroom1/enabled" -n -r
mosquitto_pub -h localhost -t "virt/room/kidroom1/override" -n -r
mosquitto_pub -h localhost -t "virt/room/kidroom1/override_request" -n -r
mosquitto_pub -h localhost -t "virt/room/kitchen/target_temp" -n -r
mosquitto_pub -h localhost -t "virt/room/kitchen/enabled" -n -r
mosquitto_pub -h localhost -t "virt/room/kitchen/override" -n -r
mosquitto_pub -h localhost -t "virt/room/kitchen/override_request" -n -r
mosquitto_pub -h localhost -t "virt/room/bathroom/target_temp" -n -r
mosquitto_pub -h localhost -t "virt/room/bathroom/enabled" -n -r
mosquitto_pub -h localhost -t "virt/room/bathroom/override" -n -r
mosquitto_pub -h localhost -t "virt/room/bathroom/override_request" -n -r
echo "✓ Batch 1 done"

# Batch 2: stat/hvac topics
for room in living bedroom kidroom1 kitchen bathroom; do
  mosquitto_pub -h localhost -t "stat/hvac/$room/enabled" -n -r
  mosquitto_pub -h localhost -t "stat/hvac/$room/current_temp" -n -r
  mosquitto_pub -h localhost -t "stat/hvac/$room/humidity" -n -r
done
echo "✓ Batch 2 done"

# Batch 3: virt/boost topics
for room in living bedroom kidroom1 kitchen bathroom; do
  mosquitto_pub -h localhost -t "virt/boost/$room/minutes" -n -r
  mosquitto_pub -h localhost -t "virt/boost/$room/target_temp" -n -r
done
echo "✓ Batch 3 done"

# Batch 4: virt/offset topics
for room in living bedroom kidroom1 kitchen bathroom; do
  mosquitto_pub -h localhost -t "virt/offset/$room/value" -n -r
done
echo "✓ Batch 4 done"

# Batch 5: cmd/hvac topics
for room in living bedroom kidroom1 kitchen bathroom; do
  mosquitto_pub -h localhost -t "cmd/hvac/$room/setpoint" -n -r
  mosquitto_pub -h localhost -t "cmd/hvac/$room/override" -n -r
  mosquitto_pub -h localhost -t "cmd/hvac/$room/override_duration" -n -r
  mosquitto_pub -h localhost -t "cmd/hvac/$room/enabled" -n -r
done
echo "✓ Batch 5 done"

echo "✓ All English room topics cleared"
