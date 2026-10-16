import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CustomerPicker, customerChoiceValid, customerPayload, type CustomerChoice } from "../../components/CustomerPicker";
import { LineItemsEditor, linesValid, newLine, toJobLines, type EditableLine } from "../../components/LineItemsEditor";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, FormError, Input, Select, Textarea } from "../../components/ui/form";
import { cn } from "../../lib/cn";
import { errorMessage } from "../../lib/api";
import { amount, money } from "../../lib/format";
import { useCreateJob, useProformas, type JobPayload } from "../../lib/queries";
import { round2 } from "../../lib/totals";
import type { Job } from "../../lib/types";

export function JobFormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: (job: Job) => void }) {
  const create = useCreateJob();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="New job order"
      description="The TAJO number is assigned when you save. New jobs wait for admin approval."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="job-form" loading={create.isPending}>
            Create job order
          </Button>
        </>
      }
    >
      <Form
        error={create.error ? errorMessage(create.error) : null}
        onSubmit={(payload) =>
          create.mutate(payload, {
            onSuccess: (job) => {
              toast.success(`Job ${job.number} created`);
              onSaved?.(job);
              onClose();
            },
          })
        }
      />
    </Dialog>
  );
}

function Form({ error, onSubmit }: { error: string | null; onSubmit: (p: JobPayload) => void }) {
  const [source, setSource] = useState<"manual" | "proforma">("manual");
  const [customer, setCustomer] = useState<CustomerChoice>({ mode: "existing", customer: null });
  const [proformaNumber, setProformaNumber] = useState("");
  const [lines, setLines] = useState<EditableLine[]>(() => [newLine()]);
  const [meta, setMeta] = useState({ jobType: "", description: "", priority: "normal" as "high" | "normal" | "low", deadline: "", advancePayment: "", artworkPath: "" });
  const [touched, setTouched] = useState(false);
  const approved = useProformas({ status: "approved", pageSize: 50 });

  const chosen = approved.data?.data.find((p) => p.number === proformaNumber);
  const valid = source === "proforma" ? !!chosen : customerChoiceValid(customer) && linesValid(lines);
  const manualTotal = round2(toJobLines(lines).reduce((s, l) => s + l.quantity * l.price, 0));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const common = {
      jobType: meta.jobType.trim() || undefined,
      description: meta.description.trim() || undefined,
      priority: meta.priority,
      deadline: meta.deadline || undefined,
      advancePayment: meta.advancePayment ? Number(meta.advancePayment) : undefined,
      artworkPath: meta.artworkPath.trim() || undefined,
    };
    onSubmit(
      source === "proforma" && chosen
        ? { ...common, customerId: chosen.customerId, proformaNumber: chosen.number, jobItems: [] }
        : { ...common, ...customerPayload(customer), jobItems: toJobLines(lines) },
    );
  };

  return (
    <form id="job-form" onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error ?? (touched && !valid ? (source === "proforma" ? "Choose an approved proforma." : "Choose a customer and complete every line.") : null)} />

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
        {(
          [
            ["manual", "Enter items"],
            ["proforma", "From approved proforma"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={source === value} onClick={() => setSource(value)} className={cn("h-9 rounded-md text-sm font-medium", source === value ? "bg-surface shadow-xs" : "text-ink-muted")}>
            {label}
          </button>
        ))}
      </div>

      {source === "proforma" ? (
        <section className="space-y-2">
          <Field label="Approved proforma" required hint="Only approved proformas that haven't been converted are listed.">
            {(p) => (
              <Select {...p} value={proformaNumber} onChange={(e) => setProformaNumber(e.target.value)}>
                <option value="">Choose…</option>
                {(approved.data?.data ?? []).map((pf) => (
                  <option key={pf.id} value={pf.number}>
                    {pf.number} — {pf.customer?.name} — {money((pf.items ?? []).reduce((s, l) => s + l.total, 0))}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {chosen && (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {(chosen.items ?? []).map((l) => (
                <li key={l.id} className="flex justify-between px-3 py-2">
                  <span>{l.quantity} × {l.name}</span>
                  <span className="tabular-nums">{amount(l.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Customer</h3>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Items</h3>
              <span className="text-sm font-semibold tabular-nums">Total {money(manualTotal)}</span>
            </div>
            <LineItemsEditor lines={lines} onChange={setLines} />
          </section>
        </>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Job details</h3>
        <Field label="Job type">{(p) => <Input {...p} value={meta.jobType} onChange={(e) => setMeta({ ...meta, jobType: e.target.value })} placeholder="Banner, sticker, signage…" />}</Field>
        <Field label="Priority">
          {(p) => (
            <Select {...p} value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: e.target.value as typeof meta.priority })}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
          )}
        </Field>
        <Field label="Deadline">{(p) => <Input {...p} type="date" value={meta.deadline} onChange={(e) => setMeta({ ...meta, deadline: e.target.value })} />}</Field>
        <Field label="Agreed advance (ETB)">{(p) => <Input {...p} inputMode="decimal" value={meta.advancePayment} onChange={(e) => setMeta({ ...meta, advancePayment: e.target.value })} />}</Field>
        <Field label="Artwork file location" hint="Where the design file is saved (uploads come in version 2)." className="sm:col-span-2">
          {(p) => <Input {...p} value={meta.artworkPath} onChange={(e) => setMeta({ ...meta, artworkPath: e.target.value })} placeholder="D:\\Designs\\2026\\…" />}
        </Field>
        <Field label="Description" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />}</Field>
      </section>
    </form>
  );
}
