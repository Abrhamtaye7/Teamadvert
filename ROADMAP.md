# Team Advert System Roadmap

## Tech Stack
- Frontend: React + Vite + TypeScript, React Router, TailwindCSS, Zustand for state, Axios for API, Zod for validation, TanStack Table for lists, react-hook-form.
- Backend: Node.js + Express + TypeScript, Zod validation, JWT auth (username + 4-digit PIN), bcrypt for PIN hashing, MySQL via Prisma ORM, multer for file path metadata (no uploads), pdf-parse for CBE PDF parsing, node-cron for weekly backups, Winston for logging.
- Shared: Type-safe DTOs via Zod schemas shared between frontend/backend, dotenv for config.
- Infra: ESLint + Prettier, ts-node-dev for dev, Jest for basic tests, Docker Compose for MySQL dev.

## Modules & Deliverables
- Auth & Roles: username+PIN login, JWT issuance, rate limit, inactivity token TTL, login audit log.
- CRM: customers CRUD, credit fields, activity notes, live search.
- Suppliers: CRUD, price history.
- Items: CRUD, purchase/selling prices, logs.
- Proforma (TAPI): identifiers, status workflow, items, PDF print stub.
- Job Orders (TAJO): conversion from proforma, approvals, production/finance states.
- Finance: payments, mark paid/pending, CBE verification endpoint.
- Notifications: simple in-app feed via polling/Server-Sent Events stub.
- Search Engine: paginated search endpoints with filters.
- Backup Scheduler: weekly cron to snapshot DB/export tables to ./backups.
- Audit Logs: immutable table capturing actions.
- UI: dashboards per role, dark/light preference stored per user.

## Task Breakdown
1) Initialize repo: workspace layout (backend/, frontend/, shared/), configs, lint/prettier, gitignore.
2) Backend foundation: Express server, routes, Prisma schema for MySQL tables (users, roles, permissions, customers, suppliers, items, price histories, proformas, proforma_items, job_orders, job_items, payments, audit_logs, backups, notifications), middleware (auth, rate limit, error handling, logging).
3) Auth module: signup seed, login with username+PIN, JWT, session TTL, audit logging, login history.
4) Core CRUDs: customers, suppliers, items with price logs; search endpoints.
5) Proforma + Job: create/edit, status transitions, convert proforma→job, approvals, finance states, link to customer.
6) Finance + CBE: payment records, mark paid/pending, CBE verifier (PDF download/parse placeholder with rules), audit.
7) Notifications + backups: SSE/poll feed, node-cron weekly backup script exporting DB dump (placeholder), record backups table.
8) Frontend: Vite React TS app with auth flow, role-based routes, dashboard widgets, list/detail forms for modules, live search hooks, theme toggle.
9) Shared validation/types: Zod schemas in shared/ consumed by backend and frontend.
10) Tests/checks: basic Jest for utility, npm scripts for lint/build/test both apps.

## Assumptions
- Local MySQL connection via .env; provide docker-compose for dev; production host configured separately.
- File storage: store path strings only; no binary upload.
- PDF verification uses stub parser for offline; parse real PDF if available.
- Notifications via polling endpoint for simplicity.
