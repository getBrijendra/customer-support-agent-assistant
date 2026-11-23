import type { Metadata } from "next";

import { AssistClient } from "./assist-client";

export const metadata: Metadata = { title: "Assist" };

export default function AssistPage() {
  return <AssistClient />;
}
