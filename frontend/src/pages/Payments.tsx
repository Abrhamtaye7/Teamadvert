import { useEffect, useState } from "react";
import api from "../lib/api";
import { paymentSchema, cbeVerifySchema } from "@shared/schemas";

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [form, setForm] = useState({ jobId: 1, amount: 0, transactionNumber: "" });
  const [verifyForm, setVerifyForm] = useState({ id: 0, transactionNumber: "", expectedAmount: 0 });

  const load = async () => {
    const res = await api.get("/payments");
    setPayments(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = paymentSchema.safeParse({ ...form, method: "Transfer" });
    if (!parsed.success) {
      alert(parsed.error.issues[0].message);
      return;
    }
    await api.post("/payments", parsed.data);
    setForm({ jobId: 1, amount: 0, transactionNumber: "" });
    load();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = cbeVerifySchema.safeParse(verifyForm);
    if (!parsed.success) {
      alert(parsed.error.issues[0].message);
      return;
    }
    await api.post(`/payments/${verifyForm.id}/verify`, parsed.data);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Finance & CBE Verification</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold">Record Payment</h3>
          <form onSubmit={create} className="space-y-2">
            <input
              className="input"
              type="number"
              placeholder="Job ID"
              value={form.jobId}
              onChange={(e) => setForm({ ...form, jobId: Number(e.target.value) })}
            />
            <input
              className="input"
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
            <input
              className="input"
              placeholder="Transaction #"
              value={form.transactionNumber}
              onChange={(e) => setForm({ ...form, transactionNumber: e.target.value })}
            />
            <button className="btn w-full" type="submit">Save</button>
          </form>
        </div>

        <div className="card">
          <h3 className="mb-2 font-semibold">Verify CBE TRX</h3>
          <form onSubmit={verify} className="space-y-2">
            <select className="input" value={verifyForm.id} onChange={(e) => setVerifyForm({ ...verifyForm, id: Number(e.target.value) })}>
              <option value={0}>Select payment</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} - {p.transactionNumber || "N/A"}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Transaction #"
              value={verifyForm.transactionNumber}
              onChange={(e) => setVerifyForm({ ...verifyForm, transactionNumber: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Expected Amount"
              value={verifyForm.expectedAmount}
              onChange={(e) => setVerifyForm({ ...verifyForm, expectedAmount: Number(e.target.value) })}
            />
            <button className="btn w-full" type="submit">Verify</button>
          </form>
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
                <th className="px-2 py-1">Verified</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-2">{p.id}</td>
                  <td className="px-2 py-2">{p.jobId}</td>
                  <td className="px-2 py-2">ETB {p.amount}</td>
                  <td className="px-2 py-2">{p.verified ? "Verified" : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
