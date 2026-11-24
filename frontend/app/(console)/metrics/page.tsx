"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { CHART, ChartCard, ColumnChart, RankedBarChart, StatusStackChart } from "@/components/charts";
import { AdminOnly } from "@/components/role-gate";
import { Button, Card, ErrorAlert, Field, KpiTile, KV, PageHeader, Select, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { fmtDate, fmtMs, fmtNum, fmtPct } from "@/lib/format";
import { qk, useCompanies } from "@/lib/queries";
import type { MetricsSummary } from "@/lib/types";

const RANGES = [
  { id: "1", label: "Last 24 hours" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
];

const TOOL_STATUSES = [
  { key: "ok", name: "ok", color: CHART.status.good },
  { key: "timeout", name: "timeout", color: CHART.status.warning },
  { key: "policy_denied", name: "policy denied", color: CHART.status.serious },
  { key: "error", name: "error", color: CHART.status.critical },
];

export default function MetricsPage() {
  return (
    <AdminOnly>
      <Metrics />
    </AdminOnly>
  );
}

function Metrics() {
  const { company: current } = useApp();
  const companies = useCompanies();
  const [days, setDays] = useState("7");
  const [company, setCompany] = useState<string | null>(null);
  const scope = company ?? current;
  // Recomputed only when the filters change, so the query key is stable between renders.
  const [now, setNow] = useState(() => Date.now());
  const from = new Date(now - Number(days) * 86_400_000).toISOString();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: qk.metrics({ days, scope, now }),
    queryFn: () => api<MetricsSummary>("/internal/metrics/summary", { query: { from, company: scope } }),
  });

  return (
    <>
      <PageHeader
        title="Metrics"
        subtitle="Volume, latency, errors, tokens, routing quality and tool usage."
        actions={
          <Button variant="secondary" size="sm" loading={isFetching} onClick={() => setNow(Date.now())}>
            Refresh
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Field label="Window" className="w-44">
          <Select
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              setNow(Date.now());
            }}
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Company" className="w-56">
          <Select value={scope} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All companies</option>
            {companies.data?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error && <ErrorAlert error={error} />}
      {isLoading || !data ? (
        !error && <Spinner />
      ) : (
        <Dashboard m={data} />
      )}
    </>
  );
}

function Dashboard({ m }: { m: MetricsSummary }) {
  const c = m.chats;
  const tokensIn = (c.tokens.input ?? 0) + (c.tokens.router_input ?? 0);
  const tokensOut = (c.tokens.output ?? 0) + (c.tokens.router_output ?? 0);
  const daily = m.daily_volume.map((d) => ({ ...d, day: d.date.slice(5, 10) }));
  const confidence = Object.entries(c.confidence_breakdown).map(([level, chats]) => ({ level, chats }));
  const tools = m.tools.calls.map((row) => ({
    ...Object.fromEntries(TOOL_STATUSES.map((s) => [s.key, Number(row[s.key] ?? 0)])),
    capability: row.capability,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Chats" value={fmtNum(c.total)} hint={`${fmtNum(c.success)} ok · ${fmtNum(c.error)} failed`} />
        <KpiTile label="Error rate" value={fmtPct(c.error_rate)} />
        <KpiTile label="Latency p50" value={fmtMs(c.latency_ms.p50)} hint={`avg ${fmtMs(c.latency_ms.avg)}`} />
        <KpiTile label="Latency p95" value={fmtMs(c.latency_ms.p95)} />
        <KpiTile label="Escalation rate" value={fmtPct(c.escalation_rate)} />
        <KpiTile label="Tokens in / out" value={`${fmtNum(tokensIn)} / ${fmtNum(tokensOut)}`} hint="generator + router" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Daily chat volume"
          empty={daily.length === 0}
          chart={<ColumnChart data={daily} x="day" y="chats" name="Chats" />}
          table={{ columns: ["Date", "Chats"], rows: m.daily_volume.map((d) => [d.date, d.chats]) }}
        />
        <ChartCard
          title="Chats by company"
          empty={m.by_company.length === 0}
          chart={<RankedBarChart data={m.by_company} label="company" value="chats" name="Chats" />}
          table={{
            columns: ["Company", "Chats", "Avg latency", "Error rate"],
            rows: m.by_company.map((b) => [b.company, b.chats, fmtMs(b.avg_latency_ms), fmtPct(b.error_rate)]),
          }}
        />
        <ChartCard
          title="Top intents"
          subtitle="successful chats, by primary intent"
          empty={m.routing.top_intents.length === 0}
          chart={<RankedBarChart data={m.routing.top_intents} label="intent" value="chats" name="Chats" />}
          table={{ columns: ["Intent", "Chats"], rows: m.routing.top_intents.map((t) => [t.intent, t.chats]) }}
        />
        <ChartCard
          title="Tool calls by outcome"
          empty={tools.length === 0}
          chart={<StatusStackChart data={tools} label="capability" series={TOOL_STATUSES} />}
          table={{
            columns: ["Capability", ...TOOL_STATUSES.map((s) => s.name)],
            rows: tools.map((t) => [t.capability, ...TOOL_STATUSES.map((s) => (t as Record<string, number | string>)[s.key])]),
          }}
        />
        <ChartCard
          title="Confidence breakdown"
          empty={confidence.length === 0}
          chart={<RankedBarChart data={confidence} label="level" value="chats" name="Chats" />}
          table={{ columns: ["Confidence", "Chats"], rows: confidence.map((x) => [x.level, x.chats]) }}
        />
        <Card title="Routing">
          <KV
            items={[
              ["No-match rate", fmtPct(m.routing.no_match_rate)],
              ["Multi-intent rate", fmtPct(m.routing.multi_intent_rate)],
              ["Feedback received", fmtNum(m.routing.feedback_count)],
              ["Feedback correction rate", fmtPct(m.routing.feedback_correction_rate)],
            ]}
          />
          {m.routing.latest_eval.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Latest eval per company</p>
              <ul className="space-y-1 text-sm">
                {m.routing.latest_eval.map((e) => (
                  <li key={e.company} className="flex justify-between gap-2">
                    <span>
                      {e.company} v{e.version} <span className="text-xs text-slate-500">({e.mode}, {fmtDate(e.created_at)})</span>
                    </span>
                    <span className="tabular-nums">
                      top-1 {fmtPct(e.top1)} · recall {fmtPct(e.recall_at_k)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/evals" className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:underline">
                Open evals
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tools & actions">
          <KV
            items={[
              ["Tool latency p95", fmtMs(m.tools.p95_latency_ms)],
              ["Prefetch share", fmtPct(m.tools.prefetch_share)],
              ...Object.entries(m.tools.proposals).map(([k, v]) => [`Actions ${k}`, fmtNum(v)] as [string, string]),
            ]}
          />
        </Card>
        <Card title="Ingestion">
          <KV
            items={[
              ["Uploads", fmtNum(m.ingestion.uploads)],
              ["Ready", fmtNum(m.ingestion.ready)],
              ["Failed", fmtNum(m.ingestion.failed)],
              ["Avg duration", fmtMs(m.ingestion.avg_duration_ms)],
            ]}
          />
        </Card>
      </div>
      <p className="text-xs text-slate-500">
        Window: {fmtDate(m.window.from)} – {fmtDate(m.window.to)}
      </p>
    </div>
  );
}
