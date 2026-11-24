"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import { ActionList } from "@/components/actions";
import { GuidanceView } from "@/components/guidance-view";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  Input,
  JsonView,
  KV,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Th,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtMs, fmtNum } from "@/lib/format";
import { enc, qk } from "@/lib/queries";
import type { ChatDetail } from "@/lib/types";

export default function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: qk.chat(id),
    queryFn: () => api<ChatDetail>(`/chats/${enc(id)}`),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorAlert error={error ?? new Error("Chat not found")} />;

  return (
    <>
      <Link href="/chats" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Chat history
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Chat <span className="font-mono text-base text-slate-500">{data.chat_id.slice(0, 8)}</span>
            <StatusBadge status={data.status} />
            {data.routing?.no_match && <Badge tone="amber">no match</Badge>}
          </span>
        }
        subtitle={`${data.company} · guidelines v${data.guideline_version ?? "?"} · ${fmtDate(data.created_at)} · ${fmtMs(data.latency_ms.total)}`}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="Customer message">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{data.customer_message}</p>
          {data.channel && <p className="mt-2 text-xs text-slate-500">Channel: {data.channel}</p>}
        </Card>
        <Card title="Agent notes">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{data.agent_notes || "—"}</p>
        </Card>
      </div>

      {data.error_message && (
        <div className="mb-6">
          <ErrorAlert error={new Error(data.error_message)} title="This chat failed" />
        </div>
      )}

      <Tabs
        tabs={[
          {
            id: "guidance",
            label: "Guidance",
            content: data.guidance ? (
              <GuidanceView guidance={data.guidance} />
            ) : (
              <EmptyState title="No guidance was produced" />
            ),
          },
          { id: "routing", label: "Routing", content: <RoutingTab chat={data} /> },
          {
            id: "tools",
            label: `Tool calls (${data.tool_calls.length})`,
            content: <ToolCallsTab chat={data} />,
          },
          {
            id: "actions",
            label: `Actions (${data.proposed_actions.length})`,
            content: <ActionList chatId={data.chat_id} actions={data.proposed_actions} />,
          },
          {
            id: "references",
            label: "References",
            content: data.references ? <JsonView value={data.references} maxHeight="32rem" /> : <EmptyState title="No references recorded" />,
          },
          { id: "meta", label: "Models & timing", content: <MetaTab chat={data} /> },
          { id: "feedback", label: "Feedback", content: <FeedbackTab chat={data} /> },
        ]}
      />
    </>
  );
}

