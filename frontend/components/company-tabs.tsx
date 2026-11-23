"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { cx } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { useCompanies } from "@/lib/queries";

/** Header for per-company admin pages; also syncs the top-bar switcher with the URL. */
export function CompanyTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { company, setCompany } = useApp();
  const { data } = useCompanies();
  const c = data?.find((x) => x.slug === slug);

  useEffect(() => {
    if (slug && slug !== company) setCompany(slug);
  }, [slug, company, setCompany]);

  const tabs = [
    { href: `/companies/${slug}/guidelines`, label: "Guidelines" },
    { href: `/companies/${slug}/integrations`, label: "Integrations" },
    { href: "/evals", label: "Evals" },
  ];
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</p>
      <h1 className="text-xl font-semibold text-slate-900">
        {c?.name ?? slug} <span className="font-mono text-sm font-normal text-slate-500">{slug}</span>
      </h1>
      <div className="mt-3 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href.split("?")[0]);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
