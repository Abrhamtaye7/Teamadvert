export type Role = "customer" | "staff" | "merchant_admin" | "developer" | "super_admin";

export interface User {
  id: string;
  username: string;
  role: Role;
  pin: string;
  totpSecret?: string;
}

export type WalletType = "customer" | "business_net" | "developer" | "central";

export interface Wallet {
  id: string;
  ownerId: string;
  type: WalletType;
  balance: number;
}

export interface Card {
  uid: string;
  customerId: string;
}

export interface TransactionLedgerEntry {
  transactionId: string;
  walletId: string;
  delta: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  merchantId: string;
  customerId: string;
  cardUid: string;
  amount: number;
  idempotencyKey: string;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  actorId?: string;
  eventType: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  walletId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  provider?: string;
  reference?: string;
  createdAt: Date;
}

export interface PayoutAccount {
  id: string;
  userId: string;
  accountNumber: string;
  provider: string;
  locked: boolean;
  createdAt: Date;
}

export interface PayoutAccountChangeRequest {
  id: string;
  userId: string;
  newAccountNumber: string;
  newProvider: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}
