FULL PRODUCT REQUIREMENTS DOCUMENT (PRD)
BLACK CARD MULTI-MERCHANT PAYMENT PLATFORM
(This is the full, clean, copyable PRD exactly as requested.)

PRODUCT REQUIREMENTS DOCUMENT (PRD)
THE BLACK CARD MULTI-MERCHANT PAYMENT PLATFORM
Closed-Loop NFC Payment System for Multi-Merchant Environments

1. PRODUCT OVERVIEW
1.1 Problem Statement
Multi-merchant recreational venues (e.g., go-kart tracks, amusement parks, gaming arenas) suffer from:
•Slow cash transactions
•Risk of cash leakage
•Fragmented settlement processes
•No automated revenue-sharing
•Poor auditability
•High operational friction
The BLACK CARD Platform solves this by enabling:
•Instant NFC tap-to-pay
•Server-side wallet balances
•Automated financial splitting
•On-demand payouts
•Bank-grade security and auditability
1.2 Vision & Value Proposition
Create a secure, scalable, closed-loop payment ecosystem that eliminates cash handling and enforces transparent revenue distribution.
Value Elements:
•Instant payments (<800 ms)
•No card-stored balance → zero clone/fraud risk
•Automated 99% Business / 1% Developer split
•Developer split (40/30/30)
•Strong 2FA for all privileged operations
•Immutable audit logs
•Multi-merchant and multi-device scalability
1.3 In-Scope (V1)
•NFC-based payment
•Mobile money top-up (Telebirr, M-Pesa, etc.)
•Server-side wallets
•Automatic ledger splitting (99/1 → 40/30/30)
•Daily withdrawal cap (80%)
•mPOS (Android)
•Web Dashboard (Developer + Super Admin)
•AES-256 encryption
•TOTP 2FA for payouts
•Payout account lock + approval flow
•Audit logging
1.4 Out-of-Scope (V1)
•Loyalty programs
•Multiple currencies
•Customer-facing mobile app UX
•Hardware POS terminals
•Chargeback interfaces
•Refund analytics

2. STAKEHOLDERS & USER PERSONAS
2.1 Persona Overview
Customer
•Loads balance via mobile money
•Uses card for payments
•Checks balance
•Cannot withdraw
Merchant Staff
•Processes payments only
•No financial privileges
•Limited transaction history
Merchant Admin
•Views Business Net wallet (99%)
•Requests withdrawals (80% cap)
•Views merchant transaction history
•Manages disputes
•2FA required
Developer (40/30/30 split)
•Views commission wallet
•Withdraws 80% daily
•Views payout history
•2FA required
Super Admin
•Manages platform rules (commission, splits, caps)
•Approves payout account changes
•Views audit logs
•Full oversight

3. USER FLOWS
3.1 Customer
A. Account Creation Flow
1.Customer registers with phone number.
2.Backend issues Customer ID.
3.Customer receives confirmation.
B. Mobile Money Top-Up
1.Customer initiates payment in-app.
2.API → mobile money provider.
3.Provider callback/confirmation.
4.Backend credits Central Wallet.
5.Funds assigned to Customer Wallet.
C. Card Linking
1.Customer taps card at mPOS.
2.Backend retrieves UID.
3.UID bound to Customer ID.
D. Payment Flow
1.Staff selects payment amount.
2.Customer taps card.
3.Backend retrieves Customer Wallet.
4.Validates balance.
5.Atomic transaction:
oDebit customer
oCredit 99% to Business Net
oCredit 1% to Developer pool (40/30/30)
6.Response sent to mPOS.
E. Balance Inquiry
•Tap card → display balance
F. Refund / Adjustment
•Admin selects transaction → initiates reversal
•Ledger entries reversed atomically
3.2 Merchant Staff
•Login
•Start payment
•Tap card
•Error handling (insufficient funds, network, unknown card)
3.3 Merchant Admin
•Login + 2FA
•View Business Net wallet
•View transactions
•Withdraw funds (80% daily)
•Enter TOTP to confirm withdrawal
•View payout history
3.4 Developer
•Login + 2FA
•View 1% split (per developer 40/30/30)
•Withdraw (80% daily)
•View payout history
3.5 Super Admin
•Configure global platform rules
•Approve payout account change requests
•View audit logs
•Override operations when needed

