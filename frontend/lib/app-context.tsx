"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Role } from "@/lib/session";

interface AppContextValue {
  role: Role;
  isAdmin: boolean;
  company: string;
  setCompany: (slug: string) => void;
}

const Ctx = createContext<AppContextValue | null>(null);
const STORAGE_KEY = "sa.company";

export function AppProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  const [company, setCompanyState] = useState("");

  useEffect(() => {
    // Restore the last selected company after hydration.
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setCompanyState(saved);
  }, []);

  const setCompany = useCallback((slug: string) => {
    setCompanyState(slug);
    if (slug) window.localStorage.setItem(STORAGE_KEY, slug);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ role, isAdmin: role === "admin", company, setCompany }),
    [role, company, setCompany],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
