# Team Advert Workflow Suite

This repository implements the TEAM ADVERT PLC business workflow platform described in `PRD.md`.

## Stack
- Backend: Node.js, Express, TypeScript, Prisma (MySQL)
- Frontend: React (Vite + TS), TailwindCSS, Zustand, React Router
- Shared: Zod schemas for DTO validation
- Jobs/Tasks: node-cron backups, CBE transaction verifier stub, JWT auth (username + PIN)

## Getting Started
1. **Database**: `docker-compose up -d` to start MySQL (root/password, db: teamadvert).
2. **Backend**
   ```bash
   cd backend
   npx prisma generate
   npm run dev        # start API on http://localhost:4000
   ```
   Seed user created automatically if DB is empty: `admin / 0000`.
3. **Frontend**
   ```bash
   cd frontend
   npm run dev        # http://localhost:5173
   ```

## Key Features
- Auth with username + 4-digit PIN, JWT, login rate limiting, login logs
- CRM: customers, notes, credit snapshot; live search endpoints
- Suppliers, items, price log audit hooks
- Proforma (TAPI) creation, approval, conversion to Job (TAJO)
- Job lifecycle: admin approval/lock, production + finance statuses
- Payments with CBE PDF verification stub and audit logging
- Notifications feed, search API, weekly backup scheduler writing JSON snapshots
- Audit logging across mutating routes

## Environment
Configure `backend/.env` (DATABASE_URL, JWT_SECRET, BACKUP_DIR etc). Prisma schema lives in `backend/prisma/schema.prisma`.

## Scripts
- `backend/npm run test` – type-check backend
- `frontend/npm run build` – type-check + bundle UI

## Notes
- File uploads are path-only per PRD; no binary storage.
- Backup job writes JSON summaries to `backups/` and records entries in DB.
- CBE verifier downloads the PDF and applies PRD matching rules; returns detailed issues on mismatch.
