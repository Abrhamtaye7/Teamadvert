import { useState } from "react";
import { Check, UserPlus, Users } from "lucide-react";
import { useDebounced } from "./ui/page";
import { Field, Input } from "./ui/form";
import { cn } from "../lib/cn";
import { phones } from "../lib/format";
import { useCustomers, type NewCustomerInput } from "../lib/queries";
import type { Customer } from "../lib/types";

export type CustomerChoice = { mode: "existing"; customer: Customer | null } | { mode: "new"; customer: NewCustomerInput };

export const customerChoiceValid = (c: CustomerChoice) => (c.mode === "existing" ? !!c.customer : c.customer.name.trim().length > 0);

/** Converts the choice into the API's `customerId` / `customerNew` fields. */
export function customerPayload(c: CustomerChoice) {
  if (c.mode === "existing") return { customerId: c.customer?.id };
  const n = c.customer;
  return {
    customerNew: {
      name: n.name.trim(),
      company: n.company?.trim() || undefined,
      phones: n.phones?.filter(Boolean),
      email: n.email?.trim() || undefined,
      tin: n.tin?.trim() || undefined,
    },
  };
}

/** Pick an existing customer by search, or register a new one inline. */
export function CustomerPicker({ value, onChange }: { value: CustomerChoice; onChange: (c: CustomerChoice) => void }) {
  const [q, setQ] = useState("");
  const search = useDebounced(q);
  const { data, isFetching } = useCustomers({ q: search, pageSize: 6 });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
        {(
          [
            ["existing", "Existing customer", Users],
            ["new", "New customer", UserPlus],
          ] as const
        ).map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={value.mode === mode}
            onClick={() => onChange(mode === "existing" ? { mode, customer: null } : { mode, customer: { name: "" } })}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium",
              value.mode === mode ? "bg-surface text-ink shadow-xs" : "text-ink-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {value.mode === "existing" ? (
        <div className="space-y-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, company, CID or TIN" aria-label="Search customers" />
          <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {(data?.data ?? []).map((c) => {
              const selected = value.customer?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ mode: "existing", customer: c })}
                    className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", selected ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-surface-muted")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-ink-subtle">
                        {c.customerId} · {c.company ?? phones(c.phones)}
                      </p>
                    </div>
                    {selected && <Check className="size-4 text-brand-600" />}
                  </button>
                </li>
              );
            })}
            {!isFetching && !data?.data.length && <li className="px-3 py-4 text-center text-sm text-ink-subtle">No customers found</li>}
          </ul>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            {(p) => <Input {...p} value={value.customer.name} onChange={(e) => onChange({ mode: "new", customer: { ...value.customer, name: e.target.value } })} />}
          </Field>
          <Field label="Company">
            {(p) => <Input {...p} value={value.customer.company ?? ""} onChange={(e) => onChange({ mode: "new", customer: { ...value.customer, company: e.target.value } })} />}
          </Field>
          <Field label="Phone">
            {(p) => (
              <Input
                {...p}
                type="tel"
                value={value.customer.phones?.[0] ?? ""}
                onChange={(e) => onChange({ mode: "new", customer: { ...value.customer, phones: [e.target.value] } })}
              />
            )}
          </Field>
          <Field label="TIN">
            {(p) => <Input {...p} value={value.customer.tin ?? ""} onChange={(e) => onChange({ mode: "new", customer: { ...value.customer, tin: e.target.value } })} />}
          </Field>
          <Field label="Email">
            {(p) => <Input {...p} type="email" value={value.customer.email ?? ""} onChange={(e) => onChange({ mode: "new", customer: { ...value.customer, email: e.target.value } })} />}
          </Field>
        </div>
      )}
    </div>
  );
}
