import { describe, expect, it } from "vitest";
import { createCbeVerifier, DEFAULT_CBE_CONFIG } from "./cbe";

/** A minimal one-page PDF with the given text lines (Helvetica, like a bank receipt). */
function makePdf(lines: string[]) {
  const content = `BT /F1 12 Tf 50 750 Td 14 TL ${lines.map((l) => `(${l}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

const receipt = makePdf([
  "Receiver : TEAM ADVERT PLC",
  "Account : 1****5219",
  "Reference No. : FT26289ABCD",
  "Transferred Amount : 12,500.00 ETB",
]);

describe("createCbeVerifier", () => {
  it("downloads the receipt PDF from the PRD URL and reads its text", async () => {
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      return new Response(receipt);
    }) as unknown as typeof fetch;

    const result = await createCbeVerifier(DEFAULT_CBE_CONFIG, fakeFetch)("FT26289ABCD", 12500);
    expect(result).toMatchObject({ success: true, parsed: { reference: "FT26289ABCD", amount: 12500 } });
    expect(urls).toEqual(["https://apps.cbe.com.et:100/?id=FT26289ABCD57045219"]);
  });

  it("fails cleanly when the bank is unreachable or returns an error", async () => {
    const down = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await createCbeVerifier(DEFAULT_CBE_CONFIG, down)("FT1", 1)).toEqual({
      success: false,
      issues: ["Unable to download or read the CBE receipt"],
    });
    const notFound = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    expect((await createCbeVerifier(DEFAULT_CBE_CONFIG, notFound)("FT1", 1)).issues).toEqual(["CBE returned HTTP 404"]);
  });
});
