import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, FormError, Input, Textarea } from "../../components/ui/form";
import { errorMessage } from "../../lib/api";
import { useCreateSupplier, useUpdateSupplier, type SupplierPayload } from "../../lib/queries";
import type { Supplier } from "../../lib/types";

export function SupplierFormDialog({ open, onClose, supplier, onSaved }: { open: boolean; onClose: () => void; supplier?: Supplier; onSaved?: (s: Supplier) => void }) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier(supplier?.id ?? 0);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const done = (s: Supplier) => {
    toast.success(supplier ? "Supplier updated" : `Supplier ${s.supplierId} created`);
    onSaved?.(s);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={supplier ? `Edit ${supplier.companyName}` : "New supplier"}
      description={supplier?.supplierId ?? "A supplier ID (SID) is assigned automatically."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="supplier-form" loading={pending}>Save supplier</Button>
        </>
      }
    >
      <Form
        supplier={supplier}
        error={error ? errorMessage(error) : null}
        onSubmit={(input) => (supplier ? update.mutate(input, { onSuccess: done }) : create.mutate(input, { onSuccess: done }))}
      />
    </Dialog>
  );
}

function Form({ supplier, error, onSubmit }: { supplier?: Supplier; error: string | null; onSubmit: (s: SupplierPayload) => void }) {
  const [f, setF] = useState({
    companyName: supplier?.companyName ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    phone: supplier?.phones?.join(", ") ?? "",
    email: supplier?.email ?? "",
    address: typeof supplier?.address === "string" ? supplier.address : "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.companyName.trim()) return setProblem("Company name is required.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setProblem("Enter a valid email.");
    setProblem(null);
    onSubmit({
      companyName: f.companyName.trim(),
      contactPerson: f.contactPerson.trim() || undefined,
      phone: f.phone.trim() || undefined,
      email: f.email.trim() || undefined,
      address: f.address.trim() || undefined,
    });
  };
  return (
    <form id="supplier-form" onSubmit={submit} className="space-y-3" noValidate>
      <FormError message={error ?? problem} />
      <Field label="Company name" required>{(p) => <Input {...p} value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} autoFocus />}</Field>
      <Field label="Contact person">{(p) => <Input {...p} value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} />}</Field>
      <Field label="Phone numbers" hint="Separate several with commas">{(p) => <Input {...p} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
      <Field label="Email">{(p) => <Input {...p} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
      <Field label="Address">{(p) => <Textarea {...p} rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />}</Field>
    </form>
  );
}
