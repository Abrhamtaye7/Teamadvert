import type { ReactNode } from "react";

export function StatCard({ title, value, icon }: { title: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      </div>
      {icon && <div className="text-primary/80">{icon}</div>}
    </div>
  );
}
