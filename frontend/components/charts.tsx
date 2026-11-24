"use client";

import { Table2, BarChart3 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, EmptyState } from "@/components/ui";

/* Validated reference palette (light surface). Single-series charts use series 1 only;
   status colours are reserved for ok / timeout / denied / error and always ship with a legend. */
export const CHART = {
  series1: "#2a78d6",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  textSecondary: "#52514e",
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const tickStyle = { fontSize: 11, fill: CHART.textSecondary };

/** Card with a chart ↔ table toggle, so every chart has an accessible table view. */
export function ChartCard({
  title,
  subtitle,
  empty,
  chart,
  table,
}: {
  title: string;
  subtitle?: string;
  empty?: boolean;
  chart: React.ReactNode;
  table: { columns: string[]; rows: (string | number)[][] };
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card
      title={
        <span>
          {title}
          {subtitle && <span className="ml-2 text-xs font-normal text-slate-500">{subtitle}</span>}
        </span>
      }
      actions={
        !empty && (
          <button
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
          >
            {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
            {asTable ? "Chart" : "Table"}
          </button>
        )
      }
    >
      {empty ? (
        <EmptyState title="No data in this window" />
      ) : asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} className={`pb-1 text-xs font-semibold text-slate-500 ${i ? "text-right" : "text-left"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={`py-1 ${j ? "text-right tabular-nums" : "font-mono text-xs"}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64">{chart}</div>
      )}
    </Card>
  );
}

function TooltipBox({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string | number; value?: number | string; color?: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-0.5 font-semibold text-slate-800">{label}</p>
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-1.5 text-slate-600">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-medium tabular-nums text-slate-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Vertical single-series bars (e.g. daily volume). */
export function ColumnChart({
  data,
  x,
  y,
  name,
}: {
  data: Row[];
  x: string;
  y: string;
  name: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey={x} tick={tickStyle} tickLine={false} axisLine={{ stroke: CHART.axis }} />
        <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(42,120,214,0.08)" }} />
        <Bar dataKey={y} name={name} fill={CHART.series1} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal single-series bars for ranked categories (companies, intents). */
export function RankedBarChart({
  data,
  label,
  value,
  name,
}: {
  data: Row[];
  label: string;
  value: string;
  name: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey={label} width={140} tick={tickStyle} tickLine={false} axisLine={{ stroke: CHART.axis }} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(42,120,214,0.08)" }} />
        <Bar dataKey={value} name={name} fill={CHART.series1} radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked horizontal bars by status (ok / timeout / policy_denied / error). */
export function StatusStackChart({
  data,
  label,
  series,
}: {
  data: Row[];
  label: string;
  series: { key: string; name: string; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey={label} width={140} tick={tickStyle} tickLine={false} axisLine={{ stroke: CHART.axis }} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(42,120,214,0.08)" }} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11, color: CHART.textSecondary }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="status"
            fill={s.color}
            stroke="#ffffff"
            strokeWidth={2}
            maxBarSize={20}
            radius={i === series.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
