#!/bin/bash
set -e

BAIKAL_URL="${BAIKAL_URL:-http://baikal:80}"
ADMIN_USER="${BAIKAL_ADMIN_USER:-admin}"
ADMIN_PASS="${BAIKAL_ADMIN_PASS:-admin}"
SMARTHOME_USER="${BAIKAL_USER:-smarthome}"
SMARTHOME_PASS="${BAIKAL_PASS:-smarthome}"
CALENDAR_NAME="${BAIKAL_CALENDAR_NAME:-default}"

echo "[baikal-init] Starting Baïkal initialization..."

# Wait for Baïkal to be ready
echo "[baikal-init] Waiting for Baïkal to be ready..."
for i in {1..30}; do
    if curl -sf "$BAIKAL_URL" > /dev/null 2>&1; then
        echo "[baikal-init] Baïkal is ready!"
        break
    fi
    echo "[baikal-init] Waiting for Baïkal... ($i/30)"
    sleep 2
done

# Check if smarthome user exists
echo "[baikal-init] Checking if user '$SMARTHOME_USER' exists..."
PROPFIND_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -u "$SMARTHOME_USER:$SMARTHOME_PASS" \
    -X PROPFIND \
    "$BAIKAL_URL/dav.php/calendars/$SMARTHOME_USER/" \
    --data '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>' \
    2>/dev/null)

HTTP_CODE=$(echo "$PROPFIND_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$PROPFIND_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    echo "[baikal-init] ❌ User '$SMARTHOME_USER' does not exist or wrong credentials"
    echo "[baikal-init] Please create user manually via Baïkal admin interface at $BAIKAL_URL/admin/"
    exit 1
elif [ "$HTTP_CODE" = "207" ]; then
    echo "[baikal-init] ✅ User '$SMARTHOME_USER' exists"
    
    # Check if default calendar exists
    if echo "$RESPONSE_BODY" | grep -q "<d:displayname>"; then
        CALENDAR_COUNT=$(echo "$RESPONSE_BODY" | grep -c "<d:displayname>" || echo "0")
        echo "[baikal-init] Found $CALENDAR_COUNT calendar(s) for user '$SMARTHOME_USER'"
        
        # If no calendars exist, create default calendar
        if [ "$CALENDAR_COUNT" -eq 0 ]; then
            echo "[baikal-init] Creating default calendar '$CALENDAR_NAME'..."
            
            CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
                -u "$SMARTHOME_USER:$SMARTHOME_PASS" \
                -X MKCALENDAR \
                "$BAIKAL_URL/dav.php/calendars/$SMARTHOME_USER/$CALENDAR_NAME/" \
                -H 'Content-Type: application/xml; charset=utf-8' \
                --data '<?xml version="1.0" encoding="utf-8" ?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>SmartHome Events</D:displayname>
      <C:calendar-description>Default calendar for smarthome automation events</C:calendar-description>
    </D:prop>
  </D:set>
</C:mkcalendar>')
            
            CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
            
            if [ "$CREATE_CODE" = "201" ]; then
                echo "[baikal-init] ✅ Calendar '$CALENDAR_NAME' created successfully"
            else
                echo "[baikal-init] ⚠️  Failed to create calendar (HTTP $CREATE_CODE)"
            fi
        else
            echo "[baikal-init] ✅ Calendars already exist, skipping creation"
        fi
    else
        echo "[baikal-init] ⚠️  No calendars found, attempting to create default..."
        
        CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
            -u "$SMARTHOME_USER:$SMARTHOME_PASS" \
            -X MKCALENDAR \
            "$BAIKAL_URL/dav.php/calendars/$SMARTHOME_USER/$CALENDAR_NAME/" \
            -H 'Content-Type: application/xml; charset=utf-8' \
            --data '<?xml version="1.0" encoding="utf-8" ?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>SmartHome Events</D:displayname>
      <C:calendar-description>Default calendar for smarthome automation events</C:calendar-description>
    </D:prop>
  </D:set>
</C:mkcalendar>')
        
        CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
        
        if [ "$CREATE_CODE" = "201" ]; then
            echo "[baikal-init] ✅ Calendar '$CALENDAR_NAME' created successfully"
        else
            echo "[baikal-init] ⚠️  Failed to create calendar (HTTP $CREATE_CODE)"
        fi
    fi
else
    echo "[baikal-init] ⚠️  Unexpected HTTP code: $HTTP_CODE"
fi

echo "[baikal-init] Initialization complete!"
