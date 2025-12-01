import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { supplierSchema } from "@shared/schemas";
import { SearchPanel } from "../components/SearchPanel";

type Supplier = {
  id: number;
  supplierId: string;
  companyName: string;
  contactPerson?: string;
  phones?: string[];
  email?: string;
  address?: any;
  priceHistory?: any[];
  notes?: any[];
};

const supplierSteps = ["Basic Info", "Categories", "Review"] as const;

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filters, setFilters] = useState({ q: "" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<(typeof supplierSteps)[number]>("Basic Info");
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    phones: "",
    email: "",
    address: { region: "", city: "", subcity: "", woreda: "", house: "" },
    categories: "",
  });
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/suppliers", { params: { q: filters.q } });
      setSuppliers(res.data);
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

  const saveSupplier = async () => {
    const payload = {
      supplierId: "TEMP",
      companyName: form.companyName,
      contactPerson: form.contactPerson || undefined,
      phone: form.phones,
      email: form.email || undefined,
      address: JSON.stringify(form.address),
    } as any;
    const parsed = supplierSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const res = await api.post("/suppliers", parsed.data);
    setSelected(res.data);
    setStep("Basic Info");
    setForm({ companyName: "", contactPerson: "", phones: "", email: "", address: { region: "", city: "", subcity: "", woreda: "", house: "" }, categories: "" });
    load();
  };

  const supplierProfile = useMemo(
    () =>
      selected && (
        <div className="space-y-3">
          <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm text-slate-500">SID</p>
            <p className="text-xl font-semibold">{selected.supplierId}</p>
            <p className="text-sm text-slate-500">{selected.companyName}</p>
            <p className="text-sm text-slate-500">Contact: {selected.contactPerson || "-"}</p>
            <p className="text-sm text-slate-500">Phones: {Array.isArray(selected.phones) ? selected.phones.join(", ") : ""}</p>
          </div>
          <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="font-semibold">Price History</p>
            <div className="space-y-1">
              {selected.priceHistory?.slice(0, 5).map((h) => (
                <div key={h.id} className="text-xs text-slate-500">
                  {h.item?.name}: {h.oldPrice} → {h.newPrice} ({new Date(h.createdAt).toLocaleDateString()})
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    [selected]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Suppliers</h2>
          <p className="text-sm text-slate-500">Wizard-based creation, live search, profile view.</p>
        </div>
        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>

      <div className="card space-y-3">
        <SearchPanel>
          <input className="input" placeholder="Search SID/company/contact" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <button className="btn bg-slate-700 hover:bg-slate-600" type="button" onClick={() => setFilters({ q: "" })}>Clear Filters</button>
        </SearchPanel>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex gap-2 text-sm font-semibold">
              {supplierSteps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={`rounded-full px-3 py-1 ${step === s ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {s}
                </button>
              ))}
            </div>

            {step === "Basic Info" && (
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">Company name</label>
                  <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Contact name</label>
                  <input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Phones</label>
                  <input className="input" placeholder="Comma separated" value={form.phones} onChange={(e) => setForm({ ...form, phones: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Email</label>
                  <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
                  <label className="text-sm text-slate-600">House</label>
                  <input className="input" value={form.address.house} onChange={(e) => setForm({ ...form, address: { ...form.address, house: e.target.value } })} />
                </div>
                <button type="button" className="btn md:col-span-2" onClick={() => setStep("Categories")}>Next</button>
              </div>
            )}

            {step === "Categories" && (
              <div className="space-y-2">
                <div>
                  <label className="text-sm text-slate-600">Categories (optional)</label>
                  <input className="input" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={() => setStep("Review")}>Next</button>
                  <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Basic Info")}>
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === "Review" && (
              <div className="space-y-3">
                <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-semibold">Preview SID</p>
                  <p className="text-slate-500">Will auto-generate next SID#### on save.</p>
                  <p>
                    {form.companyName} • Contact: {form.contactPerson || "-"} • Phones: {form.phones}
                  </p>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={saveSupplier}>
                    Save Supplier
                  </button>
                  <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Categories")}>
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>{supplierProfile}</div>
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Suppliers</h3>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800" onClick={() => setSelected(s)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{s.supplierId}</p>
                  <p className="text-xs text-slate-500">{s.companyName}</p>
                </div>
                <p className="text-xs text-slate-500">Contact: {s.contactPerson || "-"}</p>
              </div>
              <p className="text-xs text-slate-500">Phones: {Array.isArray(s.phones) ? s.phones.join(", ") : ""}</p>
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-xs text-slate-500">No suppliers yet</p>}
        </div>
      </div>
    </div>
  );
}
