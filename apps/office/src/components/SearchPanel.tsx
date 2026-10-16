import { useState } from "react";
import type { ReactNode } from "react";

export function SearchPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="flex justify-end">
        <button onClick={() => setOpen((o) => !o)} className="btn bg-slate-800 hover:bg-slate-700">
          Search & Filter
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Search & Filters</p>
            <button className="text-xs text-primary" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">{children}</div>
          <div className="mt-3 flex justify-end">
            <button className="btn bg-slate-700 hover:bg-slate-600" onClick={() => setOpen(false)}>
              Apply & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
