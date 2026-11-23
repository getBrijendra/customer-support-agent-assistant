/** Mirrors app/schemas/api.py and app/ai/schemas.py in the FastAPI back end. */

export type Json = Record<string, unknown>;
export type Confidence = "high" | "medium" | "low";
export type StepType = "say" | "ask" | "lookup" | "action" | "escalate";
export type PerformedBy = "ai" | "ai_verified" | "needs_approval" | "agent";

// ------------------------------------------------------------------ companies
export interface VersionSummary {
  id: string;
  version_number: number;
  status: string;
  review_status: string;
  file_name: string;
  created_at: string;
  activated_at: string | null;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  active_version_number: number | null;
  active_version: VersionSummary | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------- guidelines
export interface GuidelineVersion {
  id: string;
  company: string;
  version_number: number;
  status: "processing" | "ready" | "failed";
  review_status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_by: string | null;
  activate_on_approval: boolean;
  is_active: boolean;
  file_name: string;
  source_format: string;
  content_sha256: string;
  byte_size: number;
  content_type: string | null;
  storage_backend: string | null;
  embedding_model: string;
  embedding_dimensions: number;
  compiler_model: string | null;
  compile_prompt_version: string | null;
  section_count: number | null;
  intent_count: number | null;
  fact_count: number | null;
  coverage: Json | null;
  validation_warnings: string[] | null;
  routing_eval_run_id: string | null;
  compile_duration_ms: number | null;
  ingest_duration_ms: number | null;
  notes: string | null;
  error_message: string | null;
  uploaded_by: string | null;
  created_at: string;
  ready_at: string | null;
  activated_at: string | null;
  raw_text?: string | null;
  info?: string | null;
}

export interface PlaybookStep {
  step_id: string;
  type: StepType;
  text: string;
  condition: string | null;
  capability: string | null;
}

export interface Intent {
  key: string;
  name: string;
  description: string;
  conditions: string[];
  steps: PlaybookStep[];
  reply_template: string | null;
  placeholders: string[];
  source_section_ids: string[];
}

export interface Fact {
  id: string;
  title: string;
  text: string;
  source_section_ids: string[];
}

export interface Section {
  id: string;
  ref: string;
  heading: string | null;
  path: string | null;
  char_start: number;
  char_end: number;
}

export interface Playbook {
  company: string;
  version_number: number;
  compiler_model: string | null;
  intents: Intent[];
  company_rules: Json;
  facts: Fact[];
  sections: Section[];
  coverage: Json | null;
  validation_warnings: string[] | null;
}

export interface CapabilityCoverage {
  company: string;
  version_number: number;
  referenced: number;
  live: number;
  manual: number;
  capabilities: {
    capability: string;
    kind: "read" | "write" | null;
    steps: string[];
    binding_status: string | null;
    adapter_type: string | null;
    handled_by: "ai" | "agent";
  }[];
}

// ---------------------------------------------------------------------- chats
export interface PlanStep {
  step_ref: string;
  type: StepType;
  instruction: string;
  performed_by: PerformedBy;
  tool_call_id: string | null;
  proposed_action_id: string | null;
}

export interface IntentGuidance {
  intent_key: string;
  confidence: Confidence;
  steps: PlanStep[];
  missing_information: string[];
}

export interface GuidanceProposedAction {
  capability: string;
  arguments: { name: string; value: string }[];
  reason: string;
  step_ref: string;
}

export interface Guidance {
  detected_intents: IntentGuidance[];
  recommended_response: string;
  requires_escalation: boolean;
  escalation_reason: string | null;
  references: string[];
  proposed_actions: GuidanceProposedAction[];
  confidence: Confidence;
  missing_information: string[];
}

export type ActionStatus =
  | "proposed"
  | "denied"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed";

export interface Action {
  id: string;
  chat_id: string;
  capability: string;
  args: Json;
  reason: string | null;
  step_ref: string | null;
  status: ActionStatus;
  policy_check: Json | null;
  result: unknown;
  error: string | null;
  decided_by: string | null;
  decided_at: string | null;
  executed_at: string | null;
  created_at: string;
}

export interface ToolCall {
  id: string;
  capability: string;
  adapter_type: string | null;
  trigger: string;
  status: string;
  args: Json | null;
  result: unknown;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface ChatCreate {
  company: string;
  customer_message: string;
  agent_notes?: string | null;
  channel?: string | null;
}

export interface ChatCreated {
  chat_id: string;
  company: string;
  guideline_version: number | null;
  guidance: Guidance;
  proposed_actions: Action[];
  latency_ms: number | null;
  created_at: string;
}

export interface ChatListItem {
  chat_id: string;
  company: string;
  created_at: string;
  status: "success" | "error";
  primary_intent: string | null;
  customer_message: string;
  recommended_response: string | null;
  guideline_version: number | null;
}

export interface ChatList {
  items: ChatListItem[];
  next_cursor: string | null;
}

export interface RoutingCandidate {
  key: string;
  score: number;
  vector_score: number | null;
  text_score: number | null;
  best_example: string | null;
}

export interface Routing {
  candidates: RoutingCandidate[];
  selected: { key: string; confidence: Confidence; message_span: string | null }[];
  no_match: boolean;
  entities: Record<string, string>;
}

export interface ChatDetail {
  chat_id: string;
  company: string;
  status: "success" | "error";
  created_at: string;
  customer_message: string;
  agent_notes: string | null;
  channel: string | null;
  guideline_version: number | null;
  guideline_version_id: string | null;
  primary_intent: string | null;
  guidance: Guidance | null;
  routing: Routing | null;
  references: Json | null;
  feedback: { correct_intent_keys?: string[]; by?: string; at?: string } | null;
  tool_calls: ToolCall[];
  proposed_actions: Action[];
  llm_model: string | null;
  router_model: string | null;
  prompt_version: string | null;
  router_prompt_version: string | null;
  latency_ms: { total: number | null; routing: number | null; tools: number | null; llm: number | null };
  tokens: {
    input: number | null;
    output: number | null;
    router_input: number | null;
    router_output: number | null;
  };
  error_message: string | null;
  request_id: string | null;
}

// --------------------------------------------------------------- integrations
export interface Capability {
  name: string;
  kind: "read" | "write";
  vertical: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, { type: string }>; required: string[] };
  policy_keys: string[];
}

export interface Secret {
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: string;
  auth_secret_name: string | null;
  discovered_tools: Json[] | null;
  last_discovered_at: string | null;
}

export type AdapterType = "mcp" | "http" | "sql_readonly" | "mock";

export interface Binding {
  id: string;
  capability: string;
  adapter_type: AdapterType;
  config: Json;
  policy: Json;
  status: "draft" | "tested" | "live";
  last_test_result: Json | null;
  updated_at: string;
}

export interface BindingTestResult {
  binding: Binding;
  result: Json;
}

// ---------------------------------------------------------------------- evals
export interface EvalCase {
  id: string;
  message: string;
  expected_intent_keys: string[];
  source: string;
  created_from_version_id: string | null;
  chat_id: string | null;
  created_at: string;
}

export interface EvalMetrics {
  cases?: number;
  positives?: number;
  negatives?: number;
  stale?: number;
  top1_accuracy?: number | null;
  recall_at_k?: number | null;
  set_precision?: number | null;
  set_recall?: number | null;
  set_f1?: number | null;
  exact_match_rate?: number | null;
  no_match_precision?: number | null;
  no_match_recall?: number | null;
  per_intent?: Record<string, { cases: number; correct: number; accuracy: number | null }>;
  top_confusions?: { expected: string; predicted: string; count: number }[];
}

export interface EvalRun {
  id: string;
  company: string;
  version_number: number;
  mode: "retrieval" | "full";
  metrics: EvalMetrics;
  results?: Json[] | null;
  created_at: string;
}

// -------------------------------------------------------------------- metrics
export interface MetricsSummary {
  window: Record<string, string>;
  company: string | null;
  chats: {
    total: number;
    success: number;
    error: number;
    error_rate: number;
    latency_ms: { avg: number | null; p50: number | null; p95: number | null };
    tokens: Record<string, number>;
    escalation_rate: number;
    confidence_breakdown: Record<string, number>;
  };
  by_company: { company: string; chats: number; avg_latency_ms: number | null; error_rate: number }[];
  daily_volume: { date: string; chats: number }[];
  ingestion: { uploads: number; ready: number; failed: number; avg_duration_ms: number | null };
  routing: {
    no_match_rate: number;
    multi_intent_rate: number;
    top_intents: { intent: string; chats: number }[];
    feedback_count: number;
    feedback_correction_rate: number;
    latest_eval: {
      company: string;
      version: number;
      mode: string;
      top1: number | null;
      recall_at_k: number | null;
      created_at: string;
    }[];
  };
  tools: {
    calls: ({ capability: string } & Record<string, number | string>)[];
    p95_latency_ms: number | null;
    prefetch_share: number;
    proposals: Record<string, number>;
  };
}

export interface Health {
  status: string;
  checks?: Record<string, boolean> | null;
}
