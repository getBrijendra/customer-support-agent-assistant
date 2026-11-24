"use client";

import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  FileText,
  HelpCircle,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { Badge, Card, StatusBadge } from "@/components/ui";
import type { Guidance, IntentGuidance, PlanStep, StepType } from "@/lib/types";

const STEP_ICON: Record<StepType, React.ComponentType<{ className?: string }>> = {
  say: FileText,
  ask: HelpCircle,
  lookup: Search,
  action: Zap,
  escalate: UserRound,
};

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy reply"}
    </button>
  );
}

/** The full guidance: reply, intents with their plan steps, missing info and references. */
export function GuidanceView({ guidance }: { guidance: Guidance }) {
  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Recommended reply
            <StatusBadge status={guidance.confidence} label={`${guidance.confidence} confidence`} />
            {guidance.requires_escalation && (
              <Badge tone="red">
                <AlertTriangle className="h-3 w-3" /> Escalate
              </Badge>
            )}
          </span>
        }
        actions={<CopyButton text={guidance.recommended_response} />}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {guidance.recommended_response}
        </p>
        {guidance.requires_escalation && guidance.escalation_reason && (
          <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-800">
            <span className="font-medium">Escalation: </span>
            {guidance.escalation_reason}
          </p>
        )}
      </Card>

      {guidance.missing_information.length > 0 && (
        <Card title="Missing information">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {guidance.missing_information.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Card>
      )}

      {guidance.detected_intents.length === 0 ? (
        <Card title="Detected intents">
          <p className="text-sm text-slate-500">
            No playbook matched this message. The reply is a safe holding response — review and escalate if needed.
          </p>
        </Card>
      ) : (
        guidance.detected_intents.map((intent) => <IntentCard key={intent.intent_key} intent={intent} />)
      )}

      {guidance.references.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-500" /> References
            </span>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {guidance.references.map((r) => (
              <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                {r}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function IntentCard({ intent }: { intent: IntentGuidance }) {
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{intent.intent_key}</span>
          <StatusBadge status={intent.confidence} label={intent.confidence} />
        </span>
      }
    >
      <ol className="space-y-2">
        {intent.steps.map((s, i) => (
          <StepRow key={`${s.step_ref}-${i}`} step={s} index={i + 1} />
        ))}
      </ol>
      {intent.missing_information.length > 0 && (
        <p className="mt-3 text-xs text-amber-800">
          <span className="font-semibold">Missing: </span>
          {intent.missing_information.join("; ")}
        </p>
      )}
    </Card>
  );
}

function StepRow({ step, index }: { step: PlanStep; index: number }) {
  const Icon = STEP_ICON[step.type] ?? Wrench;
  return (
    <li className="flex gap-3 rounded-md border border-slate-100 bg-slate-50/60 p-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Icon className="h-3.5 w-3.5" /> {step.type}
          </span>
          <StatusBadge status={step.performed_by} />
          <span className="font-mono text-[11px] text-slate-400">{step.step_ref}</span>
        </div>
        <p className="mt-1 text-sm text-slate-800">{step.instruction}</p>
        {(step.tool_call_id || step.proposed_action_id) && (
          <p className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-slate-500">
            {step.tool_call_id && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> tool:{step.tool_call_id.slice(0, 8)}
              </span>
            )}
            {step.proposed_action_id && (
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-600" /> action:{step.proposed_action_id.slice(0, 8)}
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