4. FUNCTIONAL REQUIREMENTS
4.1 Card & Identity Requirements
1.BLACK CARD uses NFC UID only; no writable memory.
2.Balance stored server-side only.
3.UID must uniquely map to Customer ID.
4.Multiple cards per customer allowed only if enabled by policy.
4.2 Wallets
WalletOwnerPurpose
Customer WalletCustomerStores user funds
Business Net WalletMerchant99% of each sale
Developer WalletDevelopers1% split 40/30/30
Central WalletPlatformReceives top-ups
Payout HistorySystemTracks withdrawals
4.3 Ledger Logic
Every payment must be an ACID transaction with atomic writes:
1.Debit Customer Wallet
2.Credit Merchant Business Net (99%)
3.Credit Developer A/B/C (1% total, 40/30/30)
4.Insert transaction ledger row
5.Insert audit events
If any step fails → rollback entire transaction.
4.4 Mobile Money Top-Up
•Support Telebirr, M-Pesa, and future integrations
•Must handle asynchronous provider callbacks
•Funds credited only after confirmed provider success
4.5 Withdrawal Logic
•Must evaluate 80% daily cap based on:
Available Balance at 00:00 EAT
•All withdrawals require TOTP 2FA
•Payout accounts locked after first entry
4.6 mPOS Requirements
•Android app
•Offline resilience
•Idempotency keys for each request
•Staff vs Admin roles enforced via RBAC
•Display payment confirmations, balance, errors
4.7 Dashboard Requirements
Developer
•Commission balance
•Withdraw funds
•View payout history
Super Admin
•Edit platform rules
•Audit log explorer
•Approve payout account changes
4.8 Audit Logging
Audit entries required for:
•Logins + 2FA results
•Payments
•Refunds
•Withdrawals
•Payout account changes
•Super Admin rule changes
Audit log must be immutable.

5. SECURITY, COMPLIANCE & GOVERNANCE
5.1 2FA Requirements
Mandatory for:
•Merchant Admin login
•Developer login
•ALL withdrawal requests
TOTP must be:
•RFC 6238 compliant
•Validated server-side
5.2 RBAC Matrix
RolePaymentWithdrawalModify RulesView Audit LogsChange Payout Account
CustomerYesNoNoNoNo
StaffYesNoNoNoNo
Merchant AdminNoYesNoLimitedRequest only
DeveloperNoYesNoNoRequest only
Super AdminYesYesYesYesApprove
5.3 Encryption
AES-256 encryption for:
•Balances
•Payout accounts
•Secrets
•2FA seeds
•Transaction history
TLS required for all communications.
5.4 Payout Account Locking
•Cannot be modified after initial setup
•Any change must generate a Change Request
•Requires Super Admin approval
•All events logged
5.5 Compliance
•Append-only audit logs
•System configuration must be versioned
•Payout delays & reversals must be logged

6. DATA MODEL & LEDGER DESIGN
Key Entities:
•users
•roles
•cards
•wallets
•wallet_balances
•transactions
•transaction_ledgers
•developer_splits
•payout_accounts
•payout_history
•audit_log
•system_config
Ledger Concurrency Rules:
1.All reads & writes to wallets use SELECT … FOR UPDATE.
2.Enforcement of idempotency for all payment attempts.
3.If database commit fails → rollback → return error to mPOS.
4.All financial operations produce audit events.

7. NON-FUNCTIONAL REQUIREMENTS
•Transaction response time: <800 ms
•High availability (99.9%)
•Horizontal scalability (merchant-level partitioning)
•Alerts for:
oFailed payments
oFailed payouts
o2FA failures
oHigh ledger latency
oMobile money API timeouts

8. EDGE CASES
•Duplicate tap → reject via idempotency key
•Network loss → mPOS retries on reconnect
•Partial provider confirmation → mark as pending
•Insufficient balance → reject
•Time drift → always use server-side EAT time
•Payout failure → mark failed; allow retry

