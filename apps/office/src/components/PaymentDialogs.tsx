import { useState, type FormEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Field, FormError, Input } from "./ui/form";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/api";
import { money } from "../lib/format";
import { useRecordPayment, useVerifyPayment } from "../lib/queries";
import { jobBalance } from "../lib/totals";
import type { CbeResult, Job, Payment } from "../lib/types";

export function RecordPaymentDialog({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const record = useRecordPayment();
  return (
    <Dialog
      open={!!job}
      onClose={onClose}
      size="sm"
      title={`Record payment${job ? ` · ${job.number}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={record.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      {job && <PaymentForm job={job} error={record.error ? errorMessage(record.error) : null} onSubmit={(input) => record.mutate(input, { onSuccess: () => (toast.success("Payment recorded"), onClose()) })} />}
    </Dialog>
  );
}

function PaymentForm({ job, error, onSubmit }: { job: Job; error: string | null; onSubmit: (p: { jobId: number; amount: number; method: "Cash" | "Bank"; transactionNumber?: string }) => void }) {
  const { price, paid, balance } = jobBalance(job);
  const [amountText, setAmount] = useState(String(balance || ""));
  const [method, setMethod] = useState<"Cash" | "Bank">("Cash");
  const [trx, setTrx] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(amountText);
    if (!(amount > 0)) return setProblem("Enter an amount above 0.");
    if (method === "Bank" && trx.trim().length < 5) return setProblem("Enter the CBE transaction number for bank transfers.");
    setProblem(null);
    onSubmit({ jobId: job.id, amount, method, transactionNumber: method === "Bank" ? trx.trim() : undefined });
  };

  return (
    <form id="payment-form" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error ?? problem} />
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface-muted p-3 text-center text-sm">
        <div><dt className="text-xs text-ink-subtle">Price</dt><dd className="font-medium tabular-nums">{money(price)}</dd></div>
        <div><dt className="text-xs text-ink-subtle">Paid</dt><dd className="font-medium tabular-nums">{money(paid)}</dd></div>
        <div><dt className="text-xs text-ink-subtle">Balance</dt><dd className="font-semibold text-accent-600 tabular-nums">{money(balance)}</dd></div>
      </dl>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1" role="radiogroup" aria-label="Payment method">
        {(["Cash", "Bank"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={cn("h-9 rounded-md text-sm font-medium", method === m ? "bg-surface shadow-xs" : "text-ink-muted")}
          >
            {m === "Bank" ? "Bank (CBE)" : "Cash"}
          </button>
        ))}
      </div>
      <Field label="Amount (ETB)" required>
        {(p) => <Input {...p} inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} autoFocus />}
      </Field>
      {method === "Bank" && (
        <Field label="CBE transaction number" required hint="Verify it against the CBE receipt afterwards.">
          {(p) => <Input {...p} value={trx} onChange={(e) => setTrx(e.target.value.toUpperCase())} placeholder="FT26…" autoCapitalize="characters" />}
        </Field>
      )}
      <p className="text-xs text-ink-subtle">
        When the job is fully paid it closes automatically for cash, or moves to finance review for bank transfers.
      </p>
    </form>
  );
}

export function VerifyPaymentDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const verify = useVerifyPayment();
  const [result, setResult] = useState<CbeResult | null>(null);
  const close = () => {
    setResult(null);
    verify.reset();
    onClose();
  };
  return (
    <Dialog
      open={!!payment}
      onClose={close}
      size="sm"
      title="Verify CBE payment"
      description={payment ? `${payment.transactionNumber} · ${money(payment.amount)}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
          {payment && (
            <Button
              loading={verify.isPending}
              onClick={() =>
                verify.mutate(
                  { id: payment.id, transactionNumber: payment.transactionNumber ?? "", expectedAmount: payment.amount },
                  { onSuccess: setResult, onError: (err) => toast.error(errorMessage(err)) },
                )
              }
            >
              {result ? "Check again" : "Check with CBE"}
            </Button>
          )}
        </>
      }
    >
      {!result ? (
        <p className="text-sm text-ink-muted">
          Downloads the official CBE receipt and checks the receiver (Team Advert), account, reference and amount.
        </p>
      ) : result.success ? (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Payment verified</p>
            <p className="text-sm">
              {result.parsed?.receiver} · {result.parsed?.reference} · {money(result.parsed?.amount)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <XCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Not verified</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {(result.issues ?? []).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Dialog>
  );
}
