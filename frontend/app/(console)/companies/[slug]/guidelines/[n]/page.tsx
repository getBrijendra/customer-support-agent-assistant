"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { CompanyTabs } from "@/components/company-tabs";
import { AdminOnly } from "@/components/role-gate";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  KV,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fmtBytes, fmtDate, fmtMs } from "@/lib/format";
import { enc, qk } from "@/lib/queries";
import type { CapabilityCoverage, GuidelineVersion } from "@/lib/types";

export default function VersionPage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = use(params);
  return (
    <AdminOnly>
      <CompanyTabs slug={slug} />
      <Version slug={slug} n={Number(n)} />
    </AdminOnly>
  );
}

function Version({ slug, n }: { slug: string; n: number }) {
  const base = `/companies/${enc(slug)}/guidelines/${n}`;
  const version = useQuery({
    queryKey: [...qk.guideline(slug, n), "text"],
    queryFn: () => api<GuidelineVersion>(base, { query: { include_text: true } }),
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 2000 : false),
  });
  const coverage = useQuery({
    queryKey: qk.coverage(slug, n),
    queryFn: () => api<CapabilityCoverage>(`${base}/capability-coverage`),
    enabled: version.data?.status === "ready",
  });

  if (version.isLoading) return <Spinner />;
  if (version.error || !version.data) return <ErrorAlert error={version.error} />;
  const v = version.data;
  const coverageMap = Object.entries(v.coverage ?? {}).filter(([k]) => k !== "unmapped");
  const unmapped = (v.coverage?.unmapped as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/companies/${slug}/guidelines`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All versions
        </Link>
        {v.status === "ready" && (
          <Link href={`/companies/${slug}/guidelines/${n}/playbook`}>
            <Button size="sm">
              <BookOpen className="h-4 w-4" /> View playbook
            </Button>
          </Link>
        )}
      </div>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Version {v.version_number}
            <StatusBadge status={v.status} />
            <StatusBadge status={v.review_status} />
            {v.is_active && <Badge tone="green">active</Badge>}
          </span>
        }
      >
        <KV
          items={[
            ["File", `${v.file_name} (${fmtBytes(v.byte_size)})`],
            ["Uploaded", `${fmtDate(v.created_at)}${v.uploaded_by ? ` by ${v.uploaded_by}` : ""}`],
            ["Ready", fmtDate(v.ready_at)],
            ["Activated", fmtDate(v.activated_at)],
            ["Reviewed by", v.reviewed_by],
            ["Review note", v.review_note],
            ["Activate on approval", v.activate_on_approval ? "yes" : "no"],
            ["Compiler", `${v.compiler_model ?? "—"} (prompt ${v.compile_prompt_version ?? "—"})`],
            ["Embeddings", `${v.embedding_model} · ${v.embedding_dimensions} dims`],
            ["Counts", `${v.section_count ?? 0} sections · ${v.intent_count ?? 0} intents · ${v.fact_count ?? 0} facts`],
            ["Compile / ingest", `${fmtMs(v.compile_duration_ms)} / ${fmtMs(v.ingest_duration_ms)}`],
            [
              "Retrieval eval",
              v.routing_eval_run_id ? (
                <Link key="e" className="text-indigo-700 hover:underline" href={`/evals/runs/${v.routing_eval_run_id}`}>
                  open run
                </Link>
              ) : (
                "—"
              ),
            ],
            ["SHA-256", <span key="h" className="font-mono text-xs">{v.content_sha256.slice(0, 16)}…</span>],
            ["Notes", v.notes],
          ]}
        />
        {v.error_message && (
          <div className="mt-4">
            <ErrorAlert error={new Error(v.error_message)} title="Ingestion failed" />
          </div>
        )}
      </Card>

      {!!v.validation_warnings?.length && (
        <Card title={`Validation warnings (${v.validation_warnings.length})`}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {v.validation_warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Section coverage">
          {coverageMap.length === 0 ? (
            <p className="text-sm text-slate-500">No coverage data.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {coverageMap.map(([section, kind]) => (
                  <span key={section} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    <span className="font-mono">{section}</span> → {String(kind)}
                  </span>
                ))}
              </div>
              {unmapped.length > 0 && (
                <p className="mt-3 text-xs text-amber-800">Unmapped: {unmapped.join(", ")}</p>
              )}
            </>
          )}
        </Card>

        <Card title="Capability coverage">
          {coverage.isLoading && v.status === "ready" ? (
            <Spinner />
          ) : coverage.error ? (
            <ErrorAlert error={coverage.error} />
          ) : !coverage.data?.capabilities.length ? (
            <EmptyState title="No playbook step references a capability" />
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">
                {coverage.data.live} of {coverage.data.referenced} referenced capabilities are live; {coverage.data.manual} will be manual steps.
              </p>
              <Table>
                <thead>
                  <tr>
                    <Th>Capability</Th>
                    <Th>Binding</Th>
                    <Th>Handled by</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coverage.data.capabilities.map((c) => (
                    <tr key={c.capability}>
                      <Td>
                        <span className="font-mono text-xs">{c.capability}</span> {c.kind && <StatusBadge status={c.kind} />}
                        <p className="text-[11px] text-slate-500">{c.steps.join(", ")}</p>
                      </Td>
                      <Td>
                        {c.binding_status ? (
                          <>
                            <StatusBadge status={c.binding_status} /> <span className="text-xs text-slate-500">{c.adapter_type}</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">unbound</span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={c.handled_by} label={c.handled_by === "ai" ? "AI (live)" : "Agent (manual)"} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Card>
      </div>

      {v.raw_text && (
        <Card title="Source text">
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-800">
            {v.raw_text}
          </pre>
        </Card>
      )}
    </div>
  );
}
