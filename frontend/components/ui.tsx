"use client";

import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { forwardRef, useState } from "react";

import { ApiError, errorMessage } from "@/lib/api";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// -------------------------------------------------------------------- buttons
type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: "sm" | "md";
    loading?: boolean;
  }
>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// --------------------------------------------------------------------- inputs
const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(inputCls, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputCls, "font-[inherit]", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx(inputCls, "pr-8", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-indigo-600" {...rest} />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------- cards
export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// --------------------------------------------------------------------- badges
type Tone = "gray" | "green" | "amber" | "red" | "blue" | "indigo" | "violet";

const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  // generic
  success: "green",
  ok: "green",
  error: "red",
  failed: "red",
  timeout: "amber",
  policy_denied: "red",
  // versions
  processing: "blue",
  ready: "green",
  pending: "amber",
  approved: "green",
  rejected: "red",
  // bindings
  draft: "gray",
  tested: "blue",
  live: "green",
  // actions
  proposed: "amber",
  denied: "red",
  executing: "blue",
  executed: "green",
  // confidence
  high: "green",
  medium: "amber",
  low: "red",
  // performed_by
  ai: "indigo",
  ai_verified: "green",
  needs_approval: "amber",
  agent: "gray",
  // kinds
  read: "blue",
  write: "violet",
};

const LABELS: Record<string, string> = {
  ai: "AI (in reply)",
  ai_verified: "AI verified",
  needs_approval: "Needs approval",
  agent: "Agent (manual)",
  policy_denied: "policy denied",
};

/** A coloured status pill; colour always comes with a text label, never alone. */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <Badge>—</Badge>;
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{label ?? LABELS[status] ?? status}</Badge>;
}

// --------------------------------------------------------------------- states
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
      <Inbox className="h-6 w-6 text-slate-400" aria-hidden />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorAlert({ error, title = "Something went wrong" }: { error: unknown; title?: string }) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : null;
  return (
    <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="break-words">{e ? e.message : errorMessage(error)}</p>
        {e && (
          <p className="mt-1 font-mono text-xs text-red-700/80">
            {e.code} · HTTP {e.status}
            {e.requestId ? ` · request ${e.requestId}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------- misc
export function JsonView({ value, maxHeight = "20rem" }: { value: unknown; maxHeight?: string }) {
  return (
    <pre
      className="overflow-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100"
      style={{ maxHeight }}
    >
      {value === undefined ? "undefined" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
          <dt className="text-slate-500">{k}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-slate-800">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({
  tabs,
  initial,
}: {
  tabs: { id: string; label: React.ReactNode; content: React.ReactNode }[];
  initial?: string;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              active === t.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cx("px-3 py-2 align-top text-slate-700", className)}>{children}</td>;
}

export function KpiTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
