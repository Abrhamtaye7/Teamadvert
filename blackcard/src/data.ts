import { v4 as uuid } from "uuid";
import { authenticator } from "otplib";
import { config } from "./config";
import { AuditEvent, Card, PayoutRequest, Transaction, TransactionLedgerEntry, User, Wallet } from "./types";

export const users: User[] = [
  { id: uuid(), username: "customer1", role: "customer", pin: "1234" },
  { id: uuid(), username: "merchant-admin", role: "merchant_admin", pin: "3805", totpSecret: authenticator.generateSecret() },
  { id: uuid(), username: "developer-a", role: "developer", pin: "1111", totpSecret: authenticator.generateSecret() },
  { id: uuid(), username: "developer-b", role: "developer", pin: "2222", totpSecret: authenticator.generateSecret() },
  { id: uuid(), username: "developer-c", role: "developer", pin: "3333", totpSecret: authenticator.generateSecret() },
  { id: uuid(), username: "super-admin", role: "super_admin", pin: "9999", totpSecret: authenticator.generateSecret() },
];

export const wallets: Wallet[] = [];
export const cards: Card[] = [];
export const transactions: Transaction[] = [];
export const ledgers: TransactionLedgerEntry[] = [];
export const audits: AuditEvent[] = [];
export const payouts: PayoutRequest[] = [];
export const refundedTransactions = new Set<string>();

type WithdrawalWindow = {
  dateKey: string;
  startingBalance: number;
  withdrawn: number;
};

const withdrawalWindows = new Map<string, WithdrawalWindow>();

const getWallet = (ownerId: string, type: Wallet["type"], initialBalance = 0): Wallet => {
  let wallet = wallets.find((w) => w.ownerId === ownerId && w.type === type);
  if (!wallet) {
    wallet = { id: uuid(), ownerId, type, balance: initialBalance };
    wallets.push(wallet);
  }
  return wallet;
};

// Seed core wallets
const customer = users.find((u) => u.role === "customer")!;
getWallet(customer.id, "customer", 1000);

const merchant = users.find((u) => u.role === "merchant_admin")!;
getWallet(merchant.id, "business_net", 0);

const devs = users.filter((u) => u.role === "developer");
const { devA, devB, devC } = config.developerSplit;
const percentages = [devA, devB, devC];
devs.forEach((dev, index) => getWallet(dev.id, "developer", 0 + percentages[index]));

const central = getWallet("central", "central", 0);

cards.push({ uid: "CARD-001", customerId: customer.id });

export const findUserByUsername = (username: string) => users.find((u) => u.username === username);
export const findUserById = (id: string) => users.find((u) => u.id === id);
export const findCard = (uid: string) => cards.find((c) => c.uid === uid);
export const findWallet = (ownerId: string, type: Wallet["type"]) => wallets.find((w) => w.ownerId === ownerId && w.type === type);
export const getCentralWallet = () => central;
export const getWithdrawalWindow = (walletId: string) => withdrawalWindows.get(walletId);
export const updateWithdrawalWindow = (walletId: string, window: WithdrawalWindow) => withdrawalWindows.set(walletId, window);

export const recordAudit = (event: Omit<AuditEvent, "id" | "createdAt">) => {
  const audit: AuditEvent = { ...event, id: uuid(), createdAt: new Date() };
  audits.push(audit);
  return audit;
};

export const insertTransaction = (txn: Omit<Transaction, "createdAt">) => {
  const transaction: Transaction = { ...txn, createdAt: new Date() };
  transactions.push(transaction);
  return transaction;
};

export const addLedger = (entry: Omit<TransactionLedgerEntry, "createdAt">) => {
  const ledgerEntry: TransactionLedgerEntry = { ...entry, createdAt: new Date() };
  ledgers.push(ledgerEntry);
  return ledgerEntry;
};

export const recordPayout = (data: Omit<PayoutRequest, "createdAt">) => {
  const payout: PayoutRequest = { ...data, createdAt: new Date() };
  payouts.push(payout);
  return payout;
};
