# Baota GitHub Actions Auto Deploy

This project can deploy automatically when `main` is pushed to GitHub.

The workflow is stored at:

```text
.github/workflows/deploy-baota.yml
```

It syncs code to the server, keeps production data safe, installs dependencies, builds the Next.js frontend, reloads PM2 processes, and normalizes the deployed project to Baota's `www:www` ownership.

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

Optional secrets:

| Secret | Default | Notes |
| --- | --- | --- |
| `DEPLOY_PORT` | `22` | SSH port |
| `DEPLOY_PATH` | `/www/wwwroot/hkba` | Server project path |
| `BACKEND_PORT` | `37900` | Express API port |
| `FRONTEND_PORT` | `3000` | Next.js port |
| `ALLOWED_ORIGINS` | empty | Additional comma-separated backend CORS origins; same-domain proxy traffic is allowed automatically |
| `SEED_ON_FIRST_DEPLOY` | `false` | Set `true` to load initial content when all core content tables are empty; existing CMS content is preserved |

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
- `backend/uploads/`

That means production database records and uploaded files are not replaced by GitHub deploys.

The SSH deployment user remains `root` so it can install dependencies and manage PM2. At the end of every successful deploy, the workflow runs:

```bash
chown -R www:www /www/wwwroot/hkba
```

The rsync step also disables sender-side owner and group preservation, preventing GitHub Runner numeric IDs from being mapped to unrelated server accounts such as `postgres`.

The workflow regenerates this backend environment file from GitHub Secrets on every deploy:

- `backend/.env`

The frontend does not use `.env.local` in production. Legacy `NEXT_PUBLIC_API_URL` values may remain in an existing bundled Secret for compatibility, but they are ignored by the application.

## Manual Run

After secrets are configured, open:

```text
GitHub -> Actions -> Deploy to Baota Server -> Run workflow
```

Future pushes to `main` will deploy automatically.
