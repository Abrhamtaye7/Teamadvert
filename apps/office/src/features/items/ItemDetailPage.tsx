import { useState } from "react";
import { Link, useParams } from "react-router";
import { Pencil } from "lucide-react";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, EmptyState, ErrorState, PageLoader, StatCard, StatusBadge } from "../../components/ui/display";
import { FilterTabs, PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, money } from "../../lib/format";
import { useItem } from "../../lib/queries";
import { ItemFormDialog } from "./ItemForm";

type Tab = "suppliers" | "customers" | "usage";

export default function ItemDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const [tab, setTab] = useState<Tab>("suppliers");
  const [editing, setEditing] = useState(false);
  const { data: item, isLoading, error, refetch } = useItem(id);

  if (isLoading) return <PageLoader />;
  if (error || !item) return <ErrorState message={error ? errorMessage(error) : "Item not found"} onRetry={refetch} />;

  const selling = item.sellingPrice ?? item.basePrice;
  const margin = selling != null && item.purchasePrice ? Math.round(((selling - item.purchasePrice) / selling) * 100) : null;
  const bestSupplier = [...item.supplierPriceHistory].sort((a, b) => a.newPrice - b.newPrice)[0];

  return (
    <>
      <PageHeader
        back={{ to: "/items", label: "Items" }}
        title={item.name}
        description={`${item.itemId}${item.category ? ` · ${item.category.name}` : ""}${item.measurementUnit ? ` · per ${item.measurementUnit.unitName}` : ""}`}
        actions={can("item.edit") && <Button icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Selling price" value={money(selling)} />
        <StatCard label="Purchase price" value={item.purchasePrice != null ? money(item.purchasePrice) : "—"} tone="orange" />
        <StatCard label="Margin" value={margin != null ? `${margin}%` : "—"} tone="green" />
        <StatCard label="Cheapest supplier" value={bestSupplier ? money(bestSupplier.newPrice) : "—"} hint={bestSupplier?.supplier.companyName} tone="purple" />
      </div>
      <Card>
        <div className="border-b border-line p-3">
          <FilterTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "suppliers", label: "Supplier prices", count: item.supplierPriceHistory.length },
              { value: "customers", label: "Customer prices", count: item.customerPriceHistory.length },
              { value: "usage", label: "Used in", count: item.proformaItems.length + item.jobItems.length },
            ]}
          />
        </div>
        {tab === "suppliers" &&
          (item.supplierPriceHistory.length ? (
            <ul className="divide-y divide-line">
              {item.supplierPriceHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <Link to={`/suppliers/${h.supplier.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{h.supplier.companyName}</Link>
                    <p className="text-xs text-ink-subtle">{date(h.createdAt)} · {h.user?.username ?? "—"}</p>
                  </div>
                  <p className="tabular-nums">{h.oldPrice != null && <span className="mr-1 text-ink-subtle line-through">{money(h.oldPrice)}</span>}<span className="font-medium">{money(h.newPrice)}</span></p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No supplier prices yet" description="Record prices from a supplier's page." />
          ))}
        {tab === "customers" &&
          (item.customerPriceHistory.length ? (
            <ul className="divide-y divide-line">
              {item.customerPriceHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <Link to={`/customers/${h.customer.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{h.customer.name}</Link>
                    <p className="text-xs text-ink-subtle">{date(h.createdAt)}</p>
                  </div>
                  <span className="font-medium tabular-nums">{money(h.newPrice)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No customer-specific prices" />
          ))}
        {tab === "usage" && (
          <>
            <CardHeader title="Proformas" />
            {item.proformaItems.length ? (
              <ul className="divide-y divide-line">
                {item.proformaItems.map((l) => (
                  <li key={`p${l.id}`}>
                    <Link to={`/proformas/${l.proforma.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted">
                      <span className="text-sm"><span className="font-medium">{l.proforma.number}</span> · {l.quantity} × {money(l.sellingPrice)}</span>
                      <StatusBadge status={l.proforma.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not on any proforma yet" />
            )}
            <CardHeader title="Job orders" />
            {item.jobItems.length ? (
              <ul className="divide-y divide-line">
                {item.jobItems.map((l) => (
                  <li key={`j${l.id}`}>
                    <Link to={`/jobs/${l.jobOrder.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted">
                      <span className="text-sm"><span className="font-medium">{l.jobOrder.number}</span> · {l.quantity} × {money(l.price)}</span>
                      <StatusBadge status={l.jobOrder.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not on any job yet" />
            )}
          </>
        )}
      </Card>
      <ItemFormDialog open={editing} onClose={() => setEditing(false)} item={item} />
    </>
  );
}
