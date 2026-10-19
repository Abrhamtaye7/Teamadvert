// Turns what people type ("TAPI-001-26", "001-26", "CID0003", "Sunrise") into one record, through the API's
// own search. Ambiguous input lists the candidates instead of guessing.
import { InputError } from "./forms";
import type { OfficeApi } from "./office";

type Named = { id: number };

function pick<T extends Named>(rows: T[], ref: string, what: string, exact: (row: T) => string[], show: (row: T) => string): T {
  const wanted = ref.trim().toLowerCase();
  const exactMatch = rows.find((row) => exact(row).some((value) => value?.toLowerCase() === wanted));
  if (exactMatch) return exactMatch;
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new InputError(`No ${what} matches "${ref}".`);
  throw new InputError(`Several ${what}s match "${ref}":\n${rows.slice(0, 8).map(show).join("\n")}\nPlease be more specific.`);
}

function required(ref: string, what: string) {
  if (!ref.trim()) throw new InputError(`Which ${what}? Give its number or name.`);
  return ref.trim();
}

export async function findProforma(api: OfficeApi, ref: string) {
  const q = required(ref, "proforma");
  const { data } = await api.get<{ data: any[] }>("/proformas", { q, pageSize: 10 });
  return pick(data, q, "proforma", (p) => [p.number], (p) => `• ${p.number} — ${p.customer?.name ?? ""}`);
}

export async function findJob(api: OfficeApi, ref: string) {
  const q = required(ref, "job");
  const { data } = await api.get<{ data: any[] }>("/jobs", { q, pageSize: 10 });
  return pick(data, q, "job", (j) => [j.number], (j) => `• ${j.number} — ${j.customer?.name ?? ""}`);
}

export async function findCustomer(api: OfficeApi, ref: string) {
  const q = required(ref, "customer");
  const { data } = await api.get<{ data: any[] }>("/customers", { q, pageSize: 10 });
  return pick(data, q, "customer", (c) => [c.customerId, c.name], (c) => `• ${c.customerId} — ${c.name}`);
}

export async function findSupplier(api: OfficeApi, ref: string) {
  const q = required(ref, "supplier");
  const rows = await api.get<any[]>("/suppliers", { q });
  return pick(rows, q, "supplier", (s) => [s.supplierId, s.companyName], (s) => `• ${s.supplierId} — ${s.companyName}`);
}

export async function findItem(api: OfficeApi, ref: string) {
  const q = required(ref, "item");
  const { data } = await api.get<{ data: any[] }>("/items", { q, pageSize: 10 });
  return pick(data, q, "item", (i) => [i.itemId, i.name], (i) => `• ${i.itemId} — ${i.name}`);
}

export async function findUser(api: OfficeApi, ref: string) {
  const q = required(ref, "user");
  const rows = await api.get<any[]>("/users");
  const user = rows.find((u) => u.username.toLowerCase() === q.toLowerCase());
  if (!user) throw new InputError(`No office user "${q}". Send /users to see them.`);
  return user;
}

export async function findRole(api: OfficeApi, name: string) {
  const roles = await api.get<{ id: number; name: string }[]>("/users/roles");
  const role = roles.find((r) => r.name.toLowerCase() === name.trim().toLowerCase());
  if (!role) throw new InputError(`Unknown role "${name}". Roles: ${roles.map((r) => r.name).join(", ")}`);
  return role;
}
