"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CompanyRequired } from "@/components/company-required";
import { AdminOnly } from "@/components/role-gate";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtPct } from "@/lib/format";
import { enc, qk, useGuidelines } from "@/lib/queries";
import type { EvalCase, EvalRun } from "@/lib/types";

export default function EvalsPage() {
  return (
    <AdminOnly>
      <PageHeader
        title="Routing evals"
        subtitle="Measure how well messages are routed to intents, per guideline version. A retrieval eval runs automatically on every upload."
      />
      <CompanyRequired>{(slug) => <Evals slug={slug} />}</CompanyRequired>
    </AdminOnly>
  );
}

function Evals({ slug }: { slug: string }) {
  return (
    <div className="space-y-6">
      <RunForm slug={slug} />
      <Tabs
        tabs={[
          { id: "runs", label: "Runs", content: <RunsTable slug={slug} /> },
          { id: "cases", label: "Eval cases", content: <CasesPanel slug={slug} /> },
        ]}
      />
    </div>
  );
}

function RunForm({ slug }: { slug: string }) {
  const versions = useGuidelines(slug);
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [version, setVersion] = useState("");
  const [mode, setMode] = useState<"retrieval" | "full">("retrieval");

  const run = useMutation({
    mutationFn: () =>
      api<EvalRun>("/internal/evals/routing", {
        json: { company: slug, version_number: version ? Number(version) : null, mode },
      }),
    onSuccess: (r) => {
      toast.success(`Eval done: top-1 ${fmtPct(r.metrics.top1_accuracy)}`);
      qc.invalidateQueries({ queryKey: qk.evalRuns(slug) });
      router.push(`/evals/runs/${r.id}`);
    },
  });

  return (
    <Card title={`Run an eval for ${slug}`}>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate();
        }}
      >
        <Field label="Version">
          <Select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">Active version</option>
            {versions.data
              ?.filter((v) => v.status === "ready")
              .map((v) => (
                <option key={v.id} value={v.version_number}>
                  v{v.version_number}
                  {v.is_active ? " (active)" : ""} · {v.review_status}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Mode">
          <Select value={mode} onChange={(e) => setMode(e.target.value as "retrieval" | "full")}>
            <option value="retrieval">retrieval — hybrid search only (fast, deterministic)</option>
            <option value="full">full — adds the router LLM</option>
          </Select>
        </Field>
        <Button type="submit" loading={run.isPending}>
          <Play className="h-4 w-4" /> Run eval
        </Button>
      </form>
      {run.isError && (
        <div className="mt-3">
          <ErrorAlert error={run.error} title="Eval failed" />
        </div>
      )}
    </Card>
  );
}

function RunsTable({ slug }: { slug: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.evalRuns(slug),
    queryFn: () => api<EvalRun[]>("/internal/evals/routing/runs", { query: { company: slug } }),
  });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorAlert error={error} />;
  if (!data?.length) return <EmptyState title="No eval runs yet" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Version</Th>
          <Th>Mode</Th>
          <Th className="text-right">Top-1</Th>
          <Th className="text-right">Recall@k</Th>
          <Th className="text-right">Set F1</Th>
          <Th className="text-right">No-match R</Th>
          <Th className="text-right">Cases</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap">
              <Link href={`/evals/runs/${r.id}`} className="font-medium text-indigo-700 hover:underline">
                {fmtDate(r.created_at)}
              </Link>
            </Td>
            <Td>v{r.version_number}</Td>
            <Td>
              <Badge tone={r.mode === "full" ? "violet" : "blue"}>{r.mode}</Badge>
            </Td>
            <Td className="text-right tabular-nums">{fmtPct(r.metrics.top1_accuracy)}</Td>
            <Td className="text-right tabular-nums">{fmtPct(r.metrics.recall_at_k)}</Td>
            <Td className="text-right tabular-nums">{fmtPct(r.metrics.set_f1)}</Td>
            <Td className="text-right tabular-nums">{fmtPct(r.metrics.no_match_recall)}</Td>
            <Td className="text-right tabular-nums">{r.metrics.cases ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function CasesPanel({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const base = `/companies/${enc(slug)}/eval-cases`;
  const { data, isLoading, error } = useQuery({ queryKey: qk.evalCases(slug), queryFn: () => api<EvalCase[]>(base) });
  const [message, setMessage] = useState("");
  const [keys, setKeys] = useState("");
  const [source, setSource] = useState("");

  const add = useMutation({
    mutationFn: () =>
      api<EvalCase>(base, {
        json: {
          message: message.trim(),
          expected_intent_keys: keys.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean).slice(0, 10),
        },
      }),
    onSuccess: () => {
      toast.success("Eval case added");
      setMessage("");
      setKeys("");
      qc.invalidateQueries({ queryKey: qk.evalCases(slug) });
    },
    onError: (e) => toast.error(e),
  });

  const sources = [...new Set(data?.map((c) => c.source) ?? [])];
  const rows = (data ?? []).filter((c) => !source || c.source === source);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-48">
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <span className="text-xs text-slate-500">{rows.length} cases</span>
        </div>
        {error && <ErrorAlert error={error} />}
        {isLoading ? (
          <Spinner />
        ) : !rows.length ? (
          <EmptyState title="No eval cases" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Message</Th>
                <Th>Expected intents</Th>
                <Th>Source</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td className="max-w-md">
                    <p className="line-clamp-3">{c.message}</p>
                  </Td>
                  <Td className="font-mono text-xs">
                    {c.expected_intent_keys.length ? c.expected_intent_keys.join(", ") : <Badge tone="amber">out of scope</Badge>}
                  </Td>
                  <Td>
                    <Badge>{c.source}</Badge>
                    {c.chat_id && (
                      <Link href={`/chats/${c.chat_id}`} className="ml-1 text-xs text-indigo-700 hover:underline">
                        chat
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <Card title="Add a manual case" className="h-fit">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Field label="Customer message">
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={5000} />
          </Field>
          <Field label="Expected intent keys" hint="Comma separated; leave empty for an out-of-scope case">
            <Input value={keys} onChange={(e) => setKeys(e.target.value)} placeholder="refund_request" />
          </Field>
          <Button type="submit" className="w-full" loading={add.isPending}>
            <Plus className="h-4 w-4" /> Add case
          </Button>
        </form>
      </Card>
    </div>
  );
}
