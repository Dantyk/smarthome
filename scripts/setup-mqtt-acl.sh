#!/bin/bash
#
# MQTT ACL Setup Script
# 
# Vytvára užívateľov a nastavuje prístupové práva pre MQTT broker

set -e

MOSQUITTO_DIR="/home/pi/smarthome/compose/config/mosquitto"
PASSWORD_FILE="$MOSQUITTO_DIR/passwords"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MQTT User & ACL Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create password file
if [ -f "$PASSWORD_FILE" ]; then
    echo "⚠️  Password file already exists. Backup created."
    cp "$PASSWORD_FILE" "$PASSWORD_FILE.bak.$(date +%s)"
fi

# Create users
echo "Creating MQTT users..."

# Admin (full access)
echo -n "Enter password for 'admin': "
read -s ADMIN_PASS
echo ""
mosquitto_passwd -c "$PASSWORD_FILE" admin <<< "$ADMIN_PASS"

# Node-RED
echo -n "Enter password for 'nodered': "
read -s NODERED_PASS
echo ""
mosquitto_passwd -b "$PASSWORD_FILE" nodered "$NODERED_PASS"

# UI
echo -n "Enter password for 'ui': "
read -s UI_PASS
echo ""
mosquitto_passwd -b "$PASSWORD_FILE" ui "$UI_PASS"

# Monitor (read-only dashboards)
echo -n "Enter password for 'monitor': "
read -s MONITOR_PASS
echo ""
mosquitto_passwd -b "$PASSWORD_FILE" monitor "$MONITOR_PASS"

# Optional: Zigbee2MQTT
read -p "Create user for Zigbee2MQTT? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -n "Enter password for 'zigbee2mqtt': "
    read -s Z2M_PASS
    echo ""
    mosquitto_passwd -b "$PASSWORD_FILE" zigbee2mqtt "$Z2M_PASS"
fi

# Optional: Z-Wave
read -p "Create user for Z-Wave? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -n "Enter password for 'zwave': "
    read -s ZWAVE_PASS
    echo ""
    mosquitto_passwd -b "$PASSWORD_FILE" zwave "$ZWAVE_PASS"
fi

# Set permissions
chmod 600 "$PASSWORD_FILE"

echo ""
echo "✓ Password file created: $PASSWORD_FILE"
echo "✓ ACL file ready: $MOSQUITTO_DIR/acl.conf"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Update mosquitto.conf:"
echo "   allow_anonymous false"
echo "   password_file /mosquitto/config/passwords"
echo "   acl_file /mosquitto/config/acl.conf"
echo ""
echo "2. Update .env with credentials:"
echo "   MQTT_USER=nodered"
echo "   MQTT_PASSWORD=<nodered_password>"
echo "   MQTT_UI_USER=ui"
echo "   MQTT_UI_PASSWORD=<ui_password>"
echo ""
echo "3. Restart Mosquitto:"
echo "   docker compose restart mosquitto"
echo ""
echo "4. Test connection:"
echo "   mosquitto_sub -h localhost -u monitor -P <password> -t 'stat/#' -v"
echo ""
