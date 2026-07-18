#!/usr/bin/env bash
#
# decor-center TEST stand — per-deploy script (run by GitHub Actions on push to main,
# and safe to run by hand). Runs as al-bukhari; only the final restart uses the narrow
# passwordless sudo installed by root-setup.sh.
#
set -euo pipefail

REPO_DIR="/home/al-bukhari/decor-test/decor-center"
cd "$REPO_DIR"

echo "[deploy] sync code -> origin/main"
git fetch --quiet origin
git reset --hard origin/main

echo "[deploy] backend deps + migrate + collectstatic"
cd "$REPO_DIR/backend"
.venv/bin/pip install -q -r requirements/prod.txt
export DJANGO_SETTINGS_MODULE=config.settings.prod
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput
if [ "${DECOR_SKIP_SEED:-0}" != "1" ]; then
  .venv/bin/python manage.py seed_initial_data
fi

echo "[deploy] frontend build (node 18, memory-guarded)"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 18 >/dev/null 2>&1 || true
cd "$REPO_DIR/frontend"
yarn install --frozen-lockfile --network-timeout 600000
GENERATE_SOURCEMAP=false CI=false NODE_OPTIONS=--max-old-space-size=2048 \
  REACT_APP_HOST_API=https://api-test.monday-projects.uz \
  yarn build

echo "[deploy] restart backend"
sudo /usr/bin/systemctl restart decor-test-backend
sleep 4
sudo /usr/bin/systemctl is-active decor-test-backend

echo "[deploy] done."
