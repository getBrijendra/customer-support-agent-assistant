"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, ErrorAlert, Field, Input } from "@/components/ui";
import { parseError } from "@/lib/api";

const schema = z.object({ key: z.string().trim().min(1, "Enter an API key").max(500) });
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setError(parseError(res.status, await res.json().catch(() => null), res.statusText));
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/assist");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      {params.get("expired") && !error && (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          Your session expired. Please sign in again.
        </p>
      )}
      <Field
        label="API key"
        error={errors.key?.message}
        hint="Kept in a secure, httpOnly cookie. The browser never sends it to the API directly."
      >
        <Input type="password" autoComplete="current-password" autoFocus {...register("key")} />
      </Field>
      <ErrorAlert error={error} title="Sign-in failed" />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        <KeyRound className="h-4 w-4" aria-hidden /> Sign in
      </Button>
    </form>
  );
}
