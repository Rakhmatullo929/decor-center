# Dedicated `production` deploy branch

Date: 2026-07-21

## Goal

Prod (`test.monday-projects.uz` / `api.test.monday-projects.uz` — the native "test" stand, the
project's real production) must deploy from a dedicated **`production`** branch instead of `main`,
so merging to `main` no longer ships to prod. Releases become a deliberate, CI-gated promotion.

## Current state (before)

- `deploy-test.yml` triggers on **push to `main`** → SSH → `deploy/native/deploy-native.sh`, which
  itself does `git reset --hard origin/main` (branch hardcoded).
- `deploy-production.yml` is a **dormant** docker deploy (lokomotiv-decor.uz) triggered by push to a
  `production` branch that has never existed.
- `ci.yml` runs backend (postgres + ruff + pytest) and frontend (`yarn build`) on PRs + push to main.

## Decisions (confirmed with user)

- Release flow: **PR `main → production`** (diff + CI gate), merge → auto-deploy.
- **CI is a gate before deploy**: the deploy job runs only after the test jobs pass on `production`.
- Prod is the native stand; the docker/lokomotiv-decor.uz path is dead and is removed from CI/CD.

## Design

### Workflows (`.github/workflows/`)

1. **`tests.yml`** (new, `on: workflow_call`) — single source of truth for the two check jobs:
   - `backend`: postgres:18 service, `ruff check .`, `pytest` (unchanged from ci.yml).
   - `frontend`: `yarn build` (unchanged behaviour; env `REACT_APP_HOST_API` corrected to
     `https://api.test.monday-projects.uz`).
2. **`ci.yml`** (modified) — `on: pull_request + push[main]` → one job `tests: uses: ./.github/workflows/tests.yml`.
   `main` stays fully checked; **no deploy**.
3. **`deploy-production.yml`** (replaces the dormant docker one) — `on: push[production]`,
   `concurrency: deploy-production`:
   - job `tests: uses: ./.github/workflows/tests.yml`
   - job `deploy: needs: tests` → `appleboy/ssh-action` to the stand. **The workflow does the git
     sync** (not the on-server script), which is the key correctness fix:
     ```
     cd /home/al-bukhari/decor-test/decor-center
     git fetch origin
     git checkout -B production origin/production
     bash deploy/native/deploy-native.sh
     ```
     Uses existing `TEST_DEPLOY_HOST/USER/KEY/PORT` secrets (same server).
4. **Delete `deploy-test.yml`** (old, main-triggered).

### Server script (`deploy/native/deploy-native.sh`)

- Remove the `git fetch` + `git reset --hard origin/main` lines — the workflow now owns git sync and
  targets `production`. This prevents the "triggered by production but deploys main anyway" trap.
- Keep: prod pip install → `migrate --noinput` → `collectstatic` → `seed_initial_data` → frontend
  `yarn build` (`REACT_APP_HOST_API=https://api.test.monday-projects.uz`) → `systemctl restart`.
- Header comment updated: git sync is the caller's job; to run by hand, sync first
  (`git fetch && git reset --hard origin/production`).

### Docs

- `DEPLOYMENT.md`: document the new flow (main = integration/CI; production = release → CI gate →
  auto-deploy + auto-migrate).

## Rollout sequence (avoids an accidental deploy during the switch)

1. Land the change via **PR → `main`**. Merging it does **not** deploy (the trigger is now
   `production`-only; the old `main` deploy workflow is gone in the same commit).
2. Create `production` from `main` and push → first release runs the new pipeline
   (CI gate → deploy → auto-migrate).
3. Thereafter: releases via PR `main → production`.

Migrations continue to run automatically inside the deploy (`migrate --noinput`).

## Out of scope / follow-ups

- Removing the docker prod files themselves (`docker-compose.prod.yml`, `deploy/deploy.sh`,
  `deploy/nginx/*`) — dead code, can be deleted separately.
- Frontend CI runs `yarn build`, not `jest` — unchanged here.
- GitHub branch protection on `production` (require PR + passing CI, block direct push) — recommended,
  configured in GitHub settings (offer to set via `gh api`).
