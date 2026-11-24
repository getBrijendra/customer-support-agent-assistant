"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  FlaskConical,
  History,
  LogOut,
  MessageSquareText,
  Plug,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cx, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useCompanies } from "@/lib/queries";
import type { Health } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  admin?: boolean;
  /** Path built from the selected company, if the page is per-company. */
  perCompany?: (slug: string) => string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Agent",
    items: [
      { href: "/assist", label: "Assist", icon: MessageSquareText },
      { href: "/chats", label: "Chat history", icon: History },
    ],
  },
  {
    section: "Admin",
    items: [
      { href: "/companies", label: "Companies", icon: Building2, admin: true },
      {
        href: "/guidelines",
        label: "Guidelines",
        icon: ScrollText,
        admin: true,
        perCompany: (s) => `/companies/${s}/guidelines`,
      },
      {
        href: "/integrations",
        label: "Integrations",
        icon: Plug,
        admin: true,
        perCompany: (s) => `/companies/${s}/integrations`,
      },
      { href: "/evals", label: "Routing evals", icon: FlaskConical, admin: true },
      { href: "/metrics", label: "Metrics", icon: BarChart3, admin: true },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, isAdmin } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const { company } = useApp();

  const logout = async () => {
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
            S
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Support Guidance</p>
            <p className="text-xs text-slate-500">Assistant console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.admin || isAdmin);
            if (!items.length) return null;
            return (
              <div key={group.section}>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.section}
                </p>
                {items.map((item) => {
                  const href = item.perCompany ? (company ? item.perCompany(company) : "/companies") : item.href;
                  const match = item.perCompany ? `/${item.href.slice(1)}` : item.href;
                  const active = item.perCompany
                    ? pathname.includes(match)
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={cx(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                        active
                          ? "bg-indigo-50 font-medium text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between px-2 text-xs text-slate-500">
            <span>
              Signed in as <span className="font-semibold text-slate-700">{role}</span>
            </span>
            <HealthChip />
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:px-8">
          <MobileNav isAdmin={isAdmin} onLogout={logout} />
          <CompanySwitcher />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function MobileNav({ isAdmin, onLogout }: { isAdmin: boolean; onLogout: () => void }) {
  const router = useRouter();
  const items = NAV.flatMap((g) => g.items).filter((i) => !i.admin || isAdmin);
  const { company } = useApp();
  return (
    <div className="flex items-center gap-2 md:hidden">
      <Select
        aria-label="Navigate"
        className="w-40"
        defaultValue=""
        onChange={(e) => {
          if (e.target.value === "__logout") onLogout();
          else if (e.target.value) router.push(e.target.value);
        }}
      >
        <option value="">Menu…</option>
        {items.map((i) => (
          <option key={i.href} value={i.perCompany ? (company ? i.perCompany(company) : "/companies") : i.href}>
            {i.label}
          </option>
        ))}
        <option value="__logout">Sign out</option>
      </Select>
    </div>
  );
}

function CompanySwitcher() {
  const { company, setCompany } = useApp();
  const { data, isLoading } = useCompanies();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="ml-auto flex items-center gap-2">
      <label htmlFor="company-switcher" className="text-xs font-medium text-slate-500">
        Company
      </label>
      <Select
        id="company-switcher"
        className="w-56"
        value={company}
        disabled={isLoading}
        onChange={(e) => {
          const slug = e.target.value;
          setCompany(slug);
          // Keep per-company admin pages in sync with the switcher.
          const m = pathname.match(/^\/companies\/[^/]+(\/.*)?$/);
          if (m && slug) router.push(`/companies/${slug}${m[1] ?? ""}`.replace(/\/guidelines\/\d+.*$/, "/guidelines"));
        }}
      >
        <option value="">{isLoading ? "Loading…" : "Select a company"}</option>
        {data?.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name} ({c.slug}){c.active_version_number ? ` · v${c.active_version_number}` : " · no active version"}
          </option>
        ))}
      </Select>
    </div>
  );
}

function HealthChip() {
  const { data, isError } = useQuery({
    queryKey: ["ready"],
    queryFn: () => api<Health>("/ready"),
    refetchInterval: 30_000,
    retry: false,
  });
  const ok = !isError && data?.status === "ok";
  const label = isError ? "API down" : !data ? "…" : ok ? "API ready" : "Degraded";
  return (
    <span
      className="inline-flex items-center gap-1"
      title={data?.checks ? Object.entries(data.checks).map(([k, v]) => `${k}: ${v ? "ok" : "fail"}`).join("\n") : undefined}
    >
      <span
        className={cx("h-2 w-2 rounded-full", ok ? "bg-emerald-500" : data || isError ? "bg-red-500" : "bg-slate-300")}
        aria-hidden
      />
      {label}
    </span>
  );
}
