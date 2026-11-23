"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Pencil, Rocket } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmButton } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorAlert,
  Field,
  Input,
  JsonView,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { enc, qk, useCapabilities } from "@/lib/queries";
import type { AdapterType, Binding, BindingTestResult, Capability, Json } from "@/lib/types";

const CONFIG_TEMPLATES: Record<AdapterType, Json> = {
  mock: { store: "bookshop_orders" },
  http: {
    method: "GET",
    url: "https://api.example.com/orders/{order_id}",
    headers: {},
    query: {},
    auth_secret: "orders_api_key",
    auth_header: "Authorization",
    auth_scheme: "Bearer",
    response_path: "data",
  },
  sql_readonly: {
    dsn_secret: "orders_db_dsn",
    statement: "SELECT id, status FROM orders WHERE id = :order_id",
  },
  mcp: { server_id: "<mcp server id>", tool_name: "get_order", arg_map: { order_id: "id" } },
};

export function BindingsPanel({ slug }: { slug: string }) {
  const caps = useCapabilities();
  const bindings = useQuery({
    queryKey: qk.bindings(slug),
    queryFn: () => api<Binding[]>(`/companies/${enc(slug)}/capability-bindings`),
  });
  const [vertical, setVertical] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const byCap = useMemo(() => new Map(bindings.data?.map((b) => [b.capability, b]) ?? []), [bindings.data]);
  const verticals = [...new Set(caps.data?.map((c) => c.vertical) ?? [])];
  const list = (caps.data ?? []).filter((c) => !vertical || c.vertical === vertical);

  if (caps.isLoading || bindings.isLoading) return <Spinner />;
  if (caps.error || bindings.error) return <ErrorAlert error={caps.error ?? bindings.error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Reads run automatically when <StatusBadge status="live" />. Writes are only proposed and need agent approval. Lifecycle:{" "}
          <StatusBadge status="draft" /> → <StatusBadge status="tested" /> → <StatusBadge status="live" />
        </p>
        <Select value={vertical} onChange={(e) => setVertical(e.target.value)} className="w-48">
          <option value="">All verticals</option>
          {verticals.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No capabilities in the registry" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((c) => (
            <BindingCard
              key={c.name}
              slug={slug}
              cap={c}
              binding={byCap.get(c.name)}
              editing={editing === c.name}
              setEditing={(on) => setEditing(on ? c.name : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BindingCard({
  slug,
  cap,
  binding,
  editing,
  setEditing,
}: {
  slug: string;
  cap: Capability;
  binding?: Binding;
  editing: boolean;
  setEditing: (on: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const base = `/companies/${enc(slug)}/capability-bindings/${enc(cap.name)}`;
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.bindings(slug) });
  const [testResult, setTestResult] = useState<Json | null>(null);

  const goLive = useMutation({
    mutationFn: () => api<Binding>(`${base}/go-live`, { method: "POST" }),
    onSuccess: () => {
      toast.success(`${cap.name} is live`);
      invalidate();
    },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({
    mutationFn: () => api(base, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${cap.name} unbound — its steps become manual`);
      invalidate();
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{cap.name}</span>
          <StatusBadge status={cap.kind} />
          {binding ? <StatusBadge status={binding.status} /> : <Badge>unbound</Badge>}
        </span>
      }
      actions={binding && <Badge tone="blue">{binding.adapter_type}</Badge>}
    >
      <p className="text-sm text-slate-600">{cap.description}</p>
      <p className="mt-1 text-xs text-slate-500">
        Inputs:{" "}
        {Object.entries(cap.input_schema.properties)
          .map(([k, v]) => `${k}${cap.input_schema.required.includes(k) ? "*" : ""}: ${v.type}`)
          .join(", ") || "none"}
        {cap.policy_keys.length > 0 && <> · Policy keys: {cap.policy_keys.join(", ")}</>}
      </p>

      {binding && !editing && (
        <div className="mt-3 space-y-2">
          <details>
            <summary className="cursor-pointer text-xs font-medium text-slate-600">
              Config &amp; policy · updated {fmtDate(binding.updated_at)}
            </summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <JsonView value={binding.config} maxHeight="10rem" />
              <JsonView value={binding.policy} maxHeight="10rem" />
            </div>
          </details>
          {binding.last_test_result && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-600">Last test result</summary>
              <div className="mt-2">
                <JsonView value={binding.last_test_result} maxHeight="10rem" />
              </div>
            </details>
          )}
        </div>
      )}

      {editing ? (
        <BindingEditor slug={slug} cap={cap} binding={binding} onDone={() => setEditing(false)} />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> {binding ? "Edit" : "Bind"}
          </Button>
          {binding && (
            <TestButton
              cap={cap}
              base={base}
              onResult={(r) => {
                setTestResult(r.result);
                invalidate();
              }}
            />
          )}
          {binding?.status === "tested" && (
            <Button size="sm" variant="success" loading={goLive.isPending} onClick={() => goLive.mutate()}>
              <Rocket className="h-3.5 w-3.5" /> Go live
            </Button>
          )}
          {binding && (
            <ConfirmButton
              label="Unbind"
              variant="ghost"
              title={`Unbind ${cap.name}?`}
              description="Playbook steps using this capability will become manual agent steps."
              confirmLabel="Unbind"
              loading={remove.isPending}
              onConfirm={() => remove.mutate()}
            />
          )}
        </div>
      )}
      {testResult && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">Test result</p>
          <JsonView value={testResult} maxHeight="12rem" />
        </div>
      )}
    </Card>
  );
}

function TestButton({
  cap,
  base,
  onResult,
}: {
  cap: Capability;
  base: string;
  onResult: (r: BindingTestResult) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const fields = Object.keys(cap.input_schema.properties);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [executeWrite, setExecuteWrite] = useState(false);

  const test = useMutation({
    mutationFn: () => {
      const sample: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v === "") continue;
        const t = cap.input_schema.properties[k]?.type;
        sample[k] = t === "number" || t === "integer" ? Number(v) : t === "boolean" ? v === "true" : v;
      }
      return api<BindingTestResult>(`${base}/test`, { json: { sample_args: sample, execute_write: executeWrite } });
    },
    onSuccess: (r) => {
      const ok = r.binding.status === "tested" || r.binding.status === "live";
      if (ok) toast.success(`${cap.name} test passed`);
      else toast.error(`${cap.name} test failed`);
      onResult(r);
      setOpen(false);
    },
    onError: (e) => toast.error(e),
  });

  if (!open)
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <FlaskConical className="h-3.5 w-3.5" /> Test
      </Button>
    );

  return (
    <form
      className="w-full space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        test.mutate();
      }}
    >
      <p className="text-xs font-semibold text-slate-600">Sample args</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f} label={`${f}${cap.input_schema.required.includes(f) ? " *" : ""}`}>
            <Input
              value={args[f] ?? ""}
              onChange={(e) => setArgs({ ...args, [f]: e.target.value })}
              placeholder={cap.input_schema.properties[f].type}
            />
          </Field>
        ))}
      </div>
      {cap.kind === "write" && (
        <Checkbox
          label="Actually execute this write (side effects!)"
          checked={executeWrite}
          onChange={(e) => setExecuteWrite(e.target.checked)}
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={test.isPending}>
          Run test
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function BindingEditor({
  slug,
  cap,
  binding,
  onDone,
}: {
  slug: string;
  cap: Capability;
  binding?: Binding;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [adapter, setAdapter] = useState<AdapterType>(binding?.adapter_type ?? "mock");
  const [config, setConfig] = useState(JSON.stringify(binding?.config ?? CONFIG_TEMPLATES.mock, null, 2));
  const [policy, setPolicy] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(binding?.policy ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: { adapter_type: AdapterType; config: Json; policy: Json }) =>
      api<Binding>(`/companies/${enc(slug)}/capability-bindings/${enc(cap.name)}`, { method: "PUT", json: body }),
    onSuccess: () => {
      toast.success(`${cap.name} saved as draft — test it, then go live`);
      qc.invalidateQueries({ queryKey: qk.bindings(slug) });
      onDone();
    },
  });

  const policyKeys = [...new Set([...cap.policy_keys, ...Object.keys(policy)])];

  return (
    <form
      className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        let cfg: Json;
        try {
          cfg = JSON.parse(config);
          if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("Config must be a JSON object");
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "Invalid JSON");
          return;
        }
        setParseError(null);
        const pol: Json = {};
        for (const [k, v] of Object.entries(policy)) {
          if (v.trim() === "") continue;
          try {
            pol[k] = JSON.parse(v);
          } catch {
            pol[k] = v;
          }
        }
        save.mutate({ adapter_type: adapter, config: cfg, policy: pol });
      }}
    >
      <Field label="Adapter">
        <Select
          value={adapter}
          onChange={(e) => {
            const a = e.target.value as AdapterType;
            setAdapter(a);
            if (!binding || binding.adapter_type !== a) setConfig(JSON.stringify(CONFIG_TEMPLATES[a], null, 2));
          }}
        >
          <option value="mock">mock (in-process demo store)</option>
          <option value="http">http</option>
          <option value="sql_readonly">sql_readonly</option>
          <option value="mcp">mcp</option>
        </Select>
      </Field>
      <Field
        label="Config (JSON)"
        hint={
          adapter === "mock"
            ? 'store: "bookshop_orders" or "vpn_accounts"'
            : adapter === "http"
              ? "Use {arg} templates; secrets are referenced by name"
              : adapter === "sql_readonly"
                ? "A single SELECT with :name parameters; validated at save time"
                : "server_id from the MCP servers tab; arg_map maps capability args → tool args"
        }
        error={parseError ?? undefined}
      >
        <Textarea rows={8} className="font-mono text-xs" value={config} onChange={(e) => setConfig(e.target.value)} spellCheck={false} />
      </Field>
      {cap.kind === "write" || policyKeys.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Policy</p>
          {policyKeys.length === 0 && <p className="text-xs text-slate-500">This capability has no policy keys.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {policyKeys.map((k) => (
              <Field key={k} label={k} hint="Number, JSON list or text; empty = not set">
                <Input value={policy[k] ?? ""} onChange={(e) => setPolicy({ ...policy, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </div>
      ) : null}
      {save.isError && <ErrorAlert error={save.error} title="Could not save binding" />}
      {binding?.status === "live" && (
        <p className="text-xs text-amber-800">Saving changes puts this live binding back to draft until it is tested again.</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={save.isPending}>
          Save as draft
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
