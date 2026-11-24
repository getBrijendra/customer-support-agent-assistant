import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/lib/app-context";
import { KEY_COOKIE, ROLE_COOKIE, parseRole } from "@/lib/session";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const role = parseRole(jar.get(ROLE_COOKIE)?.value);
  if (!jar.get(KEY_COOKIE) || !role) redirect("/login");
  return (
    <AppProvider role={role}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
