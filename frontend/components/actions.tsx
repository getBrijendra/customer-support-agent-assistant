"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

import { ConfirmButton } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { Button, EmptyState, JsonView, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { enc, qk } from "@/lib/queries";
import type { Action } from "@/lib/types";

/** Proposed write actions with approve / reject controls. */
export function ActionList({
  chatId,
  actions,
  onChange,
}: {
  chatId: string;
  actions: Action[];
  onChange?: (a: Action) => void;
}) {
  if (!actions.length) return <EmptyState title="No proposed actions" />;
  return (
    <div className="space-y-3">
      {actions.map((a) => (
        <ActionCard key={a.id} chatId={chatId} action={a} onChange={onChange} />
      ))}
    </div>
  );
}

export function ActionCard({
  chatId,
  action,
  onChange,
}: {
  chatId: string;
  action: Action;
  onChange?: (a: Action) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const base = `/chats/${enc(chatId)}/actions/${enc(action.id)}`;

  const done = (a: Action) => {
    onChange?.(a);
    qc.invalidateQueries({ queryKey: qk.chat(chatId) });
  };

  const approve = useMutation({
    mutationFn: () => api<Action>(`${base}/approve`, { method: "POST" }),
    onSuccess: (a) => {
      done(a);
      if (a.status === "executed") toast.success(`${a.capability} executed`);
      else toast.error(`${a.capability}: ${a.status}${a.error ? ` – ${a.error}` : ""}`);
    },
    onError: (e) => toast.error(e),
  });

  const reject = useMutation({
    mutationFn: (reason: string) =>
      api<Action>(`${base}/reject`, { method: "POST", json: { reason: reason || null } }),
    onSuccess: (a) => {
      done(a);
      toast.success(`${a.capability} rejected`);
    },
    onError: (e) => toast.error(e),
  });

  const pending = action.status === "proposed";
  const args = Object.entries(action.args ?? {});

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{action.capability}</span>
            <StatusBadge status={action.status} />
            {action.step_ref && <span className="font-mono text-xs text-slate-500">{action.step_ref}</span>}
          </div>
          {action.reason && <p className="mt-1 text-sm text-slate-600">{action.reason}</p>}
        </div>
        {pending && (
          <div className="flex gap-2">
            <ConfirmButton
              label={
                <>
                  <X className="h-3.5 w-3.5" /> Reject
                </>
              }
              title={`Reject ${action.capability}?`}
              confirmLabel="Reject"
              withNote
              loading={reject.isPending}
              disabled={approve.isPending}
              onConfirm={(note) => reject.mutate(note)}
            />
            <ConfirmButton
              label={
                <>
                  <Check className="h-3.5 w-3.5" /> Approve &amp; execute
                </>
              }
              variant="success"
              confirmVariant="success"
              title={`Execute ${action.capability}?`}
              description="The policy is re-checked, then the action runs exactly once against the company's system."
              confirmLabel="Approve & execute"
              loading={approve.isPending}
              disabled={reject.isPending}
              onConfirm={() => approve.mutate()}
            />
          </div>
        )}
      </div>

      {args.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-2 text-xs sm:grid-cols-3">
          {args.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-slate-500">{k}</dt>
              <dd className="truncate font-mono text-slate-800">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {action.status === "denied" && action.policy_check && (
        <p className="mt-2 text-xs text-red-700">
          Policy: {String((action.policy_check as { reason?: unknown }).reason ?? JSON.stringify(action.policy_check))}
        </p>
      )}
      {action.error && <p className="mt-2 text-xs text-red-700">Error: {action.error}</p>}
      {action.result !== null && action.result !== undefined && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">Result</summary>
          <div className="mt-1">
            <JsonView value={action.result} maxHeight="12rem" />
          </div>
        </details>
      )}
      {(action.decided_by || action.executed_at) && (
        <p className="mt-2 text-xs text-slate-500">
          {action.decided_by && <>Decided by {action.decided_by} · {fmtDate(action.decided_at)}</>}
          {action.executed_at && <> · executed {fmtDate(action.executed_at)}</>}
        </p>
      )}
      {!pending && action.status !== "denied" && action.status !== "rejected" && !action.executed_at && (
        <div className="mt-2">
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: qk.chat(chatId) })}>
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}
