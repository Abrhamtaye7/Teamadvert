import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Users } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { DataList, Pagination } from "../../components/ui/DataList";
import { Card, EmptyState, StatusBadge } from "../../components/ui/display";
import { FilterTabs, PageHeader, SearchInput } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { phones } from "../../lib/format";
import { useCustomers } from "../../lib/queries";
import { useUrlState } from "../../lib/useUrlState";
import { CustomerFormDialog } from "./CustomerForm";

export default function CustomersPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const [{ q, standing, page }, set] = useUrlState(["q", "standing", "page"] as const);
  const { data, isLoading, error, refetch } = useCustomers({ q, standing, page: page || 1, pageSize: 20 });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Contacts, credit standing and history for every client."
        actions={
          can("customer.edit") && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New customer
            </Button>
          )
        }
      />

      <div className="mb-4 space-y-3">
        <SearchInput value={q} onSearch={(v) => set({ q: v })} placeholder="Search name, company, CID or TIN" />
        <FilterTabs
          value={standing}
          onChange={(v) => set({ standing: v })}
          options={[
            { value: "", label: "All" },
            { value: "Good", label: "Good" },
            { value: "Warning", label: "Warning" },
            { value: "Suspended", label: "Suspended" },
          ]}
        />
      </div>

      <Card>
        <DataList
          rows={data?.data}
          loading={isLoading}
          error={error ? errorMessage(error) : null}
          onRetry={refetch}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          empty={
            <EmptyState
              icon={Users}
              title={q ? "No customers match your search" : "No customers yet"}
              description={q ? "Try a different name, CID or TIN." : "Customers are also created automatically from new proformas and jobs."}
            />
          }
          columns={[
            { key: "cid", header: "CID", cell: (c) => <span className="font-mono text-xs text-ink-muted">{c.customerId}</span> },
            {
              key: "name",
              header: "Customer",
              cell: (c) => (
                <div>
                  <p className="font-medium">{c.name}</p>
                  {c.company && <p className="text-xs text-ink-subtle">{c.company}</p>}
                </div>
              ),
            },
            { key: "phones", header: "Phone", cell: (c) => phones(c.phones) },
            { key: "proformas", header: "Proformas", align: "right", cell: (c) => c._count?.proformas ?? 0 },
            { key: "jobs", header: "Jobs", align: "right", cell: (c) => c._count?.jobs ?? 0 },
            { key: "standing", header: "Standing", cell: (c) => <StatusBadge status={c.standing} /> },
          ]}
          card={(c) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{c.name}</p>
                <StatusBadge status={c.standing} />
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">{c.company ?? phones(c.phones)}</p>
              <p className="mt-1 text-xs text-ink-subtle">
                {c.customerId} · {c._count?.proformas ?? 0} proformas · {c._count?.jobs ?? 0} jobs
              </p>
            </div>
          )}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>

      <CustomerFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/customers/${c.id}`)} />
    </>
  );
}
