import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { customerSchema } from "@shared/schemas";
import { SearchPanel } from "../components/SearchPanel";
import { WizardModal } from "../components/WizardModal";
import TabHeader from "../components/TabHeader";


type Customer = {
  id: number;
  customerId: string;
  name: string;
  company?: string;
  phones?: string[];
  email?: string;
  tin?: string;
  address?: any;
  standing?: string;
  _count?: { proformas: number; jobs: number };
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filters, setFilters] = useState({ q: "", phone: "", tin: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    phones: "",
    email: "",
    tin: "",
    address: { region: "", city: "", subcity: "", woreda: "", house: "" },
    contactPerson: "",
    social: "",
  });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/customers", { params: filters });
      setCustomers(res.data.data || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const canProceedBasic = form.name.trim().length > 0 && form.phones.trim().length > 0;

  const saveCustomer = async () => {
    const payload = {
      customerId: "TEMP",
      name: form.name,
      company: form.company || undefined,
      phone: form.phones,
      email: form.email || undefined,
      tin: form.tin || undefined,
      addressRegion: form.address.region || undefined,
      addressCity: form.address.city || undefined,
      addressSubcity: form.address.subcity || undefined,
      addressWoreda: form.address.woreda || undefined,
      addressHouse: form.address.house || undefined,
    };
    const parsed = customerSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const res = await api.post("/customers", parsed.data);
    setSelected(res.data);
    setForm({
      name: "",
      company: "",
      phones: "",
      email: "",
      tin: "",
      address: { region: "", city: "", subcity: "", woreda: "", house: "" },
      contactPerson: "",
      social: "",
    });
    setWizardOpen(false);
    setStepIndex(0);
    load();
  };

  const steps = [
    {
      title: "Basic Info",
      content: (
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-600">Full name *</label>
            <input className={`input ${!form.name ? "border-red-500" : ""}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Company</label>
            <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Phone(s) *</label>
            <input
              className={`input ${!form.phones ? "border-red-500" : ""}`}
              placeholder="Comma separated"
              value={form.phones}
              onChange={(e) => setForm({ ...form, phones: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">TIN</label>
            <input className="input" value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Region</label>
            <input
              className="input"
              value={form.address.region}
              onChange={(e) => setForm({ ...form, address: { ...form.address, region: e.target.value } })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">City</label>
            <input className="input" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Sub-city</label>
            <input
              className="input"
              value={form.address.subcity}
              onChange={(e) => setForm({ ...form, address: { ...form.address, subcity: e.target.value } })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Woreda</label>
            <input
              className="input"
              value={form.address.woreda}
              onChange={(e) => setForm({ ...form, address: { ...form.address, woreda: e.target.value } })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">House number</label>
            <input
              className="input"
              value={form.address.house}
              onChange={(e) => setForm({ ...form, address: { ...form.address, house: e.target.value } })}
            />
          </div>
        </div>
      ),
      isValid: canProceedBasic,
    },
    {
      title: "Contact Details",
      content: (
        <div className="space-y-2">
          <div>
            <label className="text-sm text-slate-600">Contact person</label>
            <input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Social links</label>
            <input className="input" value={form.social} onChange={(e) => setForm({ ...form, social: e.target.value })} />
          </div>
        </div>
      ),
      isValid: true,
    },
    {
      title: "Review & Confirm",
      content: (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">CID will auto-generate</p>
          <p>
            {form.name} {form.company ? `(${form.company})` : ""} • Phones: {form.phones}
          </p>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      ),
      isValid: true,
    },
  ];

  const customerProfile = useMemo(
    () =>
      selected && (
        <div className="space-y-3">
          <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">CID</p>
            <p className="text-xl font-semibold">{selected.customerId}</p>
            <p className="text-sm text-slate-500">
              {selected.name} {selected.company ? `— ${selected.company}` : ""}
            </p>
            <p className="text-sm text-slate-500">Phones: {Array.isArray(selected.phones) ? selected.phones.join(", ") : ""}</p>
            <p className="text-sm text-slate-500">Email: {selected.email}</p>
          </div>
          <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="font-semibold">History</p>
            <p>Proformas: {selected._count?.proformas ?? 0}</p>
            <p>Jobs: {selected._count?.jobs ?? 0}</p>
          </div>
        </div>
      ),
    [selected]
  );

  return (
    <div className="space-y-4">
      <TabHeader
        title="Customer CRM"
        searchPlaceholder="Search name/CID/company"
        value={filters.q}
        onSearch={(q) => setFilters({ ...filters, q })}
        onFilter={() => setShowFilters((s) => !s)}
        onOpenNew={() => setWizardOpen(true)}
        loading={loading}
        newLabel={"New Customer"}
      />

      <WizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        steps={steps}
        current={stepIndex}
        onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
        onNext={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
        onSave={saveCustomer}
      />

      {showFilters && (
        <div className="card space-y-3">
          <SearchPanel>
            <input className="input" placeholder="Search name/CID/company" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <input className="input" placeholder="Phone" value={filters.phone} onChange={(e) => setFilters({ ...filters, phone: e.target.value })} />
            <input className="input" placeholder="TIN" value={filters.tin} onChange={(e) => setFilters({ ...filters, tin: e.target.value })} />
            <input className="input" placeholder="Email" value={filters.email} onChange={(e) => setFilters({ ...filters, email: e.target.value })} />
            <button className="btn bg-slate-700 hover:bg-slate-600" type="button" onClick={() => setFilters({ q: "", phone: "", tin: "", email: "" })}>
              Clear Filters
            </button>
          </SearchPanel>
        </div>
      )}

      <div className="card space-y-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Customers</h3>
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={() => setWizardOpen(true)}>
              New Customer
            </button>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">{customerProfile}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">CID</th>
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Company</th>
                  <th className="px-2 py-1">Phones</th>
                  <th className="px-2 py-1">Proformas</th>
                  <th className="px-2 py-1">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800" onClick={() => setSelected(c)}>
                    <td className="px-2 py-2 font-semibold">{c.customerId}</td>
                    <td className="px-2 py-2">{c.name}</td>
                    <td className="px-2 py-2">{c.company || "-"}</td>
                    <td className="px-2 py-2">{Array.isArray(c.phones) ? c.phones.join(", ") : ""}</td>
                    <td className="px-2 py-2 text-center">{c._count?.proformas ?? 0}</td>
                    <td className="px-2 py-2 text-center">{c._count?.jobs ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
