"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import { EvalMetricTiles } from "@/components/eval-metrics";
import { AdminOnly } from "@/components/role-gate";
import { Badge, Card, EmptyState, ErrorAlert, PageHeader, Select, Spinner, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtPct } from "@/lib/format";
import { enc, qk } from "@/lib/queries";
import type { EvalRun } from "@/lib/types";

interface CaseResult {
  message?: string;
  expected?: string[];
  predicted?: string[];
  candidates?: string[];
  stale?: boolean;
  source?: string;
  correct_top1?: boolean;
}

export default function EvalRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminOnly>
      <Run id={id} />
    </AdminOnly>
  );
}

function outcome(r: CaseResult): "stale" | "correct" | "wrong" {
  if (r.stale) return "stale";
  const exp = r.expected ?? [];
  const pred = r.predicted ?? [];
  if (exp.length === 0) return pred.length === 0 ? "correct" : "wrong";
  if (typeof r.correct_top1 === "boolean") return r.correct_top1 ? "correct" : "wrong";
  return pred[0] !== undefined && exp.includes(pred[0]) ? "correct" : "wrong";
}

function Run({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.evalRun(id),
    queryFn: () => api<EvalRun>(`/internal/evals/routing/runs/${enc(id)}`),
  });
  const [show, setShow] = useState<"all" | "wrong" | "correct" | "stale">("wrong");

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorAlert error={error} />;

  const m = data.metrics;
  const perIntent = Object.entries(m.per_intent ?? {}).sort((a, b) => (a[1].accuracy ?? 0) - (b[1].accuracy ?? 0));
  const results = ((data.results ?? []) as CaseResult[]).map((r) => ({ ...r, outcome: outcome(r) }));
  const visible = results.filter((r) => show === "all" || r.outcome === show);

  return (
    <div className="space-y-6">
      <Link href="/evals" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Routing evals
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Eval run · {data.company} v{data.version_number}
            <Badge tone={data.mode === "full" ? "violet" : "blue"}>{data.mode}</Badge>
          </span>
        }
        subtitle={fmtDate(data.created_at)}
      />
      <EvalMetricTiles m={m} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Per-intent accuracy (worst first)" bodyClassName="p-0">
          {perIntent.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No in-scope cases" />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Intent</Th>
                  <Th className="text-right">Cases</Th>
                  <Th className="text-right">Correct</Th>
                  <Th className="text-right">Accuracy</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {perIntent.map(([k, v]) => (
                  <tr key={k}>
                    <Td className="font-mono text-xs">{k}</Td>
                    <Td className="text-right tabular-nums">{v.cases}</Td>
                    <Td className="text-right tabular-nums">{v.correct}</Td>
                    <Td className="text-right tabular-nums">{fmtPct(v.accuracy)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card title="Most confused pairs">
          {!m.top_confusions?.length ? (
            <p className="text-sm text-slate-500">No confusions — every in-scope case was routed correctly.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {m.top_confusions.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{c.expected}</span>
                  <span className="text-slate-400">routed to</span>
                  <span className="font-mono text-xs text-red-700">{c.predicted}</span>
                  <Badge>{c.count}×</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title={`Per-case results (${visible.length} of ${results.length})`}
        actions={
          <Select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className="w-36">
            <option value="wrong">Wrong</option>
            <option value="correct">Correct</option>
            <option value="stale">Stale</option>
            <option value="all">All</option>
          </Select>
        }
        bodyClassName="p-0"
      >
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nothing to show" />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Message</Th>
                <Th>Expected</Th>
                <Th>Predicted</Th>
                <Th>Outcome</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r, i) => (
                <tr key={i}>
                  <Td className="max-w-md">
                    <p className="line-clamp-3">{r.message}</p>
                    {r.source && <p className="mt-0.5 text-[11px] text-slate-400">{r.source}</p>}
                  </Td>
                  <Td className="font-mono text-xs">{r.expected?.length ? r.expected.join(", ") : "(none)"}</Td>
                  <Td className="font-mono text-xs">{r.predicted?.length ? r.predicted.join(", ") : "(no match)"}</Td>
                  <Td>
                    <Badge tone={r.outcome === "correct" ? "green" : r.outcome === "stale" ? "gray" : "red"}>{r.outcome}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
