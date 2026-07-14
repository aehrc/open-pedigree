#!/usr/bin/env sh
# Waits for the FHIR server to be ready, then POSTs all fixture bundles.
# Each bundle uses PUT requests internally, so resources are created or replaced
# even if they existed in a deleted state from a previous run.
# Use "docker compose down -v" before "docker compose up" for a guaranteed clean start.

FHIR_BASE="${FHIR_BASE_URL:-http://smart-launcher:8080/v/r4/fhir}"
FIXTURES_DIR="$(dirname "$0")"

echo "[seed] Waiting for FHIR server at $FHIR_BASE ..."
until curl -sf "$FHIR_BASE/metadata" > /dev/null 2>&1; do
    sleep 3
done
echo "[seed] FHIR server is ready."

FAILED=0
for bundle in "$FIXTURES_DIR"/*.json; do
    echo "[seed] Posting $bundle ..."
    RESPONSE=$(curl -s -o /tmp/seed_response.json -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/fhir+json" \
        -d "@$bundle" \
        "$FHIR_BASE")
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ]; then
        echo "[seed] OK ($RESPONSE): $bundle"
    else
        echo "[seed] ERROR ($RESPONSE): $bundle"
        cat /tmp/seed_response.json
        FAILED=1
    fi
done

if [ "$FAILED" = "1" ]; then
    echo "[seed] One or more bundles failed. Run 'docker compose down -v' then 'docker compose up' for a clean start."
    exit 1
fi

echo "[seed] Seeding complete."
