/** Minimal SVG line chart with a faint grid, labelled max/min and an emphasised last point. */
export interface Series { label: string; values: number[]; color: string }

export function LineChart({ series, height = 140, xLabels, empty }: { series: Series[]; height?: number; xLabels?: [string, string]; empty: string }) {
  const W = 400;
  const H = height;
  const pad = { l: 44, r: 10, t: 10, b: xLabels ? 18 : 8 };
  const all = series.flatMap((s) => s.values);
  if (!all.length || series.every((s) => s.values.length < 2)) return <div className="chart-empty hint">{empty}</div>;
  const max = Math.max(...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const fmt = (v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + span * f;
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid-line" />
              <text x={pad.l - 4} y={y(v) + 4} textAnchor="end" className="axis-label">{fmt(v)}</text>
            </g>
          );
        })}
        {series.map((s) => {
          if (s.values.length < 2) return null;
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          const last = s.values.length - 1;
          return (
            <g key={s.label}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <circle cx={x(last)} cy={y(s.values[last])} r={3.5} fill={s.color} />
            </g>
          );
        })}
        {xLabels && (
          <>
            <text x={pad.l} y={H - 4} className="axis-label">{xLabels[0]}</text>
            <text x={W - pad.r} y={H - 4} textAnchor="end" className="axis-label">{xLabels[1]}</text>
          </>
        )}
      </svg>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}
