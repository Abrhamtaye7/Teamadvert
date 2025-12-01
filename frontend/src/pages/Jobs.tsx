import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { jobSchema, jobSearchSchema } from "@shared/schemas";
import { SearchPanel } from "../components/SearchPanel";
import TabHeader from "../components/TabHeader";
import { WizardModal } from "../components/WizardModal";

type Job = {
  id: number;
  number: string;
  status: string;
  customerSnapshot?: any;
  customer?: any;
  proforma?: any;
  jobItems: any[];
  priority?: string;
  deadline?: string;
  advancePayment?: number;
  price?: number;
  createdAt: string;
};

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    priority: "",
    customer: "",
    itemName: "",
    startDate: "",
    endDate: "",
    amountMin: "",
    amountMax: "",
    createdBy: "",
    proforma: "",
  });

  
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [registerNew, setRegisterNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    company: "",
    phones: "",
    email: "",
    tin: "",
    address: { region: "", city: "", subcity: "", woreda: "", house: "" },
  });

  const [proformaNumber, setProformaNumber] = useState("");
  const [proformaItems, setProformaItems] = useState<any[]>([]);

  const [items, setItems] = useState([{ name: "", description: "", quantity: 1, unit: "pcs", price: 0 }]);
  const [meta, setMeta] = useState({ jobType: "", description: "", priority: "normal", advancePayment: 0, deadline: "", artworkPath: "", adminNotes: "" });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  const totals = useMemo(() => {
    const total = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.price || 0), 0);
    return { total };
  }, [items]);

  const load = async () => {
      setLoading(true);
    try {
      const res = await api.get("/jobs", { params: filters });
      const parsed = jobSearchSchema.safeParse(filters);
      if (!parsed.success) console.warn(parsed.error.issues);
      setJobs(res.data.data || res.data);
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
    }, 200);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const fetchProforma = async () => {
    if (!proformaNumber) return;
    const res = await api.get("/proformas", { params: { q: proformaNumber, pageSize: 1 } });
    const p = (res.data.data || res.data)[0];
    if (p) {
      setProformaItems(
        p.items.map((it: any) => ({
          itemId: it.itemId,
          name: it.name,
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          price: Number(it.total || 0),
        }))
      );
      setItems(
        p.items.map((it: any) => ({
          name: it.name,
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          price: Number(it.total || 0),
        }))
      );
      setSelectedCustomer(p.customerSnapshot || p.customer);
      setRegisterNew(false);
    }
  };

  const updateItem = (idx: number, field: string, value: any) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const addItem = () => setItems((prev) => [...prev, { name: "", description: "", quantity: 1, unit: "pcs", price: 0 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
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
      proformaNumber: proformaNumber || undefined,
      jobType: meta.jobType || undefined,
      description: meta.description || undefined,
      priority: meta.priority as any,
      advancePayment: meta.advancePayment ? Number(meta.advancePayment) : undefined,
      deadline: meta.deadline || undefined,
      artworkPath: meta.artworkPath || undefined,
      adminNotes: meta.adminNotes || undefined,
      jobItems: items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price: Number(i.price),
      })),
    };
    const parsed = jobSchema.safeParse(payload);
    if (!parsed.success) {
      alert(parsed.error.issues[0].message);
      return;
    }
    await api.post("/jobs", payload);
    setWizardOpen(false);
    setStepIndex(0);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setProformaNumber("");
    setItems([{ name: "", description: "", quantity: 1, unit: "pcs", price: 0 }]);
    load();
  };

  const approve = async (id: number) => {
    await api.post(`/jobs/${id}/approve`, {});
    load();
  };

  const production = async (id: number, status: string) => {
    await api.post(`/jobs/${id}/production`, { status });
    load();
  };

  const finance = async (id: number, status: string) => {
    await api.post(`/jobs/${id}/finance`, { status });
    load();
  };

  const printJob = async (id: number) => {
    const res = await api.get(`/jobs/${id}/print`);
    const data = res.data;
    const html = `
    <html><head><title>${data.job.number}</title><style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
    </style></head>
    <body>
      <h2>${data.job.number}</h2>
      <div>Customer: ${data.job.customerSnapshot?.name || data.job.customer?.name || ""}</div>
      <div>Deadline: ${data.job.deadline ? new Date(data.job.deadline).toLocaleDateString() : "-"}</div>
      <div>Priority: ${data.job.priority}</div>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${data.job.jobItems
        .map((it: any) => `<tr><td>${it.name}</td><td>${it.quantity}</td><td>${it.unit || ""}</td><td>${it.price}</td><td>${it.total}</td></tr>`)
        .join("")}</tbody></table>
      <p>Total: ${data.total}</p>
      <p>Notes: ${data.job.adminNotes || ""}</p>
      <script>window.onload=()=>window.print()</script>
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
        title="Job Orders (TAJO)"
        searchPlaceholder="Search jobs..."
        value={filters.q}
        onSearch={(q) => setFilters({ ...filters, q })}
        onFilter={() => setShowFilters((s) => !s)}
        onOpenNew={() => setWizardOpen(true)}
        loading={loading}
        newLabel={"New Job Order"}
      />

      {showFilters && (
        <div className="card">
          <SearchPanel>
            <input className="input" placeholder="Search number" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <input className="input" placeholder="Customer" value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })} />
            <input className="input" placeholder="Item name" value={filters.itemName} onChange={(e) => setFilters({ ...filters, itemName: e.target.value })} />
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="finance_review">Finance Review</option>
              <option value="closed">Closed</option>
            </select>
            <select className="input" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">Any priority</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <input className="input" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            <input className="input" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            <input className="input" type="number" placeholder="Amount min" value={filters.amountMin} onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })} />
            <input className="input" type="number" placeholder="Amount max" value={filters.amountMax} onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })} />
            <button
              className="btn bg-slate-700 hover:bg-slate-600"
              type="button"
              onClick={() =>
                setFilters({ q: "", status: "", priority: "", customer: "", itemName: "", startDate: "", endDate: "", amountMin: "", amountMax: "", createdBy: "", proforma: "" })
              }
            >
              Clear Filters
            </button>
          </SearchPanel>
        </div>
      )}

      <WizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        steps={[
          {
            title: "Customer",
            content: (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Customer search</label>
                  <input className={`input mt-1 ${!selectedCustomer && !registerNew ? "border-red-500" : ""}`} placeholder="Search" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
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
                  <button type="button" className="mt-2 text-sm text-primary underline" onClick={() => setRegisterNew(true)}>
                    Register new customer
                  </button>
                </div>
                {registerNew && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="input" placeholder="Name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
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
                    <input className="input" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
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
                      placeholder="House"
                      value={newCustomer.address.house}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, house: e.target.value } })}
                    />
                  </div>
                )}
                {!registerNew && selectedCustomer && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 md:col-span-2">
                    Using customer: {selectedCustomer.name} {selectedCustomer.company ? `(${selectedCustomer.company})` : ""} – {selectedCustomer.customerId}
                  </div>
                )}
              </div>
            ),
            isValid: !!selectedCustomer || registerNew,
          },
          {
            title: "Proforma Link or Manual",
            content: (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input className="input" placeholder="Proforma number (TAPI-###-YY)" value={proformaNumber} onChange={(e) => setProformaNumber(e.target.value)} />
                  <button type="button" className="btn" onClick={fetchProforma}>
                    Fetch proforma
                  </button>
                </div>
                {proformaItems.length > 0 && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                    Loaded {proformaItems.length} items from proforma; you can adjust in Items step.
                  </div>
                )}
              </div>
            ),
            isValid: true,
          },
          {
            title: "Items",
            content: (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Items</h4>
                  <button type="button" className="btn" onClick={addItem}>
                    + Add Item
                  </button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-6">
                    <input className="input md:col-span-2" placeholder="Name" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} />
                    <input className="input md:col-span-2" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                    <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                    <input className="input" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                    <input className="input" type="number" placeholder="Price" value={item.price} onChange={(e) => updateItem(idx, "price", Number(e.target.value))} />
                    <div className="flex items-center justify-between md:col-span-2">
                      <span className="text-xs text-slate-500">Line total: {(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</span>
                      {items.length > 1 && (
                        <button type="button" className="text-sm text-red-500" onClick={() => removeItem(idx)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ),
            isValid: items.length > 0 && items.every((i) => i.name && i.quantity > 0),
          },
          {
            title: "Pricing",
            content: (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Total: ETB {totals.total.toFixed(2)}</p>
                <textarea className="input" placeholder="Description / scope" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
              </div>
            ),
            isValid: true,
          },
          {
            title: "Schedule",
            content: (
              <div className="grid gap-2 md:grid-cols-2">
                <input className="input" type="date" value={meta.deadline} onChange={(e) => setMeta({ ...meta, deadline: e.target.value })} />
                <select className="input" value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: e.target.value })}>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
                <input
                  className="input"
                  type="number"
                  placeholder="Advance payment"
                  value={meta.advancePayment}
                  onChange={(e) => setMeta({ ...meta, advancePayment: Number(e.target.value) })}
                />
                <input className="input" placeholder="Artwork path" value={meta.artworkPath} onChange={(e) => setMeta({ ...meta, artworkPath: e.target.value })} />
                <textarea className="input md:col-span-2" placeholder="Admin notes" value={meta.adminNotes} onChange={(e) => setMeta({ ...meta, adminNotes: e.target.value })} />
              </div>
            ),
            isValid: true,
          },
          {
            title: "Review",
            content: (
              <div className="space-y-3">
                <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p>Customer: {selectedCustomer?.name || newCustomer.name || "New customer"}</p>
                  <p>Proforma: {proformaNumber || "None"}</p>
                  <p>Items: {items.length} lines • Total ETB {totals.total.toFixed(2)}</p>
                  <p>
                    Deadline: {meta.deadline || "N/A"} • Priority: {meta.priority} • Advance: ETB {Number(meta.advancePayment || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ),
            isValid: true,
          },
        ]}
        current={stepIndex}
        onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
        onNext={() => setStepIndex((i) => Math.min(5, i + 1))}
        onSave={submit}
      />

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Job Orders</h3>
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={() => setWizardOpen(true)}>
              New Job Order
            </button>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
        </div>
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{job.number}</p>
                  <p className="text-xs text-slate-500">
                    {job.customerSnapshot?.name || job.customer?.name || ""} • {job.proforma?.number || "Manual"} •{" "}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{job.status}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs capitalize">{job.priority}</span>
                  <button className="btn bg-slate-700 hover:bg-slate-600" onClick={() => printJob(job.id)} type="button">
                    Print
                  </button>
                  <button className="btn bg-emerald-600 hover:bg-emerald-500" onClick={() => approve(job.id)} disabled={job.status !== "pending_approval"} type="button">
                    Approve
                  </button>
                  <button className="btn bg-blue-600 hover:bg-blue-500" onClick={() => production(job.id, "in_progress")} type="button">
                    Start
                  </button>
                  <button className="btn bg-indigo-600 hover:bg-indigo-500" onClick={() => production(job.id, "completed")} type="button">
                    Complete
                  </button>
                  <button className="btn bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => finance(job.id, "finance_review")} type="button">
                    Finance
                  </button>
                  <button className="btn bg-slate-900 hover:bg-slate-800" onClick={() => finance(job.id, "closed")} type="button">
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                {job.jobItems?.slice(0, 4).map((it) => (
                  <div key={it.id} className="rounded bg-slate-50 px-2 py-1 text-xs dark:bg-slate-900/60">
                    {it.name} — {it.quantity} x {it.price}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {jobs.length === 0 && <p className="text-xs text-slate-500">No jobs yet</p>}
        </div>
      </div>
    </div>
  );
}
