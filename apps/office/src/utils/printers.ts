import api from "../lib/api";
import proformaTemplate from "../assets/pro.html?raw";
import backgroundImage from "../assets/background.jpg";
import defaultSignature from "../assets/sign.png";
import defaultStamp from "../assets/stamp.png";

function openWindowWithContent(title: string, body: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; text-align: left; }
    h2 { margin-bottom: 4px; }
    .muted { color: #64748b; font-size: 12px; }
  </style></head><body>${body}</body></html>`);
  w.document.close();
}

const serializeForScript = (payload: any) => JSON.stringify(payload).replace(/</g, "\\u003c");

const formatDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatAddress = (customer: any) => {
  const parts: string[] = [];
  if (customer?.address) {
    const { region, city, subcity, woreda, house } = customer.address as Record<string, string>;
    [region, city, subcity, woreda, house].forEach((part) => {
      if (part) parts.push(part);
    });
  }
  if (!parts.length && customer?.company) parts.push(customer.company);
  return parts.join(", ");
};

const resolveAsset = (path?: string | null, fallback?: string) => {
  if (!path) return fallback;
  if (/^(https?:|data:)/.test(path)) return path;
  return fallback ?? path;
};

const normalizeBankInfo = (bankInfo: any) => {
  if (!bankInfo) return "";
  if (typeof bankInfo === "string") return bankInfo;
  if (typeof bankInfo === "object") {
    return Object.entries(bankInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  }
  return String(bankInfo);
};

export async function openJobPrint(jobId: number) {
  const res = await api.get(`/jobs/${jobId}/print`);
  const { job, total } = res.data;
  const customerName = job.customerSnapshot?.name || job.customer?.name || "";
  const deadline = job.deadline ? new Date(job.deadline).toLocaleDateString() : "-";
  const itemsRows = job.jobItems
    .map(
      (it: any) =>
        `<tr><td>${it.name}</td><td>${it.quantity}</td><td>${it.unit || ""}</td><td>${it.price}</td><td>${it.total}</td></tr>`
    )
    .join("");
  const body = `
    <h2>${job.number}</h2>
    <p class="muted">Customer: ${customerName}</p>
    <p class="muted">Deadline: ${deadline} | Priority: ${job.priority || "-"}</p>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <p>Total: ${total}</p>
    <p>Notes: ${job.adminNotes || ""}</p>
    <script>window.onload = () => window.print && window.print();</script>
  `;
  openWindowWithContent(job.number, body);
}

export async function openProformaPrint(proformaId: number) {
  const res = await api.get(`/proformas/${proformaId}/print`);
  const { proforma, totals } = res.data;
  const customerSnapshot = proforma.customerSnapshot || proforma.customer || {};
  const customerName = customerSnapshot?.name || proforma.customer?.name || "";
  const customerAddress = formatAddress(customerSnapshot) || "Addis Ababa, Ethiopia";
  const items = (proforma.items || []).map((item: any, index: number) => ({
    index: index + 1,
    name: item.name,
    description: item.description || "",
    unit: item.unit || "",
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.sellingPrice || 0),
    total:
      typeof item.total === "number"
        ? Number(item.total)
        : Number(item.quantity || 0) * Number(item.sellingPrice || 0) - Number(item.discount || 0),
  }));
  const subtotal = Number(totals?.subtotal || 0);
  const vat = Number(totals?.vat || 0);
  const grandTotal = Number(totals?.total || 0);
  const amountInWords = totals?.amountInWords || proforma.amountInWords || "";
  const validityDays = Number(proforma.validity || 0);
  const baseDate = proforma.date ? new Date(proforma.date) : null;
  const validUntil = baseDate && validityDays ? new Date(baseDate.getTime() + validityDays * 86400000) : null;
  const goodsDescription =
    (proforma as any)?.description || (proforma as any)?.notes || (proforma as any)?.summary || "";
  const bankInfo = normalizeBankInfo(proforma.bankInfoSnapshot);
  const payload = {
    number: proforma.number,
    date: formatDateInput(proforma.date),
    customerName,
    customerAddress,
    items,
    subtotal,
    vat,
    grandTotal,
    amountInWords: amountInWords || "Zero birr only",
    validationDate: validUntil ? validUntil.toISOString() : "",
    advancePayment: proforma.advancePayment ? String(proforma.advancePayment) : "-",
    deliveryDate: formatDateInput(proforma.deliveryDate),
    accountNumber: bankInfo || "-",
    bankDetails: bankInfo || "-",
    goodsDescription: goodsDescription || "-",
    preparedBy: proforma.preparedBy?.username || "",
    approvedBy: (proforma as any)?.approvedBy?.username || "",
    signaturePath: resolveAsset(proforma.signaturePath, defaultSignature) || "",
    stampPath: resolveAsset(proforma.stampPath, defaultStamp) || "",
    background: backgroundImage,
  };

  const styledTemplate = proformaTemplate.replace(
    "</head>",
    `<style>
      @page {
        size: A4;
        margin: 0;
      }
      html, body {
        width: 100%;
        height: 100%;
      }
      body {
        margin: 0;
        padding: 0;
        background: #0f172a;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100vh;
      }
      .container {
        width: 210mm !important;
        height: 297mm !important;
        max-width: none !important;
        margin: 0 auto;
        padding: 0 !important;
        background: url('${backgroundImage}') center top no-repeat;
        background-size: 210mm 297mm;
        box-shadow: none !important;
        border-radius: 0;
        overflow: hidden;
        position: relative;
      }
      @media print {
        body {
          background: transparent;
          display: block;
        }
        .container {
          margin: 0;
        }
      }
    </style></head>`
  );

  const script = `
    <script>
      (function () {
        const data = ${serializeForScript(payload)};
        const doc = document;
        const setValue = function (id, value) {
          const el = doc.getElementById(id);
          if (!el) return;
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.value = value || "";
          } else {
            el.textContent = value || "";
          }
        };
        const escapeHtml = function (value) {
          if (!value) return "";
          return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        };

        setValue("date", data.date || "-");
        setValue("proformaId", data.number);
        setValue("customerName", data.customerName);
        setValue("customerAddress", data.customerAddress);
        setValue("amountInWords", data.amountInWords || "");
        setValue("validationDate", data.validationDate ? data.validationDate.slice(0, 10) : "-");
        setValue("advancePayment", data.advancePayment);
        setValue("deliveryDate", data.deliveryDate ? data.deliveryDate.slice(0, 10) : "-");
        setValue("accountNumber", data.accountNumber);
        setValue("bankDetails", data.bankDetails);
        setValue("goodsDescription", data.goodsDescription);
        setValue("preparedBy", data.preparedBy);
        setValue("approvedBy", data.approvedBy);

        const tbody = doc.getElementById("itemsBody");
        if (tbody) {
          tbody.innerHTML = data.items && data.items.length
            ? data.items
                .map(function (item, index) {
                  var qty = Number(item.quantity || 0);
                  var unitPrice = Number(item.unitPrice || 0);
                  var total = Number(item.total || 0);
                  var desc = item.description ? ' - ' + escapeHtml(item.description) : '';
                  var name = escapeHtml(item.name || '');
                  var unit = escapeHtml(item.unit || '');
                  return '<tr>' +
                    '<td>' + (index + 1) + '</td>' +
                    '<td>' + name + desc + '</td>' +
                    '<td>' + unit + '</td>' +
                    '<td>' + qty + '</td>' +
                    '<td>' + unitPrice.toFixed(2) + '</td>' +
                    '<td>' + total.toFixed(2) + '</td>' +
                  '</tr>';
                })
                .join('')
            : '<tr><td colspan="6" style="text-align:center; color:#475569;">No items</td></tr>';
        }

        const setCurrency = function (id, value) {
          const el = doc.getElementById(id);
          if (!el) return;
          const formatted = Number(value || 0).toFixed(2);
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.value = formatted;
          } else {
            el.textContent = formatted;
          }
        };
        setCurrency("total", data.subtotal);
        setCurrency("vat", data.vat);
        setCurrency("grandTotal", data.grandTotal);

        const stamp = doc.getElementById("stampImage");
        if (stamp && data.stampPath) {
          stamp.src = data.stampPath;
        } else if (stamp) {
          stamp.style.display = "none";
        }

        const signature = doc.getElementById("signatureImage");
        if (signature && data.signaturePath) {
          signature.src = data.signaturePath;
          signature.style.display = "block";
        } else if (signature) {
          signature.style.display = "none";
        }
        const container = doc.querySelector('.container');
        if (container && data.background) {
          container.style.backgroundImage = 'url(' + data.background + ')';
        }

        setTimeout(function () {
          if (window.print) window.print();
        }, 300);
      })();
    </script>
  `;

  const html = styledTemplate.replace("</body>", `${script}</body>`);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export async function openCustomerProfile(customerId: number) {
  const res = await api.get(`/customers/${customerId}/profile`);
  const customer = res.data;
  const phones = Array.isArray(customer.phones) ? customer.phones.join(", ") : "";
  const addressParts = customer.address ? Object.values(customer.address).filter(Boolean).join(", ") : "";
  const historyRows = customer.proformas
    .slice(0, 5)
    .map((p: any) => `<li>${p.number} · ${new Date(p.createdAt).toLocaleDateString()}</li>`)
    .join("");
  const body = `
    <h2>${customer.customerId}</h2>
    <p class="muted">${customer.name}${customer.company ? ` · ${customer.company}` : ""}</p>
    <p>Phones: ${phones || "-"}</p>
    <p>Email: ${customer.email || "-"}</p>
    <p>TIN: ${customer.tin || "-"}</p>
    <p>Address: ${addressParts || "-"}</p>
    <h3>Recent Proformas</h3>
    <ul>${historyRows || "<li>No history</li>"}</ul>
    <script>window.onload = () => window.print && window.print();</script>
  `;
  openWindowWithContent(customer.customerId, body);
}
