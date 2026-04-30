import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

const chartPalette = [
  '#8b5cf6',
  '#ff6b4a',
  '#22c55e',
  '#60a5fa',
  '#f59e0b',
  '#94a3b8',
];

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="card stat-card">
      <div className="eyebrow">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="muted stat-hint">{hint}</div> : null}
    </div>
  );
}

type DonutChartProps = {
  title: string;
  items: Array<{ label: string; value: number }>;
  emptyLabel?: string;
};

export function DonutChart({
  title,
  items,
  emptyLabel = 'Sem dados suficientes ainda.',
}: DonutChartProps) {
  const filtered = items.filter((item) => item.value > 0).slice(0, 5);
  const total = filtered.reduce((sum, item) => sum + item.value, 0);

  if (!filtered.length || total === 0) {
    return (
      <div className="card chart-card">
        <div className="section-title">{title}</div>
        <div className="muted">{emptyLabel}</div>
      </div>
    );
  }

  let current = 0;
  const slices = filtered.map((item, index) => {
    const start = current;
    const share = (item.value / total) * 100;
    current += share;
    return {
      ...item,
      color: chartPalette[index % chartPalette.length],
      start,
      end: current,
      percentage: share,
    };
  });

  const r = 58;
  const stroke = 12;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="card chart-card">
      <div className="section-title">{title}</div>
      <div className="donut-layout">
        <div className="donut-wrap">
          <div className="donut-svg-wrap" aria-label={`${title}: total ${total}`}>
            <svg viewBox="0 0 160 160" width="180" height="180" role="img">
              <g transform="translate(80 80) rotate(-90)">
                <circle
                  r={r}
                  cx="0"
                  cy="0"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeWidth={stroke}
                />
                {slices.map((slice) => {
                  const startOffset = (slice.start / 100) * circumference;
                  const length = (slice.percentage / 100) * circumference;
                  return (
                    <circle
                      key={slice.label}
                      r={r}
                      cx="0"
                      cy="0"
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={`${length} ${circumference}`}
                      strokeDashoffset={-startOffset}
                      style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.18))' }}
                    />
                  );
                })}
              </g>
              <g>
                <circle
                  r={r - stroke / 2 - 10}
                  cx="80"
                  cy="80"
                  fill="rgba(8, 14, 24, 0.9)"
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeWidth="1"
                />
                <text
                  x="80"
                  y="78"
                  textAnchor="middle"
                  fontSize="30"
                  fontWeight="800"
                  fill="rgba(244, 247, 251, 0.98)"
                >
                  {total}
                </text>
                <text
                  x="80"
                  y="102"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="rgba(151, 164, 183, 0.9)"
                >
                  Total
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div className="donut-legend">
          {slices.map((slice) => (
            <div key={slice.label} className="legend-row">
              <span className="legend-dot" style={{ backgroundColor: slice.color }} />
              <div className="legend-copy">
                <div className="legend-label">{slice.label}</div>
                <div className="legend-meta">
                  <strong>{slice.value}</strong>
                  <span>{slice.percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type BarChartProps = {
  title: string;
  items: Array<{ label: string; value: number }>;
  emptyLabel?: string;
};

export function BarChart({ title, items, emptyLabel = 'Sem dados suficientes ainda.' }: BarChartProps) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <div className="card chart-card">
      <div className="section-title">{title}</div>
      {items.length === 0 ? (
        <div className="muted">{emptyLabel}</div>
      ) : (
        <div className="bar-list">
          {items.slice(0, 6).map((item, index) => (
            <div key={item.label} className="bar-row">
              <div className="bar-meta">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${max > 0 ? (item.value / max) * 100 : 0}%`,
                    background: `linear-gradient(90deg, ${chartPalette[index % chartPalette.length]} 0%, rgba(255, 255, 255, 0.18) 100%)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type MiniTableProps = {
  title: ReactNode;
  columns: string[];
  rows: string[][];
  emptyLabel?: string;
};

export function MiniTable({ title, columns, rows, emptyLabel = 'Sem dados.' }: MiniTableProps) {
  return (
    <div className="card">
      <div className="section-title">{title}</div>
      {rows.length === 0 ? (
        <div className="muted">{emptyLabel}</div>
      ) : (
        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${index}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
