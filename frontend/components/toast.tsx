"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

import { errorMessage } from "@/lib/api";

type Kind = "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (err: unknown) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4000);
  }, []);

  const [api] = useState<ToastApi>(() => ({
    success: (text) => push("success", text),
    error: (err) => push("error", errorMessage(err)),
  }));

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg"
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Success" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Error" />
            )}
            <p className="min-w-0 flex-1 break-words text-slate-800">{t.text}</p>
            <button
              className="text-slate-400 hover:text-slate-700"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
