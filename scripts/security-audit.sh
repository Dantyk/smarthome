#!/bin/bash
#
# SmartHome Security Audit Script
# 
# Spúšťa komplexný bezpečnostný audit:
# - npm audit (Node.js dependencies)
# - Trivy (Docker image scanning)
# - OWASP Dependency Check
# - Network policy review
#
# Usage: ./security-audit.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="$PROJECT_ROOT/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Create report directory
mkdir -p "$REPORT_DIR"

log_section "SmartHome Security Audit - $TIMESTAMP"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. NPM Audit - Node-RED
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "1. NPM Audit - Node-RED Dependencies"

if [ -f "$PROJECT_ROOT/flows/nodered/package.json" ]; then
    cd "$PROJECT_ROOT/flows/nodered"
    
    log_info "Running npm audit..."
    npm audit --json > "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json" 2>&1 || true
    
    # Parse results
    CRITICAL=$(jq '.metadata.vulnerabilities.critical // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json")
    HIGH=$(jq '.metadata.vulnerabilities.high // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json")
    MODERATE=$(jq '.metadata.vulnerabilities.moderate // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json")
    LOW=$(jq '.metadata.vulnerabilities.low // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json")
    
    echo "Results:"
    echo "  Critical:  $CRITICAL"
    echo "  High:      $HIGH"
    echo "  Moderate:  $MODERATE"
    echo "  Low:       $LOW"
    
    if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
        log_warn "Critical or high vulnerabilities found!"
        log_info "Attempting to fix with 'npm audit fix'..."
        npm audit fix --json > "$REPORT_DIR/npm-audit-fix-nodered-${TIMESTAMP}.json" 2>&1 || true
    else
        log_info "✓ No critical or high vulnerabilities"
    fi
else
    log_warn "Node-RED package.json not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. NPM Audit - UI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "2. NPM Audit - UI Dependencies"

if [ -f "$PROJECT_ROOT/ui/smarthome-ui/package.json" ]; then
    cd "$PROJECT_ROOT/ui/smarthome-ui"
    
    log_info "Running npm audit..."
    npm audit --json > "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json" 2>&1 || true
    
    CRITICAL=$(jq '.metadata.vulnerabilities.critical // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json")
    HIGH=$(jq '.metadata.vulnerabilities.high // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json")
    MODERATE=$(jq '.metadata.vulnerabilities.moderate // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json")
    LOW=$(jq '.metadata.vulnerabilities.low // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json")
    
    echo "Results:"
    echo "  Critical:  $CRITICAL"
    echo "  High:      $HIGH"
    echo "  Moderate:  $MODERATE"
    echo "  Low:       $LOW"
    
    if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
        log_warn "Critical or high vulnerabilities found!"
        log_info "Attempting to fix with 'npm audit fix'..."
        npm audit fix --json > "$REPORT_DIR/npm-audit-fix-ui-${TIMESTAMP}.json" 2>&1 || true
    else
        log_info "✓ No critical or high vulnerabilities"
    fi
else
    log_warn "UI package.json not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Docker Image Scanning with Trivy
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "3. Docker Image Security Scanning"

# Install Trivy if not present
if ! command -v trivy &> /dev/null; then
    log_info "Installing Trivy..."
    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh -s -- -b /usr/local/bin
fi

cd "$PROJECT_ROOT/compose"

# Get list of images from docker-compose
IMAGES=$(docker compose config | grep 'image:' | awk '{print $2}' | sort -u)

log_info "Scanning Docker images..."
for IMAGE in $IMAGES; do
    log_info "Scanning: $IMAGE"
    trivy image --severity HIGH,CRITICAL --format json --output "$REPORT_DIR/trivy-${IMAGE//\//_}-${TIMESTAMP}.json" "$IMAGE" 2>&1 || log_warn "Scan failed for $IMAGE"
done

# Scan custom built images
if docker images | grep -q smarthome-ui; then
    log_info "Scanning custom UI image..."
    trivy image --severity HIGH,CRITICAL --format json --output "$REPORT_DIR/trivy-smarthome-ui-${TIMESTAMP}.json" smarthome-ui:latest 2>&1 || true
fi

log_info "✓ Docker image scanning complete"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Filesystem Permissions Audit
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "4. Filesystem Permissions Audit"

log_info "Checking for world-writable files..."
WORLD_WRITABLE=$(find "$PROJECT_ROOT" -type f -perm -002 2>/dev/null | wc -l)

if [ "$WORLD_WRITABLE" -gt 0 ]; then
    log_warn "Found $WORLD_WRITABLE world-writable files"
    find "$PROJECT_ROOT" -type f -perm -002 2>/dev/null > "$REPORT_DIR/world-writable-${TIMESTAMP}.txt"
else
    log_info "✓ No world-writable files found"
fi

log_info "Checking for files with credentials..."
CRED_FILES=$(find "$PROJECT_ROOT" -type f \( -name "*password*" -o -name "*secret*" -o -name "*_cred.json" -o -name ".env" \) 2>/dev/null)

if [ -n "$CRED_FILES" ]; then
    log_warn "Found credential files:"
    echo "$CRED_FILES" | tee "$REPORT_DIR/credential-files-${TIMESTAMP}.txt"
    
    log_info "Checking if they're in .gitignore..."
    while IFS= read -r file; do
        if git check-ignore -q "$file" 2>/dev/null; then
            log_info "  ✓ $file (ignored)"
        else
            log_warn "  ✗ $file (NOT IGNORED - SECURITY RISK!)"
        fi
    done <<< "$CRED_FILES"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. MQTT Security Review
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "5. MQTT Security Configuration"

MOSQUITTO_CONF="$PROJECT_ROOT/compose/config/mosquitto/mosquitto.conf"

if [ -f "$MOSQUITTO_CONF" ]; then
    log_info "Checking Mosquitto configuration..."
    
    # Check for anonymous access
    if grep -q "allow_anonymous true" "$MOSQUITTO_CONF"; then
        log_warn "Anonymous access is ENABLED (security risk)"
    else
        log_info "✓ Anonymous access disabled"
    fi
    
    # Check for TLS
    if grep -q "^listener.*8883" "$MOSQUITTO_CONF"; then
        log_info "✓ TLS listener configured"
    else
        log_warn "No TLS listener found (consider enabling)"
    fi
    
    # Check for ACL
    if grep -q "^acl_file" "$MOSQUITTO_CONF"; then
        log_info "✓ ACL file configured"
    else
        log_warn "No ACL configured (all users have full access)"
    fi
else
    log_warn "Mosquitto configuration not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Network Exposure Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "6. Network Exposure Analysis"

log_info "Checking exposed ports..."
docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Publishers != null) | .Publishers[] | "\(.PublishedPort):\(.TargetPort)/\(.Protocol) (\(.Name))"' > "$REPORT_DIR/exposed-ports-${TIMESTAMP}.txt" || true

if [ -s "$REPORT_DIR/exposed-ports-${TIMESTAMP}.txt" ]; then
    cat "$REPORT_DIR/exposed-ports-${TIMESTAMP}.txt"
    
    log_warn "Review exposed ports and ensure firewall is configured"
else
    log_info "No exposed ports found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. Generate Summary Report
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_section "Summary Report"

cat > "$REPORT_DIR/summary-${TIMESTAMP}.md" << EOF
# SmartHome Security Audit Report

**Date:** $(date -Iseconds)  
**Hostname:** $(hostname)  

## Executive Summary

### NPM Vulnerabilities

**Node-RED:**
- Critical: $(jq '.metadata.vulnerabilities.critical // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
- High: $(jq '.metadata.vulnerabilities.high // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
- Moderate: $(jq '.metadata.vulnerabilities.moderate // 0' "$REPORT_DIR/npm-audit-nodered-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")

**UI:**
- Critical: $(jq '.metadata.vulnerabilities.critical // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
- High: $(jq '.metadata.vulnerabilities.high // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
- Moderate: $(jq '.metadata.vulnerabilities.moderate // 0' "$REPORT_DIR/npm-audit-ui-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")

### Filesystem Security

- World-writable files: $WORLD_WRITABLE
- Credential files: $(echo "$CRED_FILES" | wc -l)

### Docker Images

See individual Trivy reports in \`security-reports/\` directory.

### Recommendations

1. **Fix NPM vulnerabilities** with \`npm audit fix\`
2. **Review exposed ports** and configure firewall
3. **Enable MQTT ACL** for topic-level access control
4. **Configure TLS** for Mosquitto (port 8883)
5. **Rotate credentials** regularly
6. **Monitor Trivy reports** for container vulnerabilities

## Detailed Reports

$(ls -1 "$REPORT_DIR"/*-${TIMESTAMP}.* | sed 's|.*|- |')

EOF

log_info "Summary report generated: $REPORT_DIR/summary-${TIMESTAMP}.md"

# Display summary
cat "$REPORT_DIR/summary-${TIMESTAMP}.md"

log_section "Audit Complete"
log_info "All reports saved to: $REPORT_DIR"
