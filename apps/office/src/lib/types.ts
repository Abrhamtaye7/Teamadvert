// Shapes returned by the API (dates arrive as ISO strings).


type PublicUser = { id: number; username: string };

export type SessionUser = {
  id: number;
  username: string;
  role: string;
  permissions?: Record<string, boolean> | null;
  access?: string[];
  lastLoginAt?: string | null;
};

export type Paged<T> = { data: T[]; total: number; page: number; pageSize: number };

type Address = { region?: string; city?: string; subcity?: string; woreda?: string; house?: string };

type CreditStanding = "Good" | "Warning" | "Suspended";

export type Customer = {
  id: number;
  customerId: string;
  name: string;
  company: string | null;
  phones: string[] | null;
  email: string | null;
  tin: string | null;
  address: Address | null;
  creditLimit: number | null;
  outstandingBalance: number | null;
  standing: CreditStanding;
  createdAt: string;
  updatedAt: string;
  _count?: { proformas: number; jobs: number };
};

type Note = { id: number; note?: string; content?: string; createdAt: string; user: PublicUser | null };

type ProformaStatus = "draft" | "approved" | "converted" | "expired";

type ProformaLine = {
  id: number;
  itemId: number | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  sellingPrice: number;
  discount: number | null;
  vatPercent: number | null;
  total: number;
};

export type Proforma = {
  id: number;
  number: string;
  customerId: number;
  date: string;
  validity: number | null;
  amountInWords: string | null;
  notes: string | null;
  terms: string | null;
  customerSnapshot: Record<string, unknown> | null;
  status: ProformaStatus;
  createdAt: string;
  approvedAt: string | null;
  /** Secret for the QR code printed on approved proformas */
  verifyToken: string;
  customer?: Customer | null;
  items?: ProformaLine[];
  preparedBy?: PublicUser | null;
  approvedBy?: PublicUser | null;
};

export type ProformaPrint = {
  proforma: Proforma & { items: ProformaLine[] };
  /** subtotal = sum of line amounts (qty × price − discount); vatPercent is null when lines mix rates */
  totals: { subtotal: number; discount: number; vat: number; vatPercent: number | null; total: number; amountInWords: string | null };
};

export type JobStatus = "pending_approval" | "approved" | "in_progress" | "completed" | "finance_review" | "closed";

type JobLine = {
  id: number;
  itemId: number | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  price: number;
  total: number;
};

export type Payment = {
  id: number;
  jobId: number;
  customerId: number | null;
  amount: number;
  method: string | null;
  transactionNumber: string | null;
  verified: boolean;
  verificationNote: string | null;
  createdAt: string;
  jobOrder?: Job | null;
};

export type Job = {
  id: number;
  number: string;
  customerId: number;
  proformaId: number | null;
  jobType: string | null;
  description: string | null;
  artworkPath: string | null;
  deadline: string | null;
  priority: string | null;
  price: number | null;
  advancePayment: number | null;
  adminNotes: string | null;
  status: JobStatus;
  createdAt: string;
  customerSnapshot: Record<string, unknown> | null;
  jobItems?: JobLine[];
  payments?: Payment[];
  customer?: Customer | null;
  proforma?: Proforma | null;
  createdBy?: PublicUser | null;
  adminApprovedBy?: PublicUser | null;
};

export type CustomerDetail = Customer & {
  notes: Note[];
  proformas: (Proforma & { items: ProformaLine[] })[];
  jobs: (Job & { jobItems: JobLine[] })[];
  payments: Payment[];
  creditHistory: { id: number; change: number; reason: string | null; createdAt: string }[];
  priceHistory: { id: number; oldPrice: number | null; newPrice: number; createdAt: string; item: Item; user: PublicUser | null }[];
};

export type Category = { id: number; name: string };
export type Unit = { id: number; unitName: string };

export type Item = {
  id: number;
  itemId: string;
  name: string;
  categoryId: number | null;
  measurementUnitId: number | null;
  unit: string | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  basePrice: number | null;
  notes: string | null;
  createdAt: string;
  category?: Category | null;
  measurementUnit?: Unit | null;
};

type PriceChange = { id: number; oldPrice: number | null; newPrice: number; createdAt: string; user: PublicUser | null };

export type ItemProfile = Item & {
  customerPriceHistory: (PriceChange & { customer: Customer })[];
  supplierPriceHistory: (PriceChange & { supplier: Supplier })[];
  proformaItems: (ProformaLine & { proforma: Proforma })[];
  jobItems: (JobLine & { jobOrder: Job })[];
};

export type Supplier = {
  id: number;
  supplierId: string;
  companyName: string;
  contactPerson: string | null;
  phones: string[] | null;
  email: string | null;
  address: Address | string | null;
  createdAt: string;
};

export type SupplierDetail = Supplier & {
  priceHistory: (PriceChange & { itemId: number; item: Item })[];
  notes: Note[];
  items: { itemId: number; name: string; price: number; description?: string; updatedAt: string }[];
};

export type AppNotification = {
  id: number;
  userId: number | null;
  type: string;
  message: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
};

export type ReportOverview = {
  summary: {
    jobsThisMonth: number;
    collectedThisMonth: number;
    outstandingThisMonth: number;
    outstandingTotal: number;
    pendingJobs: number;
    financeApprovedTotal: number;
  };
  chart: { month: string; jobs: number; collected: number; outstanding: number }[];
};

export type ManagedUser = {
  id: number;
  username: string;
  roleId: number;
  isActive: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  role: { id: number; name: string };
  accessGrants: { id: number; accessRoleId: number; accessRole: AccessRole }[];
};

export type RoleRow = { id: number; name: string; permissions: Record<string, boolean> };
export type AccessRole = { id: number; code: string; label: string; description: string | null };

export type Backup = { id: number; path: string; status: string; createdAt: string };

export type CbeResult = {
  success: boolean;
  issues?: string[];
  parsed?: { receiver?: string; account?: string; reference?: string; amount?: number };
};
