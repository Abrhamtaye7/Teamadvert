import { useState } from "react";
import { Link } from "react-router";
import { CircleDollarSign, Hourglass, Lock, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "../../auth/permissions";
import { RecordPaymentDialog, VerifyPaymentDialog } from "../../components/PaymentDialogs";
import { Button } from "../../components/ui/Button";
import { DataList } from "../../components/ui/DataList";
import { Badge, Card, CardHeader, EmptyState, StatCard, StatusBadge } from "../../components/ui/display";
import { FilterTabs, PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { dateTime, money } from "../../lib/format";
import { useJobFinance, useJobs, usePayments, useReportOverview } from "../../lib/queries";
import { jobBalance } from "../../lib/totals";
import type { Job, Payment } from "../../lib/types";

type Queue = "completed" | "finance_review";

export default function FinancePage() {
  const can = useCan();
  const [queue, setQueue] = useState<Queue>("completed");
  const [paying, setPaying] = useState<Job | null>(null);
  const [verifying, setVerifying] = useState<Payment | null>(null);
  const completed = useJobs({ status: "completed", pageSize: 100 });
  const review = useJobs({ status: "finance_review", pageSize: 100 });
  const payments = usePayments();
  const overview = useReportOverview(6);
  const finance = useJobFinance();
  const jobs = queue === "completed" ? completed : review;
  const unverified = payments.data?.filter((p) => p.method === "Bank" && !p.verified) ?? [];

  const close = (job: Job) =>
    finance.mutate({ id: job.id, status: "closed" }, { onSuccess: () => toast.success(`${job.number} closed`), onError: (err) => toast.error(errorMessage(err)) });

  return (
    <>
      <PageHeader title="Finance" description="Collect payments, verify CBE transfers and close finished jobs." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected this month" value={money(overview.data?.summary.collectedThisMonth)} icon={CircleDollarSign} tone="green" />
        <StatCard label="Outstanding (open jobs)" value={money(overview.data?.summary.outstandingTotal)} icon={Hourglass} tone="orange" />
        <StatCard label="Awaiting payment" value={completed.data?.total ?? "—"} icon={Wallet} hint="Completed jobs" />
        <StatCard label="Bank transfers to verify" value={unverified.length} icon={ShieldCheck} tone="purple" />
      </div>

      <Card className="mb-4">
        <div className="border-b border-line p-3">
          <FilterTabs<Queue>
            value={queue}
            onChange={setQueue}
            options={[
              { value: "completed", label: "Completed — awaiting payment", count: completed.data?.total },
              { value: "finance_review", label: "Finance review", count: review.data?.total },
            ]}
          />
        </div>
        <DataList
          rows={jobs.data?.data}
          loading={jobs.isLoading}
          error={jobs.error ? errorMessage(jobs.error) : null}
          rowKey={(j) => j.id}
          empty={<EmptyState icon={Wallet} title="Nothing waiting" description={queue === "completed" ? "Completed jobs appear here for payment." : "Bank-paid jobs appear here until they're closed."} />}
          columns={[
            { key: "number", header: "Job", cell: (j) => <Link to={`/jobs/${j.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{j.number}</Link> },
            { key: "customer", header: "Customer", cell: (j) => j.customer?.name ?? "—" },
            { key: "price", header: "Price", align: "right", cell: (j) => money(j.price) },
            { key: "paid", header: "Paid", align: "right", cell: (j) => money(jobBalance(j).paid) },
            { key: "balance", header: "Balance", align: "right", cell: (j) => <span className="font-semibold text-accent-700 dark:text-accent-400">{money(jobBalance(j).balance)}</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (j) => (
                <div className="flex justify-end gap-2">
                  {can("payment.record") && jobBalance(j).balance > 0 && <Button size="sm" onClick={() => setPaying(j)}>Record payment</Button>}
                  {can("job.finance") && <Button size="sm" variant="secondary" icon={Lock} onClick={() => close(j)}>Close</Button>}
                </div>
              ),
            },
          ]}
          card={(j) => {
            const b = jobBalance(j);
            return (
              <div>
                <div className="flex items-center justify-between">
                  <Link to={`/jobs/${j.id}`} className="font-medium text-brand-700 dark:text-brand-300">{j.number}</Link>
                  <span className="text-sm font-semibold text-accent-700 dark:text-accent-400 tabular-nums">{money(b.balance)}</span>
                </div>
                <p className="text-sm text-ink-muted">{j.customer?.name} · paid {money(b.paid)} of {money(b.price)}</p>
                <div className="mt-2 flex gap-2">
                  {can("payment.record") && b.balance > 0 && <Button size="sm" className="flex-1" onClick={() => setPaying(j)}>Record payment</Button>}
                  {can("job.finance") && <Button size="sm" variant="secondary" className="flex-1" icon={Lock} onClick={() => close(j)}>Close</Button>}
                </div>
              </div>
            );
          }}
        />
      </Card>

      <Card>
        <CardHeader title="Recent payments" description="Bank transfers must be verified against the CBE receipt." />
        <DataList
          rows={payments.data}
          loading={payments.isLoading}
          error={payments.error ? errorMessage(payments.error) : null}
          rowKey={(p) => p.id}
          empty={<EmptyState icon={CircleDollarSign} title="No payments yet" />}
          columns={[
            { key: "date", header: "Date", cell: (p) => dateTime(p.createdAt) },
            { key: "job", header: "Job", cell: (p) => (p.jobOrder ? <Link to={`/jobs/${p.jobId}`} className="text-brand-700 dark:text-brand-300 hover:underline">{p.jobOrder.number}</Link> : "—") },
            { key: "method", header: "Method", cell: (p) => <span>{p.method}{p.transactionNumber && <span className="ml-1 font-mono text-xs text-ink-muted">{p.transactionNumber}</span>}</span> },
            { key: "amount", header: "Amount", align: "right", cell: (p) => money(p.amount) },
            {
              key: "status",
              header: "Status",
              cell: (p) =>
                p.verified ? <Badge tone="green">Verified</Badge> : p.method === "Bank" ? (can("payment.record") ? <Button size="sm" variant="secondary" onClick={() => setVerifying(p)}>Verify with CBE</Button> : <Badge tone="yellow">Unverified</Badge>) : <StatusBadge status={p.jobOrder?.status} />,
            },
          ]}
          card={(p) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.jobOrder?.number ?? "—"} · {p.method}</p>
                <p className="truncate text-xs text-ink-subtle">{dateTime(p.createdAt)}{p.transactionNumber ? ` · ${p.transactionNumber}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium tabular-nums">{money(p.amount)}</span>
                {p.verified ? <Badge tone="green">Verified</Badge> : p.method === "Bank" && can("payment.record") ? <Button size="sm" variant="secondary" onClick={() => setVerifying(p)}>Verify</Button> : null}
              </div>
            </div>
          )}
        />
      </Card>

      <RecordPaymentDialog job={paying} onClose={() => setPaying(null)} />
      <VerifyPaymentDialog payment={verifying} onClose={() => setVerifying(null)} />
    </>
  );
}
