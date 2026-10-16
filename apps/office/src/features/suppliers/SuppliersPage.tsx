import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Truck } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { DataList } from "../../components/ui/DataList";
import { Card, EmptyState } from "../../components/ui/display";
import { PageHeader, SearchInput } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, phones } from "../../lib/format";
import { useSuppliers } from "../../lib/queries";
import { useUrlState } from "../../lib/useUrlState";
import { SupplierFormDialog } from "./SupplierForm";

export default function SuppliersPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const [{ q }, set] = useUrlState(["q"] as const);
  const { data, isLoading, error, refetch } = useSuppliers(q);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who you buy from and what they charge."
        actions={can("supplier.edit") && <Button icon={Plus} onClick={() => setCreating(true)}>New supplier</Button>}
      />
      <SearchInput className="mb-4" value={q} onSearch={(v) => set({ q: v })} placeholder="Search company, SID, contact or phone" />
      <Card>
        <DataList
          rows={data}
          loading={isLoading}
          error={error ? errorMessage(error) : null}
          onRetry={refetch}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
          empty={<EmptyState icon={Truck} title={q ? "No suppliers match" : "No suppliers yet"} />}
          columns={[
            { key: "sid", header: "SID", cell: (s) => <span className="font-mono text-xs text-ink-muted">{s.supplierId}</span> },
            { key: "name", header: "Company", cell: (s) => <span className="font-medium">{s.companyName}</span> },
            { key: "contact", header: "Contact", cell: (s) => s.contactPerson ?? "—" },
            { key: "phone", header: "Phone", cell: (s) => phones(s.phones) },
            { key: "since", header: "Added", cell: (s) => date(s.createdAt) },
          ]}
          card={(s) => (
            <div>
              <p className="font-medium">{s.companyName}</p>
              <p className="text-sm text-ink-muted">{s.contactPerson ?? phones(s.phones)}</p>
              <p className="text-xs text-ink-subtle">{s.supplierId}</p>
            </div>
          )}
        />
      </Card>
      <SupplierFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(s) => navigate(`/suppliers/${s.id}`)} />
    </>
  );
}
