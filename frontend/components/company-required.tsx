"use client";

import { Building2 } from "lucide-react";

import { useApp } from "@/lib/app-context";

/** Prompts the user to pick a company in the top-bar switcher before showing children. */
export function CompanyRequired({ children }: { children: (slug: string) => React.ReactNode }) {
  const { company } = useApp();
  if (company) return <>{children(company)}</>;
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Building2 className="h-6 w-6 text-slate-400" aria-hidden />
      <p className="font-medium text-slate-800">Select a company</p>
      <p className="text-sm text-slate-500">Choose a company in the switcher at the top right.</p>
    </div>
  );
}
