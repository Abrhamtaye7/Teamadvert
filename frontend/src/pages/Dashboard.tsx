import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { StatCard } from "../components/StatCard";
import { useNavigate } from "react-router-dom";
import RecordingWizard from "../components/RecordingWizard";

type Job = {
  id: number;
  number: string;
  description?: string;
  status: string;
  productionStatus?: string;
  financeStatus?: string;
  price?: number;
};
type Proforma = { id: number; number: string; status: string; amountInWords?: string };
type Payment = { id: number; amount: number; transactionNumber?: string; verified?: boolean };
type Customer = { id: number; name: string; outstandingBalance?: number; company?: string };

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  // navigation is not used now because buttons open modals directly
  // keep hook available for future uses
  useNavigate();
  const [showCustomerWizard, setShowCustomerWizard] = useState(false);
  const [custForm, setCustForm] = useState({ name: "", company: "", phones: "", email: "", tin: "" });
  const [custLoading, setCustLoading] = useState(false);
  const [showSupplierWizard, setShowSupplierWizard] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ companyName: "", contactPerson: "", phones: "", email: "" });
  const [supplierLoading, setSupplierLoading] = useState(false);

  const saveSupplierFromDashboard = async () => {
    setSupplierLoading(true);
    try {
      const payload: any = {
        supplierId: "TEMP",
        companyName: supplierForm.companyName,
        contactPerson: supplierForm.contactPerson || undefined,
        phone: supplierForm.phones,
        email: supplierForm.email || undefined,
        address: "{}",
      };
      await api.post("/suppliers", payload);
      setShowSupplierWizard(false);
      setSupplierForm({ companyName: "", contactPerson: "", phones: "", email: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setSupplierLoading(false);
    }
  };

  const [showItemWizard, setShowItemWizard] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", basePrice: 0 });
  const [itemLoading, setItemLoading] = useState(false);
  const saveItemFromDashboard = async () => {
    setItemLoading(true);
    try {
      const payload: any = { name: itemForm.name, basePrice: Number(itemForm.basePrice) };
      await api.post("/items", payload);
      setShowItemWizard(false);
      setItemForm({ name: "", basePrice: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setItemLoading(false);
    }
  };

  const [showProformaWizard, setShowProformaWizard] = useState(false);
  const [proformaForm, setProformaForm] = useState({ customerName: "", notes: "" });
  const [proformaLoading, setProformaLoading] = useState(false);
  const saveProformaFromDashboard = async () => {
    setProformaLoading(true);
    try {
      const payload: any = {
        // Create a minimal proforma (server may accept this as draft)
        customerNew: { name: proformaForm.customerName },
        items: [{ name: "Quick Item", quantity: 1, sellingPrice: 0, vatPercent: 15 }],
        notes: proformaForm.notes || undefined,
      };
      await api.post("/proformas", payload);
      setShowProformaWizard(false);
      setProformaForm({ customerName: "", notes: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setProformaLoading(false);
    }
  };

  const [showJobWizard, setShowJobWizard] = useState(false);
  const [jobForm, setJobForm] = useState({ customerName: "", description: "" });
  const [jobLoading, setJobLoading] = useState(false);
  const saveJobFromDashboard = async () => {
    setJobLoading(true);
    try {
      const payload: any = {
        customerNew: { name: jobForm.customerName },
        jobItems: [{ name: "Quick Item", quantity: 1, price: 0 }],
        description: jobForm.description || undefined,
      };
      await api.post("/jobs", payload);
      setShowJobWizard(false);
      setJobForm({ customerName: "", description: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setJobLoading(false);
    }
  };

  const saveCustomerFromDashboard = async () => {
    setCustLoading(true);
    try {
      const payload: any = {
        customerId: "TEMP",
        name: custForm.name,
        phone: custForm.phones,
        company: custForm.company || undefined,
        email: custForm.email || undefined,
        tin: custForm.tin || undefined,
      };
      await api.post("/customers", payload);
      setShowCustomerWizard(false);
      setCustForm({ name: "", company: "", phones: "", email: "", tin: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setCustLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [jobsRes, proformasRes, paymentsRes, customersRes] = await Promise.all([
          api.get("/jobs", { params: { pageSize: 20 } }),
          api.get("/proformas", { params: { pageSize: 20 } }),
          api.get("/payments"),
          api.get("/customers", { params: { pageSize: 20 } }),
        ]);
        setJobs(jobsRes.data.data || jobsRes.data);
        setProformas(proformasRes.data.data || proformasRes.data);
        setPayments(paymentsRes.data);
        setCustomers(customersRes.data.data || customersRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const overview = useMemo(() => {
    const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paidVerified = payments.filter((p) => p.verified).length;
    const jobActive = jobs.filter((j) => j.productionStatus === "InProgress" || j.status === "Approved").length;
    const jobCompleted = jobs.filter((j) => j.productionStatus === "Completed" || j.status === "Completed").length;
    const approvalsPending =
      proformas.filter((p) => p.status === "Draft").length + jobs.filter((j) => j.status === "AwaitingApproval").length;
    return {
      paymentTotal,
      paidVerified,
      jobActive,
      jobCompleted,
      approvalsPending,
    };
  }, [jobs, proformas, payments]);

  const pipeline = {
    awaiting: jobs.filter((j) => j.status === "AwaitingApproval"),
    production: jobs.filter((j) => j.productionStatus === "InProgress"),
    finance: jobs.filter((j) => j.financeStatus === "Pending" || j.financeStatus === "Partial"),
    completed: jobs.filter((j) => j.status === "Completed" || j.productionStatus === "Completed"),
  };

  const recentProformas = proformas.slice(0, 6);
  const topCustomers = customers
    .map((c) => ({ ...c, outstanding: Number(c.outstandingBalance || 0) }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-primary to-teal-500 p-6 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm uppercase tracking-wide text-white/70">Operations dashboard</p>
            <h2 className="text-3xl font-semibold">TEAM ADVERT Command Center</h2>
            <p className="text-sm text-white/80">Live view of jobs, payments, approvals, and CRM health.</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="text-white/80">Pending approvals</p>
            <p className="text-2xl font-bold">{overview.approvalsPending}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setShowCustomerWizard(true)}>New Customer</button>
        <button className="btn" onClick={() => setShowProformaWizard(true)}>New Proforma</button>
        <button className="btn" onClick={() => setShowJobWizard(true)}>New Job Order</button>
        <button className="btn" onClick={() => setShowSupplierWizard(true)}>New Supplier</button>
        <button className="btn" onClick={() => setShowItemWizard(true)}>New Item</button>
      </div>

      <RecordingWizard title="New Customer" isOpen={showCustomerWizard} onClose={() => setShowCustomerWizard(false)} onSave={saveCustomerFromDashboard} saveLabel={custLoading ? "Saving..." : "Save Customer"}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Full name *</label>
            <input className="input" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Company</label>
            <input className="input" value={custForm.company} onChange={(e) => setCustForm({ ...custForm, company: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Phone(s) *</label>
            <input className="input" placeholder="Comma separated" value={custForm.phones} onChange={(e) => setCustForm({ ...custForm, phones: e.target.value })} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="text-sm text-slate-600">Email</label>
              <input className="input" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-slate-600">TIN</label>
              <input className="input" value={custForm.tin} onChange={(e) => setCustForm({ ...custForm, tin: e.target.value })} />
            </div>
          </div>
        </div>
      </RecordingWizard>

      <RecordingWizard title="New Supplier" isOpen={showSupplierWizard} onClose={() => setShowSupplierWizard(false)} onSave={saveSupplierFromDashboard} saveLabel={supplierLoading ? "Saving..." : "Save Supplier"}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Company *</label>
            <input className="input" value={supplierForm.companyName} onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Contact person</label>
            <input className="input" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Phones</label>
            <input className="input" value={supplierForm.phones} onChange={(e) => setSupplierForm({ ...supplierForm, phones: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input className="input" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
          </div>
        </div>
      </RecordingWizard>

      <RecordingWizard title="New Item" isOpen={showItemWizard} onClose={() => setShowItemWizard(false)} onSave={saveItemFromDashboard} saveLabel={itemLoading ? "Saving..." : "Save Item"}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Name *</label>
            <input className="input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Base price</label>
            <input className="input" type="number" value={itemForm.basePrice} onChange={(e) => setItemForm({ ...itemForm, basePrice: Number(e.target.value) })} />
          </div>
        </div>
      </RecordingWizard>

      <RecordingWizard title="New Proforma" isOpen={showProformaWizard} onClose={() => setShowProformaWizard(false)} onSave={saveProformaFromDashboard} saveLabel={proformaLoading ? "Saving..." : "Save Proforma"}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Customer name</label>
            <input className="input" value={proformaForm.customerName} onChange={(e) => setProformaForm({ ...proformaForm, customerName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Notes</label>
            <input className="input" value={proformaForm.notes} onChange={(e) => setProformaForm({ ...proformaForm, notes: e.target.value })} />
          </div>
        </div>
      </RecordingWizard>

      <RecordingWizard title="New Job" isOpen={showJobWizard} onClose={() => setShowJobWizard(false)} onSave={saveJobFromDashboard} saveLabel={jobLoading ? "Saving..." : "Save Job"}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Customer name</label>
            <input className="input" value={jobForm.customerName} onChange={(e) => setJobForm({ ...jobForm, customerName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Description</label>
            <input className="input" value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} />
          </div>
        </div>
      </RecordingWizard>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Active Jobs" value={overview.jobActive} />
        <StatCard title="Completed Jobs" value={overview.jobCompleted} />
        <StatCard title="Payments Collected" value={`ETB ${overview.paymentTotal.toFixed(2)}`} />
        <StatCard title="Verified Receipts" value={overview.paidVerified} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Job Pipeline</h3>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Awaiting Admin", color: "text-amber-600", list: pipeline.awaiting },
              { label: "In Production", color: "text-blue-600", list: pipeline.production },
              { label: "Finance Pending", color: "text-fuchsia-600", list: pipeline.finance },
              { label: "Completed", color: "text-emerald-600", list: pipeline.completed },
            ].map((col) => (
              <div key={col.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className={`mb-2 text-sm font-semibold ${col.color}`}>{col.label}</div>
                <div className="space-y-2">
                  {col.list.slice(0, 4).map((job) => (
                    <div key={job.id} className="rounded-md bg-slate-50 px-2 py-1 text-xs dark:bg-slate-800">
                      <div className="font-semibold text-slate-800 dark:text-white">{job.number}</div>
                      <div className="text-slate-500">{job.description || "—"}</div>
                    </div>
                  ))}
                  {col.list.length === 0 && <p className="text-xs text-slate-400">No items</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Finance Snapshot</h3>
            <span className="text-xs text-slate-500">Latest payments</span>
          </div>
          <div className="space-y-2">
            {payments.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div>
                  <p className="font-semibold">ETB {Number(p.amount || 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-500">TX: {p.transactionNumber || "N/A"}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${p.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.verified ? "Verified" : "Pending"}
                </span>
              </div>
            ))}
            {payments.length === 0 && <p className="text-xs text-slate-400">No payments yet</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Proformas</h3>
            <span className="text-xs text-slate-500">Recent</span>
          </div>
          <div className="space-y-2">
            {recentProformas.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div>
                  <p className="font-semibold">{p.number}</p>
                  <p className="text-xs text-slate-500">Status: {p.status}</p>
                </div>
                <span className="text-xs text-slate-500">{p.amountInWords || ""}</span>
              </div>
            ))}
            {recentProformas.length === 0 && <p className="text-xs text-slate-400">No proformas yet</p>}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Customers</h3>
            <span className="text-xs text-slate-500">Outstanding balance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Company</th>
                  <th className="px-2 py-1 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 font-medium">{c.name}</td>
                    <td className="px-2 py-2">{c.company || "—"}</td>
                    <td className="px-2 py-2 text-right">ETB {Number(c.outstandingBalance || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-center text-xs text-slate-400">
                      No customer data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
