"use client";

import { ShieldAlert } from "lucide-react";

import { useApp } from "@/lib/app-context";

/** Renders children only for admin sessions. The back end enforces this too (403). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useApp();
  if (isAdmin) return <>{children}</>;
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-6 py-12 text-center">
      <ShieldAlert className="h-6 w-6 text-amber-600" aria-hidden />
      <p className="font-medium text-amber-900">Admin access required</p>
      <p className="text-sm text-amber-800">Sign in with an admin API key to use this page.</p>
    </div>
  );
}
