#!/usr/bin/env bash
#
# decor-center TEST stand — one-time privileged setup (Phase B).
# Run ONCE as root, from the repo root:   sudo bash deploy/native/root-setup.sh
#
# Idempotent and defensive: it only ADDS resources for this project. It never edits another
# project's unit/vhost, and it refuses to reload nginx if `nginx -t` fails — so the other
# live sites on this host cannot be taken down by a bad config here.
#
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "ERROR: run with sudo/root."; exit 1; }

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NATIVE="$REPO_DIR/deploy/native"
VENV_PY="$REPO_DIR/backend/.venv/bin/python"

echo "== [1/6] swap (headroom for InsightFace + frontend builds; box has no swap) =="
if swapon --show | grep -q .; then
  echo "  swap already active -> skip"
else
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  2G swap enabled"
fi

echo "== [2/6] InsightFace model into root's cache (service runs as root) =="
if "$VENV_PY" -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']).prepare(ctx_id=-1, det_size=(640,640))" >/tmp/insightface-warmup.log 2>&1; then
  echo "  buffalo_sc ready under /root/.insightface"
else
  echo "  WARN: model prefetch failed (see /tmp/insightface-warmup.log); it will lazy-load at runtime instead"
fi

echo "== [3/6] systemd units =="
install -m 0644 "$NATIVE/decor-test-backend.socket"  /etc/systemd/system/decor-test-backend.socket
install -m 0644 "$NATIVE/decor-test-backend.service" /etc/systemd/system/decor-test-backend.service
systemctl daemon-reload
systemctl enable --now decor-test-backend.socket
systemctl enable decor-test-backend.service
systemctl restart decor-test-backend.service
sleep 4
systemctl is-active --quiet decor-test-backend.service \
  && echo "  decor-test-backend: active" \
  || { echo "  ERROR: service failed to start"; journalctl -u decor-test-backend --no-pager -n 30; exit 1; }

echo "== [4/6] nginx vhosts (HTTP; certbot upgrades to HTTPS later) =="
install -m 0644 "$NATIVE/nginx-test.monday-projects.uz.conf"     /etc/nginx/sites-available/decor-test
install -m 0644 "$NATIVE/nginx-api-test.monday-projects.uz.conf" /etc/nginx/sites-available/decor-test-api
ln -sf /etc/nginx/sites-available/decor-test     /etc/nginx/sites-enabled/decor-test
ln -sf /etc/nginx/sites-available/decor-test-api /etc/nginx/sites-enabled/decor-test-api
if nginx -t; then
  systemctl reload nginx
  echo "  nginx reloaded (other sites untouched)"
else
  echo "  ERROR: nginx -t failed -> NOT reloading. Rolling back this project's symlinks."
  rm -f /etc/nginx/sites-enabled/decor-test /etc/nginx/sites-enabled/decor-test-api
  exit 1
fi

echo "== [5/6] sudoers drop-in (narrow NOPASSWD for CI/CD restart) =="
install -m 0440 "$NATIVE/sudoers-decor-test" /etc/sudoers.d/decor-test
visudo -cf /etc/sudoers.d/decor-test

echo "== [6/6] status =="
systemctl --no-pager --full status decor-test-backend.service | head -12 || true
echo
echo "DONE (HTTP). Local checks:"
echo "  curl -s -H 'Host: api-test.monday-projects.uz' http://127.0.0.1/health/"
echo "Once DNS for test/api-test resolves to 144.91.64.70, issue TLS:"
echo "  sudo bash $NATIVE/tls-golive.sh"
