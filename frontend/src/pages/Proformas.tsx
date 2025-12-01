import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { proformaCreateSchema, proformaSearchSchema } from "@shared/schemas";
import { SearchPanel } from "../components/SearchPanel";
import TabHeader from "../components/TabHeader";
import RecordingWizard from "../components/RecordingWizard";

type Customer = { id: number; name: string; company?: string; customerId: string };
type Proforma = {
  id: number;
  number: string;
  status: string;
  customerSnapshot?: any;
  customer?: any;
  date: string;
  preparedBy?: { username: string };
  items: any[];
};

const VAT_DEFAULT = 15;

function amountToWords(amount: number) {
  const units = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const chunk = (n: number) => {
    const parts: string[] = [];
    if (n >= 100) {
      parts.push(`${units[Math.floor(n / 100)]} hundred`);
      n = n % 100;
    }
    if (n >= 20) {
      parts.push(tens[Math.floor(n / 10)] + (n % 10 ? `-${units[n % 10]}` : ""));
    } else if (n > 0) {
      parts.push(units[n]);
    }
    return parts.join(" ");
  };
  if (!Number.isFinite(amount)) return "";
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  if (whole === 0 && cents === 0) return "zero birr";
  const scales = ["", " thousand", " million", " billion"];
  let num = whole;
  const parts: string[] = [];
  let i = 0;
  while (num > 0) {
    const c = num % 1000;
    if (c) parts.unshift(`${chunk(c)}${scales[i]}`.trim());
    num = Math.floor(num / 1000);
    i++;
  }
  const birr = parts.join(" ") || "zero";
  return `${birr} birr${cents ? ` and ${chunk(cents)} cents` : ""}`;
}

