import { describe, expect, it } from "vitest";
import { checkReceiptText } from "./cbe";
import { amountToWords, proformaLineTotals, round2, sum } from "./money";
import { dateRange, pagination } from "./query";

describe("money", () => {
  it("writes amounts in words, with santim for the cents", () => {
    expect(amountToWords(0)).toBe("zero birr");
    expect(amountToWords(15)).toBe("fifteen birr");
    expect(amountToWords(5750)).toBe("five thousand seven hundred fifty birr");
    expect(amountToWords(1250.5)).toBe("one thousand two hundred fifty birr and fifty santim");
    expect(amountToWords(2_000_021)).toBe("two million twenty-one birr");
    expect(amountToWords(0.07)).toBe("zero birr and seven santim");
  });

  it("doesn't drift on float maths", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(sum([0.1, 0.2, 0.3])).toBe(0.6);
    expect(amountToWords(1.005 * 100)).toBe("one hundred birr and fifty santim");
  });

  it("computes proforma lines with 15% VAT by default and 0% as VAT-exempt", () => {
    expect(proformaLineTotals({ quantity: 10, sellingPrice: 100 })).toMatchObject({ base: 1000, vat: 150, total: 1150, vatPercent: 15 });
    expect(proformaLineTotals({ quantity: 10, sellingPrice: 100, discount: 100 })).toMatchObject({ vat: 135, total: 1035 });
    expect(proformaLineTotals({ quantity: 2, sellingPrice: 50, vatPercent: 0 })).toMatchObject({ vat: 0, total: 100, vatPercent: 0 });
  });
});

describe("CBE receipt check", () => {
  const receipt = `Commercial Bank of Ethiopia
Payer : ABEBE KEBEDE
Receiver : TEAM ADVERT PLC
Account : 1****5219
Reference No. : FT26289ABCD
Transferred Amount : 12,500.00 ETB`;

  it("accepts a matching receipt", () => {
    const result = checkReceiptText(receipt, "FT26289ABCD", 12500);
    expect(result.success).toBe(true);
    expect(result.parsed).toMatchObject({ receiver: "TEAM ADVERT PLC", amount: 12500 });
  });

  it("reports each mismatch", () => {
    expect(checkReceiptText(receipt, "FT26289ABCD", 12000).issues).toEqual(["Amount mismatch"]);
    expect(checkReceiptText(receipt, "FT000", 12500).issues).toEqual(["Reference mismatch"]);
    const other = receipt.replace("TEAM ADVERT PLC", "SOMEONE ELSE").replace("5219", "1111");
    expect(checkReceiptText(other, "FT26289ABCD", 12500).issues).toEqual(["Receiver mismatch", "Account mismatch"]);
  });
});

describe("query helpers", () => {
  it("treats a plain end date as the whole day in Addis Ababa", () => {
    const { from, toExclusive } = dateRange("2026-10-01", "2026-10-16");
    expect(from?.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(toExclusive?.toISOString()).toBe("2026-10-16T21:00:00.000Z");
    expect(dateRange("not a date").from).toBeUndefined();
  });

  it("clamps pagination", () => {
    expect(pagination("3", "10")).toEqual({ page: 3, pageSize: 10, offset: 20 });
    expect(pagination("0", "100000")).toEqual({ page: 1, pageSize: 200, offset: 0 });
    expect(pagination(undefined, "junk")).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });
});
