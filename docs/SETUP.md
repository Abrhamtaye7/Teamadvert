# Deploying to Yegara cPanel

Target environment (from Yegara): **PostgreSQL**, **Node.js 22.23.3**, server `BRX - cotswolds`, IP `91.204.209.39` (`cotswolds.hostns.io`),
nameservers `ns1.hostns.io` / `ns2.hostns.io`.

| URL | Served by | Files |
|---|---|---|
| `teamadvertplc.com/` | Apache (static) | `public_html/` ← `apps/web/dist` |
| `teamadvertplc.com/office` | Apache (static) | `public_html/office/` ← `apps/office/dist` |
| `teamadvertplc.com/api` | cPanel Node.js App (Passenger) | `~/teamadvert-api/` ← `apps/api/app.cjs` + `apps/api/dist/` + `packages/db/migrations/` |

> This guide is a first draft written before the first deployment. Steps marked **verify** depend on how
> Yegara configured cPanel and will be confirmed (and this file updated) during the first deploy.

## 1. Domain

The domain should use Yegara's nameservers `ns1.hostns.io` and `ns2.hostns.io` (Yegara client area → Domains →
Nameservers). With those, DNS is managed in cPanel → **Zone Editor**, and `teamadvertplc.com` / `www` point to
`91.204.209.39` automatically. Then enable HTTPS: cPanel → **SSL/TLS Status** → *Run AutoSSL*.

## 2. Database

1. cPanel → **PostgreSQL Databases**: create database `teamadvert` and a user, add the user to the database with
   all privileges. cPanel prefixes both with your account name (e.g. `cpuser_teamadvert`).
2. Your connection string is then:
   `postgres://cpuser_teamadvert:PASSWORD@localhost:5432/cpuser_teamadvert` (**verify** host/port in cPanel).

## 3. Build locally

```bash
npm ci
npm run build                     # web + office → dist/site
npm run build -w @teamadvert/api  # API → apps/api/dist/server.mjs (single file, no npm install needed on the server)
```

## 4. API (Node.js App)

1. Upload `apps/api/app.cjs`, `apps/api/dist/` and `packages/db/migrations/` into `~/teamadvert-api/`
   (keep the folder names; migrations go to `~/teamadvert-api/migrations/`).
2. cPanel → **Setup Node.js App** → *Create Application*:
   - Node.js version: **22.23.3**, Application mode: **Production**
   - Application root: `teamadvert-api`
   - Application URL: `teamadvertplc.com` / `api`
   - Application startup file: `app.cjs`
   - Environment variables: `NODE_ENV=production`, `DATABASE_URL=<from step 2>`, `SEED_ADMIN_PIN=<4 digits>`
3. Run migrations and the seed once (cPanel → Terminal, after `source` of the app's virtualenv shown at the top of
   the Node.js App page) — commands added in the deployment phase.
4. Restart the app and open `https://teamadvertplc.com/api/health` → `{"ok":true}`.
   (**verify** whether Passenger passes the `/api` prefix through to the app; the API expects it.)

## 5. Websites

Upload the contents of `dist/site/` into `public_html/` (this includes `office/` and both `.htaccess` files).
Don't delete `public_html/api/` — cPanel creates it for the Node.js App.

## Local development

```bash
cp .env.example .env     # set SEED_ADMIN_PIN
npm install
npm run db:up            # PostgreSQL 16 in Docker on port 5433
npm run db:migrate && npm run db:seed
npm run dev:api          # http://localhost:4000/api
npm run dev:office       # http://localhost:5173/office/ (proxies /api)
npm run dev:web          # http://localhost:4321
```
