import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { proformaCreateSchema, proformaSearchSchema } from "@shared/schemas";
import { SearchPanel } from "../components/SearchPanel";
import TabHeader from "../components/TabHeader";
import RecordingWizard from "../components/RecordingWizard";
import { openProformaPrint } from "../utils/printers";

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

type CatalogItem = { id: number; itemId: string; name: string; description?: string; unit?: string; sellingPrice?: number };
type LineItem = {
  catalogItemId?: number;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  discount: number;
  vatPercent?: number;
};
type NewCustomer = {
  name: string;
  company: string;
  phones: string;
  email: string;
  tin: string;
  address: { region: string; city: string; subcity: string; woreda: string; house: string };
};

const VAT_DEFAULT = 15;
const DEFAULT_SIGNATURE_PATH = "./frontend/src/assets/sign.png";
const DEFAULT_STAMP_PATH = "./frontend/src/assets/stamp.jpg";
const DEFAULT_BANK_ACCOUNT = "CBE 1000357045219";

const createLineItem = (): LineItem => ({
  name: "",
  description: "",
  quantity: 1,
  unit: "pcs",
  sellingPrice: 0,
  discount: 0,
  vatPercent: VAT_DEFAULT,
});

const createCustomer = (): NewCustomer => ({
  name: "",
  company: "",
  phones: "",
  email: "",
  tin: "",
  address: { region: "", city: "", subcity: "", woreda: "", house: "" },
});

const createMeta = () => ({
  validity: 14,
  notes: "",
  terms: "Payment expected within 7 days unless otherwise noted.",
  signaturePath: DEFAULT_SIGNATURE_PATH,
  stampPath: DEFAULT_STAMP_PATH,
  bankInfoSnapshot: DEFAULT_BANK_ACCOUNT,
});

const createNewCatalogForm = () => ({ name: "", description: "", unit: "pcs", sellingPrice: 0 });

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

function chunkToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${units[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)] + (n % 10 ? `-${units[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(units[n]);
  }
  return parts.join(" ");
}

function amountToWords(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  if (whole === 0 && cents === 0) return "zero birr";

  const scales = ["", " thousand", " million", " billion", " trillion"];
  const chunks: string[] = [];
  let num = whole;
  let scale = 0;
  while (num > 0 && scale < scales.length) {
    const chunk = num % 1000;
    if (chunk) chunks.unshift(`${chunkToWords(chunk)}${scales[scale]}`.trim());
    num = Math.floor(num / 1000);
    scale++;
  }
  const birr = chunks.join(" ") || "zero";
  const centsText = cents ? ` and ${chunkToWords(cents)} cents` : "";
  return `${birr} birr${centsText}`;
}

const toArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload?.items)) return payload.items as T[];
  return [];
};

export default function Proformas() {
  const location = useLocation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      q: params.get("q") ?? "",
      status: params.get("status") ?? "",
      preparedBy: params.get("preparedBy") ?? "",
      itemName: params.get("itemName") ?? "",
      amountMin: params.get("amountMin") ?? "",
      amountMax: params.get("amountMax") ?? "",
      startDate: params.get("startDate") ?? "",
      endDate: params.get("endDate") ?? "",
    };
  });

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [filters, location.pathname, navigate]);

  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [registerNew, setRegisterNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState(createCustomer);

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [newItemForm, setNewItemForm] = useState(createNewCatalogForm);
  const [creatingItem, setCreatingItem] = useState(false);

  const [items, setItems] = useState<LineItem[]>([createLineItem()]);
  const [meta, setMeta] = useState(createMeta);
  const [message, setMessage] = useState("");

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
    const discount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const vat = items.reduce((sum, item) => {
      const base = item.quantity * item.sellingPrice - (item.discount || 0);
      return sum + (base * (item.vatPercent ?? VAT_DEFAULT)) / 100;
    }, 0);
    const total = subtotal - discount + vat;
    return { subtotal, discount, vat, total, words: amountToWords(total) };
  }, [items]);

  const loadProformas = useCallback(async () => {
    setLoading(true);
    try {
      const parsed = proformaSearchSchema.safeParse(filters);
      const payload = parsed.success ? parsed.data : filters;
      const params: Record<string, string> = {};
      Object.entries(payload).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const { data } = await api.get("/proformas", { params });
      setProformas(toArray<Proforma>(data));
    } catch (error) {
      console.error("Failed to load proformas", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadProformas();
  }, [loadProformas]);

  const fetchCustomers = useCallback(
    async (term: string) => {
      try {
        const { data } = await api.get("/customers", { params: { q: term || undefined } });
        setCustomers(toArray<Customer>(data));
      } catch (error) {
        console.error("Failed to load customers", error);
      }
    },
    []
  );

  const fetchCatalogItems = useCallback(async () => {
    try {
      const { data } = await api.get("/items", { params: { q: "" } });
      setCatalogItems(toArray<CatalogItem>(data));
    } catch (error) {
      console.error("Failed to load catalog items", error);
    }
  }, []);

  useEffect(() => {
    if (!wizardOpen) return;
    fetchCatalogItems();
    fetchCustomers("");
  }, [wizardOpen, fetchCatalogItems, fetchCustomers]);

  useEffect(() => {
    if (!wizardOpen) return;
    const handle = setTimeout(() => fetchCustomers(customerSearch), 300);
    return () => clearTimeout(handle);
  }, [customerSearch, fetchCustomers, wizardOpen]);

  const resetWizard = () => {
    setWizardStep(0);
    setWizardError(null);
    setRegisterNew(false);
    setSelectedCustomer(null);
    setNewCustomer(createCustomer());
    setItems([createLineItem()]);
    setMeta(createMeta());
    setNewItemForm(createNewCatalogForm());
    setCustomerSearch("");
    setMessage("");
  };

  const openWizard = () => {
    resetWizard();
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    resetWizard();
  };

  const addItem = () => setItems((prev) => [...prev, createLineItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, idx) => idx !== index));
  const updateItem = (index: number, key: keyof LineItem, value: any) =>
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));

  const handleCatalogSelect = (index: number, catalogId: string) => {
    if (!catalogId) {
      updateItem(index, "catalogItemId", undefined);
      return;
    }
    const found = catalogItems.find((c) => String(c.id) === catalogId);
    if (!found) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              catalogItemId: found.id,
              name: found.name,
              description: found.description || "",
              unit: found.unit || item.unit,
              sellingPrice: found.sellingPrice ?? item.sellingPrice,
            }
          : item
      )
    );
  };

  const createCatalogItem = async () => {
    if (!newItemForm.name.trim()) {
      setWizardError("Item name is required");
      return;
    }
    try {
      setCreatingItem(true);
      await api.post("/items", {
        name: newItemForm.name.trim(),
        unit: newItemForm.unit || undefined,
        sellingPrice: Number(newItemForm.sellingPrice) || 0,
        notes: newItemForm.description || undefined,
      });
      setNewItemForm(createNewCatalogForm());
      await fetchCatalogItems();
    } catch (error) {
      console.error("Failed to add catalog item", error);
      setWizardError("Could not save catalog item");
    } finally {
      setCreatingItem(false);
    }
  };

  const handleWizardSave = () => {
    if (wizardStep === 0) {
      if (!selectedCustomer && !registerNew) {
        setWizardError("Please select an existing customer or register a new one");
        return;
      }
      if (registerNew && !newCustomer.name.trim()) {
        setWizardError("Customer name is required");
        return;
      }
      setWizardError(null);
      setWizardStep(1);
      return;
    }
    if (wizardStep === 1) {
      if (!items.length || items.some((item) => !item.name.trim())) {
        setWizardError("Add at least one item and provide names");
        return;
      }
      setWizardError(null);
      setWizardStep(2);
      return;
    }
    (document.getElementById("proforma-form") as HTMLFormElement | null)?.requestSubmit();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (wizardStep !== 2) return;
    try {
      const customerSnapshot = registerNew
        ? {
            name: newCustomer.name.trim(),
            company: newCustomer.company || undefined,
            phones: newCustomer.phones
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
            email: newCustomer.email || undefined,
            tin: newCustomer.tin || undefined,
            address: {
              region: newCustomer.address.region || undefined,
              city: newCustomer.address.city || undefined,
              subcity: newCustomer.address.subcity || undefined,
              woreda: newCustomer.address.woreda || undefined,
              house: newCustomer.address.house || undefined,
            },
          }
        : undefined;

      const payload = proformaCreateSchema.parse({
        customerId: !registerNew ? selectedCustomer?.id : undefined,
        customerNew: customerSnapshot,
        validity: meta.validity,
        notes: meta.notes,
        terms: meta.terms,
        signaturePath: meta.signaturePath,
        stampPath: meta.stampPath,
        bankInfoSnapshot: meta.bankInfoSnapshot,
        items: items.map((item) => ({
          name: item.name.trim(),
          description: item.description || undefined,
          quantity: item.quantity || 1,
          unit: item.unit || undefined,
          sellingPrice: item.sellingPrice || 0,
          discount: item.discount || 0,
          vatPercent: item.vatPercent ?? VAT_DEFAULT,
        })),
      });

      await api.post("/proformas", payload);
      setMessage("Proforma saved successfully.");
      closeWizard();
      await loadProformas();
    } catch (error: any) {
      console.error("Failed to save proforma", error);
      setWizardError(error?.response?.data?.message || "Failed to save proforma");
    }
  };

  const approve = async (id: number) => {
    try {
      await api.post(`/proformas/${id}/approve`);
      await loadProformas();
    } catch (error) {
      console.error("Failed to approve proforma", error);
    }
  };

  const convert = async (id: number) => {
    try {
      await api.post(`/proformas/${id}/convert`);
      await loadProformas();
      navigate("/jobs");
    } catch (error) {
      console.error("Failed to convert proforma", error);
    }
  };

  const print = async (id: number) => {
    await openProformaPrint(id);
  };

  return (
    <div className="space-y-4">
      <TabHeader
        title="Proforma Generator (TAPI)"
        searchPlaceholder="Search number/customer"
        value={filters.q}
        onSearch={(q) => setFilters((prev) => ({ ...prev, q }))}
        onFilter={() => setShowFilters((s) => !s)}
        onOpenNew={openWizard}
        loading={loading}
        newLabel="New Proforma"
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

      <RecordingWizard title="Create Proforma" isOpen={wizardOpen} onClose={closeWizard} onSave={handleWizardSave} saveLabel={wizardStep === 2 ? "Save Proforma" : "Next"}>
        <form id="proforma-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded border border-slate-200 p-3">
            <div className="flex gap-2 text-sm font-semibold">
              {["Customer", "Items", "Review"].map((label, idx) => (
                <span key={label} className={`rounded-full px-3 py-1 ${wizardStep === idx ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                  {idx + 1}. {label}
                </span>
              ))}
            </div>
            {wizardError && <span className="text-sm text-red-500">{wizardError}</span>}
          </div>

          {wizardStep === 0 && (
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
                  {customers.map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setRegisterNew(false);
                        setWizardError(null);
                      }}
                      className={`block w-full rounded border px-3 py-2 text-left text-sm ${
                        selectedCustomer?.id === customer.id ? "border-primary text-primary" : "border-slate-200"
                      }`}
                    >
                      {customer.name} {customer.company ? `– ${customer.company}` : ""} ({customer.customerId})
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

              <div className="space-y-2">
                {registerNew && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="input" placeholder="Full name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                    <input className="input" placeholder="Company" value={newCustomer.company} onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })} />
                    <input className="input" placeholder="Phones (comma separated)" value={newCustomer.phones} onChange={(e) => setNewCustomer({ ...newCustomer, phones: e.target.value })} />
                    <input className="input" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                    <input className="input" placeholder="TIN" value={newCustomer.tin} onChange={(e) => setNewCustomer({ ...newCustomer, tin: e.target.value })} />
                    <input className="input" placeholder="Region" value={newCustomer.address.region} onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, region: e.target.value } })} />
                    <input className="input" placeholder="City" value={newCustomer.address.city} onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, city: e.target.value } })} />
                    <input className="input" placeholder="Sub-city" value={newCustomer.address.subcity} onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, subcity: e.target.value } })} />
                    <input className="input" placeholder="Woreda" value={newCustomer.address.woreda} onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, woreda: e.target.value } })} />
                    <input className="input" placeholder="House" value={newCustomer.address.house} onChange={(e) => setNewCustomer({ ...newCustomer, address: { ...newCustomer.address, house: e.target.value } })} />
                  </div>
                )}

                {!registerNew && selectedCustomer && (
                  <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    Using customer: {selectedCustomer.name} {selectedCustomer.company ? `(${selectedCustomer.company})` : ""} – {selectedCustomer.customerId}
                  </div>
                )}
              </div>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Items</h4>
                <button type="button" className="btn" onClick={addItem}>
                  + Add item
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="rounded border border-slate-200 p-3">
                  <div className="grid gap-2 md:grid-cols-6">
                    <select className="input md:col-span-2" value={item.catalogItemId ?? ""} onChange={(e) => handleCatalogSelect(idx, e.target.value)}>
                      <option value="">Select existing item</option>
                      {catalogItems.map((catalog) => (
                        <option key={catalog.id} value={catalog.id}>
                          {catalog.itemId} · {catalog.name}
                        </option>
                      ))}
                    </select>
                    <input className="input md:col-span-2" placeholder="Name" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} />
                    <input className="input md:col-span-2" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                    <input className="input" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                    <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                    <input className="input" type="number" placeholder="Price" value={item.sellingPrice} onChange={(e) => updateItem(idx, "sellingPrice", Number(e.target.value))} />
                    <input className="input" type="number" placeholder="Discount" value={item.discount} onChange={(e) => updateItem(idx, "discount", Number(e.target.value))} />
                    <input className="input" type="number" placeholder="VAT %" value={item.vatPercent ?? VAT_DEFAULT} onChange={(e) => updateItem(idx, "vatPercent", Number(e.target.value))} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Line total: {(
                        item.quantity * item.sellingPrice - (item.discount || 0) + ((item.quantity * item.sellingPrice - (item.discount || 0)) * (item.vatPercent ?? VAT_DEFAULT)) / 100
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

              <div className="rounded border border-dashed border-slate-300 p-3">
                <h5 className="text-sm font-semibold">Quick add new item</h5>
                <div className="mt-2 grid gap-2 md:grid-cols-4">
                  <input className="input" placeholder="Name" value={newItemForm.name} onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })} />
                  <input className="input" placeholder="Description" value={newItemForm.description} onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })} />
                  <input className="input" placeholder="Unit" value={newItemForm.unit} onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })} />
                  <input className="input" type="number" placeholder="Price" value={newItemForm.sellingPrice} onChange={(e) => setNewItemForm({ ...newItemForm, sellingPrice: Number(e.target.value) })} />
                </div>
                <button type="button" className="btn mt-2" onClick={createCatalogItem} disabled={creatingItem}>
                  {creatingItem ? "Saving..." : "Save to item list"}
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="rounded border border-slate-200 p-3">
                <h5 className="text-sm font-semibold text-slate-600">Customer snapshot</h5>
                {registerNew ? (
                  <p className="text-sm text-slate-700">{newCustomer.name || "Unnamed customer"}</p>
                ) : (
                  <p className="text-sm text-slate-700">{selectedCustomer?.name} {selectedCustomer?.customerId ? `(${selectedCustomer.customerId})` : ""}</p>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">Validity (days)</label>
                  <input className="input" type="number" value={meta.validity} onChange={(e) => setMeta({ ...meta, validity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Notes</label>
                  <input className="input" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Signature path</label>
                  <input className="input" value={meta.signaturePath} onChange={(e) => setMeta({ ...meta, signaturePath: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Stamp path</label>
                  <input className="input" value={meta.stampPath} onChange={(e) => setMeta({ ...meta, stampPath: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-slate-600">Bank info snapshot</label>
                  <textarea className="input" value={meta.bankInfoSnapshot} onChange={(e) => setMeta({ ...meta, bankInfoSnapshot: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-slate-600">Terms</label>
                  <textarea className="input" value={meta.terms} onChange={(e) => setMeta({ ...meta, terms: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <div>Subtotal: ETB {totals.subtotal.toFixed(2)}</div>
                <div>Discount: ETB {totals.discount.toFixed(2)}</div>
                <div>VAT: ETB {totals.vat.toFixed(2)}</div>
                <div className="font-semibold text-primary">Total: ETB {totals.total.toFixed(2)}</div>
                <div className="text-xs text-slate-500">Amount in words: {totals.words}</div>
              </div>
            </div>
          )}

          {message && <p className="text-sm text-emerald-600">{message}</p>}

          {wizardStep > 0 && (
            <div className="flex justify-between">
              <button type="button" className="btn border border-slate-300 bg-white text-slate-700" onClick={() => setWizardStep((s) => Math.max(0, s - 1))}>
                Back
              </button>
              <span />
            </div>
          )}

          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </RecordingWizard>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Proformas</h3>
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={openWizard}>
              New Proforma
            </button>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
        </div>
        <div className="space-y-2">
          {proformas.map((proforma) => (
            <div key={proforma.id} className="rounded border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{proforma.number}</p>
                  <p className="text-xs text-slate-500">
                    {proforma.customerSnapshot?.name || proforma.customer?.name || ""} • {new Date(proforma.date).toLocaleDateString()} • Prepared by {proforma.preparedBy?.username || "-"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-700">{proforma.status}</span>
                  <button className="btn bg-slate-700 hover:bg-slate-600" type="button" onClick={() => print(proforma.id)}>
                    Print/PDF
                  </button>
                  <button className="btn bg-emerald-600 hover:bg-emerald-500" type="button" disabled={proforma.status !== "draft"} onClick={() => approve(proforma.id)}>
                    Approve
                  </button>
                  <button className="btn bg-amber-600 hover:bg-amber-500" type="button" disabled={proforma.status !== "approved"} onClick={() => convert(proforma.id)}>
                    Convert to Job
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                {proforma.items?.slice(0, 4).map((item: any) => (
                  <div key={item.id} className="rounded bg-slate-50 px-2 py-1 text-xs">
                    {item.name} — {item.quantity} x {item.sellingPrice} (VAT {item.vatPercent || VAT_DEFAULT}%)
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
