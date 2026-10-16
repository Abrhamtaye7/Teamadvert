import { useState } from "react";
import { useNavigate } from "react-router";
import { FileText, Plus } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { DataList, Pagination } from "../../components/ui/DataList";
import { Card, EmptyState, StatusBadge } from "../../components/ui/display";
import { FilterTabs, PageHeader, SearchInput } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, money } from "../../lib/format";
import { useProformas } from "../../lib/queries";
import type { Proforma } from "../../lib/types";
import { useUrlState } from "../../lib/useUrlState";
import { ProformaFormDialog } from "./ProformaForm";

const total = (p: Proforma) => (p.items ?? []).reduce((s, l) => s + l.total, 0);

export default function ProformasPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const [{ q, status, page }, set] = useUrlState(["q", "status", "page"] as const);
  const { data, isLoading, error, refetch } = useProformas({ q, status, page: page || 1, pageSize: 20 });

  return (
    <>
      <PageHeader
        title="Proformas"
        description="Quotes (TAPI) — draft, approve, print and convert to job orders."
        actions={
          can("proforma.create") && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New proforma
            </Button>
          )
        }
      />

      <div className="mb-4 space-y-3">
        <SearchInput value={q} onSearch={(v) => set({ q: v })} placeholder="Search TAPI number or customer" />
        <FilterTabs
          value={status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: "", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Approved" },
            { value: "converted", label: "Converted" },
          ]}
        />
      </div>

      <Card>
        <DataList
          rows={data?.data}
          loading={isLoading}
          error={error ? errorMessage(error) : null}
          onRetry={refetch}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/proformas/${p.id}`)}
          empty={<EmptyState icon={FileText} title={q || status ? "No proformas match" : "No proformas yet"} description="Create a proforma to quote a customer." />}
          columns={[
            { key: "number", header: "Number", cell: (p) => <span className="font-medium">{p.number}</span> },
            { key: "customer", header: "Customer", cell: (p) => p.customer?.name ?? "—" },
            { key: "date", header: "Date", cell: (p) => date(p.date) },
            { key: "by", header: "Prepared by", cell: (p) => p.preparedBy?.username ?? "—" },
            { key: "total", header: "Total", align: "right", cell: (p) => money(total(p)) },
            { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
          ]}
          card={(p) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{p.number}</p>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">{p.customer?.name ?? "—"}</p>
              <div className="mt-1 flex justify-between text-xs text-ink-subtle">
                <span>{date(p.date)}</span>
                <span className="font-medium text-ink tabular-nums">{money(total(p))}</span>
              </div>
            </div>
          )}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => set({ page: String(n) })} />}
      </Card>

      <ProformaFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(p) => navigate(`/proformas/${p.id}`)} />
    </>
  );
}
