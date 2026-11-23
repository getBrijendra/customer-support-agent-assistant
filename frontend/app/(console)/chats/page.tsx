"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import {
  Button,
  EmptyState,
  ErrorAlert,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { fmtDate, localInputToIso } from "@/lib/format";
import { qk, useCompanies } from "@/lib/queries";
import type { ChatList } from "@/lib/types";

interface Filters {
  company: string;
  status: string;
  intent: string;
  from: string;
  to: string;
}

export default function ChatsPage() {
  const { company } = useApp();
  const companies = useCompanies();
  const [draft, setDraft] = useState<Filters>({ company: "", status: "", intent: "", from: "", to: "" });
  const [filters, setFilters] = useState<Filters | null>(null);
  // Until the user applies filters, follow the top-bar company.
  const active: Filters = filters ?? { ...draft, company };

  const query = useInfiniteQuery({
    queryKey: qk.chats(active),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<ChatList>("/chats", {
        query: {
          company: active.company,
          status: active.status,
          intent: active.intent.trim(),
          from: localInputToIso(active.from),
          to: localInputToIso(active.to),
          limit: 25,
          cursor: pageParam,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Chat history" subtitle="Every exchange is stored, including failed ones." />

      <form
        className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
        }}
      >
        <Field label="Company">
          <Select value={filters ? draft.company : company} onChange={set("company")}>
            <option value="">All</option>
            {companies.data?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={set("status")}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </Select>
        </Field>
        <Field label="Intent">
          <Input value={draft.intent} onChange={set("intent")} placeholder="refund_request" />
        </Field>
        <Field label="From">
          <Input type="datetime-local" value={draft.from} onChange={set("from")} />
        </Field>
        <Field label="To">
          <Input type="datetime-local" value={draft.to} onChange={set("to")} />
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            Apply
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const empty = { company: "", status: "", intent: "", from: "", to: "" };
              setDraft(empty);
              setFilters(null);
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      {query.isError && <ErrorAlert error={query.error} />}
      {query.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="No chats match these filters" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th>Primary intent</Th>
                <Th>Customer message</Th>
                <Th>Version</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.chat_id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">
                    <Link href={`/chats/${c.chat_id}`} className="font-medium text-indigo-700 hover:underline">
                      {fmtDate(c.created_at)}
                    </Link>
                  </Td>
                  <Td>{c.company}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td className="font-mono text-xs">{c.primary_intent ?? "—"}</Td>
                  <Td className="max-w-md">
                    <p className="line-clamp-2">{c.customer_message}</p>
                  </Td>
                  <Td>{c.guideline_version ? `v${c.guideline_version}` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 flex justify-center">
            {query.hasNextPage ? (
              <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                Load more
              </Button>
            ) : (
              <p className="text-xs text-slate-500">End of results · {items.length} chats</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
