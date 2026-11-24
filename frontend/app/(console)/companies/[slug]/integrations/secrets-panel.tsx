"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, ErrorAlert, Field, Input, Spinner, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { enc, qk } from "@/lib/queries";
import type { Secret } from "@/lib/types";

export function SecretsPanel({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const base = `/companies/${enc(slug)}/secrets`;
  const { data, isLoading, error } = useQuery({ queryKey: qk.secrets(slug), queryFn: () => api<Secret[]>(base) });
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const save = useMutation({
    mutationFn: () => api<Secret>(base, { json: { name: name.trim(), value } }),
    onSuccess: (s) => {
      toast.success(`Secret ${s.name} saved`);
      setName("");
      setValue("");
      qc.invalidateQueries({ queryKey: qk.secrets(slug) });
    },
    onError: (e) => toast.error(e),
  });
  const remove = useMutation({
    mutationFn: (n: string) => api(`${base}/${enc(n)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.secrets(slug) }),
    onError: (e) => toast.error(e),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        {error && <ErrorAlert error={error} />}
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState title="No secrets">Store API keys or DSNs here and reference them by name in bindings.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Created</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((s) => (
                <tr key={s.name}>
                  <Td className="font-mono">{s.name}</Td>
                  <Td className="text-xs">
                    {fmtDate(s.created_at)} {s.created_by && `· ${s.created_by}`}
                  </Td>
                  <Td className="text-right">
                    <ConfirmButton
                      label="Delete"
                      variant="ghost"
                      title={`Delete secret ${s.name}?`}
                      description="Bindings that reference it will fail until a new value is stored."
                      confirmLabel="Delete"
                      onConfirm={() => remove.mutate(s.name)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <Card title="Store a secret" className="h-fit">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Name" hint="Letters, digits, _ . - (reusing a name replaces the value)">
            <Input value={name} onChange={(e) => setName(e.target.value)} pattern="[A-Za-z0-9_.\-]{1,100}" required placeholder="orders_api_key" />
          </Field>
          <Field label="Value" hint="Write-only: encrypted at rest and never shown again.">
            <Input type="password" autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full" loading={save.isPending} disabled={!name || !value}>
            <KeyRound className="h-4 w-4" /> Save secret
          </Button>
        </form>
      </Card>
    </div>
  );
}
