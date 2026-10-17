import { renderSVG } from "uqr";
import logoUrl from "../assets/teamlogo.png";
import stampUrl from "../assets/stamp.png";
import { COMPANY } from "../lib/company";
import { amount, date, dateTime, humanize, money } from "../lib/format";
import { round2 } from "../lib/totals";
import type { CustomerDetail, Job, ProformaPrint } from "../lib/types";
import { assetUrl, html, openPrint, SafeHtml } from "./html";

type Snapshot = { name?: string; company?: string | null; phones?: string[] | null; tin?: string | null; customerId?: string; address?: Record<string, string> | null };

const addressLine = (a?: Record<string, string> | null) =>
  a ? [a.house && `H.No ${a.house}`, a.woreda && `Woreda ${a.woreda}`, a.subcity, a.city, a.region].filter(Boolean).join(", ") : "";

/**
 * Public page the QR code opens. Live, the office runs at teamadvertplc.com/office, so this is the website;
 * on the local preview it is the preview server, so test scans reach the local copy.
 */
export const verifyUrl = (token: string) => `${window.location.origin}/verify/?id=${encodeURIComponent(token)}`;

/** Shared by every printout */
const DOC_CSS = `
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid #1a73e8; padding-bottom: 12px; }
  .doc-brand { display: flex; gap: 14px; align-items: center; }
  .doc-logo { width: 78px; height: 78px; }
  .doc-name { font-size: 22px; letter-spacing: .02em; }
  .doc-brand .muted { font-size: 11.5px; line-height: 1.45; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 24px; letter-spacing: .06em; margin-bottom: 10px; }
  .bill-to { display: grid; grid-template-columns: auto 1fr; column-gap: 10px; row-gap: 3px; margin: 12px 0; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12.5px; }
  .bill-to .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding-top: 2px; }
  .bill-to .lines { display: grid; row-gap: 3px; }
  .sign-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .people { display: grid; row-gap: 10px; color: #475569; font-size: 12.5px; }
  .signed { color: #1e293b; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
  /* stamp.png has transparent margins: 46mm wide prints a stamp circle about 33mm across */
  .stamp { display: block; width: 46mm; height: auto; }
  .stamp-sm { width: 34mm; }
  tr { break-inside: avoid; }
`;

/** Only the proforma */
const PROFORMA_CSS = `
  .page { display: flex; flex-direction: column; }
  .page > * { position: relative; z-index: 1; }
  .page > .watermark, .page > .draft-mark { position: absolute; z-index: 0; top: 50%; left: 50%; pointer-events: none; }
  .watermark { width: 150mm; transform: translate(-50%, -50%); opacity: .07; }
  .draft-mark { transform: translate(-50%, -50%) rotate(-30deg); font-size: 110px; font-weight: 800; letter-spacing: .12em; color: #dc2626; opacity: .12; white-space: nowrap; }
  .draft-flag { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; letter-spacing: .06em; }
  .totals { display: flex; justify-content: flex-end; margin-top: 4px; }
  .totals table { width: 300px; }
  .totals td { padding: 6px 8px; }
  .totals .grand td { font-weight: 700; font-size: 15px; border-bottom: 0; }
  .words { margin: 10px 0 0; }
  .words span { display: inline-block; margin-left: 6px; padding: 3px 10px; border-radius: 6px; background: #e2e8f0; }
  /* Grows into the free space (the stamp sits mid-page, as on the template) and shrinks to the stamp's own
     height when there are many lines, so 6+ lines with descriptions still fit on one A4 page */
  .stamp-zone { flex: 1 0 auto; display: flex; justify-content: center; align-items: center; min-height: 43mm; }
  .doc-foot { break-inside: avoid; }
  .doc-foot p { margin: 0 0 6px; line-height: 1.4; }
  /* QR code bottom-right, beside the bank details and names, not on a row of its own */
  .foot-grid { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .foot-grid .people { margin-top: 12px; }
  .qr { flex-shrink: 0; text-align: center; font-size: 10.5px; color: #475569; }
  .qr-frame { width: 27mm; padding: 2.2mm; margin-bottom: 3px;
    background:
      linear-gradient(#1a73e8, #1a73e8) left top / 4mm .5mm no-repeat, linear-gradient(#1a73e8, #1a73e8) left top / .5mm 4mm no-repeat,
      linear-gradient(#1a73e8, #1a73e8) right top / 4mm .5mm no-repeat, linear-gradient(#1a73e8, #1a73e8) right top / .5mm 4mm no-repeat,
      linear-gradient(#1a73e8, #1a73e8) left bottom / 4mm .5mm no-repeat, linear-gradient(#1a73e8, #1a73e8) left bottom / .5mm 4mm no-repeat,
      linear-gradient(#1a73e8, #1a73e8) right bottom / 4mm .5mm no-repeat, linear-gradient(#1a73e8, #1a73e8) right bottom / .5mm 4mm no-repeat; }
  .qr-frame svg { display: block; width: 100%; height: auto; shape-rendering: crispEdges; }
  .disclaimer { margin: 12px 0 0; text-align: center; font-size: 10.5px; color: #64748b; }
  /* Chrome repeats fixed elements on every printed page */
  @media print { .page > .watermark, .page > .draft-mark { position: fixed; } }
`;

