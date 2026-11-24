# Support Guidance Assistant: web console

A Next.js front end for the FastAPI back end in the repository root. Support agents use it to get
guidance and approve actions. Admins use it to manage guidelines, integrations, evals and metrics.

## Run it

Prerequisites: Node.js 22 or newer (tested with 24), and the API running on `http://127.0.0.1:8000`
(see the root README).

```bash
cd frontend
cp .env.example .env.local   # only needed if the API is not on 127.0.0.1:8000
npm install
npm run dev                  # http://127.0.0.1:3000
```

Sign in with a key from the API's `AGENT_API_KEYS` or `ADMIN_API_KEYS`. With the local defaults
these are `change-me-agent-key` and `change-me-admin-key`.

| Command | Purpose |
|---|---|
| `npm run dev` | dev server on port 3000 |
| `npm run build` / `npm start` | production build and server |
| `npm run lint` / `npm run typecheck` | ESLint (Next config) and `tsc --noEmit` |
| `npm test` | unit tests (Node's built-in test runner, no extra dependencies) |

## How it talks to the API

```
browser ──/api/proxy/*──▶ Next.js route handler ──X-API-Key──▶ FastAPI /api/v1/*
```

The browser never calls the API directly, and the API key never reaches JavaScript.

- `POST /api/session` checks the key against the API. It probes `GET /companies` for agent access
  and `GET /capabilities` for admin access.
- It then stores the key in an **httpOnly, SameSite=Strict** cookie. A second, readable cookie holds
  only the role (`agent` or `admin`), which the UI uses to hide admin pages.
- The back end still enforces every permission (401/403).
- `app/api/proxy/[...path]/route.ts` forwards the method, query, JSON or multipart body and
  `X-Request-ID`. It adds `X-API-Key` from the cookie and passes the API's status and error body
  through unchanged. Path segments are re-encoded, so a request can't escape `/api/v1`.
- Because only the Next.js server talks to the API, the API needs no CORS setup.
- `proxy.ts` (the Next.js 16 replacement for middleware) redirects visitors without a session to
  `/login`.
- `BACKEND_URL` (server-side only) sets where the API lives.

## Pages

**Agent pages**

| Path | What it does |
|---|---|
| `/assist` | Paste a customer message and get the recommended reply (with copy), confidence and escalation, detected intents with steps marked AI / AI verified / needs approval / agent, missing info, references, and proposed actions to approve or reject. |
| `/chats` | History with filters (company, status, intent, from/to) and cursor paging. |
| `/chats/[id]` | Guidance, routing (candidates with RRF/vector/text scores, entities), tool calls, actions, references, models/latency/tokens, and routing feedback. Feedback creates an eval case. |

**Admin pages**

| Path | What it does |
|---|---|
| `/companies` | List and create companies. |
| `/companies/[slug]/guidelines` | Upload `.txt` files (polls while compiling). Versions can be approved, rejected, activated (rollback), deleted or downloaded. |
| `…/guidelines/[n]` | Version metadata, validation warnings, section and capability coverage, and the source text. |
| `…/guidelines/[n]/playbook` | Intents and their steps (with capabilities), company rules, facts and sections. |
| `/companies/[slug]/integrations` | Capability bindings (mock / http / sql_readonly / mcp) with test → go-live, MCP servers with tool discovery, and write-only secrets. |
| `/evals`, `/evals/runs/[id]` | Run retrieval or full routing evals, compare runs, view per-intent accuracy, confusions and per-case results, and manage eval cases. |
| `/metrics` | KPI tiles and charts for volume, companies, intents, tool outcomes and confidence (each chart has a table view), plus routing, tools and ingestion stats. |

The company switcher in the top bar sets the company used by Assist, evals and the per-company
admin pages. The choice is remembered in `localStorage`.

## Dependencies

All versions are pinned exactly (`.npmrc` sets `save-exact=true`). Each was chosen as the newest
stable release published at least one month before the build (2026-11-23).

- **ESLint** is on 9.39.5 because `eslint-config-next` 16.4.2's plugins don't support ESLint 10.
- **TypeScript** is on 5.9.3 rather than 7.x.
- **Vitest** was dropped. Its optional peer ranges crash the npm 10 resolver, so the tests use
  `node --test` instead.
- **Next.js 16.4.2 has known advisories** (see `npm audit`). They are fixed in 16.4.6, which was
  released on 2026-11-09, inside the one-month window. `next build` prints a security notice and
  stops on the first run; running it again completes the build.