function RoutingTab({ chat }: { chat: ChatDetail }) {
  const r = chat.routing;
  if (!r) return <EmptyState title="Routing did not run" />;
  const selected = new Set(r.selected.map((s) => s.key));
  const entities = Object.entries(r.entities ?? {});
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Selected intents">
          {r.selected.length === 0 ? (
            <p className="text-sm text-slate-500">None — {r.no_match ? "no match, section fallback used" : "nothing selected"}.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {r.selected.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{s.key}</span>
                  <StatusBadge status={s.confidence} />
                  {s.message_span && <span className="text-xs text-slate-500">“{s.message_span}”</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Extracted entities">
          {entities.length === 0 ? (
            <p className="text-sm text-slate-500">None</p>
          ) : (
            <KV items={entities.map(([k, v]) => [k, <span key={k} className="font-mono">{v}</span>])} />
          )}
        </Card>
      </div>
      <Card title={`Candidates (${r.candidates.length})`} bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Intent</Th>
              <Th className="text-right">RRF</Th>
              <Th className="text-right">Vector</Th>
              <Th className="text-right">Text</Th>
              <Th>Best example</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.candidates.map((c, i) => (
              <tr key={c.key} className={selected.has(c.key) ? "bg-emerald-50/60" : undefined}>
                <Td>{i + 1}</Td>
                <Td className="font-mono text-xs">
                  {c.key} {selected.has(c.key) && <Badge tone="green">selected</Badge>}
                </Td>
                <Td className="text-right tabular-nums">{c.score.toFixed(4)}</Td>
                <Td className="text-right tabular-nums">{c.vector_score?.toFixed(3) ?? "—"}</Td>
                <Td className="text-right tabular-nums">{c.text_score?.toFixed(3) ?? "—"}</Td>
                <Td className="max-w-sm text-xs text-slate-500">{c.best_example ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function ToolCallsTab({ chat }: { chat: ChatDetail }) {
  if (!chat.tool_calls.length) return <EmptyState title="No tool calls">Lookups without a live binding become manual steps.</EmptyState>;
  return (
    <div className="space-y-3">
      {chat.tool_calls.map((t) => (
        <Card
          key={t.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{t.capability}</span>
              <StatusBadge status={t.status} />
              <Badge>{t.trigger}</Badge>
              {t.adapter_type && <Badge tone="blue">{t.adapter_type}</Badge>}
            </span>
          }
          actions={<span className="text-xs text-slate-500">{fmtMs(t.latency_ms)} · tool:{t.id.slice(0, 8)}</span>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Args (redacted)</p>
              <JsonView value={t.args} maxHeight="12rem" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Result (truncated)</p>
              <JsonView value={t.result} maxHeight="12rem" />
            </div>
          </div>
          {t.error && <p className="mt-2 text-xs text-red-700">{t.error}</p>}
        </Card>
      ))}
    </div>
  );
}

function MetaTab({ chat }: { chat: ChatDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Models & prompts">
        <KV
          items={[
            ["Generator", chat.llm_model],
            ["Router", chat.router_model],
            ["Prompt version", chat.prompt_version],
            ["Router prompt", chat.router_prompt_version],
            ["Guideline version", chat.guideline_version ? `v${chat.guideline_version}` : null],
            ["Request id", <span key="r" className="font-mono text-xs">{chat.request_id ?? "—"}</span>],
          ]}
        />
      </Card>
      <Card title="Latency & tokens">
        <KV
          items={[
            ["Total", fmtMs(chat.latency_ms.total)],
            ["Routing", fmtMs(chat.latency_ms.routing)],
            ["Tools", fmtMs(chat.latency_ms.tools)],
            ["LLM", fmtMs(chat.latency_ms.llm)],
            ["Generator tokens in / out", `${fmtNum(chat.tokens.input)} / ${fmtNum(chat.tokens.output)}`],
            ["Router tokens in / out", `${fmtNum(chat.tokens.router_input)} / ${fmtNum(chat.tokens.router_output)}`],
          ]}
        />
      </Card>
    </div>
  );
}

function FeedbackTab({ chat }: { chat: ChatDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const initial =
    chat.feedback?.correct_intent_keys ??
    chat.guidance?.detected_intents.map((i) => i.intent_key) ??
    [];
  const [keys, setKeys] = useState(initial.join(", "));

  const submit = useMutation({
    mutationFn: (correct_intent_keys: string[]) =>
      api(`/chats/${enc(chat.chat_id)}/feedback`, { json: { correct_intent_keys } }),
    onSuccess: () => {
      toast.success("Feedback saved and added as an eval case");
      qc.invalidateQueries({ queryKey: qk.chat(chat.chat_id) });
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Card title="Routing feedback">
      <p className="mb-3 text-sm text-slate-600">
        Which intents did this message really need? Your answer is stored on the chat and becomes an
        <span className="font-medium"> agent_feedback</span> routing eval case. Leave empty if none fit.
      </p>
      {chat.feedback?.at && (
        <p className="mb-3 text-xs text-slate-500">
          Last feedback by {chat.feedback.by ?? "?"} on {fmtDate(chat.feedback.at)}
        </p>
      )}
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const list = keys.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean).slice(0, 10);
          submit.mutate(list);
        }}
      >
        <Field label="Correct intent keys" hint="Comma separated, e.g. refund_request, order_status" className="flex-1">
          <Input value={keys} onChange={(e) => setKeys(e.target.value)} />
        </Field>
        <Button type="submit" loading={submit.isPending}>
          Save feedback
        </Button>
      </form>
    </Card>
  );
}
