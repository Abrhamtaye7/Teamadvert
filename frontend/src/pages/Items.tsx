import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { itemSchema } from "@shared/schemas";

type Item = {
  id: number;
  itemId: string;
  name: string;
  category?: { id: number; name: string };
  measurementUnit?: { id: number; unitName: string };
  basePrice?: number;
};

type Category = { id: number; name: string };
type Unit = { id: number; unitName: string };
type CustomerPriceEntry = { customerId: number; price: number };
type SupplierPriceEntry = { supplierId: number; price: number };

const steps = ["Basic Info", "Pricing", "Review"] as const;

export default function Items() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [filters, setFilters] = useState({ q: "", categoryId: "", unitId: "", amountMin: "", amountMax: "" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<(typeof steps)[number]>("Basic Info");
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    measurementUnitId: "",
    description: "",
    basePrice: 0,
    customerPrices: [] as CustomerPriceEntry[],
    supplierPrices: [] as SupplierPriceEntry[],
  });
  const [customerPriceInput, setCustomerPriceInput] = useState({ customerId: "", price: "" });
  const [supplierPriceInput, setSupplierPriceInput] = useState({ supplierId: "", price: "" });
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes, unitsRes] = await Promise.all([
        api.get("/items", { params: filters }),
        api.get("/items/categories").catch(() => ({ data: [] })),
        api.get("/items/units").catch(() => ({ data: [] })),
      ]);
      setItems(itemsRes.data.data || itemsRes.data);
      setCategories(catsRes.data.data || catsRes.data || []);
      setUnits(unitsRes.data.data || unitsRes.data || []);
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

  const addCategory = async (name: string) => {
    if (!name.trim()) return;
    const res = await api.post("/items/categories", { name });
    setCategories((prev) => [...prev, res.data]);
    setForm((f) => ({ ...f, categoryId: String(res.data.id) }));
  };

  const addUnit = async (unitName: string) => {
    if (!unitName.trim()) return;
    const res = await api.post("/items/units", { unitName });
    setUnits((prev) => [...prev, res.data]);
    setForm((f) => ({ ...f, measurementUnitId: String(res.data.id) }));
  };

  const addCustomerPrice = () => {
    if (!customerPriceInput.customerId || !customerPriceInput.price) return;
    setForm((f) => ({
      ...f,
      customerPrices: [...f.customerPrices, { customerId: Number(customerPriceInput.customerId), price: Number(customerPriceInput.price) }],
    }));
    setCustomerPriceInput({ customerId: "", price: "" });
  };

  const addSupplierPrice = () => {
    if (!supplierPriceInput.supplierId || !supplierPriceInput.price) return;
    setForm((f) => ({
      ...f,
      supplierPrices: [...f.supplierPrices, { supplierId: Number(supplierPriceInput.supplierId), price: Number(supplierPriceInput.price) }],
    }));
    setSupplierPriceInput({ supplierId: "", price: "" });
  };

  const submit = async () => {
    setMessage(null);
    const payload: any = {
      name: form.name,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      measurementUnitId: form.measurementUnitId ? Number(form.measurementUnitId) : undefined,
      basePrice: Number(form.basePrice || 0),
      customerPrices: form.customerPrices,
      supplierPrices: form.supplierPrices,
      notes: form.description || undefined,
    };
    const parsed = itemSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    await api.post("/items", payload);
    setMessage("Item saved");
    setForm({ name: "", categoryId: "", measurementUnitId: "", description: "", basePrice: 0, customerPrices: [], supplierPrices: [] });
    setStep("Basic Info");
    load();
  };

  const canGoPricing = form.name.trim().length > 0 && !!form.categoryId && !!form.measurementUnitId;
  const reviewData = useMemo(
    () => ({
      name: form.name,
      category: categories.find((c) => String(c.id) === form.categoryId)?.name,
      unit: units.find((u) => String(u.id) === form.measurementUnitId)?.unitName,
      basePrice: form.basePrice,
      customerPrices: form.customerPrices,
      supplierPrices: form.supplierPrices,
      description: form.description,
    }),
    [form, categories, units]
  );

  const openProfile = async (id: number) => {
    const res = await api.get(`/items/${id}/profile`);
    const i = res.data;
    alert(
      `${i.itemId} - ${i.name}\nCategory: ${i.category?.name || "-"}\nUnit: ${i.measurementUnit?.unitName || "-"}\nBase: ${i.basePrice || i.sellingPrice || 0}\nCustomer price logs: ${
        i.customerPriceHistory?.length || 0
      }\nSupplier price logs: ${i.supplierPriceHistory?.length || 0}`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Items & Pricing</h2>
          <p className="text-sm text-slate-500">Wizard-based creation with pricing logs.</p>
        </div>
        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <input className="input" placeholder="Search name/ITEM" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <input className="input" type="number" placeholder="Price min" value={filters.amountMin} onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })} />
          <input className="input" type="number" placeholder="Price max" value={filters.amountMax} onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })} />
        </div>

        <div className="flex gap-2 text-sm font-semibold">
          {steps.map((s) => (
            <button key={s} type="button" onClick={() => setStep(s)} className={`rounded-full px-3 py-1 ${step === s ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`}>
              {s}
            </button>
          ))}
        </div>

        {step === "Basic Info" && (
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="text-sm text-slate-600">Item name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-slate-600">Category</label>
              <div className="flex gap-2">
                <select className="input w-full" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const name = prompt("New category name");
                    if (name) addCategory(name);
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-600">Measurement unit</label>
              <div className="flex gap-2">
                <select className="input w-full" value={form.measurementUnitId} onChange={(e) => setForm({ ...form, measurementUnitId: e.target.value })}>
                  <option value="">Select unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const u = prompt("New unit");
                    if (u) addUnit(u);
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-slate-600">Description</label>
              <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <button type="button" className="btn md:col-span-2" disabled={!canGoPricing} onClick={() => setStep("Pricing")}>
              Next: Pricing
            </button>
          </div>
        )}

        {step === "Pricing" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-600">Global selling price</label>
              <input className="input" type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-semibold">Customer-specific prices</p>
                <div className="flex gap-2">
                  <input className="input" placeholder="Customer ID" value={customerPriceInput.customerId} onChange={(e) => setCustomerPriceInput({ ...customerPriceInput, customerId: e.target.value })} />
                  <input className="input" type="number" placeholder="Price" value={customerPriceInput.price} onChange={(e) => setCustomerPriceInput({ ...customerPriceInput, price: e.target.value })} />
                  <button type="button" className="btn" onClick={addCustomerPrice}>
                    Add
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {form.customerPrices.map((cp, idx) => (
                    <li key={idx}>CID {cp.customerId}: {cp.price}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-semibold">Supplier purchase prices</p>
                <div className="flex gap-2">
                  <input className="input" placeholder="Supplier ID" value={supplierPriceInput.supplierId} onChange={(e) => setSupplierPriceInput({ ...supplierPriceInput, supplierId: e.target.value })} />
                  <input className="input" type="number" placeholder="Price" value={supplierPriceInput.price} onChange={(e) => setSupplierPriceInput({ ...supplierPriceInput, price: e.target.value })} />
                  <button type="button" className="btn" onClick={addSupplierPrice}>
                    Add
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {form.supplierPrices.map((sp, idx) => (
                    <li key={idx}>SID {sp.supplierId}: {sp.price}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={() => setStep("Review")}>
                Next: Review
              </button>
              <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Basic Info")}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === "Review" && (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-semibold">Review</p>
              <p>Item ID: will auto-generate ITEM####</p>
              <p>Name: {reviewData.name}</p>
              <p>Category: {reviewData.category}</p>
              <p>Unit: {reviewData.unit}</p>
              <p>Base price: {reviewData.basePrice}</p>
              <p>Customer prices: {reviewData.customerPrices.length}</p>
              <p>Supplier prices: {reviewData.supplierPrices.length}</p>
              <p>Description: {reviewData.description}</p>
            </div>
            {message && <p className="text-sm text-emerald-600">{message}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={submit}>
                Confirm & Save Item
              </button>
              <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Pricing")}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Items</h3>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800 flex items-center justify-between" onClick={() => openProfile(item.id)}>
              <div>
                <p className="font-semibold">{item.itemId}</p>
                <p className="text-xs text-slate-500">{item.name}</p>
                <p className="text-xs text-slate-500">{item.category?.name || "No category"} • {item.measurementUnit?.unitName || "No unit"}</p>
              </div>
              <div className="text-right text-xs text-slate-500">Base: {item.basePrice ?? 0}</div>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-slate-500">No items yet</p>}
        </div>
      </div>
    </div>
  );
}
