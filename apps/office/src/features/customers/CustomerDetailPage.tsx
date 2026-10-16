import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Pencil, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { Card, DetailList, EmptyState, ErrorState, PageLoader, StatusBadge } from "../../components/ui/display";
import { Textarea } from "../../components/ui/form";
import { FilterTabs, PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { date, dateTime, money } from "../../lib/format";
import { fetchCustomerProfile, useAddCustomerNote, useCustomer } from "../../lib/queries";
import { printCustomerStatement } from "../../print/documents";
import { CustomerFormDialog } from "./CustomerForm";

type Tab = "jobs" | "proformas" | "payments" | "notes" | "prices";

function NoteForm({ customerId }: { customerId: number }) {
  const [text, setText] = useState("");
  const add = useAddCustomerNote(customerId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(text, { onSuccess: () => setText(""), onError: (err) => toast.error(errorMessage(err)) });
  };
  return (
    <form onSubmit={submit} className="flex gap-2 border-b border-line p-4">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note (e.g. prefers pickup, call before delivery)" className="min-h-10" rows={1} aria-label="New note" />
      <Button type="submit" icon={Send} loading={add.isPending} disabled={!text.trim()} aria-label="Add note" />
    </form>
  );
}

export default function CustomerDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const [tab, setTab] = useState<Tab>("jobs");
  const [editing, setEditing] = useState(false);
  const { data: c, isLoading, error, refetch } = useCustomer(id);

  if (isLoading) return <PageLoader />;
  if (error || !c) return <ErrorState message={error ? errorMessage(error) : "Customer not found"} onRetry={refetch} />;

  const address = c.address ? [c.address.house && `H.No ${c.address.house}`, c.address.woreda && `Woreda ${c.address.woreda}`, c.address.subcity, c.address.city, c.address.region].filter(Boolean).join(", ") : "—";

  const print = async () => {
    try {
      if (!printCustomerStatement(await fetchCustomerProfile(id))) toast.error("Allow pop-ups to print");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: "/customers", label: "Customers" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.name} <StatusBadge status={c.standing} />
          </span>
        }
        description={`${c.customerId}${c.company ? ` · ${c.company}` : ""}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={print}>
              Print profile
            </Button>
            {can("customer.edit") && (
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="p-4 md:p-5 lg:col-span-1">
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Phone", value: c.phones?.length ? c.phones.map((p) => <a key={p} href={`tel:${p}`} className="mr-2 text-brand-600 hover:underline">{p}</a>) : "—" },
              { label: "Email", value: c.email ? <a href={`mailto:${c.email}`} className="text-brand-600 hover:underline">{c.email}</a> : "—" },
              { label: "TIN", value: c.tin ?? "—" },
              { label: "Address", value: address },
              { label: "Credit limit", value: c.creditLimit != null ? money(c.creditLimit) : "—" },
              { label: "Customer since", value: date(c.createdAt) },
            ]}
          />
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-line p-3">
            <FilterTabs<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "jobs", label: "Jobs", count: c.jobs.length },
                { value: "proformas", label: "Proformas", count: c.proformas.length },
                { value: "payments", label: "Payments", count: c.payments.length },
                { value: "notes", label: "Notes", count: c.notes.length },
                { value: "prices", label: "Prices", count: c.priceHistory.length },
              ]}
            />
          </div>

          {tab === "jobs" &&
            (c.jobs.length ? (
              <ul className="divide-y divide-line">
                {c.jobs.map((j) => (
                  <li key={j.id}>
                    <Link to={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted">
                      <div>
                        <p className="font-medium">{j.number}</p>
                        <p className="text-xs text-ink-subtle">{date(j.createdAt)} · {j.jobItems.map((l) => l.name).join(", ")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{money(j.price)}</p>
                        <StatusBadge status={j.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No jobs yet" />
            ))}

          {tab === "proformas" &&
            (c.proformas.length ? (
              <ul className="divide-y divide-line">
                {c.proformas.map((p) => (
                  <li key={p.id}>
                    <Link to={`/proformas/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted">
                      <div>
                        <p className="font-medium">{p.number}</p>
                        <p className="text-xs text-ink-subtle">{date(p.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{money(p.items.reduce((s, l) => s + l.total, 0))}</p>
                        <StatusBadge status={p.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No proformas yet" />
            ))}

          {tab === "payments" &&
            (c.payments.length ? (
              <ul className="divide-y divide-line">
                {c.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{p.method ?? "Payment"}{p.transactionNumber ? ` · ${p.transactionNumber}` : ""}</p>
                      <p className="text-xs text-ink-subtle">{dateTime(p.createdAt)}</p>
                    </div>
                    <p className="font-medium tabular-nums">{money(p.amount)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No payments yet" />
            ))}

          {tab === "notes" && (
            <>
              <NoteForm customerId={id} />
              {c.notes.length ? (
                <ul className="divide-y divide-line">
                  {c.notes.map((n) => (
                    <li key={n.id} className="px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm">{n.note}</p>
                      <p className="mt-1 text-xs text-ink-subtle">{n.user?.username ?? "—"} · {dateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No notes yet" />
              )}
            </>
          )}

          {tab === "prices" &&
            (c.priceHistory.length ? (
              <ul className="divide-y divide-line">
                {c.priceHistory.map((h) => (
                  <li key={h.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{h.item.name}</p>
                      <p className="text-xs text-ink-subtle">{date(h.createdAt)} · {h.user?.username ?? "—"}</p>
                    </div>
                    <p className="text-sm tabular-nums">
                      {h.oldPrice != null && <span className="mr-1 text-ink-subtle line-through">{money(h.oldPrice)}</span>}
                      <span className="font-medium">{money(h.newPrice)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No special prices" description="Customer-specific prices set on items appear here." />
            ))}
        </Card>
      </div>

      <CustomerFormDialog open={editing} onClose={() => setEditing(false)} customer={c} />
    </>
  );
}
