"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useMemo, useState } from "react";

import { CompanyTabs } from "@/components/company-tabs";
import { AdminOnly } from "@/components/role-gate";
import { Badge, Card, EmptyState, ErrorAlert, Input, Spinner, StatusBadge, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { enc, qk } from "@/lib/queries";
import type { Intent, Playbook } from "@/lib/types";

export default function PlaybookPage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = use(params);
  return (
    <AdminOnly>
      <CompanyTabs slug={slug} />
      <PlaybookView slug={slug} n={Number(n)} />
    </AdminOnly>
  );
}

function PlaybookView({ slug, n }: { slug: string; n: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.playbook(slug, n),
    queryFn: () => api<Playbook>(`/companies/${enc(slug)}/guidelines/${n}/playbook`),
  });
  const [filter, setFilter] = useState("");
  const intents = useMemo(() => {
    const f = filter.toLowerCase();
    return (data?.intents ?? []).filter(
      (i) => !f || i.key.includes(f) || i.name.toLowerCase().includes(f) || i.description.toLowerCase().includes(f),
    );
  }, [data, filter]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorAlert error={error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/companies/${slug}/guidelines/${n}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Version {n}
        </Link>
        <p className="text-xs text-slate-500">
          v{data.version_number} · compiled by {data.compiler_model ?? "—"} · {data.intents.length} intents · {data.facts.length} facts ·{" "}
          {data.sections.length} sections
        </p>
      </div>

      <Tabs
        tabs={[
          {
            id: "intents",
            label: `Intents (${data.intents.length})`,
            content: (
              <div className="space-y-3">
                <Input placeholder="Filter intents…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
                {intents.length === 0 ? <EmptyState title="No intents" /> : intents.map((i) => <IntentCard key={i.key} intent={i} />)}
              </div>
            ),
          },
          { id: "rules", label: "Company rules", content: <RulesCard rules={data.company_rules} /> },
          {
            id: "facts",
            label: `Facts (${data.facts.length})`,
            content:
              data.facts.length === 0 ? (
                <EmptyState title="No reference facts" />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.facts.map((f) => (
                    <Card key={f.id} title={f.title}>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{f.text}</p>
                      <p className="mt-2 font-mono text-[11px] text-slate-400">
                        fact:{f.id.slice(0, 8)} · from {f.source_section_ids.join(", ") || "—"}
                      </p>
                    </Card>
                  ))}
                </div>
              ),
          },
          {
            id: "sections",
            label: `Sections (${data.sections.length})`,
            content: (
              <Card bodyClassName="p-0">
                <ul className="divide-y divide-slate-100">
                  {data.sections.map((s) => {
                    const kind = data.coverage?.[s.ref] ?? data.coverage?.[s.id];
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <span>
                          <span className="mr-2 font-mono text-xs text-slate-500">{s.ref}</span>
                          {s.heading ?? <span className="text-slate-400">(no heading)</span>}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {kind ? <Badge>{String(kind)}</Badge> : null}
                          chars {s.char_start}–{s.char_end}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function IntentCard({ intent }: { intent: Intent }) {
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {intent.name} <span className="font-mono text-xs font-normal text-slate-500">{intent.key}</span>
        </span>
      }
      actions={<span className="text-xs text-slate-400">from {intent.source_section_ids.join(", ")}</span>}
    >
      <p className="text-sm text-slate-600">{intent.description}</p>
      {intent.conditions.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold">Conditions:</span> {intent.conditions.join("; ")}
        </p>
      )}
      <ol className="mt-3 space-y-1.5">
        {intent.steps.map((s) => (
          <li key={s.step_id} className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="w-8 shrink-0 font-mono text-xs text-slate-400">{s.step_id}</span>
            <Badge tone={s.type === "action" ? "violet" : s.type === "lookup" ? "blue" : s.type === "escalate" ? "red" : "gray"}>
              {s.type}
            </Badge>
            <span className="min-w-0 flex-1 text-slate-800">
              {s.text}
              {s.condition && <span className="ml-1 text-xs text-slate-500">(if {s.condition})</span>}
            </span>
            {s.capability ? (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700">{s.capability}</span>
            ) : s.type === "lookup" || s.type === "action" ? (
              <StatusBadge status="agent" label="manual" />
            ) : null}
          </li>
        ))}
      </ol>
      {intent.reply_template && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Reply template{intent.placeholders.length ? ` · placeholders: ${intent.placeholders.join(", ")}` : ""}
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">{intent.reply_template}</p>
        </details>
      )}
    </Card>
  );
}

function RulesCard({ rules }: { rules: Record<string, unknown> }) {
  const entries = Object.entries(rules ?? {}).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
  if (!entries.length) return <EmptyState title="No company rules were compiled" />;
  return (
    <Card title="Always applied to every reply">
      <dl className="space-y-3">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.replace(/_/g, " ")}</dt>
            <dd className="mt-0.5 text-sm text-slate-800">
              {Array.isArray(v) ? (
                <ul className="list-disc space-y-0.5 pl-5">
                  {v.map((x, i) => (
                    <li key={i}>{String(x)}</li>
                  ))}
                </ul>
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
