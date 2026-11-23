"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Capability, Company, GuidelineVersion } from "@/lib/types";

export const qk = {
  companies: ["companies"] as const,
  company: (slug: string) => ["companies", slug] as const,
  guidelines: (slug: string) => ["guidelines", slug] as const,
  guideline: (slug: string, n: number) => ["guidelines", slug, n] as const,
  playbook: (slug: string, n: number) => ["playbook", slug, n] as const,
  coverage: (slug: string, n: number) => ["coverage", slug, n] as const,
  chats: (filters: object) => ["chats", filters] as const,
  chat: (id: string) => ["chat", id] as const,
  capabilities: ["capabilities"] as const,
  secrets: (slug: string) => ["secrets", slug] as const,
  mcpServers: (slug: string) => ["mcp-servers", slug] as const,
  bindings: (slug: string) => ["bindings", slug] as const,
  evalCases: (slug: string) => ["eval-cases", slug] as const,
  evalRuns: (slug: string) => ["eval-runs", slug] as const,
  evalRun: (id: string) => ["eval-run", id] as const,
  metrics: (filters: object) => ["metrics", filters] as const,
};

export function useCompanies() {
  return useQuery({ queryKey: qk.companies, queryFn: () => api<Company[]>("/companies") });
}

export function useCapabilities(enabled = true) {
  return useQuery({
    queryKey: qk.capabilities,
    queryFn: () => api<Capability[]>("/capabilities"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useGuidelines(slug: string) {
  return useQuery({
    queryKey: qk.guidelines(slug),
    queryFn: () => api<GuidelineVersion[]>(`/companies/${encodeURIComponent(slug)}/guidelines`),
    enabled: !!slug,
    // Uploads compile in the background (202): poll while any version is still processing.
    refetchInterval: (q) => (q.state.data?.some((v) => v.status === "processing") ? 2000 : false),
  });
}

export const enc = encodeURIComponent;
