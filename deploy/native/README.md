# decor-center — TEST stand deployment runbook (native, `al-bukhari` host)

Authoritative guide for the **test** environment on the `al-bukhari` server
(`144.91.64.70`, Ubuntu 24.04). This is **separate** from the docker-based
`DEPLOYMENT.md`, which targets a different host (`rakhmonov@207.180.210.65`,
`lokomotiv-decor.uz`) and does **not** apply here.

- **Frontend:** https://test.monday-projects.uz  → React CRA build served by nginx
- **Backend API:** https://api.test.monday-projects.uz → Django/gunicorn (unix socket)

## 1. Why native (not docker)

This host has **no docker**. Every project runs the same way: a Django app under
**gunicorn as a systemd service on a unix socket**, fronted by the **host nginx**
(`sites-available`/`sites-enabled`), TLS from **certbot/Let's Encrypt**, static
SPA builds served straight by nginx. This stand copies that pattern 1:1, under its
own names, so nothing shared with the other live projects is touched.

## 2. Resources this stand owns

| Thing | Value |
|---|---|
| Code | `/home/al-bukhari/decor-test/decor-center` (git, branch `main`) |
| Python venv | `backend/.venv` (Python 3.12) |
| systemd | `decor-test-backend.service` + `decor-test-backend.socket` → `/run/decor-test-backend.sock` |
| gunicorn | `config.wsgi`, 2 workers, `User=root Group=www-data` |
| Database | PostgreSQL 16 — role & db `decor_test` (local) |
| nginx sites | `decor-test` (frontend), `decor-test-api` (backend) |
| Env / secrets | `backend/.env` (mode 600, **not** in git) |
| Face engine | **real** InsightFace `buffalo_sc`; SMS + anti-spoofing on mocks |
| swap | 2 GB `/swapfile` (this box ships with none) |

## 3. Files in this directory

| File | Role |
|---|---|
| `decor-test-backend.socket` / `.service` | systemd units |
| `nginx-test.monday-projects.uz.conf` | frontend vhost |
| `nginx-api.test.monday-projects.uz.conf` | backend API vhost |
| `sudoers-decor-test` | narrow NOPASSWD (restart backend / reload nginx) for CI |
| `root-setup.sh` | **Phase B** — one-time privileged bring-up (run with sudo) |
| `deploy-native.sh` | per-deploy script (CI + manual): pull → build → migrate → restart |
| `tls-golive.sh` | **Phase C** — issue Let's Encrypt + enforce HTTPS |

## 4. First deploy

**Phase A — unprivileged (done by the operator as `al-bukhari`):** create the
`decor_test` role/db, `python -m venv` + `pip install -r requirements/prod.txt`,
write `backend/.env`, `migrate` + `seed_initial_data` + `collectstatic`, build the
frontend. (All reversible, no root.)

**Phase B — one-time root:**

```bash
cd /home/al-bukhari/decor-test/decor-center
sudo bash deploy/native/root-setup.sh
```

This adds swap, prefetches the face model into root's cache, installs the systemd
units + nginx vhosts (HTTP), installs the narrow sudoers drop-in, and starts the
service. It runs `nginx -t` before reloading and **rolls back its own symlinks** if
the config is invalid — the other sites can't be taken down by it.

Verify (HTTP, before DNS):

```bash
curl -s -H 'Host: api.test.monday-projects.uz' http://127.0.0.1/health/    # {"status": "ok"}
```

**Phase C — TLS (after DNS resolves to 144.91.64.70):**

```bash
sudo bash deploy/native/tls-golive.sh
```

## 5. CI/CD

`.github/workflows/ci.yml` runs on every PR + push to `main` (ruff + pytest + frontend build) via
the reusable `tests.yml` — it does **not** deploy.
`.github/workflows/deploy-production.yml` runs on **push to the `production` branch**: it runs the
same test suite as a gate, then SSHes in, syncs the repo to `origin/production`, and runs
`deploy/native/deploy-native.sh`. Promote a release with a PR from `main` → `production`.
Required repo secrets:

| Secret | Value |
|---|---|
| `TEST_DEPLOY_HOST` | `144.91.64.70` |
| `TEST_DEPLOY_USER` | `al-bukhari` |
| `TEST_DEPLOY_PORT` | `22` |
| `TEST_DEPLOY_KEY` | private key whose public half is in the server's `~/.ssh/authorized_keys` |

## 6. Operations

```bash
# logs
journalctl -u decor-test-backend -f
# restart / status
sudo systemctl restart decor-test-backend
systemctl status decor-test-backend
# manual deploy (same as CI)
bash /home/al-bukhari/decor-test/decor-center/deploy/native/deploy-native.sh
# db backup
pg_dump decor_test | gzip > ~/decor_test-$(date +%F).sql.gz
```

## 7. Rollback

```bash
cd /home/al-bukhari/decor-test/decor-center
git reset --hard <previous-good-sha>
bash deploy/native/deploy-native.sh
```

## 8. Guarantees toward the other projects

`root-setup.sh` only **adds** files named `decor-test*`; it never edits another
project's unit or vhost, and never reloads nginx unless `nginx -t` passes. The
`decor_test` postgres role/db is isolated. The 2 GB swapfile only adds headroom.
State of every other site is expected to be identical before and after.
