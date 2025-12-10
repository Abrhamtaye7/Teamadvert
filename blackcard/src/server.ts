import express from "express";
import helmet from "helmet";
import cors from "cors";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { config } from "./config";
import {
  addLedger,
  audits,
  cards,
  findCard,
  findPayoutAccount,
  findUserById,
  findUserByUsername,
  findWallet,
  getCentralWallet,
  insertTransaction,
  getWithdrawalWindow,
  ledgers,
  payouts,
  payoutAccountChangeRequests,
  payoutAccounts,
  recordAudit,
  recordPayout,
  refundedTransactions,
  transactions,
  insertChangeRequest,
  upsertPayoutAccount,
  updateWithdrawalWindow,
  users,
  wallets,
} from "./data";
import { Role, User, WalletType } from "./types";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const idempotencyRegister = new Map<string, string>();
let runtimeConfig = {
  commissionRate: 1,
  developerSplit: config.developerSplit,
  withdrawalCap: config.withdrawalCap,
};

const dailyCapExceeded = (wallet: { id: string; balance: number }, amount: number) => {
  const today = new Date().toISOString().slice(0, 10);
  const window = getWithdrawalWindow(wallet.id);
  if (!window || window.dateKey !== today) {
    updateWithdrawalWindow(wallet.id, { dateKey: today, startingBalance: wallet.balance, withdrawn: 0 });
  }
  const active = getWithdrawalWindow(wallet.id)!;
  const cap = active.startingBalance * runtimeConfig.withdrawalCap;
  const remaining = cap - active.withdrawn;
  if (amount > remaining) return { exceeded: true, cap, remaining };
  active.withdrawn += amount;
  updateWithdrawalWindow(wallet.id, active);
  return { exceeded: false, cap, remaining: remaining - amount };
};

const requireLockedPayoutAccount = (userId: string) => {
  const account = findPayoutAccount(userId);
  if (!account) return { ok: false, message: "No payout account on file" } as const;
  if (!account.locked) return { ok: false, message: "Payout account pending lock" } as const;
  return { ok: true, account } as const;
};

const signToken = (user: User) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "1h" });

