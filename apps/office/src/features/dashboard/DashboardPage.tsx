import { Link } from "react-router";
import { ArrowRight, Briefcase, CircleDollarSign, FileText, Hourglass, Plus, Users, Wallet } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { useSession } from "../../auth/session";
import { MonthlyChart } from "../../components/ui/BarChart";
import { ButtonLink } from "../../components/ui/Button";
import { Card, CardHeader, EmptyState, Spinner, StatCard, StatusBadge } from "../../components/ui/display";
import { date, money } from "../../lib/format";
import { useJobs, useProformas, useReportOverview } from "../../lib/queries";
import type { Job, Proforma } from "../../lib/types";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Addis_Ababa", hour: "numeric", hour12: false }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function JobQueue({ title, description, status, empty }: { title: string; description: string; status: string; empty: string }) {
  const { data, isLoading } = useJobs({ status, pageSize: 5 });
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2">{title} {data && <span className="rounded-full bg-surface-muted px-2 text-xs text-ink-muted">{data.total}</span>}</span>}
        description={description}
        action={<Link to={`/jobs?status=${status}`} className="text-sm font-medium text-brand-600 hover:underline">View all</Link>}
      />
      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : data?.data.length ? (
        <ul className="divide-y divide-line">{data.data.map((j) => <JobRow key={j.id} job={j} />)}</ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-ink-subtle">{empty}</p>
      )}
    </Card>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <li>
      <Link to={`/jobs/${job.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted md:px-5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{job.number} <span className="font-normal text-ink-muted">· {job.customer?.name}</span></p>
          <p className="truncate text-xs text-ink-subtle">{job.deadline ? `Due ${date(job.deadline)}` : date(job.createdAt)}{job.priority === "high" ? " · High priority" : ""}</p>
        </div>
        <span className="text-sm font-medium tabular-nums">{money(job.price)}</span>
      </Link>
    </li>
  );
}

function ProformaRow({ p }: { p: Proforma }) {
  return (
    <li>
      <Link to={`/proformas/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted md:px-5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{p.number} <span className="font-normal text-ink-muted">· {p.customer?.name}</span></p>
          <p className="text-xs text-ink-subtle">{date(p.date)}</p>
        </div>
        <StatusBadge status={p.status} />
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const user = useSession((s) => s.user);
  const can = useCan();
  const overview = useReportOverview(6);
  const drafts = useProformas({ status: "draft", pageSize: 5 });
  const s = overview.data?.summary;
  const role = user?.role;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="relative overflow-hidden rounded-card bg-brand-700 p-5 text-white md:p-7">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-accent-500/30 blur-3xl" />
        <p className="relative text-sm text-brand-100">{greeting()},</p>
        <h1 className="relative text-2xl font-semibold capitalize md:text-3xl">{user?.username}</h1>
        <p className="relative mt-1 text-sm text-brand-100">{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", weekday: "long", day: "numeric", month: "long" }).format(new Date())} · {role}</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          {can("proforma.create") && <ButtonLink to="/proformas" variant="accent" size="sm" icon={Plus}>Proforma</ButtonLink>}
          {can("job.create") && <ButtonLink to="/jobs" size="sm" icon={Plus} className="bg-white/15 hover:bg-white/25">Job order</ButtonLink>}
          {can("customer.edit") && <ButtonLink to="/customers" size="sm" icon={Users} className="bg-white/15 hover:bg-white/25">Customers</ButtonLink>}
          {can("payment.record") && <ButtonLink to="/finance" size="sm" icon={Wallet} className="bg-white/15 hover:bg-white/25">Finance</ButtonLink>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jobs this month" value={s?.jobsThisMonth ?? "—"} icon={Briefcase} />
        <StatCard label="Open jobs" value={s?.pendingJobs ?? "—"} icon={Hourglass} tone="purple" />
        <StatCard label="Collected this month" value={money(s?.collectedThisMonth)} icon={CircleDollarSign} tone="green" />
        <StatCard label="Outstanding" value={money(s?.outstandingTotal)} icon={Wallet} tone="orange" hint="On open jobs" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {role === "Admin" && <JobQueue title="Awaiting your approval" description="New job orders" status="pending_approval" empty="No jobs waiting for approval." />}
        {(role === "Production" || role === "Admin") && <JobQueue title="Ready for production" description="Approved jobs to start" status="approved" empty="Nothing waiting to start." />}
        {(role === "Production" || role === "Designer") && <JobQueue title="In production" description="Jobs being worked on" status="in_progress" empty="Nothing in production." />}
        {(role === "Finance" || role === "Admin") && <JobQueue title="Awaiting payment" description="Completed jobs" status="completed" empty="No completed jobs waiting for payment." />}
        {(role === "Sales" || role === "Designer" || role === "Admin") && (
          <Card>
            <CardHeader
              title="Draft proformas"
              description={role === "Admin" ? "Waiting for your approval" : "Not yet approved"}
              action={<Link to="/proformas?status=draft" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>}
            />
            {drafts.data?.data.length ? (
              <ul className="divide-y divide-line">{drafts.data.data.map((p) => <ProformaRow key={p.id} p={p} />)}</ul>
            ) : (
              <EmptyState icon={FileText} title="No drafts" />
            )}
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title="Last 6 months" description="Collected payments and outstanding balances" action={<Link to="/reports" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">Reports <ArrowRight className="size-3.5" /></Link>} />
        <div className="p-4 md:p-5">{overview.data ? <MonthlyChart data={overview.data.chart} /> : <div className="flex justify-center py-10"><Spinner /></div>}</div>
      </Card>
    </div>
  );
}
