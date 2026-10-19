// Pieces shared by the proforma and job forms.
import { type Form, InputError, opt, optionalAmount, parseQuantity } from "../forms";
import { findCustomer, findItem } from "../lookup";
import type { OfficeApi } from "../office";

/** "customer: CID0001" (existing) or "new customer: Name" (+ company/phone/email/tin lines). */
export async function customerFromForm(api: OfficeApi, form: Form) {
  const existing = opt(form.fields.get("customer"));
  if (existing) return { customerId: (await findCustomer(api, existing)).id as number };
  const name = opt(form.fields.get("newcustomer"));
  if (!name) throw new InputError('Add a "customer: CID0001" line (existing customer) or "new customer: Name".');
  const phone = opt(form.fields.get("phone"));
  return {
    customerNew: {
      name,
      company: opt(form.fields.get("company")),
      phones: phone ? phone.split(/[,/]/).map((p) => p.trim()).filter(Boolean) : undefined,
      email: opt(form.fields.get("email")),
      tin: opt(form.fields.get("tin")),
    },
  };
}

type Line = { itemId?: number; name: string; quantity: number; unit?: string; price: number; discount?: number };

/**
 * Table rows "name | quantity | price | discount". A catalogue code (ITEM0004) as the name links the item and
 * uses its selling price when the price is left out.
 */
export async function linesFromRows(api: OfficeApi, rows: string[][]): Promise<Line[]> {
  if (!rows.length) throw new InputError("Add at least one item line: name | quantity | price");
  const lines: Line[] = [];
  for (const [index, [nameOrCode = "", qty, price, discount]] of rows.entries()) {
    const where = `Line ${index + 1}`;
    const { quantity, unit } = parseQuantity(qty);
    if (/^ITEM\d+$/i.test(nameOrCode)) {
      const item = await findItem(api, nameOrCode);
      const unitPrice = optionalAmount(price, `${where} price`) ?? item.sellingPrice ?? item.basePrice;
      if (unitPrice === null || unitPrice === undefined) throw new InputError(`${where}: ${item.itemId} has no price yet; add one after the quantity.`);
      lines.push({
        itemId: item.id,
        name: item.name,
        quantity,
        unit: unit ?? item.unit ?? item.measurementUnit?.unitName ?? undefined,
        price: unitPrice,
        discount: optionalAmount(discount, `${where} discount`),
      });
    } else {
      if (!nameOrCode) throw new InputError(`${where}: the item name is missing.`);
      const unitPrice = optionalAmount(price, `${where} price`);
      if (unitPrice === undefined) throw new InputError(`${where}: add the unit price after the quantity.`);
      lines.push({ name: nameOrCode, quantity, unit, price: unitPrice, discount: optionalAmount(discount, `${where} discount`) });
    }
  }
  return lines;
}