const requireAuth: express.RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; role: Role };
    const user = findUserById(payload.sub);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const requireRole = (roles: Role[]): express.RequestHandler => (req, res, next) => {
  const user = (req as any).user as User | undefined;
  if (!user || !roles.includes(user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
};

const walletOrCreate = (ownerId: string, type: WalletType) => {
  const wallet = findWallet(ownerId, type);
  if (!wallet) {
    const newWallet = { id: uuid(), ownerId, type, balance: 0 };
    wallets.push(newWallet);
    return newWallet;
  }
  return wallet;
};

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/login", (req, res) => {
  const schema = z.object({ username: z.string(), pin: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const user = findUserByUsername(parsed.data.username);
  if (!user || user.pin !== parsed.data.pin) return res.status(401).json({ message: "Invalid credentials" });
  recordAudit({ actorId: user.id, eventType: "login" });
  return res.json({ accessToken: signToken(user), requires2FA: Boolean(user.totpSecret) });
});

app.post("/auth/2fa/verify", requireAuth, (req, res) => {
  const user = (req as any).user as User | undefined;
  const token = req.body?.token;
  if (!user?.totpSecret) return res.status(400).json({ message: "2FA not configured" });
  const ok = authenticator.check(token, user.totpSecret);
  recordAudit({ actorId: user.id, eventType: "2fa_verify", payload: { ok } });
  if (!ok) return res.status(400).json({ message: "Invalid token" });
  return res.json({ message: "2FA success" });
});

app.post("/customers/register", (req, res) => {
  const schema = z.object({ phone: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const user: User = { id: uuid(), username: parsed.data.phone, role: "customer", pin: "0000" };
  users.push(user);
  walletOrCreate(user.id, "customer");
  recordAudit({ actorId: user.id, eventType: "customer_register", payload: { phone: parsed.data.phone } });
  return res.status(201).json({ customerId: user.id });
});

app.post("/cards/link", requireAuth, (req, res) => {
  const schema = z.object({ customerId: z.string(), cardUid: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const customer = findUserById(parsed.data.customerId);
  if (!customer || customer.role !== "customer") return res.status(404).json({ message: "Customer not found" });
  cards.push({ uid: parsed.data.cardUid, customerId: customer.id });
  recordAudit({ actorId: (req as any).user?.id, eventType: "card_link", payload: parsed.data });
  return res.json({ message: "Card linked" });
});

app.get("/cards/balance", (req, res) => {
  const uid = req.query.cardUid as string | undefined;
  if (!uid) return res.status(400).json({ message: "Missing cardUid" });
  const card = findCard(uid);
  if (!card) return res.status(404).json({ message: "Card not found" });
  const wallet = findWallet(card.customerId, "customer");
  return res.json({ balance: wallet?.balance ?? 0 });
});

app.post("/topup/initiate", (req, res) => {
  const schema = z.object({ customerId: z.string(), amount: z.number().positive(), provider: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const customerWallet = walletOrCreate(parsed.data.customerId, "customer");
  const central = getCentralWallet();
  central.balance += parsed.data.amount;
  customerWallet.balance += parsed.data.amount;
  recordAudit({ eventType: "topup", payload: parsed.data });
  return res.json({ message: "Top-up initiated", balance: customerWallet.balance });
});

app.post("/payments/process", (req, res) => {
  const schema = z.object({ merchantId: z.string(), cardUid: z.string(), amount: z.number().positive(), idempotencyKey: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const { merchantId, cardUid, amount, idempotencyKey } = parsed.data;
  const idempotencyToken = `${merchantId}:${idempotencyKey}`;
  const existing = idempotencyRegister.get(idempotencyToken);
  if (existing) return res.status(409).json({ message: "Duplicate payment", transactionId: existing });

  const card = findCard(cardUid);
  if (!card) return res.status(404).json({ message: "Card not found" });
  const customerWallet = findWallet(card.customerId, "customer");
  if (!customerWallet || customerWallet.balance < amount) return res.status(402).json({ message: "Insufficient balance" });

  const merchantWallet = walletOrCreate(merchantId, "business_net");
  const developerWallets = users
    .filter((u) => u.role === "developer")
    .map((dev) => walletOrCreate(dev.id, "developer"));

  // compute splits
  const businessAmount = Number((amount * (1 - runtimeConfig.commissionRate / 100)).toFixed(2));
  const devTotal = Number((amount * (runtimeConfig.commissionRate / 100)).toFixed(2));
  const split = runtimeConfig.developerSplit;
  const devAmounts = [split.devA, split.devB, split.devC].map((p) => Number(((devTotal * p) / 100).toFixed(2)));

  // apply ledger
  customerWallet.balance -= amount;
  merchantWallet.balance += businessAmount;
  developerWallets.forEach((wallet, idx) => {
    wallet.balance += devAmounts[idx] ?? 0;
  });

  const txnId = uuid();
  insertTransaction({ id: txnId, merchantId, customerId: card.customerId, cardUid, amount, idempotencyKey });
  addLedger({ transactionId: txnId, walletId: customerWallet.id, delta: -amount });
  addLedger({ transactionId: txnId, walletId: merchantWallet.id, delta: businessAmount });
  developerWallets.forEach((wallet, idx) => addLedger({ transactionId: txnId, walletId: wallet.id, delta: devAmounts[idx] ?? 0 }));

  recordAudit({ actorId: merchantId, eventType: "payment_process", payload: { txnId, amount } });
  idempotencyRegister.set(idempotencyToken, txnId);

  return res.json({ transactionId: txnId, status: "success" });
});

app.post("/payments/refund", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const schema = z.object({ transactionId: z.string(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const txn = transactions.find((t) => t.id === parsed.data.transactionId);
  if (!txn) return res.status(404).json({ message: "Transaction not found" });
  if (refundedTransactions.has(txn.id)) return res.status(409).json({ message: "Already refunded" });

  const entries = ledgers.filter((l) => l.transactionId === txn.id);
  entries.forEach((entry) => {
    const wallet = wallets.find((w) => w.id === entry.walletId);
    if (wallet) wallet.balance -= entry.delta;
    addLedger({ transactionId: `${txn.id}-refund`, walletId: entry.walletId, delta: -entry.delta });
  });
  refundedTransactions.add(txn.id);
  recordAudit({ actorId: (req as any).user.id, eventType: "payment_refund", payload: parsed.data });
  return res.json({ message: "Refunded", refundTransactionId: `${txn.id}-refund` });
});

app.get("/payout/account", requireAuth, requireRole(["merchant_admin", "developer"]), (req, res) => {
  const user = (req as any).user as User;
  const account = findPayoutAccount(user.id);
  if (!account) return res.status(404).json({ message: "No payout account" });
  return res.json(account);
});

app.post("/payout/account/setup", requireAuth, requireRole(["merchant_admin", "developer"]), (req, res) => {
  const schema = z.object({ provider: z.string(), accountNumber: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const user = (req as any).user as User;
  const existing = findPayoutAccount(user.id);
  if (existing) return res.status(400).json({ message: "Payout account already locked" });
  const account = upsertPayoutAccount({ userId: user.id, provider: parsed.data.provider, accountNumber: parsed.data.accountNumber, locked: true });
  recordAudit({ actorId: user.id, eventType: "payout_account_setup", payload: { provider: account.provider } });
  return res.status(201).json(account);
});

app.post("/payout/account/change-request", requireAuth, requireRole(["merchant_admin", "developer"]), (req, res) => {
  const schema = z.object({ provider: z.string(), accountNumber: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const user = (req as any).user as User;
  const account = findPayoutAccount(user.id);
  if (!account) return res.status(400).json({ message: "No payout account to change" });
  const pending = payoutAccountChangeRequests.find((r) => r.userId === user.id && r.status === "pending");
  if (pending) return res.status(409).json({ message: "Existing change request pending", requestId: pending.id });
  const request = insertChangeRequest({ id: uuid(), userId: user.id, newAccountNumber: parsed.data.accountNumber, newProvider: parsed.data.provider, status: "pending" });
  recordAudit({ actorId: user.id, eventType: "payout_account_change_requested", payload: { requestId: request.id } });
  return res.status(202).json({ requestId: request.id, status: request.status });
});

app.get("/merchant/wallet", requireAuth, requireRole(["merchant_admin"]), (req, res) => {
  const user = (req as any).user as User;
  const wallet = walletOrCreate(user.id, "business_net");
  return res.json({ balance: wallet.balance });
});

app.post("/merchant/withdraw", requireAuth, requireRole(["merchant_admin"]), (req, res) => {
  const schema = z.object({ amount: z.number().positive(), totp: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const user = (req as any).user as User;
  if (!user.totpSecret || !authenticator.check(parsed.data.totp, user.totpSecret)) {
    return res.status(400).json({ message: "Invalid TOTP" });
  }
  const payoutAccountCheck = requireLockedPayoutAccount(user.id);
  if (!payoutAccountCheck.ok) return res.status(400).json({ message: payoutAccountCheck.message });
  const wallet = walletOrCreate(user.id, "business_net");
  const capCheck = dailyCapExceeded(wallet, parsed.data.amount);
  if (capCheck.exceeded) return res.status(400).json({ message: "Cap exceeded", cap: capCheck.cap, remaining: capCheck.remaining });
  wallet.balance -= parsed.data.amount;
  recordPayout({
    id: uuid(),
    userId: user.id,
    walletId: wallet.id,
    amount: parsed.data.amount,
    status: "pending",
    provider: payoutAccountCheck.account.provider,
  });
  recordAudit({ actorId: user.id, eventType: "merchant_withdraw", payload: parsed.data });
  return res.json({ message: "Withdrawal initiated", remaining: wallet.balance });
});

app.get("/developer/wallet", requireAuth, requireRole(["developer"]), (req, res) => {
  const user = (req as any).user as User;
  const wallet = walletOrCreate(user.id, "developer");
  return res.json({ balance: wallet.balance });
});

app.post("/developer/withdraw", requireAuth, requireRole(["developer"]), (req, res) => {
  const schema = z.object({ amount: z.number().positive(), totp: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const user = (req as any).user as User;
  if (!user.totpSecret || !authenticator.check(parsed.data.totp, user.totpSecret)) return res.status(400).json({ message: "Invalid TOTP" });
  const payoutAccountCheck = requireLockedPayoutAccount(user.id);
  if (!payoutAccountCheck.ok) return res.status(400).json({ message: payoutAccountCheck.message });
  const wallet = walletOrCreate(user.id, "developer");
  const capCheck = dailyCapExceeded(wallet, parsed.data.amount);
  if (capCheck.exceeded) return res.status(400).json({ message: "Cap exceeded", cap: capCheck.cap, remaining: capCheck.remaining });
  wallet.balance -= parsed.data.amount;
  recordPayout({
    id: uuid(),
    userId: user.id,
    walletId: wallet.id,
    amount: parsed.data.amount,
    status: "pending",
    provider: payoutAccountCheck.account.provider,
  });
  recordAudit({ actorId: user.id, eventType: "developer_withdraw", payload: parsed.data });
  return res.json({ message: "Withdrawal initiated", remaining: wallet.balance });
});

app.get("/admin/config", requireAuth, requireRole(["super_admin"]), (_req, res) => {
  return res.json(runtimeConfig);
});

app.post("/admin/config/update", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const schema = z.object({
    commissionRate: z.number().min(0).max(5).optional(),
    developerSplit: z
      .object({ devA: z.number(), devB: z.number(), devC: z.number() })
      .refine((v) => v.devA + v.devB + v.devC === 100, "Split must equal 100")
      .optional(),
    withdrawalCap: z.number().min(0).max(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  runtimeConfig = { ...runtimeConfig, ...parsed.data, developerSplit: parsed.data.developerSplit ?? runtimeConfig.developerSplit };
  recordAudit({ actorId: (req as any).user.id, eventType: "admin_config_update", payload: parsed.data });
  return res.json(runtimeConfig);
});

app.get("/admin/payout/change-requests", requireAuth, requireRole(["super_admin"]), (_req, res) => {
  return res.json(payoutAccountChangeRequests);
});

app.get("/payout/history", requireAuth, requireRole(["merchant_admin", "developer"]), (req, res) => {
  const user = (req as any).user as User;
  const history = payouts.filter((p) => p.userId === user.id);
  return res.json(history);
});

app.post("/admin/payout/review", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const schema = z.object({ payoutId: z.string(), approve: z.boolean(), reference: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const payout = payouts.find((p) => p.id === parsed.data.payoutId);
  if (!payout) return res.status(404).json({ message: "Payout not found" });
  if (payout.status !== "pending") return res.status(409).json({ message: "Payout already decided", status: payout.status });

  payout.status = parsed.data.approve ? "approved" : "rejected";
  payout.reference = parsed.data.reference;

  if (!parsed.data.approve) {
    const wallet = wallets.find((w) => w.id === payout.walletId);
    if (wallet) wallet.balance += payout.amount;
  }

  recordAudit({
    actorId: (req as any).user.id,
    eventType: "payout_review",
    payload: { payoutId: payout.id, approved: parsed.data.approve, reference: parsed.data.reference },
  });

  return res.json(payout);
});

app.post("/admin/payout/change/approve", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const schema = z.object({ requestId: z.string(), approve: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const request = payoutAccountChangeRequests.find((r) => r.id === parsed.data.requestId);
  if (!request) return res.status(404).json({ message: "Request not found" });
  if (request.status !== "pending") return res.status(409).json({ message: "Request already decided" });
  request.status = parsed.data.approve ? "approved" : "rejected";
  if (parsed.data.approve) {
    upsertPayoutAccount({ userId: request.userId, provider: request.newProvider, accountNumber: request.newAccountNumber, locked: true });
  }
  recordAudit({
    actorId: (req as any).user.id,
    eventType: "payout_account_change_reviewed",
    payload: { requestId: request.id, approved: parsed.data.approve },
  });
  return res.json(request);
});

app.get("/admin/audit", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const { actorId, eventType } = req.query as { actorId?: string; eventType?: string };
  const events = audits.filter((event) => (!actorId || event.actorId === actorId) && (!eventType || event.eventType === eventType));
  return res.json(events);
});

app.get("/payouts", requireAuth, requireRole(["super_admin"]), (_req, res) => res.json(payouts));

app.listen(config.port, () => {
  console.log(`Black Card API running on ${config.port}`);
  console.log("Seeded TOTP secrets (use any TOTP app):");
  users
    .filter((u) => u.totpSecret)
    .forEach((u) => console.log(`${u.username}: ${u.totpSecret}`));
});
