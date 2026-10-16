// Every API call as a React Query hook. Mutations refresh the lists they affect.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, type Query } from "./api";
import type {
  AccessRole,
  AppNotification,
  Backup,
  Category,
  CbeResult,
  Customer,
  CustomerDetail,
  Item,
  ItemProfile,
  Job,
  ManagedUser,
  Paged,
  Payment,
  Proforma,
  ProformaPrint,
  ReportOverview,
  RoleRow,
  Supplier,
  SupplierDetail,
  Unit,
} from "./types";

const refresh = (qc: QueryClient, ...keys: string[]) => Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key] })));

function useInvalidating<TInput, TResult>(fn: (input: TInput) => Promise<TResult>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => refresh(qc, ...keys) });
}

// ---------- Customers ----------

export type CustomerPayload = {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  tin?: string;
  addressRegion?: string;
  addressCity?: string;
  addressSubcity?: string;
  addressWoreda?: string;
  addressHouse?: string;
  creditLimit?: number;
  standing?: "Good" | "Warning" | "Suspended";
};

export const useCustomers = (params: Query) =>
  useQuery({ queryKey: ["customers", params], queryFn: () => api.get<Paged<Customer>>("/customers", params), placeholderData: keepPreviousData });
export const useCustomer = (id: number) => useQuery({ queryKey: ["customer", id], queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });
export const useCreateCustomer = () => useInvalidating((input: CustomerPayload) => api.post<Customer>("/customers", input), ["customers"]);
export const useUpdateCustomer = (id: number) =>
  useInvalidating((input: Partial<CustomerPayload>) => api.put<Customer>(`/customers/${id}`, input), ["customers", "customer"]);
export const useAddCustomerNote = (id: number) => useInvalidating((note: string) => api.post(`/customers/${id}/notes`, { note }), ["customer"]);
export const fetchCustomerProfile = (id: number) => api.get<CustomerDetail>(`/customers/${id}/profile`);

// ---------- Suppliers ----------

export type SupplierPayload = { companyName: string; contactPerson?: string; phone?: string; email?: string; address?: string };

export const useSuppliers = (q: string) => useQuery({ queryKey: ["suppliers", q], queryFn: () => api.get<Supplier[]>("/suppliers", { q }), placeholderData: keepPreviousData });
export const useSupplier = (id: number) => useQuery({ queryKey: ["supplier", id], queryFn: () => api.get<SupplierDetail>(`/suppliers/${id}`) });
export const useCreateSupplier = () => useInvalidating((input: SupplierPayload) => api.post<Supplier>("/suppliers", input), ["suppliers"]);
export const useUpdateSupplier = (id: number) =>
  useInvalidating((input: Partial<SupplierPayload>) => api.put<Supplier>(`/suppliers/${id}`, input), ["suppliers", "supplier"]);
export const useAddSupplierPrices = (id: number) =>
  useInvalidating(
    (items: { itemId?: number; name: string; price: number }[]) => api.post<SupplierDetail>(`/suppliers/${id}/items`, { items }),
    ["supplier", "suppliers", "items", "item"],
  );
export const useAddSupplierNote = (id: number) => useInvalidating((content: string) => api.post(`/suppliers/${id}/notes`, { content }), ["supplier"]);

// ---------- Items ----------

export type ItemPayload = {
  name: string;
  categoryId?: number;
  measurementUnitId?: number;
  unit?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  basePrice?: number;
  notes?: string;
};

export const useItems = (params: Query) =>
  useQuery({ queryKey: ["items", params], queryFn: () => api.get<Paged<Item>>("/items", params), placeholderData: keepPreviousData });
/** All items (for pickers); the catalogue is small. */
export const useItemCatalog = () => useQuery({ queryKey: ["items", "catalog"], queryFn: () => api.get<Paged<Item>>("/items", { pageSize: 200 }), staleTime: 60_000 });
export const useItem = (id: number) => useQuery({ queryKey: ["item", id], queryFn: () => api.get<ItemProfile>(`/items/${id}/profile`) });
export const useCreateItem = () => useInvalidating((input: ItemPayload) => api.post<Item>("/items", input), ["items"]);
export const useUpdateItem = (id: number) => useInvalidating((input: Partial<ItemPayload>) => api.put<Item>(`/items/${id}`, input), ["items", "item"]);
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/items/categories"), staleTime: 5 * 60_000 });
export const useUnits = () => useQuery({ queryKey: ["units"], queryFn: () => api.get<Unit[]>("/items/units"), staleTime: 5 * 60_000 });
export const useCreateCategory = () => useInvalidating((name: string) => api.post<Category>("/items/categories", { name }), ["categories"]);
export const useCreateUnit = () => useInvalidating((unitName: string) => api.post<Unit>("/items/units", { unitName }), ["units"]);

// ---------- Proformas ----------

export type NewCustomerInput = { name: string; company?: string; phones?: string[]; email?: string; tin?: string };
export type ProformaLineInput = {
  itemId?: number;
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  sellingPrice: number;
  discount?: number;
  vatPercent?: number;
};
export type ProformaPayload = {
  customerId?: number;
  customerNew?: NewCustomerInput;
  validity?: number;
  notes?: string;
  terms?: string;
  items: ProformaLineInput[];
};

export const useProformas = (params: Query) =>
  useQuery({ queryKey: ["proformas", params], queryFn: () => api.get<Paged<Proforma>>("/proformas", params), placeholderData: keepPreviousData });
