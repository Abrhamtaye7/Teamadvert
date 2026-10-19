import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox, MessageCircle, Phone, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Card, EmptyState, ErrorState, PageLoader, StatusBadge } from "../../components/ui/display";
import { Select } from "../../components/ui/form";
import { FilterTabs, PageHeader } from "../../components/ui/page";
import { api, errorMessage } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { useInvalidatingMutation } from "../../lib/queries";
import type { Customer } from "../../lib/types";
import { CustomerFormDialog } from "../customers/CustomerForm";

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  service: string | null;
  message: string;
  status: "new" | "contacted" | "converted" | "closed";
  customerId: number | null;
  createdAt: string;
};

/** Ethiopian numbers for WhatsApp: 09… → 2519… */
const whatsapp = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("0") ? `251${digits.slice(1)}` : digits}`;
};

export default function LeadsPage() {
  const [status, setStatus] = useState("new");
  const [converting, setConverting] = useState<Lead | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["leads", status], queryFn: () => api.get<Lead[]>("/leads", { status }) });
  const update = useInvalidatingMutation(
    ({ id, ...body }: { id: number; status: Lead["status"]; customerId?: number }) => api.patch<Lead>(`/leads/${id}`, body),
    ["leads"],
  );
  const setLeadStatus = (lead: Lead, next: Lead["status"], customerId?: number) =>
    update.mutate({ id: lead.id, status: next, customerId }, { onSuccess: () => toast.success(`Marked ${next}`), onError: (err) => toast.error(errorMessage(err)) });

  return (
    <>
      <PageHeader title="Quote requests" description="Enquiries sent from the website's contact form." />
      <div className="mb-4">
        <FilterTabs
          value={status}
          onChange={setStatus}
          options={[
            { value: "new", label: "New" },
            { value: "contacted", label: "Contacted" },
            { value: "converted", label: "Converted" },
            { value: "closed", label: "Closed" },
            { value: "", label: "All" },
          ]}
        />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={Inbox} title="No quote requests here" description="When someone sends the form on teamadvertplc.com it shows up here and in notifications." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 [&>*]:min-w-0">
          {data.map((lead) => (
            <Card key={lead.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{lead.name}</p>
                  <p className="text-xs text-ink-subtle">
                    {dateTime(lead.createdAt)}
                    {lead.company && ` · ${lead.company}`}
                  </p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              {lead.service && <p className="mt-2 text-sm font-medium text-brand-700 dark:text-brand-300">{lead.service}</p>}
              <p className="mt-1 flex-1 whitespace-pre-wrap text-sm text-ink-muted">{lead.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <a href={`tel:${lead.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white">
                  <Phone className="size-4" /> {lead.phone}
                </a>
                <a href={whatsapp(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="text-sm text-brand-700 dark:text-brand-300 hover:underline">
                    {lead.email}
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select aria-label="Status" className="h-8 w-auto py-0 text-sm" value={lead.status} onChange={(e) => setLeadStatus(lead, e.target.value as Lead["status"])}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                  <option value="closed">Closed</option>
                </Select>
                {lead.customerId ? (
                  <Link to={`/customers/${lead.customerId}`} className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
                    View customer
                  </Link>
                ) : (
                  <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setConverting(lead)}>
                    Create customer
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <CustomerFormDialog
        open={!!converting}
        onClose={() => setConverting(null)}
        initial={converting ? { name: converting.name, company: converting.company ?? "", phone: converting.phone, email: converting.email ?? "" } : undefined}
        onSaved={(c: Customer) => converting && setLeadStatus(converting, "converted", c.id)}
      />
    </>
  );
}
