import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, FormError, Input, Select } from "../../components/ui/form";
import { errorMessage } from "../../lib/api";
import { useCreateCustomer, useUpdateCustomer, type CustomerPayload } from "../../lib/queries";
import type { Customer } from "../../lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company: z.string().trim(),
  phone: z.string().trim(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  tin: z.string().trim(),
  addressRegion: z.string().trim(),
  addressCity: z.string().trim(),
  addressSubcity: z.string().trim(),
  addressWoreda: z.string().trim(),
  addressHouse: z.string().trim(),
  creditLimit: z.string().trim().refine((v) => v === "" || Number(v) >= 0, "Enter a positive amount"),
  standing: z.enum(["Good", "Warning", "Suspended"]),
});
type FormValues = z.infer<typeof schema>;

const blank = (v: string) => v || undefined;

function toPayload(v: FormValues): CustomerPayload {
  return {
    name: v.name,
    company: blank(v.company),
    phone: blank(v.phone),
    email: blank(v.email),
    tin: blank(v.tin),
    addressRegion: blank(v.addressRegion),
    addressCity: blank(v.addressCity),
    addressSubcity: blank(v.addressSubcity),
    addressWoreda: blank(v.addressWoreda),
    addressHouse: blank(v.addressHouse),
    creditLimit: v.creditLimit ? Number(v.creditLimit) : undefined,
    standing: v.standing,
  };
}

function defaults(c?: Customer): FormValues {
  return {
    name: c?.name ?? "",
    company: c?.company ?? "",
    phone: c?.phones?.join(", ") ?? "",
    email: c?.email ?? "",
    tin: c?.tin ?? "",
    addressRegion: c?.address?.region ?? "",
    addressCity: c?.address?.city ?? "Addis Ababa",
    addressSubcity: c?.address?.subcity ?? "",
    addressWoreda: c?.address?.woreda ?? "",
    addressHouse: c?.address?.house ?? "",
    creditLimit: c?.creditLimit != null ? String(c.creditLimit) : "",
    standing: c?.standing ?? "Good",
  };
}

type SaveMutation = ReturnType<typeof useCreateCustomer>;

function Form({ customer, save, onDone }: { customer?: Customer; save: SaveMutation; onDone: (c: Customer) => void }) {
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(customer) });
  const e = formState.errors;

  const submit = handleSubmit((values) =>
    save.mutate(toPayload(values), {
      onSuccess: (saved) => {
        toast.success(customer ? "Customer updated" : `Customer ${saved.customerId} created`);
        onDone(saved);
      },
    }),
  );

  return (
    <form id="customer-form" onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={save.error ? errorMessage(save.error) : null} />
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" required error={e.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} autoFocus />}
        </Field>
        <Field label="Company">{(p) => <Input {...p} {...register("company")} />}</Field>
        <Field label="Phone numbers" hint="Separate several with commas">
          {(p) => <Input {...p} type="tel" {...register("phone")} placeholder="0911…" />}
        </Field>
        <Field label="Email" error={e.email?.message}>
          {(p) => <Input {...p} type="email" {...register("email")} />}
        </Field>
        <Field label="TIN">{(p) => <Input {...p} inputMode="numeric" {...register("tin")} />}</Field>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink-muted">Address</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="City">{(p) => <Input {...p} {...register("addressCity")} />}</Field>
          <Field label="Sub-city">{(p) => <Input {...p} {...register("addressSubcity")} />}</Field>
          <Field label="Woreda">{(p) => <Input {...p} {...register("addressWoreda")} />}</Field>
          <Field label="House no.">{(p) => <Input {...p} {...register("addressHouse")} />}</Field>
          <Field label="Region">{(p) => <Input {...p} {...register("addressRegion")} />}</Field>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Field label="Credit limit (ETB)" error={e.creditLimit?.message}>
          {(p) => <Input {...p} inputMode="decimal" {...register("creditLimit")} />}
        </Field>
        <Field label="Credit standing">
          {(p) => (
            <Select {...p} {...register("standing")}>
              <option>Good</option>
              <option>Warning</option>
              <option>Suspended</option>
            </Select>
          )}
        </Field>
      </section>
    </form>
  );
}

export function CustomerFormDialog({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer; onSaved?: (c: Customer) => void }) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? 0);
  const save = (customer ? update : create) as SaveMutation;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : "New customer"}
      description={customer ? customer.customerId : "A customer ID (CID) is assigned automatically."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={save.isPending}>
            Save customer
          </Button>
        </>
      }
    >
      <Form
        customer={customer}
        save={save}
        onDone={(c) => {
          onSaved?.(c);
          onClose();
        }}
      />
    </Dialog>
  );
}
