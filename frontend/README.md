# HKBA Frontend

Next.js 16 App Router frontend for the HKBA public site and admin CMS.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```

`npm run dev` starts the local frontend on `http://localhost:3000` with Webpack. `npm run dev:turbo` is available for explicit Turbopack testing.

## API Proxy

The browser uses relative `/api/*` and `/uploads/*` URLs. Next.js forwards both path families internally to Express on `http://127.0.0.1:37900`, so no frontend environment file is required.

## Main Routes

Public:

- `/`
- `/about`
- `/news`
- `/news/[id]`
- `/events`
- `/members`
- `/team`
- `/contact`

Admin:

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

The admin CMS expects Express to be running locally on port `37900`; all browser traffic still stays on the Next.js origin.
