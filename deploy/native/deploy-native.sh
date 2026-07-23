#!/usr/bin/env bash
#
# decor-center prod (native stand) — per-deploy script. Invoked by the
# deploy-production.yml workflow, which first syncs the repo to origin/production; this
# script does NOT touch git. To run by hand, sync first:
#   git fetch origin && git reset --hard origin/production
# Runs as al-bukhari; only the final restart uses the narrow passwordless sudo installed
# by root-setup.sh.
#
set -euo pipefail

REPO_DIR="/home/al-bukhari/decor-test/decor-center"
cd "$REPO_DIR"

# nginx serves /media/ directly (see nginx-api...conf) but runs as www-data. Every dir in the
# path to the media files must be traversable (o+x). The media root itself is created 0700 by
# the app user, which is the one that 403s; its subdirs (root:www-data 0755) and files (0644)
# are already world-readable. We own these dirs, so make them traversable without sudo.
echo "[deploy] ensure nginx can traverse to the media dir"
chmod o+x "$HOME" "$HOME/decor-test" "$REPO_DIR" "$REPO_DIR/backend" "$REPO_DIR/backend/media" 2>/dev/null || true

echo "[deploy] backend deps + migrate + collectstatic"
cd "$REPO_DIR/backend"
.venv/bin/pip install -q -r requirements/prod.txt
export DJANGO_SETTINGS_MODULE=config.settings.prod
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput
if [ "${DECOR_SKIP_SEED:-0}" != "1" ]; then
  .venv/bin/python manage.py seed_initial_data
fi

# Load the curated survey content (standard + demo surveys) on a DB with none yet.
# Idempotent and independent of DECOR_SKIP_SEED: a no-op once any survey exists, so it
# never overwrites admin edits. This is what actually seeds surveys on the native stand
# (the Docker entrypoint is not used here).
.venv/bin/python manage.py load_survey_content

echo "[deploy] frontend build (node 18, memory-guarded)"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# Use nvm's default node (v22 here; react-scripts 5 builds fine on it). node 18 is not installed.
nvm use default >/dev/null 2>&1 || true
cd "$REPO_DIR/frontend"
yarn install --frozen-lockfile --network-timeout 600000
GENERATE_SOURCEMAP=false CI=false NODE_OPTIONS=--max-old-space-size=2048 \
  REACT_APP_HOST_API=https://api.test.monday-projects.uz \
  yarn build

echo "[deploy] restart backend"
sudo /usr/bin/systemctl restart decor-test-backend
sleep 4
sudo /usr/bin/systemctl is-active decor-test-backend

echo "[deploy] done."
