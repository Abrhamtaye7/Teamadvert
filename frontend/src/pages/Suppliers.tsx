import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { supplierSchema } from "@shared/schemas";
import { SearchPanel } from "../components/SearchPanel";
import TabHeader from "../components/TabHeader";
import RecordingWizard from "../components/RecordingWizard";

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

type SupplierItemDetail = {
  itemId: number;
  name: string;
  price: number;
  description?: string;
  updatedAt?: string;
};

type SupplierDetail = Supplier & {
  items?: SupplierItemDetail[];
};

const supplierSteps = ["Basic Info", "Categories", "Items", "Review"] as const;

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
  const [selectedDetail, setSelectedDetail] = useState<SupplierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardItems, setWizardItems] = useState<Array<{ name: string; price: string }>>([{ name: "", price: "" }]);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [priceSaving, setPriceSaving] = useState<Record<number, boolean>>({});
  const [newItemEntry, setNewItemEntry] = useState({ name: "", price: "" });
  const [addingItem, setAddingItem] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const addWizardItemRow = () => setWizardItems((prev) => [...prev, { name: "", price: "" }]);
  const updateWizardItemRow = (index: number, field: "name" | "price", value: string) => {
    setWizardItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
  };
  const removeWizardItemRow = (index: number) => {
    setWizardItems((prev) => {
      if (prev.length <= 1) return [{ name: "", price: "" }];
      return prev.filter((_, idx) => idx !== index);
    });
  };
  const handlePriceInput = (itemId: number, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [itemId]: value }));
  };
  const updateItemPrice = async (item: SupplierItemDetail) => {
    if (!selected) return;
    const value = Number(priceDrafts[item.itemId]);
    if (!Number.isFinite(value) || value <= 0) {
      setDetailError("Enter a valid price before saving.");
      return;
    }
    setDetailError(null);
    setPriceSaving((prev) => ({ ...prev, [item.itemId]: true }));
    try {
      await api.post(`/suppliers/${selected.id}/items`, {
        items: [{ itemId: item.itemId, name: item.name, price: value }],
      });
      await selectSupplier(selected, false);
    } catch (err) {
      console.error(err);
      setDetailError("Failed to update price.");
    } finally {
      setPriceSaving((prev) => ({ ...prev, [item.itemId]: false }));
    }
  };
  const addSupplierItem = async () => {
    if (!selected) return;
    const name = newItemEntry.name.trim();
    const value = Number(newItemEntry.price);
    if (!name || !Number.isFinite(value) || value <= 0) {
      setDetailError("Provide an item name and valid price.");
      return;
    }
    setDetailError(null);
    setAddingItem(true);
    try {
      await api.post(`/suppliers/${selected.id}/items`, { items: [{ name, price: value }] });
      setNewItemEntry({ name: "", price: "" });
      await selectSupplier(selected, false);
    } catch (err) {
      console.error(err);
      setDetailError("Failed to add item.");
    } finally {
      setAddingItem(false);
    }
  };

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
    try {
      const res = await api.post("/suppliers", parsed.data);
      const normalizedItems = wizardItems
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
        .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);
      if (normalizedItems.length) {
        await api.post(`/suppliers/${res.data.id}/items`, { items: normalizedItems });
      }
      await selectSupplier(res.data);
      setStep("Basic Info");
      setForm({ companyName: "", contactPerson: "", phones: "", email: "", address: { region: "", city: "", subcity: "", woreda: "", house: "" }, categories: "" });
      setWizardItems([{ name: "", price: "" }]);
      setError(null);
      load();
      setWizardOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save supplier. Please try again.");
    }
  };

  const supplierDetailPanel =
    selected && selectedDetail ? (
      <div className="space-y-3">
        <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm text-slate-500">SID</p>
          <p className="text-xl font-semibold">{selected.supplierId}</p>
          <p className="text-sm text-slate-500">{selected.companyName}</p>
          <p className="text-sm text-slate-500">Contact: {selected.contactPerson || "-"}</p>
          <p className="text-sm text-slate-500">Phones: {Array.isArray(selected.phones) ? selected.phones.join(", ") : ""}</p>
          {selected.email && <p className="text-sm text-slate-500">Email: {selected.email}</p>}
          {selected.address && <p className="text-sm text-slate-500">Address: {JSON.stringify(selected.address)}</p>}
        </div>
        <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Supplier Items</p>
            {detailLoading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
          {selectedDetail.items && selectedDetail.items.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-auto">
              {selectedDetail.items.map((item) => (
                <div key={item.itemId} className="rounded border border-slate-100 p-2 text-xs dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-700">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Current: ETB {item.price.toFixed(2)}
                        {item.updatedAt ? ` · Updated ${new Date(item.updatedAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input input-sm"
                        placeholder="New price"
                        value={priceDrafts[item.itemId] ?? ""}
                        onChange={(e) => handlePriceInput(item.itemId, e.target.value)}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => updateItemPrice(item)} disabled={priceSaving[item.itemId]}>
                        {priceSaving[item.itemId] ? "Saving..." : "Update"}
                      </button>
                    </div>
                  </div>
                  {item.description && <p className="mt-1 text-slate-500">{item.description}</p>}
                </div>
              ))}
            </div>
          ) : detailLoading ? null : (
            <p className="text-xs text-slate-400">No items listed for this supplier.</p>
          )}
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <p className="font-semibold">Add Item</p>
            {detailError && <p className="text-[11px] text-red-500">{detailError}</p>}
            <div className="flex flex-wrap gap-2">
              <input
                className="input input-sm flex-1"
                placeholder="Item name"
                value={newItemEntry.name}
                onChange={(e) => setNewItemEntry({ ...newItemEntry, name: e.target.value })}
              />
              <input
                className="input input-sm w-32"
                type="number"
                placeholder="Price"
                value={newItemEntry.price}
                onChange={(e) => setNewItemEntry({ ...newItemEntry, price: e.target.value })}
              />
              <button className="btn btn-sm" onClick={addSupplierItem} disabled={addingItem}>
                {addingItem ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
        <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="font-semibold">Recent Price Updates</p>
          {selectedDetail.priceHistory && selectedDetail.priceHistory.length > 0 ? (
            <div className="space-y-1">
              {selectedDetail.priceHistory.slice(0, 5).map((history) => (
                <div key={history.id} className="text-xs text-slate-500">
                  {history.item?.name || "Item"}: {Number(history.oldPrice || 0).toFixed(2)} → {Number(history.newPrice || 0).toFixed(2)} ({new Date(history.createdAt).toLocaleDateString()})
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No recent price history.</p>
          )}
        </div>
      </div>
    ) : null;

  const updateSupplierQuery = useCallback(
    (supplierId?: string) => {
      const params = new URLSearchParams(location.search);
      if (supplierId) params.set("supplier", supplierId);
      else params.delete("supplier");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: false });
    },
    [location.pathname, location.search, navigate]
  );

  const selectSupplier = useCallback(
    async (supplier: Supplier, updateUrl = true) => {
      setSelected(supplier);
      setSelectedDetail(null);
      if (updateUrl) updateSupplierQuery(supplier.supplierId);
      setDetailLoading(true);
      try {
        const res = await api.get(`/suppliers/${supplier.id}`);
        setSelectedDetail(res.data);
      } catch (err) {
        console.error(err);
        setSelectedDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [updateSupplierQuery]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const supplierParam = params.get("supplier");
    if (!supplierParam || suppliers.length === 0) return;
    const found = suppliers.find((sup) => sup.supplierId === supplierParam);
    if (found && (!selected || selected.id !== found.id)) {
      selectSupplier(found, false);
    }
  }, [location.search, suppliers, selectSupplier, selected]);

  useEffect(() => {
    if (selectedDetail?.items) {
      const next: Record<number, string> = {};
      selectedDetail.items.forEach((item) => {
        next[item.itemId] = item.price?.toString() ?? "";
      });
      setPriceDrafts(next);
    } else {
      setPriceDrafts({});
    }
  }, [selectedDetail]);

  return (
    <div className="space-y-4">
      <TabHeader
        title="Suppliers"
        searchPlaceholder="Search SID/company/contact"
        value={filters.q}
        onSearch={(q) => setFilters({ ...filters, q })}
        onFilter={() => setShowFilters((s) => !s)}
        onOpenNew={() => setWizardOpen(true)}
        loading={loading}
        newLabel={"New Supplier"}
      />

      {showFilters && (
        <div className="card">
          <SearchPanel>
            <input className="input" placeholder="Search SID/company/contact" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <button className="btn bg-slate-700 hover:bg-slate-600" type="button" onClick={() => setFilters({ q: "" })}>
              Clear Filters
            </button>
          </SearchPanel>
        </div>
      )}

      <RecordingWizard title="New Supplier" isOpen={wizardOpen} onClose={() => setWizardOpen(false)} onSave={saveSupplier} saveLabel="Save Supplier">
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
                  <button type="button" className="btn" onClick={() => setStep("Items")}>Next</button>
                  <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Basic Info")}>
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === "Items" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Enter the items this supplier provides along with their typical price.</p>
                <div className="space-y-2">
                  {wizardItems.map((item, idx) => (
                    <div key={idx} className="grid gap-2 md:grid-cols-[1fr_140px_90px]">
                      <input
                        className="input"
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateWizardItemRow(idx, "name", e.target.value)}
                      />
                      <input
                        className="input"
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => updateWizardItemRow(idx, "price", e.target.value)}
                      />
                      <button type="button" className="btn bg-red-50 text-red-600 hover:bg-red-100" onClick={() => removeWizardItemRow(idx)} disabled={wizardItems.length === 1}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn" onClick={addWizardItemRow}>
                  Add Another Item
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={() => setStep("Review")}>
                    Next
                  </button>
                  <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Categories")}>
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
                  <button type="button" className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setStep("Items")}>
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>{supplierDetailPanel || <p className="text-xs text-slate-500">Fill the form to generate a new supplier.</p>}</div>
        </div>
      </RecordingWizard>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Suppliers</h3>
            <div className="flex gap-2">
              <button className="btn" type="button" onClick={() => setWizardOpen(true)}>
                New Supplier
              </button>
              {loading && <span className="text-xs text-slate-500">Loading...</span>}
            </div>
          </div>
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className={`rounded border p-3 text-sm ${selected?.id === s.id ? "border-primary bg-primary/5 dark:border-primary" : "border-slate-200 dark:border-slate-800"}`}
                onClick={() => selectSupplier(s)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <a
                      href={`?supplier=${encodeURIComponent(s.supplierId)}`}
                      className="font-semibold text-primary underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectSupplier(s);
                      }}
                    >
                      {s.supplierId}
                    </a>
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
        <div className="card min-h-[200px]">
          <h3 className="mb-2 font-semibold">Selected Supplier</h3>
          {supplierDetailPanel || (
            <p className="text-xs text-slate-500">Select a supplier from the list to view details, items, and pricing.</p>
          )}
        </div>
      </div>
    </div>
  );
}
