type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="card stat-card">
      <div className="eyebrow">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="muted stat-hint">{hint}</div> : null}
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
          {items.slice(0, 6).map((item) => (
            <div key={item.label} className="bar-row">
              <div className="bar-meta">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
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

