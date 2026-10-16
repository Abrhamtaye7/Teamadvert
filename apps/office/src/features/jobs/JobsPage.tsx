import { useState } from "react";
import { useNavigate } from "react-router";
import { Briefcase, Plus } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { DataList, Pagination } from "../../components/ui/DataList";
import { Card, EmptyState, StatusBadge } from "../../components/ui/display";
import { FilterTabs, PageHeader, SearchInput } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, money } from "../../lib/format";
import { useJobs } from "../../lib/queries";
import { useUrlState } from "../../lib/useUrlState";
import { JobFormDialog } from "./JobForm";

export const JOB_STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In production" },
  { value: "completed", label: "Completed" },
  { value: "finance_review", label: "Finance review" },
  { value: "closed", label: "Closed" },
];

export default function JobsPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const [{ q, status, page }, set] = useUrlState(["q", "status", "page"] as const);
  const { data, isLoading, error, refetch } = useJobs({ q, status, page: page || 1, pageSize: 20 });

  return (
    <>
      <PageHeader
        title="Job orders"
        description="Every job from approval through production to payment."
        actions={
          can("job.create") && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New job order
            </Button>
          )
        }
      />
      <div className="mb-4 space-y-3">
        <SearchInput value={q} onSearch={(v) => set({ q: v })} placeholder="Search TAJO number" />
        <FilterTabs value={status} onChange={(v) => set({ status: v })} options={JOB_STATUS_TABS} />
      </div>
      <Card>
        <DataList
          rows={data?.data}
          loading={isLoading}
          error={error ? errorMessage(error) : null}
          onRetry={refetch}
          rowKey={(j) => j.id}
          onRowClick={(j) => navigate(`/jobs/${j.id}`)}
          empty={<EmptyState icon={Briefcase} title={q || status ? "No jobs match" : "No job orders yet"} description="Create one directly or convert an approved proforma." />}
          columns={[
            { key: "number", header: "Number", cell: (j) => <span className="font-medium">{j.number}</span> },
            { key: "customer", header: "Customer", cell: (j) => j.customer?.name ?? "—" },
            { key: "type", header: "Job", cell: (j) => j.jobType ?? j.jobItems?.[0]?.name ?? "—" },
            { key: "deadline", header: "Deadline", cell: (j) => date(j.deadline) },
            { key: "priority", header: "Priority", cell: (j) => <StatusBadge status={j.priority} /> },
            { key: "price", header: "Price", align: "right", cell: (j) => money(j.price) },
            { key: "status", header: "Status", cell: (j) => <StatusBadge status={j.status} /> },
          ]}
          card={(j) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{j.number}</p>
                <StatusBadge status={j.status} />
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                {j.customer?.name ?? "—"} · {j.jobType ?? j.jobItems?.[0]?.name ?? ""}
              </p>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-subtle">
                <span>
                  {j.deadline ? `Due ${date(j.deadline)}` : date(j.createdAt)}
                  {j.priority === "high" && <span className="ml-2 font-medium text-rose-600">High priority</span>}
                </span>
                <span className="font-medium text-ink tabular-nums">{money(j.price)}</span>
              </div>
            </div>
          )}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => set({ page: String(n) })} />}
      </Card>
      <JobFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(j) => navigate(`/jobs/${j.id}`)} />
    </>
  );
}
