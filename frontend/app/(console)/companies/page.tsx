"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AdminOnly } from "@/components/role-gate";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  Field,
  Input,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { fmtDate } from "@/lib/format";
import { qk, useCompanies } from "@/lib/queries";
import type { Company } from "@/lib/types";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, "2–50 lowercase letters, digits or dashes"),
  name: z.string().trim().min(1, "Required").max(200),
  description: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

export default function CompaniesPage() {
  return (
    <AdminOnly>
      <Companies />
    </AdminOnly>
  );
}

function Companies() {
  const { data, isLoading, error } = useCompanies();
  const { setCompany } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (v: Values) =>
      api<Company>("/companies", { json: { ...v, description: v.description?.trim() || null } }),
    onSuccess: (c) => {
      toast.success(`Company ${c.slug} created`);
      reset({ slug: "", name: "", description: "" });
      setCompany(c.slug);
      qc.invalidateQueries({ queryKey: qk.companies });
    },
    onError: (e) => toast.error(e),
  });

  return (
    <>
      <PageHeader title="Companies" subtitle="Tenants and their active guideline versions." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          {error && <ErrorAlert error={error} />}
          {isLoading ? (
            <Spinner />
          ) : !data?.length ? (
            <EmptyState title="No companies yet">Create one to upload guidelines.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Active version</Th>
                  <Th>Created</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="font-mono text-xs text-slate-500">{c.slug}</p>
                      {c.description && <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>}
                    </Td>
                    <Td>
                      {c.active_version ? (
                        <div className="space-y-0.5">
                          <p>
                            v{c.active_version.version_number} · <span className="text-xs">{c.active_version.file_name}</span>
                          </p>
                          <StatusBadge status={c.active_version.review_status} />
                        </div>
                      ) : (
                        <StatusBadge status="pending" label="none active" />
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{fmtDate(c.created_at)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/companies/${c.slug}/guidelines`} onClick={() => setCompany(c.slug)}>
                          <Button size="sm" variant="secondary">Guidelines</Button>
                        </Link>
                        <Link href={`/companies/${c.slug}/integrations`} onClick={() => setCompany(c.slug)}>
                          <Button size="sm" variant="secondary">Integrations</Button>
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card title="New company" className="h-fit">
          <form className="space-y-3" onSubmit={handleSubmit((v) => create.mutate(v))}>
            <Field label="Slug" error={errors.slug?.message} hint="URL-safe id, e.g. vpn-saas">
              <Input {...register("slug")} placeholder="vpn-saas" />
            </Field>
            <Field label="Name" error={errors.name?.message}>
              <Input {...register("name")} placeholder="VPN SaaS" />
            </Field>
            <Field label="Description">
              <Textarea rows={2} {...register("description")} />
            </Field>
            <Button type="submit" className="w-full" loading={create.isPending}>
              <Plus className="h-4 w-4" /> Create company
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
