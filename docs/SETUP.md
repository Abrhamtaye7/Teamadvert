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
npm run package:cpanel
```

This builds everything and lays out the upload in `dist/cpanel/`:

| Folder | Upload to | Contains |
|---|---|---|
| `dist/cpanel/teamadvert-api/` | `~/teamadvert-api/` | `app.cjs`, `dist/server.mjs` (the API, no `npm install` needed), `dist/db-cli.mjs`, `dist/backup-cli.mjs`, `migrations/` |
| `dist/cpanel/public_html/` | `~/public_html/` | public site, `office/`, both `.htaccess` files |

## 4. API (Node.js App)

1. Upload `dist/cpanel/teamadvert-api/` to `~/teamadvert-api/` (File Manager → Upload a zip → Extract).
2. cPanel → **Setup Node.js App** → *Create Application*:
   - Node.js version: **22.23.3**, Application mode: **Production**
   - Application root: `teamadvert-api`
   - Application URL: `teamadvertplc.com` / `api`
   - Application startup file: `app.cjs`
   - Environment variables:

     | Name | Value |
     |---|---|
     | `NODE_ENV` | `production` |
     | `DATABASE_URL` | from step 2 |
     | `SEED_ADMIN_PIN` | a 4-digit PIN for the first `admin` login |
     | `BACKUP_DIR` | `/home/teamadub/backups` (outside `public_html`: backups contain PIN hashes) |
3. cPanel → **Terminal**, paste the "Enter to the virtual environment" command shown at the top of the Node.js App
   page, then:
   ```bash
   cd ~/teamadvert-api
   node dist/db-cli.mjs migrate
   node dist/db-cli.mjs seed
   ```
4. Restart the app and open `https://teamadvertplc.com/api/health` → `{"ok":true}`.
   (**verify** whether Passenger passes the `/api` prefix through to the app; the API expects it.)
5. Log in at `https://teamadvertplc.com/office` as `admin` with `SEED_ADMIN_PIN`, then change the PIN in Settings
   and remove `SEED_ADMIN_PIN` from the app's environment variables.

### Updating later

Upload the new `teamadvert-api/` over the old one, run `node dist/db-cli.mjs migrate` (safe to repeat), and restart
the app in **Setup Node.js App**.

## 5. Websites

Upload the contents of `dist/cpanel/public_html/` into `~/public_html/` (this includes `office/` and both
`.htaccess` files). Don't delete `public_html/api/` if cPanel created it for the Node.js App.

## 6. Weekly backup

cPanel → **Cron Jobs** → add (Sundays 02:00), using the node path from the Node.js App page:

```
0 2 * * 0  cd ~/teamadvert-api && /home/teamadub/nodevenv/teamadvert-api/22/bin/node dist/backup-cli.mjs
```

The cron job needs `DATABASE_URL` and `BACKUP_DIR` too: put them in `~/teamadvert-api/.env` (it is read
automatically; set its permissions to 600). Admins can also run a backup from the API (`POST /api/backups/run`).
Each backup is a gzipped JSON dump of every table except login sessions. (**verify** the nodevenv path.)

## 7. Telegram bot (optional)

The bot does what `/office` does, with commands (`/dashboard`, `/newproforma`, `/job`, `/pay`, … — `/help` lists all).
Only the Telegram accounts in `TELEGRAM_USERS` can use it, and each acts as the office user it is linked to: same
role, same permissions, and every change appears in the audit log under that user. It only answers in private
chats. Telegram calls the API (`/api/telegram/webhook`) for each message, so nothing runs in the background.

1. In Telegram, talk to **@BotFather** → `/newbot` → copy the token.
2. Get each person's numeric Telegram ID: they send any message to **@userinfobot**. (Once the bot runs, it also
   tells anyone who isn't linked yet their ID.)
3. Add to the Node.js App's environment variables (and `~/teamadvert-api/.env`, which the setup command reads):

   | Name | Value |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | the token from BotFather |
   | `TELEGRAM_WEBHOOK_SECRET` | 16+ random letters/digits (e.g. `openssl rand -hex 24`) |
   | `TELEGRAM_USERS` | `telegramId:officeUsername` pairs, e.g. `123456789:admin,987654321:sara` |

4. Restart the app, then in the cPanel Terminal (inside the virtual environment):
   ```bash
   cd ~/teamadvert-api
   node dist/telegram-cli.mjs webhook   # points Telegram at https://teamadvertplc.com/api/telegram/webhook
   node dist/telegram-cli.mjs info      # shows the webhook and any delivery error
   ```
   Run `webhook` again after changing `TELEGRAM_USERS` (it reloads the command menu for those chats).

Messages that contain a PIN (`/newuser`, `/resetpin`, `/changepin`) are deleted from the chat after use. To stop the
bot, remove `TELEGRAM_BOT_TOKEN` and run `node dist/telegram-cli.mjs unwebhook` first.

## 8. Android app (office with fingerprint / face / PIN lock)

`apps/android/` is a small native app that opens `https://teamadvertplc.com/office/` behind the phone's own lock
(fingerprint, face, or the phone's PIN / pattern / password). It locks on start and after a minute in the background;
signing in to the office still uses the office username and PIN. Printouts open in a print window with
**Print / Save PDF**. Because it loads the live office, office updates need no new APK.

Build (needs JDK 17 and the Android SDK at `~/Android/Sdk`):

```bash
cd apps/android
echo "sdk.dir=$HOME/Android/Sdk" > local.properties   # once
./gradlew assembleRelease                              # → app/build/outputs/apk/release/app-release.apk
```

The release is signed with the key in `~/.android-keys/` (`teamadvert-office.jks` + `.properties`), which is kept
outside the repository. **Back that folder up**: phones only install updates signed with the same key. For a new
version, raise `versionCode` (and `versionName`) in `apps/android/app/build.gradle.kts`.

Install: copy the APK to the phone, open it, and allow "Install unknown apps" for the app you opened it with.

## Local development

```bash
cp .env.example .env     # set SEED_ADMIN_PIN
npm install
npm run db:up            # PostgreSQL 16 in Docker on port 5433
npm run db:migrate && npm run db:seed
npm run dev:api          # http://localhost:4000/api
npm run dev:office       # http://localhost:5173/office/ (proxies /api)
npm run dev:web          # http://localhost:4321
npm run telegram -- poll # Telegram bot without a public URL: forwards messages to the local API (needs the
                         # TELEGRAM_* variables in .env; run `webhook` again on the server afterwards)
```
