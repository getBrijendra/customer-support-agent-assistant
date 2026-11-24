"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ActionList } from "@/components/actions";
import { GuidanceView } from "@/components/guidance-view";
import { Button, Card, EmptyState, ErrorAlert, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { fmtMs } from "@/lib/format";
import { useCompanies } from "@/lib/queries";
import type { Action, ChatCreate, ChatCreated } from "@/lib/types";

const schema = z.object({
  company: z.string().min(1, "Select a company"),
  customer_message: z.string().trim().min(1, "Paste the customer's message").max(20_000),
  agent_notes: z.string().max(5_000).optional(),
  channel: z.string().max(32).optional(),
});
type Values = z.infer<typeof schema>;

export function AssistClient() {
  const { company, setCompany } = useApp();
  const companies = useCompanies();
  const [result, setResult] = useState<ChatCreated | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { company, customer_message: "", agent_notes: "", channel: "email" },
  });

  // Follow the top-bar company switcher.
  useEffect(() => {
    if (company) setValue("company", company);
  }, [company, setValue]);

  const selected = useWatch({ control, name: "company" });
  const selectedCompany = companies.data?.find((c) => c.slug === selected);

  const run = useMutation({
    mutationFn: (body: ChatCreate) => api<ChatCreated>("/chats", { json: body }),
    onSuccess: setResult,
  });

  const onSubmit = (v: Values) => {
    setResult(null);
    run.mutate({
      company: v.company,
      customer_message: v.customer_message,
      agent_notes: v.agent_notes?.trim() || null,
      channel: v.channel || null,
    });
  };

  const updateAction = (a: Action) =>
    setResult((r) => (r ? { ...r, proposed_actions: r.proposed_actions.map((x) => (x.id === a.id ? a : x)) } : r));

  return (
    <>
      <PageHeader
        title="Assist"
        subtitle="Paste a customer message to get a recommended reply and handling plan from the company's guidelines."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title="Customer message" className="h-fit lg:sticky lg:top-20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field
              label="Company"
              error={errors.company?.message}
              hint={
                selectedCompany && !selectedCompany.active_version_number
                  ? "This company has no active guidelines yet — chats will fail with NO_ACTIVE_GUIDELINES."
                  : undefined
              }
            >
              <Select
                {...register("company", { onChange: (e) => setCompany(e.target.value) })}
                disabled={companies.isLoading}
              >
                <option value="">Select…</option>
                {companies.data?.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                    {c.active_version_number ? ` (v${c.active_version_number})` : " (no active version)"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer message" error={errors.customer_message?.message}>
              <Textarea
                rows={7}
                placeholder="I was charged twice this month and the VPN won't connect on my iPhone."
                {...register("customer_message")}
              />
            </Field>
            <Field label="Agent notes" hint="Optional context: order id, email, plan… (treated as data)">
              <Textarea rows={3} placeholder="Customer email: jane@example.com, annual plan" {...register("agent_notes")} />
            </Field>
            <Field label="Channel">
              <Select {...register("channel")}>
                <option value="email">Email</option>
                <option value="chat">Chat</option>
                <option value="phone">Phone</option>
                <option value="social">Social</option>
                <option value="">Not specified</option>
              </Select>
            </Field>
            <Button type="submit" className="w-full" loading={run.isPending}>
              <Sparkles className="h-4 w-4" /> {run.isPending ? "Generating guidance…" : "Get guidance"}
            </Button>
          </form>
        </Card>

        <div className="min-w-0 space-y-4">
          {run.isError && <ErrorAlert error={run.error} title="Could not generate guidance" />}
          {!result && !run.isPending && !run.isError && (
            <EmptyState title="No guidance yet">The recommended reply, plan and proposed actions will appear here.</EmptyState>
          )}
          {run.isPending && (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-200/70" />
              ))}
            </div>
          )}
          {result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {result.company} · guidelines v{result.guideline_version ?? "?"} · {fmtMs(result.latency_ms)}
                </span>
                <Link
                  href={`/chats/${result.chat_id}`}
                  className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline"
                >
                  Open chat details <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <GuidanceView guidance={result.guidance} />
              {result.proposed_actions.length > 0 && (
                <Card title="Proposed actions (need your approval)">
                  <ActionList chatId={result.chat_id} actions={result.proposed_actions} onChange={updateAction} />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
