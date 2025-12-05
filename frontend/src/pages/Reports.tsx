import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import api from "../lib/api";
import { StatCard } from "../components/StatCard";

interface ReportSummary {
  jobsThisMonth: number;
  collectedThisMonth: number;
  outstandingThisMonth: number;
  outstandingTotal: number;
  pendingJobs: number;
  financeApprovedTotal: number;
}

interface ReportPoint {
  month: string;
  jobs: number;
  collected: number;
  outstanding: number;
}

interface ReportResponse {
  summary: ReportSummary;
  chart: ReportPoint[];
}

export default function Reports() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintable, setShowPrintable] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printRows, setPrintRows] = useState<any[]>([]);
  const [printFilters, setPrintFilters] = useState({
    startDate: "",
    endDate: "",
    status: "",
    user: "",
    item: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/reports/overview", { params: { months: 6 } });
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadPrintableReport = async () => {
    setPrintLoading(true);
    try {
      const params: Record<string, any> = { pageSize: 100 };
      if (printFilters.startDate) params.startDate = printFilters.startDate;
      if (printFilters.endDate) params.endDate = printFilters.endDate;
      if (printFilters.status) params.status = printFilters.status;
      if (printFilters.user) params.createdBy = printFilters.user;
      if (printFilters.item) params.itemName = printFilters.item;
      const res = await api.get("/jobs", { params });
      setPrintRows(res.data?.data ?? res.data ?? []);
    } catch (err) {
      console.error(err);
      setPrintRows([]);
    } finally {
      setPrintLoading(false);
    }
  };

  useEffect(() => {
    if (showPrintable) {
      loadPrintableReport();
    }
  }, [showPrintable]);

  const cards = [
    { title: "Jobs this month", value: data?.summary.jobsThisMonth ?? 0 },
    { title: "Collected this month", value: `ETB ${(data?.summary.collectedThisMonth ?? 0).toFixed(2)}` },
    { title: "Outstanding this month", value: `ETB ${(data?.summary.outstandingThisMonth ?? 0).toFixed(2)}` },
    { title: "Outstanding total", value: `ETB ${(data?.summary.outstandingTotal ?? 0).toFixed(2)}` },
    { title: "Pending jobs", value: data?.summary.pendingJobs ?? 0 },
    { title: "Finance approved total", value: `ETB ${(data?.summary.financeApprovedTotal ?? 0).toFixed(2)}` },
  ];

  const formatDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-500">Monthly performance overview with collection and outstanding tracking.</p>
        <button
          className="btn mt-3"
          type="button"
          onClick={() => setShowPrintable((prev) => !prev)}
        >
          {showPrintable ? "Hide Printable Report" : "Printable Report"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.title} title={card.title} value={card.value} />
        ))}
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">6-Month Performance</h3>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="h-80">
          {data && data.chart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chart} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Bar yAxisId="left" dataKey="jobs" name="Jobs" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="outstanding" name="Outstanding" stroke="#f97316" strokeDasharray="4 4" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">No data</div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Monthly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-2 py-1">Month</th>
                <th className="px-2 py-1">Jobs</th>
                <th className="px-2 py-1">Collected</th>
                <th className="px-2 py-1">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data?.chart && data.chart.length > 0 ? (
                data.chart.map((row) => (
                  <tr key={row.month} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 font-medium">{row.month}</td>
                    <td className="px-2 py-2">{row.jobs}</td>
                    <td className="px-2 py-2">ETB {row.collected.toFixed(2)}</td>
                    <td className="px-2 py-2">ETB {row.outstanding.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-2 py-2 text-slate-500" colSpan={4}>
                    {loading ? "Loading..." : "No data"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPrintable && (
        <div className="card print:border-none print:shadow-none">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Printable Job Report</h3>
              <p className="text-xs text-slate-500">Filter by date, status, user, or item and export-ready layout.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn text-xs" type="button" onClick={loadPrintableReport} disabled={printLoading}>
                {printLoading ? "Loading..." : "Apply Filters"}
              </button>
              <button className="btn text-xs" type="button" onClick={() => window.print()}>
                Print
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-500">
              Start date
              <input
                type="date"
                className="input mt-1"
                value={printFilters.startDate}
                onChange={(e) => setPrintFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              End date
              <input
                type="date"
                className="input mt-1"
                value={printFilters.endDate}
                onChange={(e) => setPrintFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Status
              <select
                className="input mt-1"
                value={printFilters.status}
                onChange={(e) => setPrintFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Any</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="finance_review">Finance Review</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Created by (user)
              <input
                className="input mt-1"
                placeholder="Username"
                value={printFilters.user}
                onChange={(e) => setPrintFilters((prev) => ({ ...prev, user: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Item contains
              <input
                className="input mt-1"
                placeholder="Item name"
                value={printFilters.item}
                onChange={(e) => setPrintFilters((prev) => ({ ...prev, item: e.target.value }))}
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm print:text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1">Job #</th>
                  <th className="px-2 py-1">Customer</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Price</th>
                  <th className="px-2 py-1">Created</th>
                  <th className="px-2 py-1">Owner</th>
                </tr>
              </thead>
              <tbody>
                {printRows.length === 0 && !printLoading && (
                  <tr>
                    <td className="px-2 py-3 text-center text-slate-400" colSpan={6}>
                      No jobs match filters
                    </td>
                  </tr>
                )}
                {printRows.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100 text-slate-700 dark:border-slate-800">
                    <td className="px-2 py-2 font-semibold">{job.number}</td>
                    <td className="px-2 py-2">{job.customerSnapshot?.name || job.customer?.name || "—"}</td>
                    <td className="px-2 py-2 capitalize">{(job.status || "").replaceAll("_", " ")}</td>
                    <td className="px-2 py-2">ETB {Number(job.price || 0).toFixed(2)}</td>
                    <td className="px-2 py-2">{formatDate(job.createdAt)}</td>
                    <td className="px-2 py-2">{job.createdBy?.username || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
