import { useState } from "react";
import { useNavigate } from "react-router";
import { Package, Plus } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { DataList, Pagination } from "../../components/ui/DataList";
import { Badge, Card, EmptyState } from "../../components/ui/display";
import { FilterTabs, PageHeader, SearchInput } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { money } from "../../lib/format";
import { useCategories, useItems } from "../../lib/queries";
import { useUrlState } from "../../lib/useUrlState";
import { ItemFormDialog } from "./ItemForm";

export default function ItemsPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const [{ q, categoryId, page }, set] = useUrlState(["q", "categoryId", "page"] as const);
  const categories = useCategories();
  const { data, isLoading, error, refetch } = useItems({ q, categoryId, page: page || 1, pageSize: 25 });

  return (
    <>
      <PageHeader title="Items & prices" description="Your catalogue of products and services with purchase and selling prices." actions={can("item.edit") && <Button icon={Plus} onClick={() => setCreating(true)}>New item</Button>} />
      <div className="mb-4 space-y-3">
        <SearchInput value={q} onSearch={(v) => set({ q: v })} placeholder="Search item name or code" />
        {!!categories.data?.length && (
          <FilterTabs value={categoryId} onChange={(v) => set({ categoryId: v })} options={[{ value: "", label: "All" }, ...categories.data.map((c) => ({ value: String(c.id), label: c.name }))]} />
        )}
      </div>
      <Card>
        <DataList
          rows={data?.data}
          loading={isLoading}
          error={error ? errorMessage(error) : null}
          onRetry={refetch}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/items/${i.id}`)}
          empty={<EmptyState icon={Package} title={q ? "No items match" : "No items yet"} description="Items are also added when you record supplier prices." />}
          columns={[
            { key: "code", header: "Code", cell: (i) => <span className="font-mono text-xs text-ink-muted">{i.itemId}</span> },
            { key: "name", header: "Item", cell: (i) => <span className="font-medium">{i.name}</span> },
            { key: "category", header: "Category", cell: (i) => (i.category ? <Badge tone="blue">{i.category.name}</Badge> : "—") },
            { key: "unit", header: "Unit", cell: (i) => i.measurementUnit?.unitName ?? i.unit ?? "—" },
            { key: "buy", header: "Purchase", align: "right", cell: (i) => (i.purchasePrice != null ? money(i.purchasePrice) : "—") },
            { key: "sell", header: "Selling", align: "right", cell: (i) => <span className="font-medium">{money(i.sellingPrice ?? i.basePrice)}</span> },
          ]}
          card={(i) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-ink-subtle">{i.itemId}{i.category ? ` · ${i.category.name}` : ""}{i.measurementUnit ? ` · per ${i.measurementUnit.unitName}` : ""}</p>
              </div>
              <span className="font-semibold tabular-nums">{money(i.sellingPrice ?? i.basePrice)}</span>
            </div>
          )}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => set({ page: String(n) })} />}
      </Card>
      <ItemFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(i) => navigate(`/items/${i.id}`)} />
    </>
  );
}
