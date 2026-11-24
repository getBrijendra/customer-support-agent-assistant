import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Support Guidance Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your agent or admin API key</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
