#!/usr/bin/env sh
set -e

echo "[entrypoint] migrate..."
python manage.py migrate --noinput

# seed_initial_data bootstraps the canonical specialty roster + system accounts. Skip it
# on a DB that already holds imported/real data (set DEPO_SKIP_SEED=1) so the canonical
# roster is not re-added alongside the imported specialties. Leave unset on a fresh deploy.
if [ "${DEPO_SKIP_SEED:-0}" = "1" ]; then
  echo "[entrypoint] DEPO_SKIP_SEED=1 -> skipping seed_initial_data"
else
  echo "[entrypoint] seed_initial_data..."
  python manage.py seed_initial_data
fi

echo "[entrypoint] collectstatic..."
python manage.py collectstatic --noinput

echo "[entrypoint] exec: $*"
exec "$@"
