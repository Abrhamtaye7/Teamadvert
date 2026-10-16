import { useState, type FormEvent } from "react";
import { Briefcase, CircleDollarSign, Hourglass, Printer, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { MonthlyChart } from "../../components/ui/BarChart";
import { Button } from "../../components/ui/Button";
import { DataList } from "../../components/ui/DataList";
import { Card, CardHeader, ErrorState, Spinner, StatCard, StatusBadge } from "../../components/ui/display";
import { Field, Input, Select } from "../../components/ui/form";
import { FilterTabs, PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, humanize, money, todayInput } from "../../lib/format";
import { fetchJobs, useReportOverview } from "../../lib/queries";
import type { Job } from "../../lib/types";
import { printJobsReport } from "../../print/documents";
import { JOB_STATUS_TABS } from "../jobs/JobsPage";

const firstOfMonth = () => `${todayInput().slice(0, 8)}01`;

export default function ReportsPage() {
  const [months, setMonths] = useState("6");
  const overview = useReportOverview(Number(months));
  const s = overview.data?.summary;
  const [filters, setFilters] = useState({ startDate: firstOfMonth(), endDate: todayInput(), status: "", createdBy: "", itemName: "" });
  const [rows, setRows] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(false);

  const describe = () =>
    [
      `${date(filters.startDate)} – ${date(filters.endDate)}`,
      filters.status && humanize(filters.status),
      filters.createdBy && `created by ${filters.createdBy}`,
      filters.itemName && `item "${filters.itemName}"`,
    ]
      .filter(Boolean)
      .join(" · ");

  const run = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setRows((await fetchJobs({ ...filters, pageSize: 200 })).data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Reports" description="Monthly performance and printable job reports." />

      <div className="mb-3 flex justify-end">
        <FilterTabs value={months} onChange={setMonths} options={[{ value: "3", label: "3 months" }, { value: "6", label: "6 months" }, { value: "12", label: "12 months" }]} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jobs this month" value={s?.jobsThisMonth ?? "—"} icon={Briefcase} />
        <StatCard label="Collected this month" value={money(s?.collectedThisMonth)} icon={CircleDollarSign} tone="green" />
        <StatCard label="Outstanding (open jobs)" value={money(s?.outstandingTotal)} icon={Hourglass} tone="orange" />
        <StatCard label="Finance approved (all time)" value={money(s?.financeApprovedTotal)} icon={Wallet} tone="purple" />
      </div>
      <Card className="mb-4">
        <CardHeader title="Collected vs outstanding" />
        <div className="p-4 md:p-5">
          {overview.error ? <ErrorState message={errorMessage(overview.error)} onRetry={overview.refetch} /> : overview.data ? <MonthlyChart data={overview.data.chart} /> : <div className="flex justify-center py-10"><Spinner /></div>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Job report" description="Filter jobs, then print or save as PDF." />
        <form onSubmit={run} className="grid grid-cols-2 gap-3 p-4 md:grid-cols-6 md:p-5">
          <Field label="From">{(p) => <Input {...p} type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />}</Field>
          <Field label="To">{(p) => <Input {...p} type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />}</Field>
          <Field label="Status">
            {(p) => (
              <Select {...p} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                {JOB_STATUS_TABS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Created by">{(p) => <Input {...p} value={filters.createdBy} onChange={(e) => setFilters({ ...filters, createdBy: e.target.value })} />}</Field>
          <Field label="Item">{(p) => <Input {...p} value={filters.itemName} onChange={(e) => setFilters({ ...filters, itemName: e.target.value })} />}</Field>
          <div className="col-span-2 flex items-end gap-2 md:col-span-1">
            <Button type="submit" icon={Search} loading={loading} className="flex-1">Run</Button>
            <Button variant="secondary" icon={Printer} disabled={!rows?.length} onClick={() => rows && !printJobsReport(describe(), describe(), rows) && toast.error("Allow pop-ups to print")} aria-label="Print report" />
          </div>
        </form>
        {rows && (
          <>
            <p className="border-t border-line px-4 py-2 text-sm text-ink-muted md:px-5">
              {rows.length} jobs · total {money(rows.reduce((sum, j) => sum + Number(j.price || 0), 0))}
            </p>
            <DataList
              rows={rows}
              rowKey={(j) => j.id}
              columns={[
                { key: "n", header: "Job", cell: (j) => <span className="font-medium">{j.number}</span> },
                { key: "d", header: "Date", cell: (j) => date(j.createdAt) },
                { key: "c", header: "Customer", cell: (j) => j.customer?.name ?? "—" },
                { key: "b", header: "Created by", cell: (j) => j.createdBy?.username ?? "—" },
                { key: "s", header: "Status", cell: (j) => <StatusBadge status={j.status} /> },
                { key: "p", header: "Price", align: "right", cell: (j) => money(j.price) },
              ]}
              card={(j) => (
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{j.number}</p>
                    <p className="text-xs text-ink-subtle">{date(j.createdAt)} · {j.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{money(j.price)}</p>
                    <StatusBadge status={j.status} />
                  </div>
                </div>
              )}
            />
          </>
        )}
      </Card>
    </>
  );
}
