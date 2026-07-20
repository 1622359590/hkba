# Baota GitHub Actions Auto Deploy

This project can deploy automatically when `main` is pushed to GitHub.

The workflow is stored at:

```text
.github/workflows/deploy-baota.yml
```

It validates deployment configuration, syncs code, creates an online-safe SQLite backup, installs dependencies, builds the Next.js frontend, reloads PM2 processes, verifies the frontend and API, and normalizes the deployed project to Baota's `www:www` ownership.

## Server Requirements

Install these on the Baota server:

- Node.js 20 or newer
- npm
- PM2
- rsync
- Nginx

Example:

```bash
npm install -g pm2
```

## GitHub Secrets

In GitHub, open:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Add these required secrets:

| Secret | Example | Notes |
| --- | --- | --- |
| `DEPLOY_HOST` | `1.2.3.4` | Server IP or host |
| `DEPLOY_USER` | `root` | SSH user |
| `DEPLOY_SSH_KEY` | private key text | Private key that can SSH into the server |
| `JWT_SECRET` | long random string | Use at least 32 random characters |
| `ALLOWED_ORIGINS` | `https://hkba.example.com` | Comma-separated HTTPS origins allowed to call the API |

Optional secrets:

| Secret | Default | Notes |
| --- | --- | --- |
| `DEPLOY_PORT` | `22` | SSH port |
| `DEPLOY_PATH` | `/www/wwwroot/hkba` | Server project path |
| `BACKEND_PORT` | `37900` | Express API port |
| `FRONTEND_PORT` | `3000` | Next.js port |
| `ADMIN_INITIAL_PASSWORD` | empty for existing databases | Required for the first deployment of an empty database; use at least 12 characters and do not include a newline or single quote |
| `SEED_ON_FIRST_DEPLOY` | `false` | Set `true` to load initial content when all core content tables are empty; existing CMS content is preserved |

The project also supports the existing bundled `DEPLOY_SSH_KEY` secret. The bundle may contain the environment lines followed by the OpenSSH private key, including:

```text
DEPLOY_USER=root
DEPLOY_PATH=/www/wwwroot/hkba
ALLOWED_ORIGINS=https://hkba.example.com
JWT_SECRET=at-least-32-random-characters
ADMIN_INITIAL_PASSWORD=at-least-12-random-characters
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Individual repository secrets take precedence over values in this bundle.
An existing production database that already contains the `admin` account can deploy without `ADMIN_INITIAL_PASSWORD`. A new empty database refuses to initialize in production until the value is provided.

## SSH Key Setup

On your local machine:

```bash
ssh-keygen -t ed25519 -f hkba_deploy_key -C "github-actions-hkba"
```

On the server, add the public key:

```bash
mkdir -p ~/.ssh
cat hkba_deploy_key.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Put the private key content into GitHub secret `DEPLOY_SSH_KEY`.

## Baota Nginx Reverse Proxy

Create a site in Baota for your domain, enable SSL, and keep only this reverse proxy config:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Delete or disable old Baota `/api/` and `/uploads/` reverse proxies. Next.js preserves those path prefixes and forwards them internally to Express on port `37900`.

## What The Workflow Preserves

These server-side data paths are preserved during every deploy:

- `backend/db/*.db`
- `backend/db/*.db-wal`
- `backend/db/*.db-shm`
- `backend/db/backups/`
- `backend/uploads/`

That means production database records and uploaded files are not replaced by GitHub deploys.

The SSH deployment user remains `root` so it can install dependencies and manage PM2. At the end of every successful deploy, the workflow runs:

```bash
chown -R www:www /www/wwwroot/hkba
```

The rsync step also disables sender-side owner and group preservation, preventing GitHub Runner numeric IDs from being mapped to unrelated server accounts such as `postgres`.

The workflow uploads this backend environment file from GitHub Secrets on every deploy without putting secret values in the SSH command line:

- `backend/.env`

The frontend does not use `.env.local` in production. Legacy `NEXT_PUBLIC_API_URL` values may remain in an existing bundled Secret for compatibility, but they are ignored by the application.

## Manual Run

After secrets are configured, open:

```text
GitHub -> Actions -> Deploy to Baota Server -> Run workflow
```

Future pushes to `main` will deploy automatically.

## Deployment Checks And Backups

Before restarting the API, the workflow runs SQLite's online backup API and writes a consistent snapshot to:

```text
backend/db/backups/hkba.<timestamp>.bak
```

After PM2 starts `hkba-api` and `hkba-web`, `scripts/deploy-smoke.js` verifies:

- the frontend homepage on the loopback frontend port;
- `/api/health` directly on the backend port;
- `/api/health` through the Next.js proxy.

PM2 state is saved only after these checks pass. A failed backup, build, process start, or health check marks the GitHub Actions run as failed.

## Database Rollback

Use rollback only after identifying the failed deployment and selecting the correct backup:

```bash
cd /www/wwwroot/hkba
pm2 stop hkba-api
cp backend/db/hkba.db backend/db/hkba.failed.$(date +%Y%m%d%H%M%S).db
cp backend/db/backups/hkba.<timestamp>.bak backend/db/hkba.db
chown www:www backend/db/hkba.db
pm2 restart hkba-api --update-env
curl --fail http://127.0.0.1:37900/api/health
pm2 restart hkba-web
pm2 save
```

Do not delete the failed database until its contents have been inspected or exported.
