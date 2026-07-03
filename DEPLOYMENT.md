# Deployment Runbook — Lokomotiv Decor

This document is the authoritative operational guide for deploying and maintaining the `decor`
application in production. Follow it top-to-bottom for first deploy; jump to relevant sections
for day-to-day operations.

---

## 1. Architecture

The application runs as its own **docker-compose project** (`docker-compose.prod.yml`, project
name `decor`) on the server at `/home/rakhmonov/decor` (IP: **207.180.210.65**).

### Services

| Container | Image / Build | Networks | Exposed port |
|---|---|---|---|
| `decor-db` | `postgres:18` | `internal` | None (no host port) |
| `decor-backend` | built from `backend/Dockerfile.prod` (gunicorn + WhiteNoise + InsightFace/ArcFace) | `internal`, `shared` | None (exposes 8000 internally) |
| `decor-frontend` | built from `frontend/Dockerfile.prod` (nginx serving the CRA build) | `shared` | None (exposes 80 internally) |

### Networks

- **`internal`** — private bridge network; only `decor-db` and `decor-backend` are attached. The
  database is never reachable from the internet.
- **`shared`** — the **existing external** Docker network `rental_track_default`. `decor-backend`
  and `decor-frontend` attach to it so the shared nginx can route to them.

### Volumes

| Volume | Purpose |
|---|---|
| `decor_pgdata` | Postgres 18 data directory (`/var/lib/postgresql`) |
| `decor_media` | Django user-uploaded media files |

### Shared reverse-proxy

The server hosts multiple projects under a single nginx container
(`rental_track-nginx-1`) that owns ports **80** and **443**. That nginx forwards:

- `api.lokomotiv-decor.uz` → `decor-backend:8000`
- `lokomotiv-decor.uz` and `www.lokomotiv-decor.uz` → `decor-frontend:80`

