#!/usr/bin/env bash
#
# decor-center TEST stand — TLS go-live (Phase C). Run as root AFTER the DNS A-records
# for test.monday-projects.uz and api.test.monday-projects.uz resolve to 144.91.64.70:
#   sudo bash deploy/native/tls-golive.sh
#
# Issues a Let's Encrypt cert for both names via the nginx plugin (adds 443 + 80->443
# redirect in place, exactly like the other sites on this host), then enforces HTTPS in
# Django and restarts the backend.
#
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "ERROR: run with sudo/root."; exit 1; }

ENV_FILE="/home/al-bukhari/decor-test/decor-center/backend/.env"
EMAIL="${CERTBOT_EMAIL:-tillo3305@gmail.com}"

echo "== DNS pre-check =="
ok=1
for d in test.monday-projects.uz api.test.monday-projects.uz; do
  ip="$(dig +short "$d" @8.8.8.8 | tail -1)"
  echo "  $d -> ${ip:-<none>}"
  [ "$ip" = "144.91.64.70" ] || ok=0
done
if [ "$ok" -ne 1 ]; then
  echo "ERROR: one or both names do not resolve to 144.91.64.70 yet. Wait for DNS, then re-run."
  exit 1
fi

echo "== issuing certificate (nginx plugin) =="
certbot --nginx \
  -d test.monday-projects.uz \
  -d api.test.monday-projects.uz \
  --non-interactive --agree-tos -m "$EMAIL" --redirect

nginx -t && systemctl reload nginx

echo "== enforce HTTPS in Django =="
sed -i 's/^DJANGO_SECURE_SSL_REDIRECT=.*/DJANGO_SECURE_SSL_REDIRECT=True/' "$ENV_FILE"
systemctl restart decor-test-backend
sleep 4
systemctl is-active --quiet decor-test-backend && echo "  backend active over HTTPS" || {
  echo "  ERROR: backend did not come back up"; journalctl -u decor-test-backend --no-pager -n 30; exit 1;
}

echo "DONE. https://test.monday-projects.uz  +  https://api.test.monday-projects.uz"
