import { useId, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

/**
 * Minimal, dependency-free SVG charts for the dashboards. Single-series, one brand hue
 * (validated against light and dark surfaces), hairline grids, per-bar hover tooltips and a
 * table view so no value is ever only available visually.
 */

const BAR_COLOR = 'var(--color-brand)';

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value / 4) ?? 10;
  return Math.ceil(value / (step * pow)) * step * pow;
}

export interface ColumnDatum {
  label: string;
  value: number;
}

export function ColumnChart({
  title,
  data,
  format,
  tickLabel,
  height = 220,
}: {
  title: string;
  data: ColumnDatum[];
  format: (v: number) => string;
  tickLabel?: (label: string, index: number) => string | null;
  height?: number;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const width = 640;
  const pad = { top: 16, right: 8, bottom: 28, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(2, band - 2));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const hovered = hover !== null ? data[hover] : undefined;

  return (
    <figure aria-labelledby={`${id}-title`} className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <figcaption id={`${id}-title`} className="font-display font-bold">
          {title}
        </figcaption>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-xs font-semibold text-ink-faint underline-offset-2 hover:text-ink hover:underline">
          {asTable ? 'View chart' : 'View as table'}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-faint">
                <th className="py-1 font-semibold">Date</th>
                <th className="py-1 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-t border-line">
                  <td className="py-1">{d.label}</td>
                  <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${title}. Use "View as table" for exact values.`}>
            {ticks.map((t) => {
              const y = pad.top + innerH - (t / max) * innerH;
              return (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--nf-line)" strokeWidth={1} />
                  <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--nf-ink-faint)">
                    {format(t)}
                  </text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.value / max) * innerH;
              const x = pad.left + i * band + (band - barW) / 2;
              const y = pad.top + innerH - h;
              const r = Math.min(4, barW / 2, h);
              const label = tickLabel ? tickLabel(d.label, i) : null;
              return (
                <g key={d.label}>
                  {h > 0 ? (
                    <path
                      d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                      fill={BAR_COLOR}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  ) : null}
                  {/* Hit target taller and wider than the mark. */}
                  <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`} />
                  {label ? (
                    <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--nf-ink-faint)">
                      {label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {hovered && hover !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lift"
              style={{ left: `${((pad.left + hover * band + band / 2) / width) * 100}%` }}
            >
              <p className="font-semibold">{hovered.label}</p>
              <p className="tabular-nums text-ink-soft">{format(hovered.value)}</p>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}

/** Ranked horizontal bars with the value at the tip. */
export function BarList({ title, data, format, className }: { title: string; data: { label: string; value: number; hint?: string }[]; format: (v: number) => string; className?: string }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  return (
    <figure className={cn('w-full', className)}>
      <figcaption className="mb-3 font-display font-bold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-ink-faint">No data yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => (
            <li key={d.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{d.label}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {format(d.value)}
                  {d.hint ? <span className="ml-1 text-ink-faint">· {d.hint}</span> : null}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: BAR_COLOR }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-soft">
      <p className="text-sm font-semibold text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}
