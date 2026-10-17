import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { CustomerPicker, customerChoiceValid, customerPayload, type CustomerChoice } from "../../components/CustomerPicker";
import { LineItemsEditor, linesValid, newLine, toProformaLines, type EditableLine } from "../../components/LineItemsEditor";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, FormError, Input, Textarea } from "../../components/ui/form";
import { errorMessage } from "../../lib/api";
import { COMPANY } from "../../lib/company";
import { amount } from "../../lib/format";
import { useCreateProforma, useUpdateProforma, type ProformaPayload } from "../../lib/queries";
import { proformaTotals } from "../../lib/totals";
import type { Customer, Proforma } from "../../lib/types";

const fromProforma = (p: Proforma): EditableLine[] =>
  (p.items ?? []).map((l) =>
    newLine({
      itemId: l.itemId ?? undefined,
      name: l.name,
      description: l.description ?? "",
      quantity: String(l.quantity),
      unit: l.unit ?? "",
      price: String(l.sellingPrice),
      discount: l.discount ? String(l.discount) : "",
      vatPercent: l.vatPercent != null ? String(l.vatPercent) : String(COMPANY.vatPercent),
    }),
  );

function Section({ title, step, children }: { title: string; step: number; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Create a proforma, or edit a draft (the customer can't change after creation). */
/** Create a proforma (optionally for a given customer, e.g. from the customer's page), or edit a draft. */
export function ProformaFormDialog({
  open,
  onClose,
  proforma,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  proforma?: Proforma;
  customer?: Customer;
  onSaved?: (p: Proforma) => void;
}) {
  const create = useCreateProforma();
  const update = useUpdateProforma(proforma?.id ?? 0);
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const done = (saved: Proforma) => {
    toast.success(proforma ? "Proforma updated" : `Proforma ${saved.number} created`);
    onSaved?.(saved);
    onClose();
  };
  const submit = (payload: ProformaPayload) => {
    if (proforma) {
      const { customerId: _c, customerNew: _n, ...changes } = payload;
      update.mutate(changes, { onSuccess: done });
    } else {
      create.mutate(payload, { onSuccess: done });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={proforma ? `Edit ${proforma.number}` : "New proforma"}
      description={proforma ? (proforma.customer?.name ?? undefined) : "The TAPI number is assigned when you save."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="proforma-form" loading={pending}>
            {proforma ? "Save changes" : "Create proforma"}
          </Button>
        </>
      }
    >
      <Form proforma={proforma} presetCustomer={customer} error={error ? errorMessage(error) : null} onSubmit={submit} />
    </Dialog>
  );
}

function Form({
  proforma,
  presetCustomer,
  error,
  onSubmit,
}: {
  proforma?: Proforma;
  presetCustomer?: Customer;
  error: string | null;
  onSubmit: (payload: ProformaPayload) => void;
}) {
  const [customer, setCustomer] = useState<CustomerChoice>({ mode: "existing", customer: presetCustomer ?? null });
  const [lines, setLines] = useState<EditableLine[]>(() => (proforma ? fromProforma(proforma) : [newLine()]));
  const [validity, setValidity] = useState(String(proforma?.validity ?? COMPANY.defaultValidityDays));
  const [notes, setNotes] = useState(proforma?.notes ?? "");
  const [terms, setTerms] = useState(proforma?.terms ?? COMPANY.defaultTerms);
  const [touched, setTouched] = useState(false);

  const items = toProformaLines(lines);
  const totals = proformaTotals(items);
  const customerOk = !!proforma || customerChoiceValid(customer);
  const valid = customerOk && linesValid(lines);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit({
      ...(proforma ? {} : customerPayload(customer)),
      items,
      validity: validity ? Number(validity) : undefined,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
    });
  };

  const problem = touched && !valid ? (!customerOk ? "Choose a customer or enter the new customer's name." : "Every line needs a name, a quantity above 0 and a price.") : null;

  return (
    <form id="proforma-form" onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error ?? problem} />

      {!proforma && (
        <Section step={1} title="Customer">
          {presetCustomer ? (
            <div className="rounded-lg border border-line bg-surface-muted/50 px-3 py-2.5">
              <p className="font-medium">{presetCustomer.name}</p>
              <p className="text-xs text-ink-subtle">
                {presetCustomer.customerId}
                {presetCustomer.company ? ` · ${presetCustomer.company}` : ""}
              </p>
            </div>
          ) : (
            <CustomerPicker value={customer} onChange={setCustomer} />
          )}
        </Section>
      )}

      <Section step={proforma ? 1 : 2} title="Items">
        <LineItemsEditor lines={lines} onChange={setLines} withTax />
      </Section>

      <Section step={proforma ? 2 : 3} title="Terms">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valid for (days)">{(p) => <Input {...p} inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value.replace(/\D/g, ""))} />}</Field>
          <Field label="Payment terms" className="sm:col-span-2">
            {(p) => <Input {...p} value={terms} onChange={(e) => setTerms(e.target.value)} />}
          </Field>
          <Field label="Notes (printed)" className="sm:col-span-3">
            {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </Field>
        </div>
      </Section>

      <div className="rounded-lg bg-surface-muted p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums">{amount(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between text-xs text-ink-subtle"><dt>Line discounts (included)</dt><dd className="tabular-nums">{amount(totals.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-muted">{totals.vatPercent === null ? "VAT" : `VAT ${totals.vatPercent}%`}</dt><dd className="tabular-nums">{amount(totals.vat)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">ETB {amount(totals.total)}</dd></div>
        </dl>
      </div>
    </form>
  );
}
