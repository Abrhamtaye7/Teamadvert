import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { humanize } from "../../lib/format";

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card border border-line bg-surface shadow-xs", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  orange: "bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-400",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  purple: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  yellow: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};
type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const statusTones: Record<string, Tone> = {
  draft: "gray",
  approved: "blue",
  converted: "green",
  expired: "red",
  pending_approval: "yellow",
  in_progress: "purple",
  completed: "orange",
  finance_review: "blue",
  closed: "green",
  Good: "green",
  Warning: "yellow",
  Suspended: "red",
  high: "red",
  normal: "gray",
  low: "blue",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return <Badge tone={statusTones[status] ?? "gray"}>{humanize(status)}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-brand-700 dark:text-brand-300", className)} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-surface-muted p-3">
        <Icon className="size-6 text-ink-subtle" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-6 text-rose-500" />
      <p className="text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: "blue" | "orange" | "green" | "purple";
}) {
  const iconTone = {
    blue: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
    orange: "bg-accent-50 text-accent-700 dark:text-accent-400 dark:bg-accent-700/20 dark:text-accent-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    purple: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink-muted">{label}</p>
        {Icon && (
          <span className={cn("rounded-lg p-1.5", iconTone)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums md:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </Card>
  );
}

/** Label/value pairs, stacked on phones and in columns on wider screens. */
export function DetailList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
