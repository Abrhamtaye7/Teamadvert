import { Link } from "react-router";
import { Bell, BadgeCheck, CheckCheck, CircleDollarSign, FileCheck2, Hammer, Inbox, type LucideIcon } from "lucide-react";
import { useNotifications } from "../../app/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, EmptyState, ErrorState, PageLoader } from "../../components/ui/display";
import { PageHeader } from "../../components/ui/page";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { dateTime, timeAgo } from "../../lib/format";
import { useMarkNotificationRead } from "../../lib/queries";
import type { AppNotification } from "../../lib/types";

const ICONS: Record<string, LucideIcon> = {
  ProformaApproved: FileCheck2,
  JobApproved: BadgeCheck,
  JobCompleted: Hammer,
  PaymentPending: CircleDollarSign,
  PaymentVerified: CheckCheck,
  CustomerAlert: Inbox,
};

/** Where a notification should take you. */
function target(n: AppNotification) {
  const d = n.data ?? {};
  if (typeof d.jobId === "number") return `/jobs/${d.jobId}`;
  if (typeof d.proformaId === "number") return `/proformas/${d.proformaId}`;
  if (typeof d.leadId === "number") return "/leads";
  return null;
}

export default function NotificationsPage() {
  const { data, isLoading, error, refetch } = useNotifications();
  const mark = useMarkNotificationRead();
  const unread = data?.filter((n) => !n.read) ?? [];

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread.length ? `${unread.length} unread` : "You're all caught up."}
        actions={unread.length > 0 && <Button variant="secondary" icon={CheckCheck} loading={mark.isPending} onClick={() => unread.forEach((n) => mark.mutate(n.id))}>Mark all read</Button>}
      />
      <Card>
        {data?.length ? (
          <ul className="divide-y divide-line">
            {data.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const href = target(n);
              const body = (
                <>
                  <span className={cn("mt-0.5 rounded-lg p-2", n.read ? "bg-surface-muted text-ink-subtle" : "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300")}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", !n.read && "font-medium")}>{n.message}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle" title={dateTime(n.createdAt)}>{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent-500" aria-label="Unread" />}
                </>
              );
              return (
                <li key={n.id}>
                  {href ? (
                    <Link to={href} onClick={() => !n.read && mark.mutate(n.id)} className="flex gap-3 px-4 py-3 hover:bg-surface-muted md:px-5">{body}</Link>
                  ) : (
                    <button type="button" onClick={() => !n.read && mark.mutate(n.id)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-muted md:px-5">{body}</button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="No notifications yet" description="Approvals, completed jobs and payments show up here." />
        )}
      </Card>
    </>
  );
}