TLS certificates are issued and renewed by the **shared certbot** (Let's Encrypt, webroot,
auto-renews every 12 h). `deploy.sh` writes decor-specific vhost files into the shared nginx
`conf.d` directory and reloads nginx after each deploy (see [Known coupling](#8-known-coupling--caveats)).

---

## 2. Environment / Secrets

The file `/home/rakhmonov/decor/.env` on the server holds every secret and runtime config value.
It is **not in git** and must be mode `600`.

```bash
chmod 600 /home/rakhmonov/decor/.env
```

Compose reads this file for `${VAR}` interpolation inside `docker-compose.prod.yml` **and** as
the `env_file` for the `decor-backend` container.

### Required keys (mirror of `.env.prod.example`)

```dotenv
# Django
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=<50+ random chars>
DJANGO_ALLOWED_HOSTS=api.lokomotiv-decor.uz,lokomotiv-decor.uz,207.180.210.65
DJANGO_CORS_ALLOWED_ORIGINS=https://lokomotiv-decor.uz
DJANGO_CSRF_TRUSTED_ORIGINS=https://lokomotiv-decor.uz,https://api.lokomotiv-decor.uz
DJANGO_SECURE_SSL_REDIRECT=True

# Postgres
POSTGRES_DB=decor
POSTGRES_USER=decor
POSTGRES_PASSWORD=<strong password>

# Face recognition (model is baked into the backend image)
DECOR_FACE_BACKEND=apps.integrations.insightface_adapter.InsightFaceAdapter
DECOR_FACE_WARMUP_ON_STARTUP=true
DECOR_FACE_SIMILARITY_THRESHOLD=0.5

# Seeded system account passwords (seed_initial_data reads these)
DECOR_ADMIN_PASSWORD=<strong password>
DECOR_EMPLOYEE_PASSWORD=<strong password>

# TTS
UZBEKVOICE_API_KEY=<key from UzbekVoice>
DECOR_TTS_VOICE_UZ=lola
```

> **Note:** Leave `DECOR_FACE_WARMUP_ON_STARTUP=true` so the InsightFace/ArcFace model
> (buffalo_sc, 512-dim, cosine similarity) warms up per gunicorn worker on startup rather than
> on the first request.

---

## 3. CI/CD Flow

### CI gate (`.github/workflows/ci.yml`)

Triggered on every **pull request** and every push to **`main`**.

| Job | Steps |
|---|---|
| `backend` | Spins up a `postgres:18` service container; installs `backend/requirements/dev.txt`; runs `ruff check .`; runs `pytest` |
| `frontend` | Installs deps via `yarn install --frozen-lockfile`; runs `yarn build` (with `CI=false` to treat warnings as non-fatal) |

### Deployment workflow (`.github/workflows/deploy-production.yml`)

Triggered on every push to the **`production`** branch (concurrency guard prevents overlapping
deployments). Steps:

1. GitHub Actions connects to the server over SSH via **appleboy/ssh-action@v1.2.0**.
2. On the server: `cd ~/decor && git fetch origin && git checkout production && git reset --hard origin/production && ./deploy/deploy.sh`

### Required GitHub Actions secrets

Configure these in **Settings → Secrets and variables → Actions** on the GitHub repository:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `207.180.210.65` |
| `DEPLOY_USER` | `rakhmonov` |
| `DEPLOY_SSH_KEY` | Private key matching the server's `~/.ssh/authorized_keys` |
| `DEPLOY_PORT` | `22` (or whichever SSH port the server uses) |

---

## 4. First Deploy (Manual)

Run these commands on the server. Assumes the repo is already cloned at `/home/rakhmonov/decor`
and the `production` branch exists on origin.

```bash
# 1. Ensure .env is present and locked down
ls -la /home/rakhmonov/decor/.env   # must exist; create from .env.prod.example if not
chmod 600 /home/rakhmonov/decor/.env

# 2. Check out the production branch at the latest commit
cd /home/rakhmonov/decor
git fetch origin
git checkout production
git reset --hard origin/production

# 3. Run the deploy script
./deploy/deploy.sh
```

`deploy.sh` will:

- Build the `decor-backend` and `decor-frontend` Docker images on the server.
- Bring up the full stack (`docker-compose.prod.yml`) — `decor-db`, `decor-backend`,
  `decor-frontend`.
- Write the decor vhost config files into the shared nginx `conf.d` directory.
- Run `nginx -t` to validate the config.
- Reload `rental_track-nginx-1`.

> **Without a TLS cert yet,** `deploy.sh` installs HTTP-only vhosts. Traffic will be served
> over plain HTTP until you complete the Go-live step below.

---

## 5. Go-live (DNS + TLS)

Perform this step once the domain `lokomotiv-decor.uz` is registered and DNS is under your
control.

### 5.1 Create DNS A records

Point all three names to **207.180.210.65** (managed at the ahost.uz DNS panel; `www` may be a CNAME to the apex):

| Hostname | Type | Value |
|---|---|---|
| `lokomotiv-decor.uz` | A | `207.180.210.65` |
| `www.lokomotiv-decor.uz` | A/CNAME | `207.180.210.65` / `lokomotiv-decor.uz` |
| `api.lokomotiv-decor.uz` | A | `207.180.210.65` |

### 5.2 Confirm propagation

```bash
dig +short @8.8.8.8 lokomotiv-decor.uz
dig +short @8.8.8.8 www.lokomotiv-decor.uz
dig +short @8.8.8.8 api.lokomotiv-decor.uz
# All should resolve to: 207.180.210.65
```

### 5.3 Issue TLS certificates

Run on the server:

```bash
~/decor/deploy/issue-certs.sh
```

This issues a **single SAN certificate** covering all three names via the shared certbot
(Let's Encrypt, webroot challenge). The certbot container auto-renews every 12 hours.

### 5.4 Switch vhosts to SSL

```bash
~/decor/deploy/deploy.sh
```

`deploy.sh` detects that the cert now exists and rewrites the vhost files to include SSL
directives, then reloads nginx. From this point all traffic is served over HTTPS.

---

## 6. Rollback

If a deployment introduces a regression, roll back on the server:

```bash
cd /home/rakhmonov/decor

# Option A: reset to a known-good commit SHA
git reset --hard <previous-good-sha>

# Option B: or revert/force-push the production branch from another machine,
#            then on the server:
git fetch origin
git reset --hard origin/production

# Either way, re-run the deploy script to rebuild images from the checked-out source
./deploy/deploy.sh
```

Images are always rebuilt from the source code at the current `HEAD` of the working tree, so
a hard reset + deploy reliably restores the previous state.

---

## 7. Database Backups

The named volume `decor_pgdata` persists data across container restarts and deploys. It is
**not** backed up automatically yet — set this up before go-live.

### Manual dump (run before any risky migration or go-live)

```bash
docker exec decor-db pg_dump -U decor decor | gzip > ~/decor-$(date +%F).sql.gz
```

Move the dump off the server (e.g. `scp` to your workstation or upload to object storage).

### Recommended: scheduled cron backup

Add a cron job on the server to dump nightly and rotate old dumps:

```cron
0 3 * * * docker exec decor-db pg_dump -U decor decor | gzip > /home/rakhmonov/backups/decor-$(date +\%F).sql.gz
```

Automating off-site transfer (S3, Backblaze, etc.) is a follow-up task.

---

## 8. Known Coupling / Caveats

### Shared nginx

`deploy.sh` writes **two vhost config files** into the shared nginx configuration directory:

```
/home/rakhmonov/hadware-raxmonov/deploy/nginx/conf.d/decor-frontend.conf   # frontend (lokomotiv-decor.uz)
/home/rakhmonov/hadware-raxmonov/deploy/nginx/conf.d/decor-api.conf        # backend API (api.lokomotiv-decor.uz)
```

It then reloads `rental_track-nginx-1` (the container that owns ports 80/443 for the entire
server). This is unavoidable: that nginx is the single ingress point for all projects on the
box.

**Safety guard:** `deploy.sh` runs `nginx -t` inside `rental_track-nginx-1` before issuing the
reload. If the new vhost config is invalid, the reload is aborted and the existing sites remain
up. The existing vhosts (`rakhmonov-arenda.uz`, `rakhimbobo.uz`, etc.) are unaffected because
`deploy.sh` only **adds** new files — it never touches the config files that belong to other
projects.

### InsightFace model warm-up

The `decor-backend` image has the InsightFace buffalo_sc model baked in at build time.
With `DECOR_FACE_WARMUP_ON_STARTUP=true`, each gunicorn worker loads the model on startup, so
the first health-check hit may take up to 90 seconds. The `start_period: 90s` in the backend
healthcheck is intentional.

### `UZBEKVOICE_API_KEY` during bulk import

When running `manage.py import_teplovoz_questions` on the server, the TTS integration will fire
for every question unless you temporarily unset the key:

```bash
UZBEKVOICE_API_KEY= python manage.py import_teplovoz_questions --dry-run
```

Set it back before restarting the backend container.
