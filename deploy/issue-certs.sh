#!/usr/bin/env bash
set -euo pipefail

# One-time Let's Encrypt issuance for the decor domains, via the shared certbot.
# Run ONCE at go-live, AFTER the A records for all three names point to this server.
# Then re-run deploy/deploy.sh to switch the vhosts from HTTP to SSL.

RENTAL_DIR="${SHARED_NGINX_DIR:-/home/rakhmonov/hadware-raxmonov}"
EMAIL="${CERTBOT_EMAIL:-admin@lokomotiv-decor.uz}"

cd "$RENTAL_DIR"
echo "[certs] requesting cert for lokomotiv-decor.uz, www, api ..."
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d lokomotiv-decor.uz -d www.lokomotiv-decor.uz -d api.lokomotiv-decor.uz \
  --email "$EMAIL" --agree-tos --no-eff-email -n

echo "[certs] done. Now run: ~/decor/deploy/deploy.sh  (switches vhosts to SSL)."
