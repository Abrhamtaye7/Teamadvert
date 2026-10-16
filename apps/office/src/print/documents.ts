import logoUrl from "../assets/teamlogo.png";
import signUrl from "../assets/sign.png";
import stampUrl from "../assets/stamp.png";
import { COMPANY } from "../lib/company";
import { amount, date, dateTime, humanize, money } from "../lib/format";
import type { CustomerDetail, Job, ProformaPrint } from "../lib/types";
import { assetUrl, html, openPrint } from "./html";

type Snapshot = { name?: string; company?: string | null; phones?: string[] | null; tin?: string | null; customerId?: string; address?: Record<string, string> | null };

const addressLine = (a?: Record<string, string> | null) =>
  a ? [a.house && `H.No ${a.house}`, a.woreda && `Woreda ${a.woreda}`, a.subcity, a.city, a.region].filter(Boolean).join(", ") : "";

function header(title: string, number: string, when: string) {
  return html`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a73e8;padding-bottom:12px">
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${assetUrl(logoUrl)}" alt="" style="width:58px;height:58px" />
        <div>
          <h2 style="font-size:20px;letter-spacing:.04em" class="brand">${COMPANY.name}</h2>
          <div class="muted">${COMPANY.city}</div>
        </div>
      </div>
      <div style="text-align:right">
        <h1 style="font-size:22px;letter-spacing:.06em" class="accent">${title}</h1>
        <div style="margin-top:4px"><strong>No.</strong> ${number}</div>
        <div><strong>Date</strong> ${when}</div>
      </div>
    </div>`;
}

function customerBlock(s: Snapshot | null | undefined, fallbackName?: string) {
  return html`
    <div style="margin:16px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
      <div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.06em">Bill to</div>
      <div style="font-size:14px;font-weight:600;margin-top:2px">${s?.name ?? fallbackName ?? "—"}</div>
      ${s?.company ? html`<div>${s.company}</div>` : ""}
      ${s?.phones?.length ? html`<div>Tel: ${s.phones.join(", ")}</div>` : ""}
      ${s?.tin ? html`<div>TIN: ${s.tin}</div>` : ""}
      ${addressLine(s?.address) ? html`<div>${addressLine(s?.address)}</div>` : ""}
    </div>`;
}

const signatures = (preparedBy?: string) => html`
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px">
    <div><div class="muted">Prepared by</div><div style="font-weight:600;margin-top:2px">${preparedBy ?? "—"}</div></div>
    <div style="position:relative;text-align:center;width:220px">
      <img src="${assetUrl(stampUrl)}" alt="" style="position:absolute;left:10px;bottom:6px;width:120px;opacity:.85" />
      <img src="${assetUrl(signUrl)}" alt="" style="position:relative;width:110px" />
      <div style="border-top:1px solid #94a3b8;padding-top:4px"><span class="muted">Approved by</span> <strong>${COMPANY.approvedBy}</strong></div>
    </div>
  </div>`;

export function printProforma({ proforma, totals }: ProformaPrint) {
  const snap = proforma.customerSnapshot as Snapshot | null;
  const validUntil = proforma.validity ? new Date(new Date(proforma.date).getTime() + proforma.validity * 86_400_000) : null;
  const body = html`
    <div class="page">
      ${header("PROFORMA INVOICE", proforma.number, date(proforma.date))}
      ${customerBlock(snap, proforma.customer?.name)}
      <table>
        <thead>
          <tr><th style="width:28px">#</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Discount</th><th class="num">VAT</th><th class="num">Amount</th></tr>
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
              <td class="num">${line.vatPercent ?? COMPANY.vatPercent}%</td>
              <td class="num">${amount(line.total)}</td>
            </tr>`,
          )}
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <table style="width:280px">
          <tr><td>Subtotal</td><td class="num">${amount(totals.subtotal)}</td></tr>
          ${totals.discount ? html`<tr><td>Discount</td><td class="num">−${amount(totals.discount)}</td></tr>` : ""}
          <tr><td>VAT</td><td class="num">${amount(totals.vat)}</td></tr>
          <tr><td style="font-weight:700;font-size:14px;border-bottom:0">Total (ETB)</td><td class="num" style="font-weight:700;font-size:14px;border-bottom:0">${amount(totals.total)}</td></tr>
        </table>
      </div>
      <p style="margin:10px 0 0"><strong>Amount in words:</strong> ${totals.amountInWords ?? ""} only</p>
      ${validUntil ? html`<p style="margin:4px 0 0"><strong>Valid until:</strong> ${date(validUntil)} (${proforma.validity} days)</p>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div style="padding:10px;background:#f8fafc;border-radius:8px">
          <strong>Bank details</strong>
          <div>${COMPANY.bank.accountName}</div>
          <div>${COMPANY.bank.bank}</div>
          <div>Account: <strong>${COMPANY.bank.accountNumber}</strong></div>
        </div>
        <div style="padding:10px;background:#f8fafc;border-radius:8px">
          <strong>Payment terms</strong>
          <div>${proforma.terms || COMPANY.defaultTerms}</div>
          ${proforma.notes ? html`<div style="margin-top:6px"><strong>Notes:</strong> ${proforma.notes}</div>` : ""}
        </div>
      </div>
      ${signatures(proforma.preparedBy?.username)}
      <p class="muted" style="margin-top:18px;font-size:10.5px;text-align:center">${COMPANY.proformaDisclaimer}</p>
    </div>`;
  return openPrint(`${proforma.number} — Proforma`, body);
}

export function printJob(job: Job) {
  const snap = job.customerSnapshot as Snapshot | null;
  const lines = job.jobItems ?? [];
  const body = html`
    <div class="page">
      ${header("JOB ORDER", job.number, date(job.createdAt))}
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
      ${signatures(job.createdBy?.username)}
    </div>`;
  return openPrint(`${job.number} — Job order`, body);
}

export function printCustomerStatement(c: CustomerDetail) {
  const body = html`
    <div class="page">
      ${header("CUSTOMER PROFILE", c.customerId, dateTime(new Date()))}
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
  return openPrint(`${c.customerId} — ${c.name}`, body);
}

export function printJobsReport(title: string, filters: string, jobs: Job[]) {
  const total = jobs.reduce((s, j) => s + Number(j.price || 0), 0);
  const body = html`
    <div class="page">
      ${header("JOBS REPORT", title, dateTime(new Date()))}
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
  return openPrint(`Jobs report ${title}`, body);
}
