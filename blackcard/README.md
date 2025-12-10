# Black Card API (Prototype)

This folder contains a lightweight, in-memory prototype for the Black Card multi-merchant payment platform described in `BLACK_CARD_PRD.md`. It mirrors the OpenAPI flows (login, top-up, NFC payment, withdrawals, admin config) so the team can iterate on logic before wiring to a real database or mPOS client.

## Running locally

```bash
cd blackcard
npm install
npm run dev   # starts on http://localhost:5001
```

Environment toggles live in `.env` (optional):

- `BLACKCARD_PORT` (default `5001`)
- `BLACKCARD_JWT_SECRET` (default `blackcard-secret`)
- `BLACKCARD_WITHDRAWAL_CAP` (default `0.8` → 80% daily cap)
- `BLACKCARD_DEV_A`, `BLACKCARD_DEV_B`, `BLACKCARD_DEV_C` (developer split percentages; must total 100)

## Seeded actors

| Role | Username | PIN | Notes |
| --- | --- | --- | --- |
| Customer | `customer1` | `1234` | Has card UID `CARD-001` and balance 1000 |
| Merchant Admin | `merchant-admin` | `3805` | Business wallet for settlements; has TOTP secret |
| Developer A/B/C | `developer-a`/`developer-b`/`developer-c` | `1111`/`2222`/`3333` | Developer split wallets; each has TOTP secret |
| Super Admin | `super-admin` | `9999` | Can change config & view audits; has TOTP secret |

Generate a TOTP using the secret logged at startup (`otplib` compatible). Use the returned `accessToken` for authenticated routes.

## API highlights

- `/auth/login` → returns `accessToken` and `requires2FA`
- `/auth/2fa/verify` → server-side TOTP check
- `/customers/register` → issues new customer + wallet
- `/cards/link` → bind NFC UID to customer (auth required)
- `/cards/balance` → quick balance lookup by UID
- `/topup/initiate` → credits customer + central wallet
- `/payments/process` → ACID-like atomic updates with idempotency, 99/1 split, 40/30/30 dev breakdown
- `/merchant/wallet` & `/merchant/withdraw` → enforce 80% cap + TOTP
- `/developer/wallet` & `/developer/withdraw` → same withdrawal logic
- `/admin/config` & `/admin/config/update` → mutable commission/split settings
- `/admin/audit` & `/payouts` → view immutable audit + payout queues

This implementation is intentionally simple (in-memory, no persistence, no encryption) to let us validate flows fast. Swap the storage layer for Prisma/PostgreSQL plus encryption per PRD when ready.
