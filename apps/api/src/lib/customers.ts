import { eq } from "drizzle-orm";
import { customers, nextCustomerCode, type Address, type Executor } from "@teamadvert/db";
import { notFound } from "./errors";

type CustomerRow = typeof customers.$inferSelect;

export function toPhoneArray(value?: string | string[] | null): string[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const phones = raw.map((p) => p.trim()).filter(Boolean);
  return phones.length ? phones : undefined;
}

/** Builds the address JSON from the legacy flat form fields, dropping blanks. */
export function buildAddress(input: {
  addressRegion?: string;
  addressCity?: string;
  addressSubcity?: string;
  addressWoreda?: string;
  addressHouse?: string;
}): Address | undefined {
  const entries = Object.entries({
    region: input.addressRegion,
    city: input.addressCity,
    subcity: input.addressSubcity,
    woreda: input.addressWoreda,
    house: input.addressHouse,
  }).filter(([, v]) => typeof v === "string" && v.trim().length > 0);
  return entries.length ? (Object.fromEntries(entries) as Address) : undefined;
}

/** Frozen copy of the customer's details at the time a proforma or job was issued. */
export function customerSnapshot(c: CustomerRow) {
  return {
    name: c.name,
    company: c.company,
    phones: c.phones,
    email: c.email,
    tin: c.tin,
    address: c.address,
    customerId: c.customerId,
  };
}

export type NewCustomerInput = {
  name: string;
  company?: string;
  phones?: string[];
  email?: string;
  tin?: string;
  address?: Partial<Address>;
};

/** Resolves an existing customer by id, or registers the inline "new customer" from a proforma/job form. */
export async function resolveCustomer(db: Executor, customerId?: number, customerNew?: NewCustomerInput): Promise<CustomerRow | null> {
  if (customerId) {
    const [existing] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!existing) throw notFound("Customer");
    return existing;
  }
  if (!customerNew) return null;
  const [created] = await db
    .insert(customers)
    .values({
      customerId: await nextCustomerCode(db),
      name: customerNew.name,
      company: customerNew.company,
      phones: customerNew.phones,
      email: customerNew.email,
      tin: customerNew.tin,
      address: customerNew.address,
    })
    .returning();
  return created;
}
