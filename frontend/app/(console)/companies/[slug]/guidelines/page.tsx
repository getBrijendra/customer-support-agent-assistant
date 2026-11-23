"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import { CompanyTabs } from "@/components/company-tabs";
import { ConfirmButton } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/file-dropzone";
import { AdminOnly } from "@/components/role-gate";
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
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { api, buildPath } from "@/lib/api";
import { fmtBytes, fmtDate, fmtMs } from "@/lib/format";
import { enc, qk, useGuidelines } from "@/lib/queries";
import type { GuidelineVersion } from "@/lib/types";

export default function GuidelinesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <AdminOnly>
      <CompanyTabs slug={slug} />
      <Guidelines slug={slug} />
    </AdminOnly>
  );
}

function useVersionAction(slug: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ n, op, note }: { n: number; op: "approve" | "reject" | "activate" | "delete"; note?: string }) =>
      op === "delete"
        ? api(`/companies/${enc(slug)}/guidelines/${n}`, { method: "DELETE" })
        : api<GuidelineVersion>(`/companies/${enc(slug)}/guidelines/${n}/${op}`, {
            method: "POST",
            json: op === "activate" ? undefined : { note: note || null },
          }),
    onSuccess: (_d, v) => {
      const done = { approve: "approved", reject: "rejected", activate: "activated", delete: "deleted" }[v.op];
      toast.success(`Version ${v.n} ${done}`);
      qc.invalidateQueries({ queryKey: qk.guidelines(slug) });
      qc.invalidateQueries({ queryKey: qk.companies });
    },
    onError: (e) => toast.error(e),
  });
}

function Guidelines({ slug }: { slug: string }) {
  const { data, isLoading, error } = useGuidelines(slug);
  const action = useVersionAction(slug);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        {error && <ErrorAlert error={error} />}
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState title="No guideline versions yet">Upload a .txt file to compile the first playbook.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Compiled</Th>
                <Th>Uploaded</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((v) => (
                <tr key={v.id} className={v.is_active ? "bg-emerald-50/50" : "hover:bg-slate-50"}>
                  <Td>
                    <Link href={`/companies/${slug}/guidelines/${v.version_number}`} className="font-semibold text-indigo-700 hover:underline">
                      v{v.version_number}
                    </Link>
                    {v.is_active && (
                      <span className="ml-2">
                        <Badge tone="green">active</Badge>
                      </span>
                    )}
                    <p className="text-xs text-slate-500">
                      {v.file_name} · {fmtBytes(v.byte_size)}
                    </p>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={v.status} />
                      <StatusBadge status={v.review_status} />
                    </div>
                    {v.status === "failed" && v.error_message && (
                      <p className="mt-1 max-w-xs text-xs text-red-700">{v.error_message}</p>
                    )}
                    {!!v.validation_warnings?.length && (
                      <p className="mt-1 text-xs text-amber-700">{v.validation_warnings.length} warning(s)</p>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {v.status === "ready" ? (
                      <>
                        {v.intent_count ?? 0} intents · {v.fact_count ?? 0} facts · {v.section_count ?? 0} sections
                        <br />
                        <span className="text-slate-500">ingest {fmtMs(v.ingest_duration_ms)}</span>
                      </>
                    ) : v.status === "processing" ? (
                      <span className="text-sky-700">compiling…</span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {fmtDate(v.created_at)}
                    <br />
                    <span className="text-slate-500">{v.uploaded_by ?? ""}</span>
                  </Td>
                  <Td className="text-right">
                    <VersionButtons slug={slug} v={v} run={action.mutate} busy={action.isPending} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <UploadCard slug={slug} />
    </div>
  );
}

function VersionButtons({
  slug,
  v,
  run,
  busy,
}: {
  slug: string;
  v: GuidelineVersion;
  run: (a: { n: number; op: "approve" | "reject" | "activate" | "delete"; note?: string }) => void;
  busy: boolean;
}) {
  const n = v.version_number;
  const ready = v.status === "ready";
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {ready && (
        <Link href={`/companies/${slug}/guidelines/${n}/playbook`}>
          <Button size="sm" variant="secondary">Playbook</Button>
        </Link>
      )}
      {ready && v.review_status !== "approved" && (
        <ConfirmButton
          label="Approve"
          variant="success"
          confirmVariant="success"
          title={`Approve v${n}?`}
          description={v.activate_on_approval ? "It will also become the active version." : "It will not be activated automatically."}
          withNote
          noteLabel="Note (optional)"
          confirmLabel="Approve"
          disabled={busy}
          onConfirm={(note) => run({ n, op: "approve", note })}
        />
      )}
      {!v.is_active && v.review_status !== "rejected" && v.status !== "processing" && (
        <ConfirmButton
          label="Reject"
          title={`Reject v${n}?`}
          description="A rejected version cannot be activated."
          withNote
          confirmLabel="Reject"
          disabled={busy}
          onConfirm={(note) => run({ n, op: "reject", note })}
        />
      )}
      {ready && v.review_status === "approved" && !v.is_active && (
        <ConfirmButton
          label="Activate"
          variant="primary"
          confirmVariant="primary"
          title={`Activate v${n}?`}
          description="New chats will use this version's playbook, company rules and facts (rollback / roll forward)."
          confirmLabel="Activate"
          disabled={busy}
          onConfirm={() => run({ n, op: "activate" })}
        />
      )}
      <a href={buildPath(`/companies/${enc(slug)}/guidelines/${n}/file`)} title="Download original file">
        <Button size="sm" variant="ghost" aria-label="Download file">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </a>
      {!v.is_active && (
        <ConfirmButton
          label="Delete"
          variant="ghost"
          title={`Delete v${n}?`}
          description="This permanently removes the version and all its compiled playbook rows."
          confirmLabel="Delete"
          disabled={busy}
          onConfirm={() => run({ n, op: "delete" })}
        />
      )}
    </div>
  );
}

function UploadCard({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [activate, setActivate] = useState(true);
  const [notes, setNotes] = useState("");

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("file", file as File);
      form.append("activate", String(activate));
      if (notes.trim()) form.append("notes", notes.trim());
      return api<GuidelineVersion>(`/companies/${enc(slug)}/guidelines`, { method: "POST", form });
    },
    onSuccess: (v) => {
      toast.success(
        v.status === "processing"
          ? `v${v.version_number} uploaded — compiling in the background`
          : `v${v.version_number}: ${v.status}, ${v.review_status}`,
      );
      setFile(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: qk.guidelines(slug) });
      qc.invalidateQueries({ queryKey: qk.companies });
    },
  });

  return (
    <Card title="Upload new version" className="h-fit">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (file) upload.mutate();
        }}
      >
        <FileDropzone file={file} onFile={setFile} />
        <Checkbox
          label="Activate when approved"
          checked={activate}
          onChange={(e) => setActivate(e.target.checked)}
        />
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="What changed?" />
        </Field>
        {upload.isError && <ErrorAlert error={upload.error} title="Upload failed" />}
        <Button type="submit" className="w-full" disabled={!file} loading={upload.isPending}>
          <Upload className="h-4 w-4" /> Upload &amp; compile
        </Button>
        <p className="text-xs text-slate-500">
          Each upload creates a new immutable version: parse → compile → embed → retrieval eval → auto-approve.
        </p>
      </form>
    </Card>
  );
}
