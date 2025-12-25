#!/bin/bash
#
# Network Security Hardening Script
# 
# Pre interné siete (LAN-only deployment)

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Network Security Hardening"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Detect LAN subnet
LOCAL_IP=$(hostname -I | awk '{print $1}')
SUBNET=$(echo "$LOCAL_IP" | sed 's/\.[0-9]*$/\.0\/24/')

echo "Detected local IP: $LOCAL_IP"
echo "Detected subnet:   $SUBNET"
echo ""

# Check if ufw is installed
if ! command -v ufw &> /dev/null; then
    echo "Installing ufw..."
    sudo apt-get update
    sudo apt-get install -y ufw
fi

# Reset ufw (optional)
read -p "Reset firewall rules? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo ufw --force reset
fi

# Default policies
echo "Setting default policies..."
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH access (always allow to prevent lockout)
echo "Allowing SSH..."
sudo ufw allow 22/tcp comment 'SSH'

# LAN-only access to SmartHome services
echo "Configuring LAN-only access..."

sudo ufw allow from "$SUBNET" to any port 1880 proto tcp comment 'Node-RED (LAN)'
sudo ufw allow from "$SUBNET" to any port 1883 proto tcp comment 'MQTT (LAN)'
sudo ufw allow from "$SUBNET" to any port 9001 proto tcp comment 'MQTT WS (LAN)'
sudo ufw allow from "$SUBNET" to any port 3000 proto tcp comment 'UI (LAN)'
sudo ufw allow from "$SUBNET" to any port 8088 proto tcp comment 'UI external (LAN)'
sudo ufw allow from "$SUBNET" to any port 9090 proto tcp comment 'Prometheus (LAN)'
sudo ufw allow from "$SUBNET" to any port 9093 proto tcp comment 'Alertmanager (LAN)'
sudo ufw allow from "$SUBNET" to any port 16686 proto tcp comment 'Jaeger UI (LAN)'
sudo ufw allow from "$SUBNET" to any port 3001 proto tcp comment 'Grafana (LAN)'
sudo ufw allow from "$SUBNET" to any port 8086 proto tcp comment 'InfluxDB (LAN)'

# Optional: Allow from specific trusted IPs only
read -p "Add additional trusted IP? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter trusted IP address: " TRUSTED_IP
    sudo ufw allow from "$TRUSTED_IP" comment "Trusted device"
fi

# Enable firewall
echo ""
echo "Enabling firewall..."
sudo ufw --force enable

# Show status
echo ""
sudo ufw status verbose

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Security Hardening Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ Firewall enabled"
echo "✓ LAN-only access configured ($SUBNET)"
echo "✓ SSH access preserved"
echo ""
echo "⚠️  Important:"
echo "- Test connections from LAN devices"
echo "- Connections from outside $SUBNET will be blocked"
echo "- Use VPN for remote access"
echo ""
echo "To disable firewall:"
echo "  sudo ufw disable"
echo ""
