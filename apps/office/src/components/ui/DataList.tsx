import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { EmptyState, ErrorState, Spinner } from "./display";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

/**
 * Responsive list: a table from the `md` breakpoint up, tappable cards on phones.
 * `card` renders the phone layout for one row.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  card,
  onRowClick,
  loading,
  error,
  onRetry,
  empty,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  card: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: ReactNode;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !rows)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  if (!rows?.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-2.5 font-medium", col.align === "right" && "text-right", col.className)}>
                  {col.header}
                </th>
              ))}
              {onRowClick && <th className="w-8" aria-hidden />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-b border-line last:border-0", onRowClick && "cursor-pointer hover:bg-surface-muted")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 align-middle", col.align === "right" && "text-right tabular-nums", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="pr-3 text-ink-subtle">
                    <ChevronRight className="size-4" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button type="button" onClick={() => onRowClick(row)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted">
                <div className="min-w-0 flex-1">{card(row)}</div>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
              </button>
            ) : (
              <div className="px-4 py-3">{card(row)}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <span className="text-ink-muted">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-muted disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-muted disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