export default function Proformas() {
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [registerNew, setRegisterNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    company: "",
    phones: "",
    email: "",
    tin: "",
    address: { region: "", city: "", subcity: "", woreda: "", house: "" },
  });
  const [items, setItems] = useState([
    { name: "", description: "", quantity: 1, unit: "pcs", sellingPrice: 0, discount: 0, vatPercent: VAT_DEFAULT },
  ]);
  const [meta, setMeta] = useState({
    validity: 7,
    notes: "",
    terms: "",
    signaturePath: "",
    stampPath: "",
    bankInfoSnapshot: "",
  });
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    preparedBy: "",
    itemName: "",
    amountMin: "",
    amountMax: "",
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.sellingPrice || 0), 0);
    const discount = items.reduce((sum, i) => sum + Number(i.discount || 0), 0);
    const vat = items.reduce((sum, i) => {
      const base = Number(i.quantity || 0) * Number(i.sellingPrice || 0) - Number(i.discount || 0);
      const vatPercent = i.vatPercent ?? VAT_DEFAULT;
      return sum + (base * vatPercent) / 100;
    }, 0);
    const total = items.reduce((sum, i) => {
      const base = Number(i.quantity || 0) * Number(i.sellingPrice || 0);
      const vatPercent = i.vatPercent ?? VAT_DEFAULT;
      const discountAmt = Number(i.discount || 0);
      return sum + base - discountAmt + ((base - discountAmt) * vatPercent) / 100;
    }, 0);
    return { subtotal, discount, vat, total, words: amountToWords(total) };
  }, [items]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/proformas", { params: filters });
      const parsed = proformaSearchSchema.safeParse(filters);
      if (!parsed.success) {
        console.warn("Filter validation", parsed.error.issues);
      }
      setProformas(res.data.data || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!customerSearch) return;
      const res = await api.get("/customers", { params: { q: customerSearch, pageSize: 5 } });
      setCustomers(res.data.data || res.data);
    }, 250);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () =>
    setItems((prev) => [...prev, { name: "", description: "", quantity: 1, unit: "pcs", sellingPrice: 0, discount: 0, vatPercent: VAT_DEFAULT }]);

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const payload: any = {
      customerId: selectedCustomer?.id,
      customerNew: !selectedCustomer
        ? {
            name: newCustomer.name,
            company: newCustomer.company,
            phones: newCustomer.phones ? newCustomer.phones.split(",").map((p) => p.trim()) : undefined,
            email: newCustomer.email || undefined,
            tin: newCustomer.tin || undefined,
            address: newCustomer.address,
          }
        : undefined,
      validity: meta.validity ? Number(meta.validity) : undefined,
      notes: meta.notes || undefined,
      terms: meta.terms || undefined,
      signaturePath: meta.signaturePath || undefined,
      stampPath: meta.stampPath || undefined,
      bankInfoSnapshot: meta.bankInfoSnapshot || undefined,
      items: items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        sellingPrice: Number(i.sellingPrice),
        discount: Number(i.discount || 0),
        vatPercent: Number(i.vatPercent || VAT_DEFAULT),
      })),
    };
    const parsed = proformaCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    await api.post("/proformas", payload);
    setMessage("Proforma created");
    setItems([{ name: "", description: "", quantity: 1, unit: "pcs", sellingPrice: 0, discount: 0, vatPercent: VAT_DEFAULT }]);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setWizardOpen(false);
    load();
  };

  const approve = async (id: number) => {
    await api.post(`/proformas/${id}/approve`, {});
    load();
  };

  const convert = async (id: number) => {
    await api.post(`/proformas/${id}/convert`, {});
    load();
  };

  const print = async (id: number) => {
    const res = await api.get(`/proformas/${id}/print`);
    const data = res.data;
    const html = `
      <html>
      <head><title>${data.proforma.number}</title><style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
      </style></head>
      <body>
        <h2>Proforma ${data.proforma.number}</h2>
        <div>Customer: ${data.proforma.customerSnapshot?.name || data.proforma.customer?.name || ""}</div>
        <div>Date: ${new Date(data.proforma.date).toLocaleDateString()}</div>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>Discount</th><th>Total</th></tr></thead>
        <tbody>
          ${data.proforma.items
            .map(
              (i: any) =>
                `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unit || ""}</td><td>${i.sellingPrice}</td><td>${i.discount || 0}</td><td>${i.total}</td></tr>`
            )
            .join("")}
        </tbody></table>
        <p>Subtotal: ${data.totals.subtotal} | VAT: ${data.totals.vat} | Total: ${data.totals.total}</p>
        <p>Amount in words: ${data.totals.amountInWords}</p>
        <p>Notes: ${data.proforma.notes || ""}</p>
        <p>Terms: ${data.proforma.terms || ""}</p>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div className="space-y-4">
      <TabHeader
        title="Proforma Generator (TAPI)"
        searchPlaceholder="Search number/customer"
        value={filters.q}
        onSearch={(q) => setFilters({ ...filters, q })}
        onFilter={() => setShowFilters((s) => !s)}
        onOpenNew={() => setWizardOpen(true)}
        loading={loading}
        newLabel={"New Proforma"}
      />

      {showFilters && (
          <div className="card space-y-3">
            <SearchPanel>
              <input className="input" placeholder="Search number/customer" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              <input className="input" placeholder="Prepared by" value={filters.preparedBy} onChange={(e) => setFilters({ ...filters, preparedBy: e.target.value })} />
              <input className="input" placeholder="Item name" value={filters.itemName} onChange={(e) => setFilters({ ...filters, itemName: e.target.value })} />
              <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="converted">Converted</option>
                <option value="expired">Expired</option>
              </select>
              <input className="input" type="number" placeholder="Amount min" value={filters.amountMin} onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })} />
              <input className="input" type="number" placeholder="Amount max" value={filters.amountMax} onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })} />
              <input className="input" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
              <input className="input" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
              <button
                className="btn bg-slate-700 hover:bg-slate-600"
                type="button"
                onClick={() => setFilters({ q: "", status: "", preparedBy: "", itemName: "", amountMin: "", amountMax: "", startDate: "", endDate: "" })}
              >
                Clear Filters
              </button>
            </SearchPanel>
          </div>
      )}

      <RecordingWizard
        title="Create Proforma"
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={() => (document.getElementById("proforma-form") as HTMLFormElement | null)?.requestSubmit()}
        saveLabel="Save Proforma"
      >
        <form id="proforma-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Customer search</label>
              <input
                className="input mt-1"
                placeholder="Search by name/company"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomer(null);
                }}
              />
              <div className="mt-2 space-y-1">
                {customers.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setRegisterNew(false);
                    }}
                    className={`block w-full rounded border px-3 py-2 text-left text-sm ${
                      selectedCustomer?.id === c.id ? "border-primary text-primary" : "border-slate-200"
                    }`}
                  >
                    {c.name} {c.company ? `– ${c.company}` : ""} ({c.customerId})
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-sm text-primary underline"
                onClick={() => {
                  setRegisterNew(true);
                  setSelectedCustomer(null);
                }}
              >
                {registerNew ? "Registering new customer" : "Register a new customer"}
              </button>
            </div>

            {registerNew && (
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="input"
                  placeholder="Name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  required
                />
                <input
                  className="input"
                  placeholder="Company"
                  value={newCustomer.company}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Phones (comma separated)"
                  value={newCustomer.phones}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phones: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
                <input className="input" placeholder="TIN" value={newCustomer.tin} onChange={(e) => setNewCustomer({ ...newCustomer, tin: e.target.value })} />
                <input
                  className="input"
                  placeholder="Region"
                  value={newCustomer.address.region}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, region: e.target.value } })}
                />
                <input
                  className="input"
                  placeholder="City"
                  value={newCustomer.address.city}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, city: e.target.value } })}
                />
                <input
                  className="input"
                  placeholder="Sub-city"
                  value={newCustomer.address.subcity}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, subcity: e.target.value } })}
                />
                <input
                  className="input"
                  placeholder="Woreda"
                  value={newCustomer.address.woreda}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, woreda: e.target.value } })}
                />
                <input
                  className="input"
                  placeholder="House No"
                  value={newCustomer.address.house}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, house: e.target.value } })}
                />
              </div>
            )}

            {!registerNew && selectedCustomer && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Using customer snapshot: <strong>{selectedCustomer.name}</strong> {selectedCustomer.company ? `(${selectedCustomer.company})` : ""} –{" "}
                {selectedCustomer.customerId}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Items</h4>
              <button type="button" className="btn bg-primary" onClick={addItem}>
                + Add item
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6">
                <input className="input md:col-span-2" placeholder="Item name" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} />
                <input className="input md:col-span-2" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                <input
                  className="input"
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                />
                <input className="input" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                <input
                  className="input"
                  type="number"
                  placeholder="Price"
                  value={item.sellingPrice}
                  onChange={(e) => updateItem(idx, "sellingPrice", Number(e.target.value))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Discount"
                  value={item.discount}
                  onChange={(e) => updateItem(idx, "discount", Number(e.target.value))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="VAT %"
                  value={item.vatPercent}
                  onChange={(e) => updateItem(idx, "vatPercent", Number(e.target.value))}
                />
                <div className="flex items-center justify-between md:col-span-2">
                  <span className="text-sm text-slate-500">
                    Line total: {" "}
                    {(
                      Number(item.quantity || 0) * Number(item.sellingPrice || 0) -
                      Number(item.discount || 0) +
                      ((Number(item.quantity || 0) * Number(item.sellingPrice || 0) - Number(item.discount || 0)) *
                        (item.vatPercent ?? VAT_DEFAULT)) /
                        100
                    ).toFixed(2)}
                  </span>
                  {items.length > 1 && (
                    <button type="button" className="text-sm text-red-500" onClick={() => removeItem(idx)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="input"
              type="number"
              placeholder="Validity (days)"
              value={meta.validity}
              onChange={(e) => setMeta({ ...meta, validity: Number(e.target.value) })}
            />
            <input
              className="input"
              placeholder="Signature path"
              value={meta.signaturePath}
              onChange={(e) => setMeta({ ...meta, signaturePath: e.target.value })}
            />
            <input className="input" placeholder="Stamp path" value={meta.stampPath} onChange={(e) => setMeta({ ...meta, stampPath: e.target.value })} />
            <textarea
              className="input md:col-span-3"
              placeholder="Bank info snapshot"
              value={meta.bankInfoSnapshot}
              onChange={(e) => setMeta({ ...meta, bankInfoSnapshot: e.target.value })}
            />
            <textarea className="input md:col-span-3" placeholder="Notes" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
            <textarea className="input md:col-span-3" placeholder="Terms" value={meta.terms} onChange={(e) => setMeta({ ...meta, terms: e.target.value })} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div>Subtotal: ETB {totals.subtotal.toFixed(2)}</div>
            <div>Discount: ETB {totals.discount.toFixed(2)}</div>
            <div>VAT: ETB {totals.vat.toFixed(2)}</div>
            <div className="font-semibold text-primary">Total: ETB {totals.total.toFixed(2)}</div>
            <div className="text-xs text-slate-500">Amount in words: {totals.words}</div>
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn" type="submit">
              Save Proforma (draft)
            </button>
            <button type="button" className="btn" onClick={() => setWizardOpen(false)}>
              Close
            </button>
          </div>
        </form>
      </RecordingWizard>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Proformas</h3>
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={() => setWizardOpen(true)}>
              New Proforma
            </button>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
        </div>
        <div className="space-y-2">
          {proformas.map((p) => (
            <div key={p.id} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.number}</p>
                  <p className="text-xs text-slate-500">
                    {p.customerSnapshot?.name || p.customer?.name || ""} • {new Date(p.date).toLocaleDateString()} • Prepared by {p.preparedBy?.username || "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">{p.status}</span>
                  <button className="btn bg-slate-700 hover:bg-slate-600" type="button" onClick={() => print(p.id)}>
                    Print/PDF
                  </button>
                  <button className="btn bg-emerald-600 hover:bg-emerald-500" type="button" disabled={p.status !== "draft"} onClick={() => approve(p.id)}>
                    Approve
                  </button>
                  <button className="btn bg-amber-600 hover:bg-amber-500" type="button" disabled={p.status !== "approved"} onClick={() => convert(p.id)}>
                    Convert to Job
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                {p.items?.slice(0, 4).map((it) => (
                  <div key={it.id} className="rounded bg-slate-50 px-2 py-1 text-xs dark:bg-slate-900/60">
                    {it.name} — {it.quantity} x {it.sellingPrice} (VAT {it.vatPercent || VAT_DEFAULT}%)
                  </div>
                ))}
              </div>
            </div>
          ))}
          {proformas.length === 0 && <p className="text-xs text-slate-500">No proformas yet</p>}
        </div>
      </div>
    </div>
  );
}