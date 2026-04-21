type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

const chartPalette = [
  '#ff7a59',
  '#6dd3c7',
  '#7aa2ff',
  '#f4c95d',
  '#c48cff',
  '#7bd389',
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

  const gradient = slices
    .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
    .join(', ');

  return (
    <div className="card chart-card">
      <div className="section-title">{title}</div>
      <div className="donut-layout">
        <div className="donut-wrap">
          <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}>
            <div className="donut-hole">
              <strong>{total}</strong>
              <span>Total</span>
            </div>
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
                    background: `linear-gradient(90deg, ${chartPalette[index % chartPalette.length]} 0%, rgba(255,255,255,0.9) 100%)`,
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
  title: string;
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
