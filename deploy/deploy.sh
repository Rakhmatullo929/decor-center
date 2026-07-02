#!/usr/bin/env bash
set -euo pipefail

# decor production deploy — build-on-server, mirrors the rental_track pattern.
# Run from anywhere; resolves the repo root from this script's location.

cd "$(dirname "$0")/.."
export COMPOSE_PROJECT_NAME=decor
COMPOSE="docker compose -f docker-compose.prod.yml"

# Shared rental_track nginx that owns 80/443 and fronts every site on this box.
SHARED_DIR="${SHARED_NGINX_DIR:-/home/rakhmonov/hadware-raxmonov}"
SHARED_CONF_D="$SHARED_DIR/deploy/nginx/conf.d"
SHARED_NGINX="${SHARED_NGINX_CONTAINER:-rental_track-nginx-1}"

# The shared external network must exist (created by the rental_track stack).
docker network inspect rental_track_default >/dev/null 2>&1 \
  || { echo "ERROR: network rental_track_default not found (is the rental_track stack up?)"; exit 1; }

echo "[deploy] building + starting decor stack..."
$COMPOSE up -d --build

echo "[deploy] syncing nginx vhosts into shared nginx ($SHARED_CONF_D)..."
mkdir -p "$SHARED_CONF_D"
# Drop vhost files from any previous domain so stale server_names don't linger in nginx.
rm -f "$SHARED_CONF_D"/decor-lokomotiv-decor.conf "$SHARED_CONF_D"/decor-api.lokomotiv-decor.conf
# Single SAN cert lives under .../live/lokomotiv-decor.uz/. Use SSL vhosts only once it exists.
if docker exec "$SHARED_NGINX" test -f /etc/letsencrypt/live/lokomotiv-decor.uz/fullchain.pem 2>/dev/null; then
  VARIANT=ssl
else
  VARIANT=http
  echo "[deploy] no cert yet -> installing HTTP-only vhosts (run deploy/issue-certs.sh after DNS is live)"
fi
cp "deploy/nginx/lokomotiv-decor.$VARIANT.conf"     "$SHARED_CONF_D/decor-frontend.conf"
cp "deploy/nginx/api.lokomotiv-decor.$VARIANT.conf" "$SHARED_CONF_D/decor-api.conf"

echo "[deploy] validating + reloading shared nginx..."
docker exec "$SHARED_NGINX" nginx -t
docker exec "$SHARED_NGINX" nginx -s reload

$COMPOSE ps
echo "[deploy] done."
