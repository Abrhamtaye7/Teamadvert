// Tiny HTML builder for printouts. Every interpolated value is escaped unless it is itself `html`,
// so customer-entered text can never inject markup into a print window.

export class SafeHtml {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

function render(value: unknown): string {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

const absolute = (url: string) => new URL(url, window.location.origin).href;
export const assetUrl = absolute;

/**
 * Opens a print window with an A4 document and triggers printing once images have loaded.
 * Returns false if the browser blocked the popup.
 */
export function openPrint(title: string, body: SafeHtml, extraCss = ""): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const doc = html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          ${new SafeHtml(BASE_CSS + extraCss)}
        </style>
      </head>
      <body>
        ${body}
        <div class="no-print toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
      </body>
    </html>`;
  win.document.open();
  win.document.write(doc.value);
  win.document.close();
  const images = Array.from(win.document.images);
  Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => ((img.onload = r), (img.onerror = r)))))).then(() => {
    win.focus();
    win.print();
  });
  return true;
}

const BASE_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1e293b; font-size: 12px; background: #e2e8f0; }
  .page { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 18mm 16mm; background: #fff; position: relative; overflow: hidden; }
  h1, h2, h3 { margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: #475569; background: #f1f5f9; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .muted { color: #64748b; }
  .brand { color: #1a73e8; }
  .accent { color: #f7931e; }
  .toolbar { position: fixed; right: 16px; bottom: 16px; }
  .toolbar button { background: #1a73e8; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 14px; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; }
    .no-print { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media screen and (max-width: 800px) {
    .page { width: 100%; min-height: auto; margin: 0; padding: 16px; }
  }
`;