9. ASSUMPTIONS / OPEN QUESTIONS / RISKS
Assumptions
•Merchant devices maintain internet
•Mobile money APIs provide reliable callbacks
•All merchants accept Black Card exclusively
Open Questions
1.Should customers undergo KYC?
2.Should we allow multiple cards per customer?
3.Should refunds require Super Admin approval?
Risks
RiskMitigation
Fraudulent withdrawalsTOTP + locked payout account
Ledger corruptionACID + row locking
mPOS device compromiseRoot/jailbreak detection
Network failureIdempotent requests + retries
Regulatory issuesSeek legal review early

10. RELEASE PLAN
V1 – MVP
•Core ledgers
•NFC tap payments
•99/1 → 40/30/30 split
•mPOS payments
•2FA for Admin/Developer
•Withdrawal system
•Payout locking
•Audit logs
V2
•Fraud monitoring
•Merchant reporting suite
V3
•Multi-currency
•Multi-country
•Customer mobile app
•Loyalty system

STRIDE THREAT MODEL
S – Spoofing
Threats:
•Fake mPOS device
•Fake login attempts
•Stolen admin credentials
Mitigations:
•Device attestation
•Strong auth + TOTP
•IP/device fingerprinting
•JWT with short TTL
T – Tampering
Threats:
•Ledger modification
•Payment payload tampering
•Transaction replay
Mitigations:
•ACID DB
•Idempotency keys
•Immutable append-only audit logs
•TLS + request signing
R – Repudiation
Threats:
•Merchant denies a payout
•Developer denies withdrawal
•Staff denies performing payment
Mitigations:
•Audit logs with:
oIP
oDevice ID
oTimestamps
oSignatures
I – Information Disclosure
Threats:
•Payout account leak
•Transaction history leak
Mitigations:
•AES-256 encryption
•RBAC enforcement
•Encrypted audit logs
•Strict least privilege
D – Denial of Service
Threats:
•High-frequency tap spam
•DDoS on API
Mitigations:
•Rate limiting
•mPOS client-side throttling
•API gateway filters
•Auto-scaling
E – Elevation of Privilege
Threats:
•Staff gaining admin privileges
•Developer modifying commission rules
Mitigations:
•Strict RBAC model
•Super Admin is only role with configuration permissions
•All modifications logged and monitored

Below is MESSAGE 2 of 2, containing:
1.Full OpenAPI/Swagger Specification (YAML)
2.Full PostgreSQL DDL Schema
3.Full Ledger Engine Pseudocode
All artifacts are formatted to be copy-paste ready for engineering teams.

1. FULL OPENAPI / SWAGGER SPECIFICATION (YAML)
BLACK CARD PAYMENT PLATFORM API — VERSION 1.0
openapi: 3.0.3
info:
  title: Black Card Multi-Merchant Payment Platform API
  version: 1.0.0
  description: >
    Closed-loop NFC payment system with server-side balances, automated
    revenue splitting, mobile-money top-ups, payouts, 2FA, and audit logging.

servers:
  - url: https://api.blackcard.local/v1

tags:
  - name: auth
    description: Authentication & 2FA
  - name: customers
  - name: cards
  - name: payments
  - name: wallets
  - name: merchants
  - name: developers
  - name: payouts
  - name: admin
  - name: audit

#
# AUTHENTICATION
#
paths:
  /auth/login:
    post:
      tags: [auth]
      summary: Login user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string }
                password: { type: string }
      responses:
        200:
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken: { type: string }
                  requires2FA: { type: boolean }
        401:
          description: Invalid credentials

  /auth/2fa/verify:
    post:
      tags: [auth]
      summary: Verify TOTP 2FA
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token]
              properties:
                token: { type: string }
      responses:
        200: { description: 2FA success }
        400: { description: Invalid token }

#
# CUSTOMER & CARD ENDPOINTS
#
  /customers/register:
    post:
      tags: [customers]
      summary: Register a customer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone: { type: string }
      responses:
        201:
          description: Customer created
          content:
            application/json:
              schema:
                type: object
                properties:
                  customerId: { type: string }

  /cards/link:
    post:
      tags: [cards]
      summary: Link NFC card UID to customer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [customerId, cardUid]
              properties:
                customerId: { type: string }
                cardUid: { type: string }
      responses:
        200: { description: Card linked }

  /cards/balance:
    get:
      tags: [cards]
      summary: Get balance for card UID
      parameters:
        - in: query
          name: cardUid
          schema: { type: string }
          required: true
      responses:
        200:
          description: Balance result
          content:
            application/json:
              schema:
                type: object
                properties:
                  balance: { type: number }

