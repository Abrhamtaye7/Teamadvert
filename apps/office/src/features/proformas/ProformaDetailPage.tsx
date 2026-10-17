import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRightLeft, CheckCircle2, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "../../auth/permissions";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { Card, CardHeader, DetailList, ErrorState, PageLoader, StatusBadge } from "../../components/ui/display";
import { PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { COMPANY } from "../../lib/company";
import { amount, date, money, phones } from "../../lib/format";
import { fetchProformaPrint, useApproveProforma, useConvertProforma, useProforma } from "../../lib/queries";
import { proformaTotals } from "../../lib/totals";
import { printProforma } from "../../print/documents";
import { ProformaFormDialog } from "./ProformaForm";

export default function ProformaDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const can = useCan();
  const { data: p, isLoading, error, refetch } = useProforma(id);
  const approve = useApproveProforma();
  const convert = useConvertProforma();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"approve" | "convert" | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !p) return <ErrorState message={error ? errorMessage(error) : "Proforma not found"} onRetry={refetch} />;

  const lines = p.items ?? [];
  const totals = proformaTotals(lines.map((l) => ({ quantity: l.quantity, sellingPrice: l.sellingPrice, discount: l.discount ?? 0, vatPercent: l.vatPercent ?? undefined })));
  const snap = (p.customerSnapshot ?? {}) as { phones?: string[]; tin?: string; company?: string };

  const print = async () => {
    try {
      if (!printProforma(await fetchProformaPrint(id))) toast.error("Allow pop-ups to print");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const run = () => {
    if (confirm === "approve") {
      approve.mutate(id, {
        onSuccess: () => toast.success(`${p.number} approved`),
        onError: (err) => toast.error(errorMessage(err)),
        onSettled: () => setConfirm(null),
      });
    } else if (confirm === "convert") {
      convert.mutate(id, {
        onSuccess: (job) => {
          toast.success(`Job ${job.number} created`);
          navigate(`/jobs/${job.id}`);
        },
        onError: (err) => toast.error(errorMessage(err)),
        onSettled: () => setConfirm(null),
      });
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: "/proformas", label: "Proformas" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.number} <StatusBadge status={p.status} />
          </span>
        }
        description={`${date(p.date)} · prepared by ${p.preparedBy?.username ?? "—"}${p.approvedBy ? ` · approved by ${p.approvedBy.username}` : ""}`}
        actions={
          <>
            {/* Drafts print without the stamp or QR code, marked DRAFT */}
            <Button variant="secondary" icon={Printer} onClick={print}>
              {p.status === "draft" ? "Print draft" : "Print"}
            </Button>
            {p.status === "draft" && can("proforma.edit") && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {p.status === "draft" && can("proforma.approve") && (
              <Button variant="success" icon={CheckCircle2} onClick={() => setConfirm("approve")}>
                Approve
              </Button>
            )}
            {p.status === "approved" && can("proforma.convert") && (
              <Button variant="accent" icon={ArrowRightLeft} onClick={() => setConfirm("convert")}>
                Convert to job
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Items" description={`${lines.length} line${lines.length === 1 ? "" : "s"}`} />
            <ul className="divide-y divide-line">
              {lines.map((l, i) => (
                <li key={l.id} className="flex gap-3 px-4 py-3 md:px-5">
                  <span className="mt-0.5 text-xs text-ink-subtle">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.name}</p>
                    {l.description && <p className="text-sm text-ink-muted">{l.description}</p>}
                    <p className="mt-1 text-xs text-ink-subtle">
                      {l.quantity} {l.unit ?? ""} × {amount(l.sellingPrice)}
                      {l.discount ? ` − ${amount(l.discount)} discount` : ""} · VAT {l.vatPercent ?? COMPANY.vatPercent}%
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">{amount(l.total)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-4 py-3 text-sm md:px-5">
              <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums">{amount(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className="tabular-nums">−{amount(totals.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-muted">VAT</dt><dd className="tabular-nums">{amount(totals.vat)}</dd></div>
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
            </dl>
            {p.amountInWords && <p className="border-t border-line px-4 py-3 text-sm text-ink-muted md:px-5">In words: {p.amountInWords} only</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Customer" />
            <div className="p-4 md:p-5">
              {p.customer ? (
                <Link to={`/customers/${p.customer.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                  {p.customer.name}
                </Link>
              ) : (
                "—"
              )}
              <DetailList
                className="mt-3 sm:grid-cols-1"
                items={[
                  { label: "Company", value: snap.company ?? "—" },
                  { label: "Phone", value: phones(snap.phones) },
                  { label: "TIN", value: snap.tin ?? "—" },
                ]}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Terms" />
            <div className="p-4 md:p-5">
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: "Valid for", value: p.validity ? `${p.validity} days` : "—" },
                  { label: "Payment terms", value: p.terms ?? COMPANY.defaultTerms },
                  { label: "Notes", value: p.notes ?? "—" },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      <ProformaFormDialog open={editing} onClose={() => setEditing(false)} proforma={p} />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={run}
        loading={approve.isPending || convert.isPending}
        title={confirm === "approve" ? `Approve ${p.number}?` : `Convert ${p.number} to a job order?`}
        message={confirm === "approve" ? "Approved proformas can no longer be edited." : `A job order for ${money(totals.total)} will be created and sent for admin approval.`}
        confirmLabel={confirm === "approve" ? "Approve" : "Create job order"}
      />
    </>
  );
}
