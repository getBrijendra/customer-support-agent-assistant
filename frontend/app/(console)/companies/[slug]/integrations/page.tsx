"use client";

import { use } from "react";

import { CompanyTabs } from "@/components/company-tabs";
import { AdminOnly } from "@/components/role-gate";
import { Tabs } from "@/components/ui";

import { BindingsPanel } from "./bindings-panel";
import { McpPanel } from "./mcp-panel";
import { SecretsPanel } from "./secrets-panel";

export default function IntegrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <AdminOnly>
      <CompanyTabs slug={slug} />
      <Tabs
        tabs={[
          { id: "bindings", label: "Capability bindings", content: <BindingsPanel slug={slug} /> },
          { id: "mcp", label: "MCP servers", content: <McpPanel slug={slug} /> },
          { id: "secrets", label: "Secrets", content: <SecretsPanel slug={slug} /> },
        ]}
      />
    </AdminOnly>
  );
}
