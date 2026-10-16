import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { BadgeCheck, CheckCircle2, Factory, Lock, Printer, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "../../auth/permissions";
import { RecordPaymentDialog, VerifyPaymentDialog } from "../../components/PaymentDialogs";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Badge, Card, CardHeader, DetailList, EmptyState, ErrorState, PageLoader, StatusBadge } from "../../components/ui/display";
import { Field, FormError, Input, Select, Textarea } from "../../components/ui/form";
import { PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { amount, date, dateTime, money } from "../../lib/format";
import { useApproveJob, useJob, useJobFinance, useJobProduction } from "../../lib/queries";
import { jobBalance } from "../../lib/totals";
import type { Job, JobStatus, Payment } from "../../lib/types";
import { printJob } from "../../print/documents";

const STEPS: { status: JobStatus; label: string }[] = [
  { status: "pending_approval", label: "Approval" },
  { status: "approved", label: "Approved" },
  { status: "in_progress", label: "Production" },
  { status: "completed", label: "Completed" },
  { status: "finance_review", label: "Finance" },
  { status: "closed", label: "Closed" },
];

function Stepper({ status }: { status: JobStatus }) {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Job progress">
      {STEPS.map((s, i) => (
        <li key={s.status} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-current={i === current ? "step" : undefined}>
          <div className="flex w-full items-center">
            <div className={cn("h-0.5 flex-1", i === 0 ? "invisible" : i <= current ? "bg-brand-600" : "bg-line")} />
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                i < current ? "bg-brand-600 text-white" : i === current ? "bg-accent-500 text-white ring-4 ring-accent-500/20" : "bg-surface-muted text-ink-subtle",
              )}
            >
              {i + 1}
            </span>
            <div className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "invisible" : i < current ? "bg-brand-600" : "bg-line")} />
          </div>
          <span className={cn("whitespace-nowrap text-[11px]", i === current ? "font-semibold text-ink" : "text-ink-subtle")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function ApproveDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const approve = useApproveJob(job.id);
  const [form, setForm] = useState({
    price: String(job.price ?? ""),
    deadline: job.deadline ? job.deadline.slice(0, 10) : "",
    priority: (job.priority ?? "normal") as "high" | "normal" | "low",
    advancePayment: job.advancePayment != null ? String(job.advancePayment) : "",
    adminNotes: job.adminNotes ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    approve.mutate(
      {
        price: form.price ? Number(form.price) : undefined,
        deadline: form.deadline || undefined,
        priority: form.priority,
        advancePayment: form.advancePayment ? Number(form.advancePayment) : undefined,
        adminNotes: form.adminNotes.trim() || undefined,
      },
      { onSuccess: () => (toast.success(`${job.number} approved`), onClose()) },
    );
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={job.status === "approved" ? `Update ${job.number}` : `Approve ${job.number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="approve-form" variant="success" loading={approve.isPending}>
            {job.status === "approved" ? "Save" : "Approve job"}
          </Button>
        </>
      }
    >
      <form id="approve-form" onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <FormError message={approve.error ? errorMessage(approve.error) : null} />
        <Field label="Price (ETB)" className="col-span-2">{(p) => <Input {...p} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />}</Field>
        <Field label="Deadline">{(p) => <Input {...p} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />}</Field>
        <Field label="Priority">
          {(p) => (
            <Select {...p} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
          )}
        </Field>
        <Field label="Advance (ETB)" className="col-span-2">{(p) => <Input {...p} inputMode="decimal" value={form.advancePayment} onChange={(e) => setForm({ ...form, advancePayment: e.target.value })} />}</Field>
        <Field label="Notes for the team" className="col-span-2">{(p) => <Textarea {...p} rows={3} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} />}</Field>
      </form>
    </Dialog>
  );
}

export default function JobDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const { data: job, isLoading, error, refetch } = useJob(id);
  const production = useJobProduction(id);
  const finance = useJobFinance();
  const [approving, setApproving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState<Payment | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !job) return <ErrorState message={error ? errorMessage(error) : "Job not found"} onRetry={refetch} />;

  const { price, paid, balance } = jobBalance(job);
  const s = job.status;
  const notify = { onError: (err: unknown) => toast.error(errorMessage(err)) };
  const move = (status: "in_progress" | "completed") => production.mutate(status, { ...notify, onSuccess: () => toast.success(status === "completed" ? "Marked completed" : "Production started") });
  const fin = (status: "finance_review" | "closed" | "approved") => finance.mutate({ id, status }, { ...notify, onSuccess: () => toast.success(status === "closed" ? "Job closed" : status === "approved" ? "Sent back to production" : "Sent to finance review") });
  const busy = production.isPending || finance.isPending;

  const actions = [
    can("job.approve") && (s === "pending_approval" || s === "approved") && (
      <Button key="approve" variant={s === "pending_approval" ? "success" : "secondary"} icon={BadgeCheck} onClick={() => setApproving(true)}>
        {s === "pending_approval" ? "Approve" : "Edit approval"}
      </Button>
    ),
    can("job.production") && s === "approved" && (
      <Button key="start" icon={Factory} loading={busy} onClick={() => move("in_progress")}>Start production</Button>
    ),
    can("job.production") && (s === "approved" || s === "in_progress") && (
      <Button key="done" variant="accent" icon={CheckCircle2} loading={busy} onClick={() => move("completed")}>Mark completed</Button>
    ),
    can("payment.record") && ["approved", "in_progress", "completed", "finance_review"].includes(s) && (
      <Button key="pay" variant="secondary" icon={Wallet} onClick={() => setPaying(true)}>Record payment</Button>
    ),
    can("job.finance") && s === "completed" && (
      <Button key="review" variant="secondary" loading={busy} onClick={() => fin("finance_review")}>Send to finance review</Button>
    ),
    can("job.finance") && (s === "completed" || s === "finance_review") && (
      <Button key="close" variant="success" icon={Lock} loading={busy} onClick={() => fin("closed")}>Close job</Button>
    ),
    can("job.finance") && s === "finance_review" && (
      <Button key="back" variant="ghost" icon={Undo2} loading={busy} onClick={() => fin("approved")}>Send back</Button>
    ),
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ to: "/jobs", label: "Job orders" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {job.number} <StatusBadge status={s} />
            {job.priority === "high" && <Badge tone="red">High priority</Badge>}
          </span>
        }
        description={`${job.customer?.name ?? "—"} · created ${date(job.createdAt)} by ${job.createdBy?.username ?? "—"}`}
        actions={
          <Button variant="secondary" icon={Printer} onClick={() => !printJob(job) && toast.error("Allow pop-ups to print")}>
            Print
          </Button>
        }
      />

      <Card className="mb-4 p-4 md:p-5">
        <Stepper status={s} />
        {actions.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">{actions}</div>}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-line">
              {(job.jobItems ?? []).map((l) => (
                <li key={l.id} className="flex justify-between gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{l.name}</p>
                    {l.description && <p className="text-sm text-ink-muted">{l.description}</p>}
                    <p className="mt-1 text-xs text-ink-subtle">{l.quantity} {l.unit ?? ""} × {amount(l.price)}</p>
                  </div>
                  <p className="font-medium tabular-nums">{amount(l.total)}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Payments" description={`${money(paid)} of ${money(price)} paid`} />
            <div className="px-4 pt-3 md:px-5">
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${price ? Math.min(100, (paid / price) * 100) : 0}%` }} />
              </div>
              <p className="mt-1.5 text-sm">Balance <span className="font-semibold text-accent-600 tabular-nums">{money(balance)}</span></p>
            </div>
            {job.payments?.length ? (
              <ul className="mt-2 divide-y divide-line">
                {job.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {p.method ?? "Payment"} {p.transactionNumber && <span className="font-mono text-xs text-ink-muted">{p.transactionNumber}</span>}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {dateTime(p.createdAt)}
                        {p.verificationNote && <span className="text-rose-600"> · {p.verificationNote}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{money(p.amount)}</span>
                      {p.verified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : p.method === "Bank" && can("payment.record") ? (
                        <Button size="sm" variant="secondary" onClick={() => setVerifying(p)}>Verify</Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No payments yet" />
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Details" />
          <div className="p-4 md:p-5">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Customer", value: job.customer ? <Link className="text-brand-600 hover:underline" to={`/customers/${job.customer.id}`}>{job.customer.name}</Link> : "—" },
                { label: "Proforma", value: job.proforma ? <Link className="text-brand-600 hover:underline" to={`/proformas/${job.proforma.id}`}>{job.proforma.number}</Link> : "Manual job" },
                { label: "Job type", value: job.jobType ?? "—" },
                { label: "Deadline", value: date(job.deadline) },
                { label: "Agreed advance", value: job.advancePayment != null ? money(job.advancePayment) : "—" },
                { label: "Artwork", value: job.artworkPath ? <span className="break-all font-mono text-xs">{job.artworkPath}</span> : "—" },
                { label: "Description", value: job.description ?? "—" },
                { label: "Admin notes", value: job.adminNotes ?? "—" },
              ]}
            />
          </div>
        </Card>
      </div>

      <ApproveDialog job={job} open={approving} onClose={() => setApproving(false)} />
      <RecordPaymentDialog job={paying ? job : null} onClose={() => setPaying(false)} />
      <VerifyPaymentDialog payment={verifying} onClose={() => setVerifying(null)} />
    </>
  );
}
