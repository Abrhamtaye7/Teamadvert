import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, FormError, Input, Select, Textarea } from "../../components/ui/form";
import { errorMessage } from "../../lib/api";
import { useCategories, useCreateCategory, useCreateItem, useCreateUnit, useUnits, useUpdateItem, type ItemPayload } from "../../lib/queries";
import type { Item } from "../../lib/types";

export function ItemFormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item?: Item; onSaved?: (i: Item) => void }) {
  const create = useCreateItem();
  const update = useUpdateItem(item?.id ?? 0);
  const error = create.error ?? update.error;
  const done = (saved: Item) => {
    toast.success(item ? "Item updated" : `Item ${saved.itemId} created`);
    onSaved?.(saved);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? `Edit ${item.name}` : "New item"}
      description={item?.itemId ?? "An item code is assigned automatically."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="item-form" loading={create.isPending || update.isPending}>Save item</Button>
        </>
      }
    >
      <Form item={item} error={error ? errorMessage(error) : null} onSubmit={(p) => (item ? update.mutate(p, { onSuccess: done }) : create.mutate(p, { onSuccess: done }))} />
    </Dialog>
  );
}

function QuickAdd({ label, onAdd, pending }: { label: string; onAdd: (name: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600">
        <Plus className="size-3" />
        New {label}
      </button>
    );
  }
  return (
    <div className="mt-2 flex gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${label}`} aria-label={`New ${label}`} autoFocus />
      <Button
        loading={pending}
        disabled={!name.trim()}
        onClick={() => {
          onAdd(name.trim());
          setName("");
          setOpen(false);
        }}
      >
        Add
      </Button>
    </div>
  );
}

function Form({ item, error, onSubmit }: { item?: Item; error: string | null; onSubmit: (p: ItemPayload) => void }) {
  const categories = useCategories();
  const units = useUnits();
  const addCategory = useCreateCategory();
  const addUnit = useCreateUnit();
  const [f, setF] = useState({
    name: item?.name ?? "",
    categoryId: item?.categoryId ? String(item.categoryId) : "",
    measurementUnitId: item?.measurementUnitId ? String(item.measurementUnitId) : "",
    purchasePrice: item?.purchasePrice != null ? String(item.purchasePrice) : "",
    sellingPrice: item?.sellingPrice != null ? String(item.sellingPrice) : "",
    notes: item?.notes ?? "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setProblem("Item name is required.");
    if ([f.purchasePrice, f.sellingPrice].some((v) => v.trim() && !(Number(v) >= 0))) return setProblem("Prices must be positive numbers.");
    setProblem(null);
    const unit = units.data?.find((u) => String(u.id) === f.measurementUnitId);
    onSubmit({
      name: f.name.trim(),
      categoryId: num(f.categoryId),
      measurementUnitId: num(f.measurementUnitId),
      unit: unit?.unitName,
      purchasePrice: num(f.purchasePrice),
      sellingPrice: num(f.sellingPrice),
      notes: f.notes.trim() || undefined,
    });
  };

  return (
    <form id="item-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormError message={error ?? problem} />
      </div>
      <Field label="Name" required className="sm:col-span-2">
        {(p) => <Input {...p} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}
      </Field>
      <div>
        <Field label="Category">
          {(p) => (
            <Select {...p} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">None</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <QuickAdd
          label="category"
          pending={addCategory.isPending}
          onAdd={(name) => addCategory.mutate(name, { onSuccess: (c) => setF((s) => ({ ...s, categoryId: String(c.id) })), onError: (err) => toast.error(errorMessage(err)) })}
        />
      </div>
      <div>
        <Field label="Unit">
          {(p) => (
            <Select {...p} value={f.measurementUnitId} onChange={(e) => setF({ ...f, measurementUnitId: e.target.value })}>
              <option value="">None</option>
              {(units.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.unitName}</option>
              ))}
            </Select>
          )}
        </Field>
        <QuickAdd
          label="unit"
          pending={addUnit.isPending}
          onAdd={(name) => addUnit.mutate(name, { onSuccess: (u) => setF((s) => ({ ...s, measurementUnitId: String(u.id) })), onError: (err) => toast.error(errorMessage(err)) })}
        />
      </div>
      <Field label="Purchase price (ETB)">{(p) => <Input {...p} inputMode="decimal" value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: e.target.value })} />}</Field>
      <Field label="Selling price (ETB)" hint="Used as the default price on proformas.">
        {(p) => <Input {...p} inputMode="decimal" value={f.sellingPrice} onChange={(e) => setF({ ...f, sellingPrice: e.target.value })} />}
      </Field>
      <Field label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
    </form>
  );
}
