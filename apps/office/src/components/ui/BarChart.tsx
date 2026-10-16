import { amount, monthLabel } from "../../lib/format";

type Point = { month: string; collected: number; outstanding: number; jobs: number };

/**
 * Monthly collected vs outstanding bars (with job counts), as plain responsive SVG —
 * no chart library needed for one chart.
 */
export function MonthlyChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.collected, d.outstanding]));
  const height = 180;
  const group = 100 / Math.max(data.length, 1);

  return (
    <figure>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Collected and outstanding amounts per month">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="0" x2="100" y1={height - f * (height - 8)} y2={height - f * (height - 8)} className="stroke-line" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const barW = group * 0.3;
            const x = i * group + group * 0.18;
            const h1 = (d.collected / max) * (height - 8);
            const h2 = (d.outstanding / max) * (height - 8);
            return (
              <g key={d.month}>
                <rect x={x} y={height - h1} width={barW} height={h1} rx="0.6" className="fill-brand-600">
                  <title>{`${monthLabel(d.month)} collected ETB ${amount(d.collected)}`}</title>
                </rect>
                <rect x={x + barW + group * 0.04} y={height - h2} width={barW} height={h2} rx="0.6" className="fill-accent-500">
                  <title>{`${monthLabel(d.month)} outstanding ETB ${amount(d.outstanding)}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 grid text-center text-xs text-ink-subtle" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <div key={d.month}>
            <div>{monthLabel(d.month)}</div>
            <div className="text-[10px]">{d.jobs} jobs</div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex justify-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-600" /> Collected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent-500" /> Outstanding
        </span>
      </figcaption>
    </figure>
  );
}
