#!/bin/bash
#
# Backup Verification Script
# 
# Overí integritu zálohy pred restore operáciou
#
# Usage: ./verify-backup.sh <backup_archive.tar.gz>

set -e

BACKUP_ARCHIVE="$1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

if [ -z "$BACKUP_ARCHIVE" ]; then
    echo "Usage: $0 <backup_archive.tar.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_ARCHIVE" ]; then
    log_error "Backup archive not found: $BACKUP_ARCHIVE"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backup Verification Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Archive: $BACKUP_ARCHIVE"
echo ""

# 1. Check archive integrity
log_info "Checking archive integrity..."
if tar -tzf "$BACKUP_ARCHIVE" > /dev/null 2>&1; then
    log_info "Archive is valid and readable"
else
    log_error "Archive is corrupted or invalid"
    exit 1
fi

# 2. Extract to temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

tar -xzf "$BACKUP_ARCHIVE" -C "$TEMP_DIR"
BACKUP_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)

# 3. Check manifest
if [ -f "$BACKUP_DIR/manifest.json" ]; then
    log_info "Manifest found"
    
    TIMESTAMP=$(jq -r '.timestamp' "$BACKUP_DIR/manifest.json" 2>/dev/null || echo "unknown")
    VERSION=$(jq -r '.version' "$BACKUP_DIR/manifest.json" 2>/dev/null || echo "unknown")
    
    echo "  Timestamp: $TIMESTAMP"
    echo "  Version:   $VERSION"
    
    # Verify checksum (sort files for consistent ordering)
    STORED_CHECKSUM=$(jq -r '.checksum' "$BACKUP_DIR/manifest.json" 2>/dev/null)
    CURRENT_CHECKSUM=$(find "$BACKUP_DIR" -type f -not -name "manifest.json" | sort | xargs cat | md5sum | cut -d' ' -f1)
    
    if [ "$STORED_CHECKSUM" = "$CURRENT_CHECKSUM" ]; then
        log_info "Checksum verification passed"
    else
        log_warn "Checksum mismatch (backup may be corrupted)"
        echo "  Expected: $STORED_CHECKSUM"
        echo "  Got:      $CURRENT_CHECKSUM"
    fi
else
    log_warn "Manifest not found (legacy backup?)"
fi

# 4. Check critical files
echo ""
log_info "Checking critical files..."

check_file() {
    if [ -f "$BACKUP_DIR/$1" ]; then
        SIZE=$(du -h "$BACKUP_DIR/$1" | cut -f1)
        log_info "$1 (${SIZE})"
        return 0
    else
        log_warn "$1 missing"
        return 1
    fi
}

CRITICAL_FILES=0
check_file "modes.yaml" && CRITICAL_FILES=$((CRITICAL_FILES + 1))
check_file "flows.json" && CRITICAL_FILES=$((CRITICAL_FILES + 1))

if [ $CRITICAL_FILES -eq 0 ]; then
    log_error "No critical files found in backup"
    exit 1
fi

# 5. Validate YAML/JSON syntax
echo ""
log_info "Validating file syntax..."

if [ -f "$BACKUP_DIR/modes.yaml" ]; then
    if python3 -c "import yaml; yaml.safe_load(open('$BACKUP_DIR/modes.yaml'))" 2>/dev/null; then
        log_info "modes.yaml syntax valid"
    else
        log_error "modes.yaml has invalid YAML syntax"
    fi
fi

if [ -f "$BACKUP_DIR/flows.json" ]; then
    if jq empty "$BACKUP_DIR/flows.json" 2>/dev/null; then
        log_info "flows.json syntax valid"
    else
        log_error "flows.json has invalid JSON syntax"
    fi
fi

# 6. List all files
echo ""
log_info "Backup contents:"
find "$BACKUP_DIR" -type f -not -name "manifest.json" | sed "s|$BACKUP_DIR/|  - |"

# 7. Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ARCHIVE_SIZE=$(du -h "$BACKUP_ARCHIVE" | cut -f1)
FILE_COUNT=$(find "$BACKUP_DIR" -type f | wc -l)

echo "Summary:"
echo "  Archive size: $ARCHIVE_SIZE"
echo "  File count:   $FILE_COUNT"
echo "  Critical files: $CRITICAL_FILES/2"
echo ""

if [ $CRITICAL_FILES -ge 1 ]; then
    log_info "Backup appears valid and ready for restore"
    exit 0
else
    log_error "Backup validation failed"
    exit 1
fi
