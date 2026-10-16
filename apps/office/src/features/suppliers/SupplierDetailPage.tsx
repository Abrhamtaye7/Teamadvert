import { useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardHeader, DetailList, EmptyState, ErrorState, PageLoader } from "../../components/ui/display";
import { FormError, Input, Textarea } from "../../components/ui/form";
import { PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, dateTime, money, phones } from "../../lib/format";
import { useAddSupplierNote, useAddSupplierPrices, useItemCatalog, useSupplier } from "../../lib/queries";
import { SupplierFormDialog } from "./SupplierForm";

function PricesDialog({ supplierId, open, onClose }: { supplierId: number; open: boolean; onClose: () => void }) {
  const add = useAddSupplierPrices(supplierId);
  const { data } = useItemCatalog();
  const listId = useId();
  const [rows, setRows] = useState([{ key: 1, name: "", price: "" }]);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const entries = rows.filter((r) => r.name.trim() || r.price.trim());
    if (!entries.length || entries.some((r) => !r.name.trim() || !(Number(r.price) >= 0) || r.price.trim() === "")) return setProblem("Each row needs an item name and a price.");
    setProblem(null);
    const byName = new Map((data?.data ?? []).map((i) => [i.name.toLowerCase(), i.id]));
    add.mutate(
      entries.map((r) => ({ itemId: byName.get(r.name.trim().toLowerCase()), name: r.name.trim(), price: Number(r.price) })),
      { onSuccess: () => (toast.success("Prices saved"), setRows([{ key: Date.now(), name: "", price: "" }]), onClose()) },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record prices"
      description="New item names are added to the item catalogue automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="prices-form" loading={add.isPending}>Save prices</Button>
        </>
      }
    >
      <form id="prices-form" onSubmit={submit} className="space-y-3" noValidate>
        <FormError message={add.error ? errorMessage(add.error) : problem} />
        <datalist id={listId}>{(data?.data ?? []).map((i) => <option key={i.id} value={i.name} />)}</datalist>
        {rows.map((r, i) => (
          <div key={r.key} className="flex gap-2">
            <Input list={listId} placeholder="Item" aria-label={`Item ${i + 1}`} value={r.name} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))} />
            <Input className="w-32" inputMode="decimal" placeholder="Price" aria-label={`Price ${i + 1}`} value={r.price} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, price: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows(rows.filter((x) => x.key !== r.key))} icon={Trash2} />
          </div>
        ))}
        <Button variant="secondary" icon={Plus} onClick={() => setRows([...rows, { key: Date.now(), name: "", price: "" }])}>Add row</Button>
      </form>
    </Dialog>
  );
}

export default function SupplierDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const { data: s, isLoading, error, refetch } = useSupplier(id);
  const addNote = useAddSupplierNote(id);
  const [editing, setEditing] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [note, setNote] = useState("");

  if (isLoading) return <PageLoader />;
  if (error || !s) return <ErrorState message={error ? errorMessage(error) : "Supplier not found"} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        back={{ to: "/suppliers", label: "Suppliers" }}
        title={s.companyName}
        description={s.supplierId}
        actions={
          can("supplier.edit") && (
            <>
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
              <Button icon={Plus} onClick={() => setPricing(true)}>Record prices</Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="h-fit p-4 md:p-5">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Contact", value: s.contactPerson ?? "—" },
              { label: "Phone", value: s.phones?.length ? s.phones.map((p) => <a key={p} href={`tel:${p}`} className="mr-2 text-brand-700 dark:text-brand-300 hover:underline">{p}</a>) : phones(s.phones) },
              { label: "Email", value: s.email ?? "—" },
              { label: "Address", value: typeof s.address === "string" ? s.address : "—" },
              { label: "Added", value: date(s.createdAt) },
            ]}
          />
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Current prices" description="Latest price per item" />
            {s.items.length ? (
              <ul className="divide-y divide-line">
                {s.items.map((i) => (
                  <li key={i.itemId} className="flex items-center justify-between px-4 py-3 md:px-5">
                    <div>
                      <Link to={`/items/${i.itemId}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{i.name}</Link>
                      <p className="text-xs text-ink-subtle">Updated {date(i.updatedAt)}</p>
                    </div>
                    <span className="font-semibold tabular-nums">{money(i.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No prices yet" description="Record what this supplier charges to compare across suppliers." />
            )}
          </Card>
          <Card>
            <CardHeader title="Price history" />
            {s.priceHistory.length ? (
              <ul className="divide-y divide-line">
                {s.priceHistory.slice(0, 30).map((h) => (
                  <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm md:px-5">
                    <div>
                      <p>{h.item.name}</p>
                      <p className="text-xs text-ink-subtle">{dateTime(h.createdAt)} · {h.user?.username ?? "—"}</p>
                    </div>
                    <p className="tabular-nums">
                      {h.oldPrice != null && <span className="mr-1 text-ink-subtle line-through">{money(h.oldPrice)}</span>}
                      {money(h.newPrice)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No history yet" />
            )}
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <form
              className="flex gap-2 border-b border-line p-4"
              onSubmit={(e) => {
                e.preventDefault();
                addNote.mutate(note, { onSuccess: () => setNote(""), onError: (err) => toast.error(errorMessage(err)) });
              }}
            >
              <Textarea rows={1} className="min-h-10" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" aria-label="New note" />
              <Button type="submit" icon={Send} loading={addNote.isPending} disabled={!note.trim()} aria-label="Add note" />
            </form>
            {s.notes.length ? (
              <ul className="divide-y divide-line">
                {s.notes.map((n) => (
                  <li key={n.id} className="px-4 py-3 md:px-5">
                    <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                    <p className="mt-1 text-xs text-ink-subtle">{n.user?.username ?? "—"} · {dateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No notes yet" />
            )}
          </Card>
        </div>
      </div>
      <SupplierFormDialog open={editing} onClose={() => setEditing(false)} supplier={s} />
      <PricesDialog supplierId={id} open={pricing} onClose={() => setPricing(false)} />
    </>
  );
}
