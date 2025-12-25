#!/bin/bash
# Run all load tests
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$RESULTS_DIR"

echo "Running API stress test..."
export BASE_URL="http://localhost:3000"
k6 run --out json="$RESULTS_DIR/api-${TIMESTAMP}.json" "$SCRIPT_DIR/api-stress.js"

echo "Done! Results: $RESULTS_DIR"
