// Ported from legacy/backend/prisma/schema.prisma to PostgreSQL. Columns are camelCase in code and
// snake_case in the database (drizzle `casing: "snake_case"`). Money is NUMERIC(14,2) read as JS numbers.
// `serial` ids (not identity columns) keep the DDL compatible with older PostgreSQL versions on shared hosting.
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const id = () => serial().primaryKey();
const money = () => numeric({ precision: 14, scale: 2, mode: "number" });
const ts = () => timestamp({ withTimezone: true, precision: 3, mode: "date" });
const createdAt = () => ts().notNull().defaultNow();
const updatedAt = () =>
  ts()
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());

export const proformaStatuses = ["draft", "approved", "converted", "expired"] as const;
export const jobStatuses = [
  "pending_approval",
  "approved",
  "in_progress",
  "completed",
  "finance_review",
  "closed",
] as const;
export const notificationTypes = [
  "ProformaApproved",
  "JobApproved",
  "JobCompleted",
  "PaymentPending",
  "PriceChange",
  "CustomerAlert",
  "PaymentVerified",
  "Generic",
] as const;
export const creditStandings = ["Good", "Warning", "Suspended"] as const;

export const proformaStatusEnum = pgEnum("proforma_status", proformaStatuses);
export const jobStatusEnum = pgEnum("job_status", jobStatuses);
export const notificationTypeEnum = pgEnum("notification_type", notificationTypes);
export const creditStandingEnum = pgEnum("credit_standing", creditStandings);

export type Permissions = Record<string, boolean>;
export type Address = {
  region?: string;
  city?: string;
  subcity?: string;
  woreda?: string;
  houseNo?: string;
};

// ---------- Users & access ----------

