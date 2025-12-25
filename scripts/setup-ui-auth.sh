#!/bin/bash
#
# Basic UI Authentication Setup
#
# Vytvára jednoduchú password protection pre Next.js UI (LAN-only)

set -e

UI_DIR="/home/pi/smarthome/ui/smarthome-ui"
ENV_FILE="$UI_DIR/.env.local"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "UI Authentication Setup (LAN-only)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Generate secret for session cookies
SECRET=$(openssl rand -base64 32)

echo "Generated session secret: $SECRET"
echo ""

# Prompt for username and password
read -p "Enter UI username [admin]: " UI_USER
UI_USER=${UI_USER:-admin}

echo -n "Enter UI password: "
read -s UI_PASSWORD
echo ""

# Hash password (bcrypt would be better, but this is simple for LAN)
PASSWORD_HASH=$(echo -n "$UI_PASSWORD" | sha256sum | cut -d' ' -f1)

# Create .env.local
cat > "$ENV_FILE" << EOF
# UI Authentication (LAN-only, basic protection)
# Generated: $(date -Iseconds)

UI_AUTH_ENABLED=true
UI_AUTH_USERNAME=$UI_USER
UI_AUTH_PASSWORD_HASH=$PASSWORD_HASH
SESSION_SECRET=$SECRET

# Session expires after 24 hours
SESSION_MAX_AGE=86400
EOF

chmod 600 "$ENV_FILE"

echo "✓ Configuration saved to $ENV_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Add middleware to UI (src/middleware.ts)"
echo "2. Rebuild UI:"
echo "   cd $UI_DIR"
echo "   npm run build"
echo ""
echo "3. Restart UI container:"
echo "   docker compose build ui"
echo "   docker compose up -d ui"
echo ""
echo "4. Login at http://localhost:3000"
echo "   Username: $UI_USER"
echo "   Password: <your_password>"
echo ""
echo "⚠️  Note: This is basic protection for LAN-only access."
echo "   For external access, use VPN or proper OAuth2."
echo ""