function header(title: string, numberLabel: string, number: string, when: string, extra: SafeHtml | "" = "") {
  return html`
    <header class="doc-head">
      <div class="doc-brand">
        <img src="${assetUrl(logoUrl)}" alt="" class="doc-logo" />
        <div>
          <h2 class="brand doc-name">${COMPANY.name}</h2>
          <div class="muted">${COMPANY.address}</div>
          <div class="muted">Tel: ${COMPANY.phones.join(" / ")}</div>
          <div class="muted">${COMPANY.email} · www.${COMPANY.website}</div>
        </div>
      </div>
      <div class="doc-title">
        <h1 class="accent">${title}</h1>
        <div><strong>${numberLabel}</strong> ${number}</div>
        <div><strong>Date</strong> ${when}</div>
        ${extra}
      </div>
    </header>`;
}

function customerBlock(s: Snapshot | null | undefined, fallbackName?: string) {
  const address = addressLine(s?.address);
  return html`
    <section class="bill-to">
      <span class="label">Bill to</span>
      <div class="lines">
        <strong>${s?.name ?? fallbackName ?? "—"}</strong>
        ${s?.company ? html`<div>${s.company}</div>` : ""}
        ${s?.phones?.length ? html`<div>Tel: ${s.phones.join(", ")}</div>` : ""}
        ${s?.customerId ? html`<div>Customer ID #${s.customerId}</div>` : ""}
        ${s?.tin ? html`<div>TIN: ${s.tin}</div>` : ""}
        ${address ? html`<div>${address}</div>` : ""}
      </div>
    </section>`;
}

/** The QR code as inline SVG. Its only input is our own URL, so the markup is safe to embed as-is. */
const qrCode = (url: string) => new SafeHtml(renderSVG(url, { ecc: "M", border: 0 }));

/**
 * A4 proforma, laid out like the approved template (TAPI-001-26 — Proforma.pdf). The stamp, the approver and
 * the QR code only appear once an admin has approved it; drafts carry a large "DRAFT" mark instead.
 */
export function proformaDocument({ proforma, totals }: ProformaPrint) {
  const snap = proforma.customerSnapshot as Snapshot | null;
  const approved = proforma.status !== "draft";
  const validUntil = proforma.validity ? new Date(new Date(proforma.date).getTime() + proforma.validity * 86_400_000) : null;
  const vatLabel = totals.vatPercent === null ? "VAT" : `VAT ${totals.vatPercent}%`;
  const bank = COMPANY.bank;
  return html`
    <div class="page">
      <img src="${assetUrl(logoUrl)}" alt="" class="watermark" />
      ${approved ? "" : html`<div class="draft-mark" aria-hidden="true">DRAFT</div>`}
      ${header("PROFORMA INVOICE", "Pro. No.", proforma.number, date(proforma.date), approved ? "" : html`<div class="draft-flag">DRAFT · NOT VALID</div>`)}
      ${customerBlock(snap, proforma.customer?.name)}
      <table>
        <thead>
          <tr><th style="width:28px">#</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Discount</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
          ${proforma.items.map(
            (line, i) => html`<tr>
              <td>${i + 1}</td>
              <td><strong>${line.name}</strong>${line.description ? html`<div class="muted">${line.description}</div>` : ""}</td>
              <td>${line.unit ?? ""}</td>
              <td class="num">${line.quantity}</td>
              <td class="num">${amount(line.sellingPrice)}</td>
              <td class="num">${line.discount ? amount(line.discount) : "—"}</td>
              <td class="num">${amount(round2(line.quantity * line.sellingPrice - (line.discount ?? 0)))}</td>
            </tr>`,
          )}
        </tbody>
      </table>
      <div class="totals">
        <table>
          <tr><td>Subtotal</td><td class="num">${amount(totals.subtotal)}</td></tr>
          <tr><td>${vatLabel}</td><td class="num">${amount(totals.vat)}</td></tr>
          <tr class="grand"><td>Total (ETB)</td><td class="num">${amount(totals.total)}</td></tr>
        </table>
      </div>
      ${totals.amountInWords ? html`<p class="words"><strong>Amount in words:</strong><span>${totals.amountInWords} only</span></p>` : ""}
      <div class="stamp-zone">${approved ? html`<img src="${assetUrl(stampUrl)}" alt="" class="stamp" />` : ""}</div>
      <footer class="doc-foot">
        <div class="foot-grid">
          <div>
            ${validUntil ? html`<p><strong>Valid until:</strong> ${date(validUntil)} (${proforma.validity} days)</p>` : ""}
            <p><strong>Payment terms</strong><br />${proforma.terms || COMPANY.defaultTerms}</p>
            ${proforma.notes ? html`<p><strong>Notes</strong><br />${proforma.notes}</p>` : ""}
            <p><strong>Bank details</strong><br />${bank.accountName}<br />${bank.bank}<br />Account: <strong>${bank.accountNumber}</strong></p>
            <div class="people">
              <div>Prepared by: <span class="signed">${proforma.preparedBy?.username ?? "—"}</span></div>
              <div>Approved by: ${approved ? html`<span class="signed">${proforma.approvedBy?.username ?? "—"}</span>` : html`<em>awaiting approval</em>`}</div>
            </div>
          </div>
          ${approved ? html`<div class="qr"><div class="qr-frame">${qrCode(verifyUrl(proforma.verifyToken))}</div>Scan to verify</div>` : ""}
        </div>
        <p class="disclaimer">${COMPANY.proformaDisclaimer}</p>
      </footer>
    </div>`;
}

export function printProforma(data: ProformaPrint) {
  return openPrint(`${data.proforma.number} — Proforma`, proformaDocument(data), DOC_CSS + PROFORMA_CSS);
}

/** Job orders: the stamp goes on once an admin has approved the job */
const jobSignatures = (preparedBy?: string, approvedBy?: string) => html`
  <div class="sign-row" style="margin-top:28px">
    <div class="people">
      <div>Prepared by: <span class="signed">${preparedBy ?? "—"}</span></div>
      <div>Approved by: ${approvedBy ? html`<span class="signed">${approvedBy}</span>` : html`<em>awaiting approval</em>`}</div>
    </div>
    ${approvedBy ? html`<img src="${assetUrl(stampUrl)}" alt="" class="stamp stamp-sm" />` : ""}
  </div>`;

export function printJob(job: Job) {
  const snap = job.customerSnapshot as Snapshot | null;
  const lines = job.jobItems ?? [];
  const body = html`
    <div class="page">
      ${header("JOB ORDER", "No.", job.number, date(job.createdAt))}
      ${customerBlock(snap, job.customer?.name)}
      <table style="margin-bottom:14px">
        <tr><th style="width:25%">Status</th><td>${humanize(job.status)}</td><th style="width:25%">Priority</th><td>${humanize(job.priority)}</td></tr>
        <tr><th>Job type</th><td>${job.jobType ?? "—"}</td><th>Deadline</th><td>${date(job.deadline)}</td></tr>
        <tr><th>Proforma</th><td>${job.proforma?.number ?? "—"}</td><th>Created by</th><td>${job.createdBy?.username ?? "—"}</td></tr>
        ${job.artworkPath ? html`<tr><th>Artwork</th><td colspan="3">${job.artworkPath}</td></tr>` : ""}
      </table>
      ${job.description ? html`<p><strong>Description:</strong> ${job.description}</p>` : ""}
      <table>
        <thead><tr><th style="width:28px">#</th><th>Item</th><th>Unit</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${lines.map(
            (l, i) => html`<tr>
              <td>${i + 1}</td>
              <td><strong>${l.name}</strong>${l.description ? html`<div class="muted">${l.description}</div>` : ""}</td>
              <td>${l.unit ?? ""}</td>
              <td class="num">${l.quantity}</td>
              <td class="num">${amount(l.price)}</td>
              <td class="num">${amount(l.total)}</td>
            </tr>`,
          )}
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <table style="width:280px">
          <tr><td style="font-weight:700">Job price</td><td class="num" style="font-weight:700">${money(job.price)}</td></tr>
          ${job.advancePayment ? html`<tr><td>Agreed advance</td><td class="num">${money(job.advancePayment)}</td></tr>` : ""}
        </table>
      </div>
      ${job.adminNotes ? html`<p><strong>Admin notes:</strong> ${job.adminNotes}</p>` : ""}
      ${jobSignatures(job.createdBy?.username, job.adminApprovedBy?.username)}
    </div>`;
  return openPrint(`${job.number} — Job order`, body, DOC_CSS);
}

export function printCustomerStatement(c: CustomerDetail) {
  const body = html`
    <div class="page">
      ${header("CUSTOMER PROFILE", "No.", c.customerId, dateTime(new Date()))}
      ${customerBlock({ ...c, address: c.address as Record<string, string> | null })}
      <h3 style="margin:16px 0 6px">Job orders</h3>
      <table>
        <thead><tr><th>No.</th><th>Date</th><th>Status</th><th class="num">Price</th></tr></thead>
        <tbody>${c.jobs.map((j) => html`<tr><td>${j.number}</td><td>${date(j.createdAt)}</td><td>${humanize(j.status)}</td><td class="num">${amount(j.price)}</td></tr>`)}</tbody>
      </table>
      <h3 style="margin:16px 0 6px">Proformas</h3>
      <table>
        <thead><tr><th>No.</th><th>Date</th><th>Status</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${c.proformas.map(
            (p) => html`<tr><td>${p.number}</td><td>${date(p.date)}</td><td>${humanize(p.status)}</td><td class="num">${amount(p.items.reduce((s, l) => s + l.total, 0))}</td></tr>`,
          )}
        </tbody>
      </table>
    </div>`;
  return openPrint(`${c.customerId} — ${c.name}`, body, DOC_CSS);
}

export function printJobsReport(title: string, filters: string, jobs: Job[]) {
  const total = jobs.reduce((s, j) => s + Number(j.price || 0), 0);
  const body = html`
    <div class="page">
      ${header("JOBS REPORT", "No.", title, dateTime(new Date()))}
      <p class="muted" style="margin:12px 0">${filters}</p>
      <table>
        <thead><tr><th>No.</th><th>Date</th><th>Customer</th><th>Status</th><th>Created by</th><th class="num">Price</th></tr></thead>
        <tbody>
          ${jobs.map(
            (j) => html`<tr><td>${j.number}</td><td>${date(j.createdAt)}</td><td>${j.customer?.name ?? ""}</td><td>${humanize(j.status)}</td><td>${j.createdBy?.username ?? ""}</td><td class="num">${amount(j.price)}</td></tr>`,
          )}
        </tbody>
      </table>
      <p style="text-align:right;font-weight:700;margin-top:10px">${jobs.length} jobs · Total ${money(total)}</p>
    </div>`;
  return openPrint(`Jobs report ${title}`, body, DOC_CSS);
}