export const useProforma = (id: number) => useQuery({ queryKey: ["proforma", id], queryFn: () => api.get<Proforma>(`/proformas/${id}`) });
export const fetchProformaPrint = (id: number) => api.get<ProformaPrint>(`/proformas/${id}/print`);
export const useCreateProforma = () => useInvalidating((input: ProformaPayload) => api.post<Proforma>("/proformas", input), ["proformas", "customers"]);
export const useUpdateProforma = (id: number) =>
  useInvalidating((input: Partial<ProformaPayload>) => api.put<Proforma>(`/proformas/${id}`, input), ["proformas", "proforma"]);
export const useApproveProforma = () =>
  useInvalidating((id: number) => api.post<Proforma>(`/proformas/${id}/approve`), ["proformas", "proforma", "notifications"]);
export const useConvertProforma = () => useInvalidating((id: number) => api.post<Job>(`/proformas/${id}/convert`), ["proformas", "proforma", "jobs"]);

// ---------- Jobs ----------

export type JobLineInput = { itemId?: number; name: string; description?: string; quantity: number; unit?: string; price: number };
export type JobPayload = {
  customerId?: number;
  customerNew?: NewCustomerInput;
  proformaNumber?: string;
  jobType?: string;
  description?: string;
  deadline?: string;
  priority?: "high" | "normal" | "low";
  advancePayment?: number;
  artworkPath?: string;
  jobItems: JobLineInput[];
};
export type JobApprovePayload = { price?: number; deadline?: string; priority?: "high" | "normal" | "low"; advancePayment?: number; adminNotes?: string };

const JOB_KEYS = ["jobs", "job", "reports", "notifications", "payments"];

export const useJobs = (params: Query) =>
  useQuery({ queryKey: ["jobs", params], queryFn: () => api.get<Paged<Job>>("/jobs", params), placeholderData: keepPreviousData });
export const useJob = (id: number) => useQuery({ queryKey: ["job", id], queryFn: () => api.get<Job>(`/jobs/${id}`) });
export const fetchJobPrint = (id: number) => api.get<{ job: Job; total: number }>(`/jobs/${id}/print`);
export const fetchJobs = (params: Query) => api.get<Paged<Job>>("/jobs", params);
export const useCreateJob = () => useInvalidating((input: JobPayload) => api.post<Job>("/jobs", input), ["jobs", "customers", "proformas"]);
export const useApproveJob = (id: number) => useInvalidating((input: JobApprovePayload) => api.post<Job>(`/jobs/${id}/approve`, input), JOB_KEYS);
export const useJobProduction = (id: number) =>
  useInvalidating((status: "in_progress" | "completed") => api.post<Job>(`/jobs/${id}/production`, { status }), JOB_KEYS);
export const useJobFinance = () =>
  useInvalidating(({ id, status }: { id: number; status: "finance_review" | "closed" | "approved" }) => api.post<Job>(`/jobs/${id}/finance`, { status }), JOB_KEYS);

// ---------- Payments ----------

export type PaymentPayload = { jobId: number; amount: number; method: "Cash" | "Bank"; transactionNumber?: string };

export const usePayments = () => useQuery({ queryKey: ["payments"], queryFn: () => api.get<Payment[]>("/payments") });
export const useRecordPayment = () => useInvalidating((input: PaymentPayload) => api.post<Payment>("/payments", input), JOB_KEYS);
export const useVerifyPayment = () =>
  useInvalidating(
    ({ id, transactionNumber, expectedAmount }: { id: number; transactionNumber: string; expectedAmount: number }) =>
      api.post<CbeResult>(`/payments/${id}/verify`, { transactionNumber, expectedAmount }),
    ["payments", "job", "notifications"],
  );

// ---------- Reports & notifications ----------

export const useReportOverview = (months = 6) =>
  useQuery({ queryKey: ["reports", "overview", months], queryFn: () => api.get<ReportOverview>("/reports/overview", { months }) });

export const useMarkNotificationRead = () => useInvalidating((id: number) => api.post<AppNotification>(`/notifications/${id}/read`), ["notifications"]);

// ---------- Users & backups (Admin) ----------

export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: () => api.get<ManagedUser[]>("/users") });
export const useRoles = () => useQuery({ queryKey: ["roles"], queryFn: () => api.get<RoleRow[]>("/users/roles"), staleTime: 5 * 60_000 });
export const useAccessRoles = () => useQuery({ queryKey: ["access-roles"], queryFn: () => api.get<AccessRole[]>("/users/access-roles"), staleTime: 5 * 60_000 });
export const useCreateUser = () =>
  useInvalidating((input: { username: string; pin: string; roleId: number; accessRoleIds?: number[] }) => api.post<ManagedUser>("/users", input), ["users"]);
export const useSetUserRole = () => useInvalidating(({ id, roleId }: { id: number; roleId: number }) => api.patch<ManagedUser>(`/users/${id}/role`, { roleId }), ["users"]);
export const useSetUserAccess = () =>
  useInvalidating(({ id, accessRoleIds }: { id: number; accessRoleIds: number[] }) => api.put<ManagedUser>(`/users/${id}/access`, { accessRoleIds }), ["users"]);
export const useResetUserPin = () => useInvalidating(({ id, pin }: { id: number; pin: string }) => api.post(`/users/${id}/reset-pin`, { pin }), ["users"]);
export const useSetUserStatus = () =>
  useInvalidating(({ id, isActive }: { id: number; isActive: boolean }) => api.patch<ManagedUser>(`/users/${id}/status`, { isActive }), ["users"]);

export const useBackups = (enabled: boolean) => useQuery({ queryKey: ["backups"], queryFn: () => api.get<Backup[]>("/backups"), enabled });
export const useRunBackup = () => useInvalidating(() => api.post<{ message: string; backup: Backup }>("/backups/run"), ["backups"]);
