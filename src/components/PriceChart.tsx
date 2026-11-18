"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartPoint {
  t: number; // timestamp
  carpet?: number;
  saleable?: number;
  unknown?: number;
  label: string; // stage + date
  source: string;
}

export interface ChartEvent {
  t: number;
  title: string;
}

const SERIES = [
  { key: "carpet", name: "Carpet basis", color: "var(--accent)" },
  { key: "saleable", name: "Saleable basis", color: "#d08a2b" },
  { key: "unknown", name: "Basis unclear", color: "#8a8f94" },
] as const;

const fmtYear = (t: number) => String(new Date(t).getFullYear());
const fmtK = (v: number) => `₹${(v / 1000).toFixed(0)}k`;

export default function PriceChart({ points, events }: { points: ChartPoint[]; events: ChartEvent[] }) {
  const present = SERIES.filter((s) => points.some((p) => p[s.key] != null));
  if (points.length === 0) return <p className="text-sm text-muted">No price data yet.</p>;

  return (
    <div className="space-y-2">
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtYear}
              stroke="var(--muted)"
              fontSize={12}
            />
            <YAxis tickFormatter={fmtK} stroke="var(--muted)" fontSize={12} width={52} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
              labelFormatter={(_, payload) => (payload?.[0]?.payload as ChartPoint | undefined)?.label ?? ""}
              formatter={(v, name) => [`₹${Math.round(Number(v)).toLocaleString("en-IN")}/sq ft`, String(name)]}
            />
            {events.map((e) => (
              <ReferenceLine key={`${e.t}-${e.title}`} x={e.t} stroke="var(--muted)" strokeDasharray="2 4" strokeOpacity={0.6} />
            ))}
            {present.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {present.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
        {events.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 border-l border-dashed border-muted" /> News event
          </span>
        )}
      </div>
    </div>
  );
}