export const roles = pgTable("roles", {
  id: id(),
  name: varchar({ length: 64 }).notNull().unique(),
  permissions: jsonb().$type<Permissions>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable("users", {
  id: id(),
  username: varchar({ length: 64 }).notNull().unique(),
  pinHash: varchar({ length: 255 }).notNull(),
  roleId: integer()
    .notNull()
    .references(() => roles.id),
  isActive: boolean().notNull().default(true),
  failedAttempts: integer().notNull().default(0),
  lockedUntil: ts(),
  lastLoginAt: ts(),
  lastLoginIp: varchar({ length: 64 }),
  lastLoginAgent: varchar({ length: 512 }),
  preferences: jsonb().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Login sessions. `id` is the SHA-256 of the cookie token, so a DB leak doesn't leak live sessions. */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar({ length: 64 }).primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts().notNull(),
    lastSeenAt: ts().notNull(),
    ip: varchar({ length: 64 }),
    userAgent: varchar({ length: 512 }),
    createdAt: createdAt(),
  },
  (t) => [index("idx_session_user").on(t.userId)],
);

export const accessRoles = pgTable("access_roles", {
  id: id(),
  code: varchar({ length: 64 }).notNull().unique(),
  label: varchar({ length: 128 }).notNull(),
  description: varchar({ length: 255 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userAccessRoles = pgTable(
  "user_access_roles",
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessRoleId: integer()
      .notNull()
      .references(() => accessRoles.id),
    granted: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_user_access_role").on(t.userId, t.accessRoleId)],
);

export const loginLogs = pgTable(
  "login_logs",
  {
    id: id(),
    userId: integer()
      .notNull()
      .references(() => users.id),
    ip: varchar({ length: 64 }),
    userAgent: varchar({ length: 512 }),
    createdAt: createdAt(),
  },
  (t) => [index("idx_login_logs_user").on(t.userId, t.createdAt)],
);

// ---------- Customers ----------

export const customers = pgTable(
  "customers",
  {
    id: id(),
    customerId: varchar({ length: 32 }).notNull().unique(),
    name: varchar({ length: 191 }).notNull(),
    company: varchar({ length: 191 }),
    phones: jsonb().$type<string[]>(),
    email: varchar({ length: 191 }),
    tin: varchar({ length: 32 }),
    address: jsonb().$type<Address>(),
    creditLimit: money(),
    outstandingBalance: money(),
    lastPaymentDate: ts(),
    standing: creditStandingEnum().notNull().default("Good"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_customer_name").on(t.name), index("idx_customer_company").on(t.company)],
);

export const customerNotes = pgTable("customer_notes", {
  id: id(),
  customerId: integer()
    .notNull()
    .references(() => customers.id),
  userId: integer().references(() => users.id),
  note: text().notNull(),
  createdAt: createdAt(),
});

export const creditHistory = pgTable("credit_history", {
  id: id(),
  customerId: integer()
    .notNull()
    .references(() => customers.id),
  change: money().notNull(),
  reason: varchar({ length: 255 }),
  createdAt: createdAt(),
});

// ---------- Suppliers ----------

export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    supplierId: varchar({ length: 32 }).notNull().unique(),
    companyName: varchar({ length: 191 }).notNull(),
    contactPerson: varchar({ length: 191 }),
    phones: jsonb().$type<string[]>(),
    email: varchar({ length: 191 }),
    address: jsonb().$type<Address>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_supplier_company").on(t.companyName)],
);

export const supplierNotes = pgTable("supplier_notes", {
  id: id(),
  supplierId: integer()
    .notNull()
    .references(() => suppliers.id),
  content: text().notNull(),
  createdById: integer().references(() => users.id),
  createdAt: createdAt(),
});

// ---------- Items ----------

export const itemCategories = pgTable("item_categories", {
  id: id(),
  name: varchar({ length: 128 }).notNull().unique(),
  createdAt: createdAt(),
});

export const measurementUnits = pgTable("measurement_units", {
  id: id(),
  unitName: varchar({ length: 64 }).notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const items = pgTable(
  "items",
  {
    id: id(),
    itemId: varchar({ length: 32 }).notNull().unique(),
    name: varchar({ length: 191 }).notNull(),
    categoryId: integer().references(() => itemCategories.id),
    measurementUnitId: integer().references(() => measurementUnits.id),
    unit: varchar({ length: 64 }),
    purchasePrice: money(),
    sellingPrice: money(),
    basePrice: money(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_item_name").on(t.name)],
);

export const customerPriceHistory = pgTable("customer_price_history", {
  id: id(),
  customerId: integer()
    .notNull()
    .references(() => customers.id),
  itemId: integer()
    .notNull()
    .references(() => items.id),
  oldPrice: money(),
  newPrice: money().notNull(),
  changedBy: integer().references(() => users.id),
  createdAt: createdAt(),
});

export const supplierPriceHistory = pgTable("supplier_price_history", {
  id: id(),
  supplierId: integer()
    .notNull()
    .references(() => suppliers.id),
  itemId: integer()
    .notNull()
    .references(() => items.id),
  oldPrice: money(),
  newPrice: money().notNull(),
  changedBy: integer().references(() => users.id),
  createdAt: createdAt(),
});

// ---------- Proformas (TAPI) ----------

export const proformas = pgTable(
  "proformas",
  {
    id: id(),
    number: varchar({ length: 32 }).notNull().unique(),
    customerId: integer()
      .notNull()
      .references(() => customers.id),
    preparedById: integer()
      .notNull()
      .references(() => users.id),
    date: ts().notNull().defaultNow(),
    validity: integer(),
    amountInWords: varchar({ length: 512 }),
    notes: text(),
    terms: text(),
    signaturePath: varchar({ length: 512 }),
    stampPath: varchar({ length: 512 }),
    bankInfoSnapshot: jsonb().$type<Record<string, unknown>>(),
    customerSnapshot: jsonb().$type<Record<string, unknown>>(),
    status: proformaStatusEnum().notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_proforma_customer").on(t.customerId), index("idx_proforma_status").on(t.status)],
);

export const proformaItems = pgTable("proforma_items", {
  id: id(),
  proformaId: integer()
    .notNull()
    .references(() => proformas.id, { onDelete: "cascade" }),
  itemId: integer().references(() => items.id),
  name: varchar({ length: 191 }).notNull(),
  description: text(),
  quantity: money().notNull(),
  unit: varchar({ length: 64 }),
  sellingPrice: money().notNull(),
  discount: money(),
  vatPercent: numeric({ precision: 5, scale: 2, mode: "number" }),
  total: money().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Job orders (TAJO) ----------

export const jobOrders = pgTable(
  "job_orders",
  {
    id: id(),
    number: varchar({ length: 32 }).notNull().unique(),
    customerId: integer()
      .notNull()
      .references(() => customers.id),
    proformaId: integer()
      .unique()
      .references(() => proformas.id),
    customerSnapshot: jsonb().$type<Record<string, unknown>>(),
    jobType: varchar({ length: 128 }),
    description: text(),
    artworkPath: varchar({ length: 512 }),
    deadline: ts(),
    priority: varchar({ length: 32 }).default("normal"),
    price: money(),
    advancePayment: money(),
    adminNotes: text(),
    status: jobStatusEnum().notNull().default("pending_approval"),
    createdById: integer().references(() => users.id),
    adminApprovedById: integer().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_job_customer").on(t.customerId), index("idx_job_status").on(t.status)],
);

export const jobItems = pgTable("job_items", {
  id: id(),
  jobId: integer()
    .notNull()
    .references(() => jobOrders.id, { onDelete: "cascade" }),
  itemId: integer().references(() => items.id),
  name: varchar({ length: 191 }).notNull(),
  description: text(),
  quantity: money().notNull(),
  unit: varchar({ length: 64 }),
  price: money().notNull(),
  total: money().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Payments ----------

export const payments = pgTable(
  "payments",
  {
    id: id(),
    jobId: integer()
      .notNull()
      .references(() => jobOrders.id),
    customerId: integer().references(() => customers.id),
    amount: money().notNull(),
    method: varchar({ length: 32 }),
    transactionNumber: varchar({ length: 64 }),
    referencePath: varchar({ length: 512 }),
    verified: boolean().notNull().default(false),
    verificationNote: text(),
    createdById: integer().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("idx_payment_job").on(t.jobId), index("idx_payment_trx").on(t.transactionNumber)],
);

// ---------- Logs, notifications, system ----------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: integer().references(() => users.id),
    entity: varchar({ length: 64 }).notNull(),
    entityId: varchar({ length: 64 }),
    action: varchar({ length: 64 }).notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_audit_entity").on(t.entity, t.entityId), index("idx_audit_created").on(t.createdAt)],
);

export const activityLogs = pgTable("activity_logs", {
  id: id(),
  message: varchar({ length: 512 }).notNull(),
  context: jsonb(),
  createdAt: createdAt(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: integer().references(() => users.id),
    type: notificationTypeEnum().notNull().default("Generic"),
    message: varchar({ length: 512 }).notNull(),
    read: boolean().notNull().default(false),
    data: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_notification_user").on(t.userId, t.read)],
);

export const backups = pgTable("backups", {
  id: id(),
  path: varchar({ length: 512 }).notNull(),
  status: varchar({ length: 32 }).notNull(),
  createdAt: createdAt(),
});

/** Sequence counters for document numbers. `period` is the 2-digit year, or 0 for never-resetting sequences. */
export const counters = pgTable(
  "counters",
  {
    scope: varchar({ length: 32 }).notNull(),
    period: integer().notNull(),
    value: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.period] })],
);
