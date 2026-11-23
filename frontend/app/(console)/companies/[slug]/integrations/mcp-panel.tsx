"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, ErrorAlert, Field, Input, Select, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { enc, qk } from "@/lib/queries";
import type { McpServer, Secret } from "@/lib/types";

export function McpPanel({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const base = `/companies/${enc(slug)}/mcp-servers`;
  const servers = useQuery({ queryKey: qk.mcpServers(slug), queryFn: () => api<McpServer[]>(base) });
  const secrets = useQuery({
    queryKey: qk.secrets(slug),
    queryFn: () => api<Secret[]>(`/companies/${enc(slug)}/secrets`),
  });
  const [form, setForm] = useState({ name: "", url: "", auth_secret_name: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.mcpServers(slug) });

  const create = useMutation({
    mutationFn: () =>
      api<McpServer>(base, {
        json: { name: form.name.trim(), url: form.url.trim(), auth_secret_name: form.auth_secret_name || null },
      }),
    onSuccess: (s) => {
      toast.success(`MCP server ${s.name} registered`);
      setForm({ name: "", url: "", auth_secret_name: "" });
      invalidate();
    },
    onError: (e) => toast.error(e),
  });
  const discover = useMutation({
    mutationFn: (id: string) => api<McpServer>(`${base}/${enc(id)}/discover`, { method: "POST" }),
    onSuccess: (s) => {
      toast.success(`Discovered ${s.discovered_tools?.length ?? 0} tools on ${s.name}`);
      invalidate();
    },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${base}/${enc(id)}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {servers.error && <ErrorAlert error={servers.error} />}
        {servers.isLoading ? (
          <Spinner />
        ) : !servers.data?.length ? (
          <EmptyState title="No MCP servers">Register a streamable-HTTP MCP server, discover its tools, then bind tools to capabilities.</EmptyState>
        ) : (
          servers.data.map((s) => (
            <Card
              key={s.id}
              title={
                <span>
                  {s.name} <span className="font-mono text-xs font-normal text-slate-500">{s.id.slice(0, 8)}</span>
                </span>
              }
              actions={
                <>
                  <Button size="sm" variant="secondary" loading={discover.isPending && discover.variables === s.id} onClick={() => discover.mutate(s.id)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Discover tools
                  </Button>
                  <ConfirmButton
                    label="Delete"
                    variant="ghost"
                    title={`Delete ${s.name}?`}
                    description="Bindings using this server will stop working."
                    confirmLabel="Delete"
                    onConfirm={() => remove.mutate(s.id)}
                  />
                </>
              }
            >
              <p className="break-all font-mono text-xs text-slate-600">{s.url}</p>
              <p className="mt-1 text-xs text-slate-500">
                {s.transport} · auth secret: {s.auth_secret_name ?? "none"} · last discovery: {fmtDate(s.last_discovered_at)}
              </p>
              {s.discovered_tools && s.discovered_tools.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {s.discovered_tools.map((t, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-mono text-indigo-700">{String(t.name ?? "?")}</span>
                      {typeof t.description === "string" && <span className="text-slate-500"> — {t.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))
        )}
      </div>
      <Card title="Register MCP server" className="h-fit">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
          </Field>
          <Field label="URL" hint="Streamable HTTP endpoint, e.g. https://mcp.example.com/mcp">
            <Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
          </Field>
          <Field label="Auth secret">
            <Select value={form.auth_secret_name} onChange={(e) => setForm({ ...form, auth_secret_name: e.target.value })}>
              <option value="">None</option>
              {secrets.data?.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" className="w-full" loading={create.isPending}>
            <Plus className="h-4 w-4" /> Register
          </Button>
        </form>
      </Card>
    </div>
  );
}
