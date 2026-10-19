import React from 'react';

export interface BarSeries {
  key: string;
  label: string;
  /** Tailwind fill class, e.g. "fill-white" */
  className: string;
}

interface BarChartProps {
  categories: string[];
  series: BarSeries[];
  /** values[seriesIndex][categoryIndex] */
  values: number[][];
  format?: (n: number) => string;
  ariaLabel: string;
  height?: number;
}

/**
 * Dependency-free grouped bar chart with a labelled y-axis, gridlines and native tooltips.
 * Colours come from classes so the chart follows the design tokens.
 */
export const BarChart: React.FC<BarChartProps> = ({ categories, series, values, format = n => String(n), ariaLabel, height = 220 }) => {
  const W = 640;
  const pad = { l: 52, r: 8, t: 12, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const rawMax = Math.max(1, ...values.flat());
  // Round the axis up to a "nice" value (1, 2, 5 × 10^n) so ticks read cleanly
  const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const norm = rawMax / pow;
  const max = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  const ticks = [0, 0.5, 1].map(f => max * f);
  const groupW = innerW / categories.length;
  const barW = Math.min(28, (groupW * 0.7) / series.length);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className="w-full h-auto">
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#232325" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#71717A" fontFamily="monospace">
              {format(t)}
            </text>
          </g>
        ))}
        {categories.map((cat, ci) => {
          const gx = pad.l + ci * groupW + groupW / 2 - (barW * series.length) / 2;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const v = values[si][ci] ?? 0;
                const h = (v / max) * innerH;
                return (
                  <rect key={s.key} x={gx + si * barW} y={y(v)} width={barW - 2} height={Math.max(h, v > 0 ? 1 : 0)} rx="2" className={s.className}>
                    <title>{`${cat} · ${s.label}: ${format(v)}`}</title>
                  </rect>
                );
              })}
              <text x={pad.l + ci * groupW + groupW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#A1A1AA" fontFamily="monospace">
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="flex items-center gap-4 mt-2 text-[11px] text-zinc-400">
          {series.map(s => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden>
                <rect width="10" height="10" rx="2" className={s.className} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
