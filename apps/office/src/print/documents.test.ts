import { describe, expect, it } from "vitest";
import type { ProformaPrint } from "../lib/types";
import { proformaDocument, verifyUrl } from "./documents";

// The example from the approved template: 4 roll-up banners at 1,250 + 15% VAT
const draft: ProformaPrint = {
  proforma: {
    id: 1,
    number: "TAPI-001-26",
    customerId: 1,
    date: "2026-10-16T06:00:00.000Z",
    validity: 15,
    amountInWords: "five thousand seven hundred fifty birr",
    notes: null,
    terms: null,
    customerSnapshot: { name: "Smoke Test Customer", phones: ["0911111111"], customerId: "CID0001" },
    status: "draft",
    createdAt: "2026-10-16T06:00:00.000Z",
    approvedAt: null,
    verifyToken: "q1W2e3R4t5Y6u7I8o9P0aS",
    preparedBy: { id: 2, username: "sara" },
    approvedBy: null,
    items: [{ id: 1, itemId: null, name: "Roll-up banner 85x200", description: null, quantity: 4, unit: "pcs", sellingPrice: 1250, discount: 0, vatPercent: 15, total: 5750 }],
  },
  totals: { subtotal: 5000, discount: 0, vat: 750, vatPercent: 15, total: 5750, amountInWords: "five thousand seven hundred fifty birr" },
};
const approved: ProformaPrint = {
  ...draft,
  proforma: { ...draft.proforma, status: "approved", approvedAt: "2026-10-16T07:00:00.000Z", approvedBy: { id: 1, username: "admin" } },
};

const count = (text: string, part: string) => text.split(part).length - 1;

describe("proforma printout", () => {
  it("follows the template: amounts before VAT, one VAT line, amount in words", () => {
    const out = proformaDocument(approved).value;
    expect(out).toContain("<strong>Pro. No.</strong> TAPI-001-26");
    expect(out).toContain("Customer ID #CID0001");
    expect(out).toContain("Tel: 0911111111");
    // Line amount is 4 × 1,250 = 5,000.00; 5,750.00 only appears as the grand total
    expect(count(out, ">5,000.00<")).toBe(2); // the line and the subtotal
    expect(count(out, ">5,750.00<")).toBe(1);
    expect(out).toContain("<td>VAT 15%</td>");
    expect(out).not.toContain(">VAT</th>");
    expect(out).toContain("five thousand seven hundred fifty birr only");
    expect(out).toContain("Valid until:</strong> 31 Oct 2026 (15 days)");
    expect(out).toContain("50% advance on the job starting date");
    expect(out).toContain("1000357045219");
  });

  it("stamps approved proformas and adds the approver and a verify QR code", () => {
    const out = proformaDocument(approved).value;
    expect(out).toContain('class="stamp"');
    expect(out).toContain("Approved by: <span class=\"signed\">admin</span>");
    expect(out).toContain("Prepared by: <span class=\"signed\">sara</span>");
    expect(out).toContain("<svg");
    expect(out).toContain("Scan to verify");
    expect(out).not.toContain("DRAFT");
  });

  it("prints drafts as not valid: no stamp, approver or QR code", () => {
    const out = proformaDocument(draft).value;
    expect(out).toContain("DRAFT · NOT VALID");
    expect(out).toContain("awaiting approval");
    expect(out).not.toContain('class="stamp"');
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("Scan to verify");
  });

  it("labels mixed VAT rates plainly", () => {
    const out = proformaDocument({ ...approved, totals: { ...approved.totals, vatPercent: null } }).value;
    expect(out).toContain("<td>VAT</td>");
  });

  it("escapes customer-entered text", () => {
    const evil = { ...draft, proforma: { ...draft.proforma, customerSnapshot: { name: '<img src=x onerror="alert(1)">' } } };
    const out = proformaDocument(evil).value;
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("points the QR code at the public verify page", () => {
    expect(verifyUrl("ab_-9")).toBe(`${window.location.origin}/verify/?id=ab_-9`);
  });
});
