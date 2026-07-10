# HKBA Club

Hong Kong Blockchain Association website and CMS. This repository currently uses a split frontend/backend setup and keeps Phase 1 focused on stabilizing the existing runnable app while aligning it with the HKBA official-site brief.

## Architecture

- `frontend/`: Next.js 16 App Router, React 19, Tailwind CSS, public pages, and admin CMS pages.
- `backend/`: Express REST API, SQLite through `better-sqlite3`, JWT admin auth, and local uploads.
- `backend/db/hkba.db`: local SQLite database.
- `backend/uploads/`: local uploaded files served by the backend.

Phase 1 keeps SQLite and local uploads. PostgreSQL/Prisma, Aliyun OSS, shadcn/ui, rich text editing, and normalized `/api/admin/*` routes are Phase 2 work.

## Local Setup

Install backend dependencies:

```bash
cd backend
npm install
cp .env.example .env
```

Install frontend dependencies:

```bash
cd frontend
npm install
cp .env.example .env.local
```

## Environment

Backend defaults:

```dotenv
PORT=37900
JWT_SECRET=replace-with-at-least-32-random-characters
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Frontend defaults:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:37900
```

## Development

Start the backend:

```bash
cd backend
npm run dev
```

The backend listens on `http://localhost:37900`.

Start the frontend:

```bash
cd frontend
npm run dev
```

The frontend listens on `http://localhost:3000`.

`npm run dev` uses Next.js with Webpack for local development. On the current macOS/Node setup, Next.js 16's default Turbopack dev server can stall while compiling `/` and emit noisy `MallocStackLogging` messages. To test Turbopack explicitly, run:

```bash
cd frontend
npm run dev:turbo
```

## Database And Seed Data

The backend initializes the SQLite schema automatically on startup through `backend/db/init.js`.

If the `admin` account does not exist, startup creates:

```text
username: admin
password: hkba2024
```

Change this password in the CMS before any production deployment.

To load the larger sample content set:

```bash
cd backend
node db/seed.js
```

## Useful Commands

Build the frontend:

```bash
cd frontend
npm run build
```

Run the backend in production mode:

```bash
cd backend
npm start
```

Verify that repeated database initialization does not add default records:

```bash
cd backend
node - <<'NODE'
const { initDatabase, getDb, closeDatabase } = require('./db/init');
initDatabase();
const first = getDb();
const before = {
  stats: first.prepare('SELECT COUNT(*) AS count FROM stats').get().count,
  milestones: first.prepare('SELECT COUNT(*) AS count FROM milestones').get().count,
};
closeDatabase();
initDatabase();
const second = getDb();
const after = {
  stats: second.prepare('SELECT COUNT(*) AS count FROM stats').get().count,
  milestones: second.prepare('SELECT COUNT(*) AS count FROM milestones').get().count,
};
console.log({ before, after });
if (before.stats !== after.stats || before.milestones !== after.milestones) process.exit(1);
closeDatabase();
NODE
```

The two count pairs must be identical. A healthy backend responds at `http://localhost:37900/api/health` with a JSON object whose `status` is `ok`.

## Routes

Public pages:

- `/`
- `/about`
- `/news`
- `/news/[id]`
- `/events`
- `/members`
- `/team`
- `/contact`

Admin pages:

- `/admin/login`
- `/admin`
- `/admin/banners`
- `/admin/news`
- `/admin/events`
- `/admin/pages`
- `/admin/team`
- `/admin/members`
- `/admin/messages`
- `/admin/settings`

## Deployment Notes

For the current Phase 1 app:

- Run the backend with PM2 or another process manager on port `37900`.
- Run the frontend with `npm run build` and `npm start` on port `3000`.
- Put Nginx in front of both services.
- Set `NEXT_PUBLIC_API_URL` to the public API origin.
- Set `ALLOWED_ORIGINS` on the backend to the public frontend origins.
- Keep uploads backed up if using local disk storage.

GitHub Actions auto-deploy for a Baota server is documented in `docs/BAOTA_AUTO_DEPLOY.md`.

Phase 2 can migrate media to Aliyun OSS and data to PostgreSQL/Prisma once the Phase 1 product surface is stable.