#
# TOP-UP
#
  /topup/initiate:
    post:
      tags: [customers]
      summary: Initiate mobile money top-up
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [customerId, amount, provider]
              properties:
                customerId: { type: string }
                amount: { type: number }
                provider: { type: string }
      responses:
        200:
          description: Top-up initiated

  /topup/callback:
    post:
      tags: [customers]
      summary: Mobile money provider callback (asynchronous)
      responses:
        200: { description: Callback received }

#
# PAYMENTS
#
  /payments/process:
    post:
      tags: [payments]
      summary: Process NFC payment
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [merchantId, cardUid, amount, idempotencyKey]
              properties:
                merchantId: { type: string }
                cardUid: { type: string }
                amount: { type: number }
                idempotencyKey: { type: string }
      responses:
        200:
          description: Payment success
          content:
            application/json:
              schema:
                type: object
                properties:
                  transactionId: { type: string }
                  status: { type: string }
        402:
          description: Insufficient balance
        409:
          description: Duplicate payment

#
# MERCHANT ADMIN
#
  /merchant/wallet:
    get:
      tags: [merchants]
      summary: Get merchant's Business Net wallet balance
      parameters:
        - in: query
          name: merchantId
          schema: { type: string }
          required: true
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  balance: { type: number }

  /merchant/withdraw:
    post:
      tags: [payouts]
      summary: Merchant withdrawal request (80% rule)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [merchantId, amount, totp]
              properties:
                merchantId: { type: string }
                amount: { type: number }
                totp: { type: string }
      responses:
        200: { description: Withdrawal initiated }
        400: { description: Invalid TOTP / cap exceeded }

#
# DEVELOPER ENDPOINTS
#
  /developer/wallet:
    get:
      tags: [developers]
      summary: Get developer commission balance
      parameters:
        - in: query
          name: developerId
          required: true
          schema: { type: string }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  balance: { type: number }

  /developer/withdraw:
    post:
      tags: [developers, payouts]
      summary: Developer withdrawal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [developerId, amount, totp]
              properties:
                developerId: { type: string }
                amount: { type: number }
                totp: { type: string }
      responses:
        200: { description: Withdrawal initiated }

#
# SUPER ADMIN
#
  /admin/config:
    get:
      tags: [admin]
      summary: Get system configuration
      responses:
        200:
          content:
            application/json:
              schema:
                type: object

  /admin/config/update:
    post:
      tags: [admin]
      summary: Update financial rules
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                commissionRate: { type: number }
                developerSplit: 
                  type: object
                  properties:
                    devA: { type: number }
                    devB: { type: number }
                    devC: { type: number }
                withdrawalCap: { type: number }
      responses:
        200: { description: Config updated }

  /admin/audit:
    get:
      tags: [audit]
      summary: Retrieve audit logs
      parameters:
        - name: actorId
          in: query
          required: false
          schema: { type: string }
        - name: eventType
          in: query
          schema: { type: string }
      responses:
        200:
          description: Audit logs

