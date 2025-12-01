type Props = {
  title?: string;
  searchPlaceholder?: string;
  value?: string;
  onSearch?: (q: string) => void;
  onFilter?: () => void;
  onOpenNew: () => void;
  newLabel?: string;
  loading?: boolean;
};

export default function TabHeader({
  title,
  searchPlaceholder = "Search...",
  value = "",
  onSearch,
  onFilter,
  onOpenNew,
  newLabel = "New Record",
  loading = false,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        {title && <h2 className="text-2xl font-semibold">{title}</h2>}
      </div>

      <div className="flex w-full items-center gap-2 md:w-auto">
        <input
          className="input flex-1 md:flex-none"
          placeholder={searchPlaceholder}
          value={value}
          onChange={(e) => onSearch?.(e.target.value)}
        />

        <button type="button" className="btn" onClick={onFilter}>
          Filter
        </button>

        <button type="button" className="btn bg-primary text-white" onClick={onOpenNew}>
          {newLabel}
        </button>

        {loading && <span className="text-xs text-slate-500">Loading...</span>}
      </div>
    </div>
  );
}
