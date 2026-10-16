import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Link } from "react-router";
import { cn } from "../../lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-4 md:mb-6">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Search box; `onSearch` fires after the user stops typing. */
export function SearchInput({ value, onSearch, placeholder = "Search…", className }: { value: string; onSearch: (q: string) => void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value);
  const debounced = useDebounced(text);
  useEffect(() => {
    if (debounced !== value) onSearch(debounced);
  }, [debounced, value, onSearch]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      {text && (
        <button type="button" aria-label="Clear search" onClick={() => setText("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:text-ink">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Horizontally scrollable pill tabs (status filters). */
export function FilterTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="flex w-max gap-1.5" role="tablist">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors",
              value === o.value ? "bg-brand-600 text-white" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 opacity-75">{o.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
