import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";
import { paymentSchema } from "@shared/schemas";

type PaymentInputState = {
  amount: number;
  method: "Cash" | "Bank";
  transactionNumber: string;
};

type FinanceJob = {
  id: number;
  number: string;
  price?: number;
  jobItems?: { total?: number }[];
  payments?: { amount?: number }[];
  customerSnapshot?: { name?: string };
  customer?: { name?: string };
};

type PaymentRecord = {
  id: number;
  jobId?: number;
  amount?: number;
  transactionNumber?: string;
  verified?: boolean;
  jobOrder?: { status?: string };
};

type ApiError = {
  response?: {
    data?: { message?: string };
  };
};

export default function Payments() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [financeQueue, setFinanceQueue] = useState<{ completed: FinanceJob[]; finance: FinanceJob[] }>({ completed: [], finance: [] });
  const [queueLoading, setQueueLoading] = useState(false);
  const [jobPaymentInputs, setJobPaymentInputs] = useState<Record<number, PaymentInputState>>({});
  const [processingJobs, setProcessingJobs] = useState<number[]>([]);
  const [jobErrors, setJobErrors] = useState<Record<number, string>>({});

  const jobPrice = useCallback((job: FinanceJob) => {
    if (job.price) return Number(job.price);
    if (job.jobItems?.length) {
      return job.jobItems.reduce((sum: number, it) => sum + Number(it.total || 0), 0);
    }
    return 0;
  }, []);

  const jobPaidTotal = useCallback((job: FinanceJob) => (job.payments || []).reduce((sum: number, p) => sum + Number(p.amount || 0), 0), []);

  const jobOutstanding = useCallback((job: FinanceJob) => Math.max(jobPrice(job) - jobPaidTotal(job), 0), [jobPrice, jobPaidTotal]);

  const load = useCallback(async () => {
    const res = await api.get("/payments");
    setPayments(res.data);
  }, []);

  const fetchJobsByStatus = useCallback(async (status: string): Promise<FinanceJob[]> => {
    const res = await api.get("/jobs", { params: { status, pageSize: 50 } });
    return (res.data?.data ?? res.data ?? []) as FinanceJob[];
  }, []);

  const loadFinanceQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [completed, finance] = await Promise.all([fetchJobsByStatus("completed"), fetchJobsByStatus("finance_review")]);
      setFinanceQueue({ completed, finance });
      const relevantJobs = [...completed, ...finance];
      setJobPaymentInputs((prev) => {
        const next: Record<number, PaymentInputState> = {};
        relevantJobs.forEach((job) => {
          const outstanding = jobOutstanding(job);
          const previous = prev[job.id];
          next[job.id] = {
            amount: previous?.amount ?? outstanding,
            method: previous?.method ?? "Cash",
            transactionNumber: previous?.transactionNumber ?? "",
          };
        });
        return next;
      });
      setJobErrors((prev) => {
        const filtered: Record<number, string> = {};
        relevantJobs.forEach((job) => {
          if (prev[job.id]) filtered[job.id] = prev[job.id];
        });
        return filtered;
      });
    } finally {
      setQueueLoading(false);
    }
  }, [fetchJobsByStatus, jobOutstanding]);

  useEffect(() => {
    load();
    loadFinanceQueue();
  }, [load, loadFinanceQueue]);

  const closeJob = async (jobId: number) => {
    await api.post(`/jobs/${jobId}/finance`, { status: "closed" });
    await load();
    await loadFinanceQueue();
  };

  const updateJobPayment = (jobId: number, updates: Partial<PaymentInputState>) => {
    setJobPaymentInputs((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...updates },
    }));
  };

  const handleAcceptPayment = async (job: FinanceJob) => {
    const input = jobPaymentInputs[job.id];
    if (!input) {
      setJobErrors((prev) => ({ ...prev, [job.id]: "Provide payment details" }));
      return;
    }
    const parsed = paymentSchema.safeParse({
      jobId: job.id,
      amount: Number(input.amount),
      method: input.method,
      transactionNumber: input.method === "Bank" ? input.transactionNumber : undefined,
    });
    if (!parsed.success) {
      setJobErrors((prev) => ({
        ...prev,
        [job.id]: parsed.error.issues[0]?.message || "Invalid payment data",
      }));
      return;
    }
    setProcessingJobs((prev) => [...prev, job.id]);
    try {
      await api.post("/payments", parsed.data);
      setJobErrors((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      load();
      loadFinanceQueue();
    } catch (error: unknown) {
      const message = typeof error === "object" && error !== null ? (error as ApiError).response?.data?.message : undefined;
      setJobErrors((prev) => ({
        ...prev,
        [job.id]: message || "Failed to record payment",
      }));
    } finally {
      setProcessingJobs((prev) => prev.filter((id) => id !== job.id));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Finance & CBE Verification</h2>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Finance Queue</h3>
          <button className="text-xs font-semibold text-primary" type="button" onClick={loadFinanceQueue} disabled={queueLoading}>
            {queueLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-600">Completed jobs (awaiting finance handoff)</p>
            <p className="text-xs text-slate-500">Production-completed jobs appear automatically once marked completed.</p>
            <div className="mt-3 space-y-2">
              {financeQueue.completed.map((job) => {
                const price = jobPrice(job);
                const totalPaid = jobPaidTotal(job);
                const outstanding = Math.max(price - totalPaid, 0);
                const inputState = jobPaymentInputs[job.id] ?? {
                  amount: outstanding,
                  method: "Cash",
                  transactionNumber: "",
                };
                const isProcessing = processingJobs.includes(job.id);
                const jobError = jobErrors[job.id];
                return (
                  <div key={job.id} className="rounded-lg border border-slate-200 p-3 text-sm shadow-sm dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-primary">{job.number}</div>
                      <span className="text-xs text-slate-500">ETB {price.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{job.customerSnapshot?.name || job.customer?.name || "Customer"}</p>
                    <div className="mt-3 space-y-3 rounded-lg border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-[11px] font-semibold text-slate-500">
                          Amount
                          <input
                            className="input mt-1"
                            type="number"
                            min={0}
                            value={inputState.amount}
                            onChange={(e) => updateJobPayment(job.id, { amount: Number(e.target.value) || 0 })}
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-500">
                          Method
                          <select
                            className="input mt-1"
                            value={inputState.method}
                            onChange={(e) =>
                              updateJobPayment(job.id, {
                                method: e.target.value as "Cash" | "Bank",
                                transactionNumber: e.target.value === "Cash" ? "" : inputState.transactionNumber,
                              })
                            }
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank Transfer</option>
                          </select>
                        </label>
                      </div>
                      {inputState.method === "Bank" && (
                        <label className="text-[11px] font-semibold text-slate-500">
                          Transaction #
                          <input
                            className="input mt-1"
                            value={inputState.transactionNumber}
                            onChange={(e) => updateJobPayment(job.id, { transactionNumber: e.target.value })}
                          />
                        </label>
                      )}
                      {jobError && <p className="text-xs text-red-500">{jobError}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {outstanding > 0 ? `Outstanding ETB ${outstanding.toFixed(2)}` : "Ready to close"}
                        </span>
                        <button
                          className="btn w-40 text-xs"
                          type="button"
                          onClick={() => handleAcceptPayment(job)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? "Recording..." : inputState.method === "Cash" ? "Accept Cash" : "Record Bank"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {financeQueue.completed.length === 0 && <p className="text-xs text-slate-400">No completed jobs waiting.</p>}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600">Finance review (ready for approval)</p>
            <p className="text-xs text-slate-500">Approve or record outstanding payments before closing jobs.</p>
            <div className="mt-3 space-y-2">
              {financeQueue.finance.map((job) => {
                const totalPaid = jobPaidTotal(job);
                const price = Number(job.price || 0);
                const outstanding = Math.max(price - totalPaid, 0);
                const inputState = jobPaymentInputs[job.id] ?? {
                  amount: outstanding,
                  method: "Cash",
                  transactionNumber: "",
                };
                const isProcessing = processingJobs.includes(job.id);
                const jobError = jobErrors[job.id];
                const canClose = outstanding <= 0;
                return (
                  <div key={job.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-fuchsia-700 dark:text-fuchsia-300">{job.number}</div>
                      <span className="text-xs text-slate-500">Due ETB {price.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-slate-500">Paid ETB {totalPaid.toFixed(2)} · Outstanding ETB {outstanding.toFixed(2)}</p>
                    <div className="mt-3 space-y-3 rounded-lg border-t border-amber-100 pt-3 text-xs dark:border-slate-800">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-[11px] font-semibold text-slate-500">
                          Amount to collect
                          <input
                            className="input mt-1"
                            type="number"
                            min={0}
                            value={inputState.amount}
                            onChange={(e) => updateJobPayment(job.id, { amount: Number(e.target.value) || 0 })}
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-500">
                          Method
                          <select
                            className="input mt-1"
                            value={inputState.method}
                            onChange={(e) =>
                              updateJobPayment(job.id, {
                                method: e.target.value as "Cash" | "Bank",
                                transactionNumber: e.target.value === "Cash" ? "" : inputState.transactionNumber,
                              })
                            }
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank Transfer</option>
                          </select>
                        </label>
                      </div>
                      {inputState.method === "Bank" && (
                        <label className="text-[11px] font-semibold text-slate-500">
                          Transaction #
                          <input
                            className="input mt-1"
                            value={inputState.transactionNumber}
                            onChange={(e) => updateJobPayment(job.id, { transactionNumber: e.target.value })}
                          />
                        </label>
                      )}
                      {jobError && <p className="text-xs text-red-500">{jobError}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {outstanding > 0 ? `Outstanding ETB ${outstanding.toFixed(2)}` : "Outstanding cleared"}
                        </span>
                        <button className="btn w-40 text-xs" type="button" onClick={() => handleAcceptPayment(job)} disabled={isProcessing}>
                          {isProcessing ? "Recording..." : "Approve Outstanding"}
                        </button>
                      </div>
                    </div>
                    <button
                      className="btn mt-2 w-full bg-emerald-600 text-xs text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      type="button"
                      onClick={() => closeJob(job.id)}
                      disabled={!canClose}
                    >
                      {canClose ? "Mark as Closed" : "Collect outstanding first"}
                    </button>
                  </div>
                );
              })}
              {financeQueue.finance.length === 0 && <p className="text-xs text-slate-400">Nothing awaiting finance approval.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">Recent Payments</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-2 py-1">ID</th>
                <th className="px-2 py-1">Job</th>
                <th className="px-2 py-1">Amount</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-2">{p.id}</td>
                  <td className="px-2 py-2">{p.jobId}</td>
                  <td className="px-2 py-2">ETB {p.amount}</td>
                  <td className="px-2 py-2">{p.jobOrder?.status?.toLowerCase() === "closed" || p.verified ? "Complete" : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
