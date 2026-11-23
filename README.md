# Support Guidance Assistant

A FastAPI back end that gives customer-support agents a ready-to-send reply plus a step-by-step
handling plan for a customer message, grounded in **that company's own support guidelines**.

How it works in one paragraph:
1. Each guideline upload is **compiled** into structured data in Postgres: intents with typed playbook steps, company-wide rules, and reference facts.
2. Chats are **routed** to the right intents (several when needed) with hybrid search (pgvector + Postgres full-text) and a fast router LLM.
3. The harness can **look up** data in the company's own systems (MCP server, HTTP API, read-only SQL) and **proposes** writes (refunds, resets) that the agent approves.

- **LLMs and embeddings:** deterministic fake collaborators run fully offline in local development.
  Production uses Google Gemini via LangChain for generation, compilation, routing and embeddings.
- **Database and search:** Postgres with **pgvector**. PGlite provides the lightweight persistent
  local database and the default ephemeral integration-test backend; hosted Supabase is used in
  production, with a real-Postgres compatibility mode for release checks. The app uses SQLAlchemy 2
  async with asyncpg, and **Alembic owns the schema**. There is no separate vector database.
- **Chat harness:** a [LangGraph](https://github.com/langchain-ai/langgraph) graph that runs **in-process** inside the API. There is no LangGraph Platform or LangSmith deployment.

```
api (routers) ─▶ services ─▶ repositories (all SQL, incl. pgvector search)
                         ├▶ harness (LangGraph: route ∥ facts → prefetch → tool loop → generate → gate → persist)
                         ├▶ ai (compiler, router, generator, prompts, heuristic offline fakes)
                         ├▶ documents (parser interface; .txt only)
                         ├▶ search (SearchGateway → pgvector + tsvector, RRF)
                         └▶ capabilities (registry, gateway, policy, secrets, adapters: mcp/http/sql_readonly/mock)
```

See [architecture.md](architecture.md) for diagrams and the key decisions, and
[claude.md](claude.md) for the full build spec.

---

## First-time local setup

1. Install Python 3.12+, `uv`, and Node.js/npm. Run `uv sync` and `npm install`.
2. Run `cp .env.example .env`. Add your own `AGENT_API_KEYS` / `ADMIN_API_KEYS` and a
   `SECRETS_ENCRYPTION_KEY`
   (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
3. In terminal 1, run `npm run db:pglite`. Data persists under `.pglite/`; press Ctrl+C to stop it.
4. In terminal 2, run `uv run alembic upgrade head`, then optionally
   `uv run python scripts/seed.py`. The configured fake provider is used automatically.
5. Run `uv run uvicorn app.main:app --reload` and open <http://127.0.0.1:8000/docs>.
6. Run `uv run pytest -m unit` for the Docker-free test tier.

**Web console (optional):** with the API running, `cd frontend && npm install && npm run dev`
(or `make fe-install fe-dev`) and open <http://127.0.0.1:3000>. Sign in with an agent or admin
key. See [frontend/README.md](frontend/README.md).

> **Ports:** PGlite listens on `55432`. The optional Supabase CLI stack uses DB `55422` and Studio
> `55423`, so both can be installed without a port collision.

`PGLITE_MODE=true` makes the app use `PGLITE_DATABASE_URL` and leaves `DATABASE_URL` untouched.
Set `PGLITE_MODE=false` to return to the real Postgres/Supabase URL. PGlite remains local-only;
its socket accepts eight logical clients. FastAPI uses one serialized connection, leaving seven
slots for Pgweb or CLI tools. This avoids unsafe concurrent extended-query execution in
PGlite's single WASM backend. Run the integration suite against real Postgres before release.

The Gemini SDK is not installed by the default local `uv sync`. To run against Gemini outside the
production image, use `uv sync --extra google`, set `LLM_PROVIDER=google`, and add `GOOGLE_API_KEY`.

For optional real local Postgres + pgvector integration testing, install Docker and the Supabase
CLI, run `make db-up`, and then `make test-integration-postgres`. `make db-up` also creates the
isolated `support_assistant_test` database from `TEST_DATABASE_URL`.

`make db-up` runs `supabase start` and then `scripts/create_test_db.py`, which creates
`support_assistant_test` for the integration tests. `make db-reset` wipes the local DB, then
re-runs the migrations and the seed.

### Seed data
`scripts/seed.py` does the following:
1. Creates `bookshop`, `vpn-saas` and `agrifarm`.
2. Uploads and compiles `data/seed_guidelines/bookshop.txt`, `vpn_saas.txt` and `agrifarm.txt`. You must provide the first two files.
3. Binds **mock** capabilities so the demo shows verified lookups: bookshop orders and shipments, plus VPN accounts, subscriptions and devices. Writes get policies, e.g. a refund is capped at 50.
4. For **AgriFarm** (fresh-food delivery plus a weekly Farm Box), registers the built-in MCP server `inproc://agrifarm`, discovers its tools and binds all 13 capabilities to it. The policies are: refund ≤ 60, store credit ≤ 15, discount ≤ 15 %, Farm Box pause ≤ 4 weeks.

Flags:
- With `LLM_PROVIDER=fake`, normal `make seed` is fully offline. `make seed-offline`
  (`--fake-compiler`) can also force heuristic compilation when the configured provider is Google.
- `--no-bindings` skips the mock bindings.

Re-running the script is safe.

**Demo of "verified vs manual":**
1. Ask for bookshop order `#1001` with `POST /chats`. The lookup step comes back as `performed_by: "ai_verified"`, with the real ETA from the mock store.
2. Delete the `shipment.track` binding and ask again. The same step is now `"agent"`, a manual step for the agent.

### Upgrading an existing database
Migration `0002` clears every company's active pointer, because guideline versions created before it have no compiled
playbook. Run `make migrate && make seed` (or re-upload your guidelines) after upgrading.

---

## Configuration

`.env.example` documents every variable. The important ones:

| Variable | Notes |
|---|---|
| `PGLITE_MODE` / `PGLITE_DATABASE_URL` / `PGLITE_APP_POOL_SIZE` | Local PGlite switch, socket URL and FastAPI pool size (safely defaults to 1 of 8 socket slots). Turning it off restores `DATABASE_URL`. |
| `DATABASE_URL` / `TEST_DATABASE_URL` | Real Postgres asyncpg URLs. The test DB name **must end in `_test`**. |
| `LLM_PROVIDER` | `fake` runs local generator/compiler/router/embeddings with no API calls; `google` uses the optional Gemini dependency (`uv sync --extra google`). Fake mode is rejected in production. |
| `GOOGLE_API_KEY`, `LLM_MODEL`, `COMPILER_MODEL`, `ROUTER_MODEL`, `EMBEDDING_MODEL` | Used only with the Google provider. Without a key, Google-mode uploads and chats fail. |
| `EMBEDDING_DIMENSIONS` | `768`, **fixed by the migration** (`vector(768)`). The app refuses to start if it differs. The Gemini embeddings client requests this size with `output_dimensionality`. |
| `ROUTING_CANDIDATES` / `ROUTING_MAX_INTENTS` / `ROUTING_MIN_SCORE` | How many intents the router sees, how many it may pick, and the no-match threshold. |
| `AUTO_APPROVE_GUIDELINES` / `AUTO_APPROVE_MIN_ROUTING_TOP1` | Whether auto-approval is on, and its eval gate (default 0.8 top-1 accuracy). |
| `TOOLS_ENABLED`, `AGENT_MAX_STEPS`, `TOOL_TIMEOUT_SECONDS`, `AGENT_TOTAL_TIMEOUT_SECONDS` | Limits for the tool loop. |
| `SECRETS_ENCRYPTION_KEY` | Fernet key for company secrets (MCP tokens, API keys, DSNs). |
| `OUTBOUND_ALLOW_PRIVATE_NETWORK` | SSRF guard for HTTP/MCP URLs. `true` locally, **`false` in prod**. |
| `GUIDELINE_STORAGE_BACKEND`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GUIDELINE_STORAGE_BUCKET` | Where original uploaded files are kept. See *Original guideline files* below. |
| `LANGSMITH_TRACING` | **Off by default.** See the warning below. |
| `SENTRY_DSN`, `SENTRY_ENABLE_LOGS`, `SENTRY_LOG_EVENT_LEVEL`, … | Optional Sentry error reporting and log capture. See *Sentry* below. |

### Supabase connection pooler
Use the **direct connection** or the **session pooler (port 5432)** for the API. With the
**transaction pooler (port 6543)**, asyncpg prepared statements break under PgBouncer. In that
case the app (and Alembic) automatically sets `statement_cache_size=0` and
`prepared_statement_cache_size=0`, and uses `NullPool`.

### pgvector
Local and hosted Supabase both ship the `vector` extension, and migration `0002` runs
`CREATE EXTENSION IF NOT EXISTS vector`. Each search runs
`SET LOCAL hnsw.iterative_scan = relaxed_order`, so filtered HNSW scans don't return too few
rows for small tenants. This needs **pgvector ≥ 0.8**; local Supabase ships 0.8.2, which you
can check with `SELECT extversion FROM pg_extension WHERE extname='vector'`.

### Original guideline files (Supabase Storage)
Compilation always works from the decoded text in `guideline_versions.raw_text`. In addition,
with `GUIDELINE_STORAGE_BACKEND=supabase`, the **exact uploaded bytes** are written to a
**private** Supabase Storage bucket (`GUIDELINE_STORAGE_BUCKET`, default `guideline-files`,
created by the app at startup) under `<company_id>/<version_id>/<file name>`. The version row
records `storage_backend`, `storage_bucket`, `storage_key` and `content_type`, and
`GET /companies/{slug}/guidelines/{n}/file` downloads the original.

- The upload to storage happens before the version row commits. If storage is unreachable, the
  upload fails with `502 STORAGE_ERROR` and no version is created.
- Deleting a version also deletes its file (best effort; a failure is logged, not raised).
- The app uses the service-role / `sb_secret_` key over the Storage REST API, so the bucket
  needs no RLS policies. Keep that key server-side only.
- Versions uploaded before migration `0003`, or while storage was `none`, have no stored file
  (`404 FILE_NOT_STORED`); their text is still available with `?include_text=true`.
- In Docker, use `SUPABASE_URL=http://host.docker.internal:55421`.
- Another backend (S3, GCS) means a new `FileStore` implementation in `app/storage/`.

### Schema ownership: Alembic only
Alembic (`migrations/`) is the single source of truth for the schema, both locally and in
production. Never add tables via `supabase/migrations/` or Studio. `supabase/` holds only
`config.toml`.

### LangSmith tracing (optional, off by default)
LangGraph and LangChain can send traces to LangSmith. Setting `LANGSMITH_TRACING=true` with an
API key **sends customer messages, guideline text and tool results to a third-party service**.
Only enable it for debugging with non-sensitive data. Logs, Prometheus metrics and the
`tool_calls` audit table already give you a full trace without it.

### Sentry (optional, off by default)
Set `SENTRY_DSN` to turn on Sentry. The app's standard `logging` records are forwarded:
- records at `SENTRY_LOG_EVENT_LEVEL` (default `ERROR`) and above, and unhandled 5xx exceptions, become **issues**;
- records at `SENTRY_LOG_BREADCRUMB_LEVEL` (default `INFO`) are attached as **breadcrumbs**;
- with `SENTRY_ENABLE_LOGS=true`, records at `SENTRY_LOGS_LEVEL` and above also go to **Sentry Logs**.

Events are tagged with the `request_id` so they line up with the JSON logs. Domain errors (4xx)
are not reported. `send_default_pii` is off, and request bodies, query strings, cookies and local
variables are never sent. `X-API-Key` and other secret-like fields are scrubbed. The app logs only
lengths and hashes of customer text, but Sentry is still a third-party service.
`SENTRY_TRACES_SAMPLE_RATE` (default `0`) turns on performance tracing.

### Rate limiting (`POST /chats`)
Chats are rate limited with the [`limits`](https://limits.readthedocs.io) library before any
embedding or LLM work. Two levels are checked:
- **per agent per company**: key `(company slug, API-key label)`, `CHAT_RATE_LIMIT_PER_AGENT` (default `20/minute`);
- **per company**: all agents of one company together, `CHAT_RATE_LIMIT_PER_COMPANY` (default `300/minute`).

Limits use `limits` notation, and several windows can be combined with `;` (e.g. `20/minute;300/hour`).
An empty value turns that level off, and `RATE_LIMIT_ENABLED=false` turns it all off.
An agent is identified by the **label** of their API key (`AGENT_API_KEYS=alice:key1,bob:key2`),
so give each agent their own key; agents sharing a key share one quota.

A rejected request gets `429 RATE_LIMITED` with `Retry-After` and `details.scope`
(`agent` or `company`). It is **not** stored as a chat, but it counts in
`chat_rate_limited_total{company,scope}`. Successful responses carry
`X-RateLimit-Limit/Remaining/Reset` for the agent's tightest window.

`RATE_LIMIT_STORAGE_URL=memory://` keeps counters per process, which is fine locally. With more than
one process or replica, point it at Redis (`redis://…` or `rediss://…`) so all of them share the
counters. If Redis is unreachable, chats are allowed and a `rate_limit.storage_error` warning is
logged. Set `RATE_LIMIT_FAIL_OPEN=false` to reject them instead.
`RATE_LIMIT_STRATEGY` can be `sliding-window-counter` (default), `moving-window` (exact, but more
storage) or `fixed-window`.

### Production
1. Copy `.env.prod.example`. Set `DATABASE_URL` (direct connection or session pooler, port 5432), `SECRETS_ENCRYPTION_KEY`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (original-file storage), and `OUTBOUND_ALLOW_PRIVATE_NETWORK=false`.
2. Run `alembic upgrade head` against the hosted database as a release step.
3. Deploy the `Dockerfile` image. With more than one replica, set `RATE_LIMIT_STORAGE_URL` to a Redis URL.

The API is stateless (all state, including the vector index, is in Postgres), so you can run
several replicas. The hosted Postgres major version should match `supabase/config.toml`
(**17**) and the `pgvector/pgvector:pg17` image used in CI. Check it under
**Settings → Infrastructure**.

### Docker (optional)
`docker compose up --build` runs only the API. The DB comes from the Supabase CLI on the host,
so use `DATABASE_URL=postgresql+asyncpg://postgres:postgres@host.docker.internal:55422/postgres`.

---

## How it works

### 1. Ingestion and compilation (`services/ingestion_service.py`)
1. **Validate the upload.** The parser registry accepts only `.txt` and returns `UNSUPPORTED_FORMAT` for anything else; PDF/DOCX plug in here later. The size limit, UTF-8/Latin-1 decoding and the duplicate-of-active check (`409`) also apply.
2. **Allocate the version.** Version numbers are allocated under `SELECT … FOR UPDATE` on the company row, with a UNIQUE constraint as a backstop.
3. **Parse** the text into sections (`S1`, `S2`, …) with headings and character offsets.
4. **Compile** with `COMPILER_MODEL`, which produces:
   - intents, each with typed steps (`say`/`ask`/`lookup`/`action`/`escalate`) and a capability mapping for lookups and actions;
   - company rules;
   - reference facts;
   - a section → kind map.

   The compiler receives the previous version's intent keys and reuses them, so keys stay stable across versions. Large documents are compiled section by section and merged.
5. **Validate** in code. Blocking errors (no intents, duplicate keys, no source section) fail the version. Fixable problems become warnings, and coverage is recorded.
6. **Generate synthetic customer messages** per intent: index examples for routing, plus held-out eval examples and negatives.
7. **Embed** everything, then insert all rows **in one transaction**. A failure leaves no partial rows, and the previous active version keeps serving.
8. **Run a retrieval-mode routing eval** (no LLM). This gates auto-approval: with the eval passing and auto-approval on, the version is approved and becomes active. Otherwise it waits as `pending` for an admin.

### 2. The chat harness (`harness/`, LangGraph)
```
load_context → [route ∥ retrieve_facts] → (no match? fallback_sections) → prefetch
            → tool_agent ⟲ tools (bounded) → generate → validate_and_gate → persist
```
- **route:** hybrid search over the intent examples (vector cosine + an OR full-text query, fused with RRF, best example per intent), then the router LLM picks 0–3 intents and extracts entities such as order id and email.
- **Company rules are always injected.** Reference facts are retrieved in parallel.
- **No match:** the harness falls back to section search, forces `confidence="low"` and escalation, and flags the chat.
- **prefetch:** runs lookups deterministically when the needed arguments are already known. **tool_agent:** offers the LLM only the *bound read* capabilities of the selected intents, limited by `AGENT_MAX_STEPS` and the timeouts.
- **validate_and_gate:**
  - strips citations that weren't in the context;
  - decides `performed_by` per step **in code** (`ai` / `ai_verified` / `needs_approval` / `agent`);
  - checks proposed writes against the capability schema and the binding's **policy** (`proposed` or `denied`).
- **persist:** **always** runs, on success or error. It stores the chat, the routing trace, tool calls and proposals. An LLM failure returns `502 LLM_ERROR`, and the row is still saved.

### 3. Company integrations (`capabilities/`)
Playbook steps refer to **abstract capabilities** (`order.get`, `refund.create`, …; see
`GET /capabilities`). Each company binds a capability to an adapter:

| Adapter | Config | Notes |
|---|---|---|
| `mock` | `{"store": "bookshop_orders"\|"vpn_accounts"}` | Demo and tests; writes are idempotent |
| `http` | `{"method","url","headers","query","body","auth_secret","response_path"}` | `{arg}` templates; secret injected at call time; SSRF guard |
| `sql_readonly` | `{"dsn_secret","statement"}` | One admin-defined parameterized `SELECT` (validated); runs in a `READ ONLY` transaction with `statement_timeout` and a row limit |
| `mcp` | `{"server_id","tool_name","arg_map","idempotency_arg"?}` | Only the mapped tool is ever callable; `idempotency_arg` passes the action's idempotency key to the tool |

**In-process MCP server (AgriFarm demo).** `app/capabilities/adapters/local_mcp/agrifarm.py` is a real
MCP server (`MCPServer` from the `mcp` SDK). It runs inside the API process through the SDK's in-process
transport, so there is no port and nothing extra to start. To use it, register the server URL `inproc://agrifarm`.
Its data lives in `data/mcp/agrifarm.json` (orders, cold-chain logs, delivery slots, products/harvest
dates, Farm Boxes) and is re-read on every call. The file's `as_of` date is the server's "today", so every
result is deterministic. Write tools enforce business rules: refunds can't exceed the refundable amount,
packed orders can't be cancelled, full slots are rejected and a box can't be paused twice. They return
references derived from their arguments (`RF-…`, `CR-…`, `FRESH10-…`) and replay the first result for a
repeated idempotency key. Writes are not saved back to the file. Demo customers include
`priya.sharma@example.com` (spoiled order `AF-10421` with a cold-chain breach), `emma.lindqvist@example.com`
(delayed `AF-10463`), `daniel.okafor@example.com` (cancellable `AF-10458`) and `marcus.bell@example.com`
(Farm Box charged after a pause).

Rules:
- **Binding lifecycle:** `PUT` creates a `draft` → `test` (a dry run; writes are only validated unless `execute_write=true`) → `tested` → `go-live` → `live`. Any change resets the binding to `draft`.
- **Reads** run automatically. **Writes** become proposed actions. The agent approves one with `POST /chats/{id}/actions/{aid}/approve`, which locks the row, re-checks the policy, and executes it **once** with an idempotency key. Approving again returns the stored result.
- **Graceful degradation:** a capability that is unbound, failing or timing out becomes a manual step for the agent, and the chat never fails because of it.
- Secrets are Fernet-encrypted, write-only through the API, and redacted from `tool_calls` and logs. Every call is audited in `tool_calls`.

### 4. Routing evals (`services/eval_service.py`)
- **Case sources:** synthetic held-out examples, negatives, manual cases, and **agent feedback** (`POST /chats/{id}/feedback`).
- **Modes:** `retrieval` (search only, deterministic; runs at every ingest) and `full` (adds the router LLM).
- **Metrics:** top-1 accuracy, candidate recall@k, multi-intent set precision/recall/F1 and exact match, no-match precision/recall, per-intent accuracy, and the most-confused intent pairs. Stale cases (whose key no longer exists) are reported separately.

### Observability
- **Logs:** JSON logs with `request_id`, and the `X-Request-ID` header is propagated. Customer messages are only logged as length plus hash.
- **Events:** `chat.*`, `routing.completed`, `tool.called`, `action.*`, `ingestion.*`, `guidelines.*`, `eval.completed`.
- **Prometheus** (`/metrics`, admin only):
  - `chat_requests_total{company,status}`
  - `chat_latency_seconds`
  - `llm_tokens_total{role,direction}`
  - `ingestion_total{status}`
  - `ingestion_compile_seconds`
  - `routing_no_match_total{company}`
  - `routing_intents_selected`
  - `tool_calls_total{capability,adapter,status}`
  - `tool_latency_seconds`
  - `proposed_actions_total{status}`
  - `chat_rate_limited_total{company,scope}`
- **Metrics summary and dashboard:** `/internal/metrics/summary` is computed in SQL and includes `routing` and `tools` blocks. `/internal/dashboard` renders it with Chart.js.

### Swapping the vector search
Only `app/search/` and `repositories/search.py` know about pgvector. To use a dedicated vector
database, implement `SearchGateway` (`search_intents`, `search_facts`, `search_sections`,
`healthcheck`) and build it in `app/resources.py`. Services and graph nodes don't change.

---

## API (all under `/api/v1`; header `X-API-Key`)

**Agent** keys: chats, actions, feedback, and reading companies, guidelines and playbooks.
**Admin** keys: everything. Health endpoints are public. Errors look like
`{"error": {"code", "message", "request_id"}}`.

```bash
API=http://127.0.0.1:8000/api/v1
AGENT="X-API-Key: <agent-key>"; ADMIN="X-API-Key: <admin-key>"; JSON='Content-Type: application/json'

# Health
curl $API/health
curl $API/ready                                   # DB + pgvector search index

# Companies
curl -X POST $API/companies -H "$ADMIN" -H "$JSON" -d '{"slug":"bookshop","name":"Bookshop"}'
curl $API/companies -H "$AGENT"
curl $API/companies/bookshop -H "$AGENT"

# Guideline versions, playbooks, review
curl -X POST $API/companies/bookshop/guidelines -H "$ADMIN" \
     -F file=@data/seed_guidelines/bookshop.txt -F activate=true -F notes="refund policy updated"
curl $API/companies/bookshop/guidelines -H "$AGENT"
curl $API/companies/bookshop/guidelines/active -H "$AGENT"
curl "$API/companies/bookshop/guidelines/2?include_text=true" -H "$AGENT"
curl -OJ $API/companies/bookshop/guidelines/2/file -H "$AGENT"           # original upload
curl $API/companies/bookshop/guidelines/2/playbook -H "$AGENT"            # intents, rules, facts
curl $API/companies/bookshop/guidelines/2/capability-coverage -H "$ADMIN" # live vs manual
curl -X POST $API/companies/bookshop/guidelines/2/approve -H "$ADMIN" -H "$JSON" -d '{"note":"ok"}'
curl -X POST $API/companies/bookshop/guidelines/3/reject -H "$ADMIN" -H "$JSON" -d '{"reason":"typo"}'
curl -X POST $API/companies/bookshop/guidelines/1/activate -H "$ADMIN"    # rollback
curl -X DELETE $API/companies/bookshop/guidelines/3 -H "$ADMIN"

# Chats
curl -X POST $API/chats -H "$AGENT" -H "$JSON" -d '{
  "company": "vpn-saas",
  "customer_message": "I was charged twice this month and the VPN will not connect on my iPhone.",
  "agent_notes": "Customer email: jane@example.com", "channel": "email"}'
curl "$API/chats?company=vpn-saas&status=success&intent=billing_and_subscription_issues&limit=20" -H "$AGENT"
curl "$API/chats?cursor=<next_cursor>" -H "$AGENT"
curl $API/chats/<chat_id> -H "$AGENT"                 # routing trace, tool calls, actions
curl -X POST $API/chats/<chat_id>/feedback -H "$AGENT" -H "$JSON" \
     -d '{"correct_intent_keys":["billing_and_subscription_issues","connection_failures"]}'

# Proposed actions (agent approves; executes exactly once)
curl $API/chats/<chat_id>/actions -H "$AGENT"
curl -X POST $API/chats/<chat_id>/actions/<action_id>/approve -H "$AGENT"
curl -X POST $API/chats/<chat_id>/actions/<action_id>/reject -H "$AGENT" -H "$JSON" -d '{"reason":"store credit"}'

# Integrations (admin)
curl $API/capabilities -H "$ADMIN"
curl -X POST $API/companies/bookshop/secrets -H "$ADMIN" -H "$JSON" -d '{"name":"orders_api","value":"sk-…"}'
curl $API/companies/bookshop/secrets -H "$ADMIN"                       # names only
curl -X DELETE $API/companies/bookshop/secrets/orders_api -H "$ADMIN"
#   HTTP API binding
curl -X PUT $API/companies/bookshop/capability-bindings/order.get -H "$ADMIN" -H "$JSON" -d '{
  "adapter_type":"http",
  "config":{"method":"GET","url":"https://api.bookshop.example/orders/{order_id}",
            "auth_secret":"orders_api","response_path":"data"},"policy":{}}'
#   Read-only SQL binding (DSN stored as a secret)
curl -X PUT $API/companies/bookshop/capability-bindings/shipment.track -H "$ADMIN" -H "$JSON" -d '{
  "adapter_type":"sql_readonly",
  "config":{"dsn_secret":"orders_db","statement":"SELECT status, eta FROM shipments WHERE order_id = :order_id"}}'
#   MCP server binding
curl -X POST $API/companies/bookshop/mcp-servers -H "$ADMIN" -H "$JSON" \
     -d '{"name":"orders","url":"https://mcp.bookshop.example/mcp","auth_secret_name":"mcp_token"}'
curl $API/companies/bookshop/mcp-servers -H "$ADMIN"
curl -X PATCH $API/companies/bookshop/mcp-servers/<server_id> -H "$ADMIN" -H "$JSON" -d '{"url":"https://…"}'
curl -X POST $API/companies/bookshop/mcp-servers/<server_id>/discover -H "$ADMIN"
curl -X PUT $API/companies/bookshop/capability-bindings/order.get -H "$ADMIN" -H "$JSON" -d '{
  "adapter_type":"mcp","config":{"server_id":"<server_id>","tool_name":"lookup_order","arg_map":{"order_id":"id"}}}'
#   Lifecycle: test (dry run) -> go-live; writes take a policy
curl -X POST $API/companies/bookshop/capability-bindings/order.get/test -H "$ADMIN" -H "$JSON" \
     -d '{"sample_args":{"order_id":"1001"}}'
curl -X POST $API/companies/bookshop/capability-bindings/order.get/go-live -H "$ADMIN"
curl -X PUT $API/companies/bookshop/capability-bindings/refund.create -H "$ADMIN" -H "$JSON" \
     -d '{"adapter_type":"mock","config":{"store":"bookshop_orders"},"policy":{"max_amount":50}}'
curl $API/companies/bookshop/capability-bindings -H "$ADMIN"
curl $API/companies/bookshop/capability-bindings/order.get -H "$ADMIN"
curl -X DELETE $API/companies/bookshop/capability-bindings/order.get -H "$ADMIN"
curl -X DELETE $API/companies/bookshop/mcp-servers/<server_id> -H "$ADMIN"

# Routing evals (admin)
curl $API/companies/bookshop/eval-cases -H "$ADMIN"
curl -X POST $API/companies/bookshop/eval-cases -H "$ADMIN" -H "$JSON" \
     -d '{"message":"my parcel never arrived","expected_intent_keys":["shipping_delays"]}'
curl -X POST $API/internal/evals/routing -H "$ADMIN" -H "$JSON" -d '{"company":"bookshop","mode":"full"}'
curl "$API/internal/evals/routing/runs?company=bookshop" -H "$ADMIN"
curl $API/internal/evals/routing/runs/<run_id> -H "$ADMIN"

# Metrics (admin)
curl "$API/internal/metrics/summary?from=2026-11-01T00:00:00Z&company=bookshop" -H "$ADMIN"
open "$API/internal/dashboard?key=<admin-key>"
curl http://127.0.0.1:8000/metrics -H "$ADMIN"
```

Error codes:
- **Companies and guidelines:** `COMPANY_NOT_FOUND`, `COMPANY_EXISTS`, `VERSION_NOT_FOUND`, `NO_ACTIVE_GUIDELINES`, `VERSION_NOT_READY`, `VERSION_NOT_APPROVED`, `VERSION_IS_ACTIVE`, `DUPLICATE_GUIDELINES`
- **Uploads:** `INVALID_FILE`, `UNSUPPORTED_FORMAT`, `FILE_TOO_LARGE`, `COMPILE_ERROR`
- **Integrations and actions:** `CAPABILITY_NOT_BOUND`, `BINDING_NOT_TESTED`, `POLICY_VIOLATION`, `ACTION_NOT_PENDING`, `TOOL_ERROR`
- **Chats:** `CHAT_NOT_FOUND`
- **Auth:** `UNAUTHORIZED`, `FORBIDDEN`
- **Upstream failures:** `LLM_ERROR`, `RETRIEVAL_ERROR`
- **General:** `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `INTERNAL_ERROR`

---

## Tests

| Command | What it runs |
|---|---|
| `make test-unit` | Fast unit tests with no Docker or Postgres. Only the repository unit test uses in-memory SQLite. |
| `make test-integration` | All integration tests against a fresh in-memory PGlite + pgvector server; it starts and stops automatically. |
| `make test-integration-postgres` | The same suite against real Postgres + pgvector (`TEST_DATABASE_URL`). |
| `make test` | Unit and integration tiers; the integration tier uses ephemeral PGlite. |
| `make test-live` | Opt-in: real Gemini compiler, router, generator and embeddings (needs `GOOGLE_API_KEY` and `bookshop.txt`). |
| `make eval` | Routing evals for the seed companies' active versions. |

No non-live test needs a Gemini key. They use:
- `DeterministicFakeEmbedding(size=768)`;
- the heuristic compiler, example generator and router (`app/ai/heuristic.py`);
- a fake generator that builds output from the context;
- a scripted tool-calling model;
- mock adapters;
- an **in-process MCP server** (`MCPServer` from the `mcp` SDK).

The default integration harness starts a dedicated in-memory PGlite socket server, recreates its
`public` schema, runs `alembic upgrade head`, truncates every table between tests, and stops the
server at session end. It requires Node.js and `npm install`, but not Docker. In explicit Postgres
mode it instead drops and recreates `TEST_DATABASE_URL`, whose database name must end in `_test`.

No hosted CI pipeline is configured. Before pushing, run the same checks locally:
1. `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy app` and `make test-unit`.
2. `make test-integration`; before release, also run `make test-integration-postgres` against local
   Supabase (Postgres 17 + pgvector, the same major version as hosted Supabase).

---

## Future work (out of scope)

- Multi-turn threads, SSO and per-company RBAC.
- A queue worker for ingestion and action execution. Both functions are already queue-ready.
- Multilingual messages.
- PDF/DOCX/OCR parsers (the interface exists).
- Native OAuth connectors (Shopify, Stripe, Zendesk…) and OpenAPI import (the adapter interface allows them).
- KMS/Vault secret store.
- Per-company tool rate limits.
- Recompiling an existing version.
- Cross-encoder re-ranking.
- LLM-judge evals of reply quality.
- Partitioning playbook tables by company.
- Streaming responses.
- LangGraph checkpointing (human-in-the-loop resume).
