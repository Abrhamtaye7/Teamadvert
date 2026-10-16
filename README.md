# Team Advert Workflow Suite

Business workflow platform for TEAM ADVERT PLC (see `PRD.md`). Hosted on Yegara cPanel:
static sites on Apache, the API as a Node.js app, PostgreSQL database.

## Layout

| Path | What |
|---|---|
| `apps/api` | API at `/api` — Hono on Node.js, bundled to a single file for cPanel |
| `apps/office` | Office app at `/office` — React, Vite, Tailwind, Zustand |
| `apps/web` | Public marketing site at `/` — Astro (static, SEO) |
| `packages/db` | PostgreSQL schema (Drizzle), migrations, seed, document-number counters, PIN hashing |
| `packages/shared` | Zod schemas shared by API and office app |
| `legacy/backend` | Old Express + Prisma + MySQL backend, reference only while porting — deleted after the API port |
| `tools/` | Site assembly script, local database init |

## Getting started

Requires Node 22+ and Docker.

```bash
cp .env.example .env     # set SEED_ADMIN_PIN to a 4-digit PIN
npm install
npm run db:up            # PostgreSQL on localhost:5433
npm run db:migrate
npm run db:seed          # roles, access roles, user "admin" with SEED_ADMIN_PIN
npm run dev:api          # http://localhost:4000/api
npm run dev:office       # http://localhost:5173/office/
npm run dev:web          # http://localhost:4321
```

## Scripts

| Command | Does |
|---|---|
| `npm run typecheck` | Type-check every workspace |
| `npm test` | Run all tests (needs `npm run db:up`) |
| `npm run build` | Build web + office into `dist/site` |
| `npm run preview` | Production-like preview: everything on http://localhost:4000 (site, /office, /api) |
| `npm run db:generate` | Create a migration after changing `packages/db/src/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations / seed defaults |

Deployment to cPanel: see [docs/SETUP.md](docs/SETUP.md).
