#!/bin/bash
# SmartHome - Service Status Checker
# Kontrola stavu všetkých služieb podľa profilov

set -e

COMPOSE_DIR="/home/pi/smarthome/compose"
cd "$COMPOSE_DIR"

echo "════════════════════════════════════════════════════════════"
echo "  SmartHome - Service Status Check"
echo "════════════════════════════════════════════════════════════"
echo ""

# Load COMPOSE_PROFILES from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep COMPOSE_PROFILES | xargs)
fi

echo "📋 Active profiles: ${COMPOSE_PROFILES:-none}"
echo ""

# Function to check service status
check_service() {
    local service=$1
    local profile=$2
    local port=$3
    
    # Check if profile is enabled
    if [[ "$COMPOSE_PROFILES" != *"$profile"* ]] && [ "$profile" != "default" ]; then
        echo "  ⏸️  $service (profile '$profile' not enabled)"
        return
    fi
    
    # Get container status
    local status=$(docker compose ps $service 2>/dev/null | tail -n +2 | awk '{print $7}')
    
    if [ -z "$status" ]; then
        echo "  ❌ $service - NOT RUNNING"
        return
    fi
    
    if [[ "$status" == *"Up"* ]]; then
        echo "  ✅ $service - Running"
        if [ -n "$port" ]; then
            echo "     🌐 http://localhost:$port"
        fi
    elif [[ "$status" == *"Exited"* ]]; then
        local exit_code=$(docker compose ps $service 2>/dev/null | tail -n +2 | grep -oP 'Exited \(\K[0-9]+')
        echo "  ❌ $service - Exited (code: $exit_code)"
        echo "     💡 Check logs: docker logs compose-${service}-1"
    else
        echo "  ⚠️  $service - $status"
    fi
}

echo "🔧 Core Services (always running):"
echo "────────────────────────────────────────────────────────────"
check_service "mosquitto" "default" "1883"
check_service "nodered" "default" "1880"
check_service "baikal" "default" "8800"
check_service "ui" "default" "8088"
echo ""

echo "📊 Metrics (profile: metrics):"
echo "────────────────────────────────────────────────────────────"
check_service "influxdb" "metrics" "8086"
check_service "grafana" "metrics" "3000"
echo ""

echo "🔌 Device Integrations:"
echo "────────────────────────────────────────────────────────────"
check_service "zigbee2mqtt" "zigbee" "8090"
check_service "zwavejsui" "zwave" "8091"
echo ""

echo "📢 Notifications (profile: notify):"
echo "────────────────────────────────────────────────────────────"
check_service "apprise" "notify" "8000"
echo ""

# Check InfluxDB data collection
if [[ "$COMPOSE_PROFILES" == *"metrics"* ]]; then
    echo "📈 InfluxDB Data Check:"
    echo "────────────────────────────────────────────────────────────"
    
    # Get token from .env
    INFLUX_TOKEN=$(grep INFLUX_TOKEN .env | cut -d'=' -f2)
    
    if [ "$INFLUX_TOKEN" == "REPLACE_ME" ] || [ "$INFLUX_TOKEN" == "changeme" ]; then
        echo "  ⚠️  InfluxDB token not configured!"
        echo "     Run: openssl rand -hex 32"
        echo "     Then set INFLUX_TOKEN in .env"
    else
        # Try to count measurements
        local count=$(curl -s "http://localhost:8086/api/v2/query?orgID=Home" \
            -H "Authorization: Token ${INFLUX_TOKEN}" \
            -H "Content-Type: application/vnd.flux" \
            -d 'from(bucket:"smarthome") |> range(start: -24h) |> count()' 2>/dev/null | grep -c "_value" || echo "0")
        
        if [ "$count" -gt 0 ]; then
            echo "  ✅ Data collection active ($count measurements in last 24h)"
        else
            echo "  ⚠️  No data in InfluxDB yet"
            echo "     💡 Check Node-RED flows are configured"
        fi
    fi
    echo ""
fi

echo "════════════════════════════════════════════════════════════"
echo ""
echo "💡 Tips:"
echo "  • View all logs:    docker compose logs -f"
echo "  • Restart service:  docker compose restart <service>"
echo "  • Enable profile:   Edit COMPOSE_PROFILES in .env"
echo "  • Check README.md for service setup instructions"
echo ""