2. FULL POSTGRESQL DATABASE SCHEMA (DDL)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    phone VARCHAR(20),
    username VARCHAR(50) UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INT REFERENCES roles(id),
    totp_secret TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cards (
    uid VARCHAR(64) PRIMARY KEY,
    customer_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallets (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES users(id),
    owner_merchant_id UUID,
    type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_balances (
    wallet_id UUID PRIMARY KEY REFERENCES wallets(id),
    balance NUMERIC(18,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES users(id),
    customer_id UUID REFERENCES users(id),
    card_uid VARCHAR(64) REFERENCES cards(uid),
    amount NUMERIC(18,2),
    created_at TIMESTAMP DEFAULT NOW(),
    idempotency_key VARCHAR(128)
);

CREATE UNIQUE INDEX uniq_idempotency
ON transactions (merchant_id, idempotency_key);

CREATE TABLE transaction_ledgers (
    id SERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id),
    wallet_id UUID REFERENCES wallets(id),
    delta NUMERIC(18,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE developer_splits (
    id SERIAL PRIMARY KEY,
    developer_id UUID REFERENCES users(id),
    percentage NUMERIC(5,2)
);

CREATE TABLE payout_accounts (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    account_number TEXT ENCRYPTED WITH (provider = 'aes256'),
    provider VARCHAR(50),
    locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payout_history (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    wallet_id UUID REFERENCES wallets(id),
    amount NUMERIC(18,2),
    status VARCHAR(32),
    provider VARCHAR(50),
    reference TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID,
    event_type VARCHAR(50),
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    commission_rate NUMERIC(5,2),
    split_dev_a NUMERIC(5,2),
    split_dev_b NUMERIC(5,2),
    split_dev_c NUMERIC(5,2),
    withdrawal_cap NUMERIC(5,2),
    updated_at TIMESTAMP DEFAULT NOW()
);

3. LEDGER ENGINE PSEUDOCODE
This pseudocode is ready to be translated into Go, Java, Node.js, Python, or Rust.
function processPayment(merchantId, cardUid, amount, idempotencyKey):

    begin transaction

    # 1. Resolve customer ID from card UID
    customerId = SELECT customer_id FROM cards WHERE uid = cardUid FOR UPDATE
    if customerId is null:
        rollback; return ERROR_CARD_NOT_FOUND

    # 2. Check idempotency
    existing = SELECT id FROM transactions
               WHERE merchant_id = merchantId
                 AND idempotency_key = idempotencyKey
    if existing exists:
        rollback; return DUPLICATE_REQUEST

    # 3. Load wallets (with locks)
    customerWallet = SELECT * FROM wallet_balances
                     WHERE wallet_id = (SELECT id FROM wallets WHERE owner_user_id = customerId AND type='CUSTOMER')
                     FOR UPDATE

    merchantWallet = SELECT * FROM wallet_balances
                     WHERE wallet_id = (SELECT id FROM wallets WHERE owner_merchant_id = merchantId AND type='BUSINESS_NET')
                     FOR UPDATE

    devWallets = SELECT wallet_id, percentage
                 FROM developer_splits JOIN wallets
                 ON wallets.owner_user_id = developer_splits.developer_id
                 FOR UPDATE

    # 4. Check balance
    if customerWallet.balance < amount:
        rollback; return INSUFFICIENT_BALANCE

    # 5. Compute splits
    businessAmount = amount * 0.99
    developerTotal = amount * 0.01

    devA = developerTotal * 0.40
    devB = developerTotal * 0.30
    devC = developerTotal * 0.30

    # 6. Perform all deductions/credits
    UPDATE wallet_balances SET balance = balance - amount WHERE wallet_id = customerWallet.wallet_id
    UPDATE wallet_balances SET balance = balance + businessAmount WHERE wallet_id = merchantWallet.wallet_id

    UPDATE wallet_balances SET balance = balance + devA WHERE wallet_id = devA.wallet_id
    UPDATE wallet_balances SET balance = balance + devB WHERE wallet_id = devB.wallet_id
    UPDATE wallet_balances SET balance = balance + devC WHERE wallet_id = devC.wallet_id

    # 7. Insert transaction record
    txnId = generateUUID()
    INSERT INTO transactions(id, merchant_id, customer_id, card_uid, amount, idempotency_key)
    VALUES (txnId, merchantId, customerId, cardUid, amount, idempotencyKey)

    # 8. Ledger entries
    INSERT INTO transaction_ledgers(transaction_id, wallet_id, delta)
    VALUES (txnId, customerWallet.wallet_id, -amount)

    INSERT INTO transaction_ledgers(transaction_id, wallet_id, delta)
    VALUES (txnId, merchantWallet.wallet_id, businessAmount)

    INSERT ledger rows for devA, devB, devC

    # 9. Audit logging
    INSERT INTO audit_log(actor_id, event_type, payload)
    VALUES (merchantId, 'PAYMENT_PROCESS', JSON({...}))

    commit
    return SUCCESS(txnId)
