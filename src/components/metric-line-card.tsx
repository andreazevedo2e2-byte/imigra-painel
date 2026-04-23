'use client';

import { useMemo, useRef, useState } from 'react';

export type LineSeriesPoint = { date: string; value: number };

type MetricLineCardProps = {
  title: string;
  unit: 'brl_cents' | 'count';
  currentTotal: number;
  previousTotal: number;
  delta: number | null;
  current: LineSeriesPoint[];
  previous?: LineSeriesPoint[];
  accent?: 'violet' | 'orange';
};

const VB_WIDTH = 640;
const VB_HEIGHT = 200;
const PAD_X = 18;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function formatValue(unit: MetricLineCardProps['unit'], value: number) {
  if (unit === 'brl_cents') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

function formatDelta(delta: number | null) {
  if (delta === null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}%`;
}

function getDeltaTone(delta: number | null) {
  if (delta === null) return 'flat';
  if (delta > 0.0001) return 'up';
  if (delta < -0.0001) return 'down';
  return 'flat';
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const d: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }

  return d.join(' ');
}

export function MetricLineCard({
  title,
  unit,
  currentTotal,
  previousTotal,
  delta,
  current,
  previous,
  accent = 'violet',
}: MetricLineCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = current.length ? current : [{ date: new Date().toISOString().slice(0, 10), value: 0 }];
  const compare = previous && previous.length ? previous : null;
  const tone = getDeltaTone(delta);

  const meta = useMemo(() => {
    const innerWidth = VB_WIDTH - PAD_X * 2;
    const innerHeight = VB_HEIGHT - PAD_TOP - PAD_BOTTOM;

    const currentValues = series.map((p) => p.value);
    const compareValues = compare ? compare.map((p) => p.value) : [];
    const maxValueRaw = Math.max(0, ...currentValues, ...compareValues);
    const maxValue = maxValueRaw === 0 ? 1 : maxValueRaw * 1.08;

    const toPoint = (index: number, value: number) => {
      const t = series.length === 1 ? 0 : index / (series.length - 1);
      const x = PAD_X + t * innerWidth;
      const y = PAD_TOP + innerHeight - (value / maxValue) * innerHeight;
      return { x, y };
    };

    const currentPoints = series.map((p, idx) => toPoint(idx, p.value));
    const comparePoints = compare ? compare.map((p, idx) => toPoint(idx, p.value)) : null;

    const currentPath = buildSmoothPath(currentPoints);
    const comparePath = comparePoints ? buildSmoothPath(comparePoints) : '';
    const areaPath =
      currentPoints.length > 1
        ? `${currentPath} L ${currentPoints[currentPoints.length - 1].x} ${PAD_TOP + innerHeight} L ${currentPoints[0].x} ${PAD_TOP + innerHeight} Z`
        : '';

    return {
      innerHeight,
      innerWidth,
      maxValue,
      currentPoints,
      comparePoints,
      currentPath,
      comparePath,
      areaPath,
    };
  }, [compare, series]);

  const accentClass = accent === 'orange' ? 'accent-orange' : 'accent-violet';
  const hover = hoverIndex !== null ? clamp(hoverIndex, 0, series.length - 1) : null;

  const hoverPoint = hover !== null ? meta.currentPoints[hover] : null;
  const hoverComparePoint = hover !== null && meta.comparePoints ? meta.comparePoints[hover] : null;
  const hoverSeriesItem = hover !== null ? series[hover] : null;
  const hoverCompareItem = hover !== null && compare ? compare[hover] : null;

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = clamp(x / rect.width, 0, 1);
    const index = Math.round(pct * (series.length - 1));
    setHoverIndex(index);
  }

  return (
    <div className={`card metric-card ${accentClass}`}>
      <div className="metric-head">
        <div>
          <div className="metric-title">{title}</div>
          <div className="metric-value">{formatValue(unit, currentTotal)}</div>
          <div className="metric-sub">
            <span className={`metric-delta ${tone}`}>{formatDelta(delta)}</span>
            <span className="metric-prev">{formatValue(unit, previousTotal)} periodo anterior</span>
          </div>
        </div>
      </div>

      <div className="metric-chart" ref={chartRef} onPointerMove={onPointerMove} onPointerLeave={() => setHoverIndex(null)}>
        <svg viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="metricFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-primary-soft)" stopOpacity="0.55" />
              <stop offset="70%" stopColor="var(--chart-primary-soft)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--chart-primary-soft)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g opacity="0.9">
            {[0.15, 0.5, 0.85].map((t) => (
              <line
                key={t}
                x1={PAD_X}
                x2={VB_WIDTH - PAD_X}
                y1={PAD_TOP + meta.innerHeight * t}
                y2={PAD_TOP + meta.innerHeight * t}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="1"
              />
            ))}
          </g>

          {meta.areaPath ? (
            <path d={meta.areaPath} fill="url(#metricFill)" />
          ) : null}

          {meta.comparePath ? (
            <path
              d={meta.comparePath}
              fill="none"
              stroke="rgba(148,163,184,0.45)"
              strokeWidth="2"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          ) : null}

          {meta.currentPath ? (
            <path
              d={meta.currentPath}
              fill="none"
              stroke="var(--chart-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {hoverPoint ? (
            <>
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={PAD_TOP}
                y2={PAD_TOP + meta.innerHeight}
                stroke="rgba(148,163,184,0.18)"
                strokeWidth="1"
              />
              {hoverComparePoint ? (
                <circle
                  cx={hoverComparePoint.x}
                  cy={hoverComparePoint.y}
                  r="4"
                  fill="rgba(148,163,184,0.9)"
                  stroke="rgba(8, 14, 24, 0.9)"
                  strokeWidth="2"
                />
              ) : null}
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="5"
                fill="var(--chart-primary)"
                stroke="rgba(8, 14, 24, 0.9)"
                strokeWidth="2"
              />
            </>
          ) : null}
        </svg>

        {hoverPoint && hoverSeriesItem ? (
          <div
            className="metric-tooltip"
            style={{
              left: `${(hoverPoint.x / VB_WIDTH) * 100}%`,
            }}
          >
            <div className="metric-tooltip-row">
              <span className="metric-tooltip-swatch current" />
              <span className="metric-tooltip-date">{formatShortDate(hoverSeriesItem.date)}</span>
              <span className="metric-tooltip-value">{formatValue(unit, hoverSeriesItem.value)}</span>
            </div>
            {hoverCompareItem ? (
              <div className="metric-tooltip-row">
                <span className="metric-tooltip-swatch prev" />
                <span className="metric-tooltip-date">{formatShortDate(hoverCompareItem.date)}</span>
                <span className="metric-tooltip-value">{formatValue(unit, hoverCompareItem.value)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="metric-axis">
        <span>{formatShortDate(series[0].date)}</span>
        <span>{formatShortDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}
