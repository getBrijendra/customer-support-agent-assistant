/** Cookie names shared by the server routes, the proxy and the UI. */
export const KEY_COOKIE = "sa_key"; // httpOnly: the raw X-API-Key, never readable by JS
export const ROLE_COOKIE = "sa_role"; // readable: "agent" | "admin", only used to shape the UI

export type Role = "agent" | "admin";

export function parseRole(value: string | undefined | null): Role | null {
  return value === "admin" || value === "agent" ? value : null;
}
