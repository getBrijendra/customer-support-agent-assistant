# Support Guidance Assistant — developer commands.
# Uses the Supabase CLI if installed, otherwise falls back to `npx supabase`.
SUPABASE ?= $(shell command -v supabase >/dev/null 2>&1 && echo supabase || echo npx supabase)
UV ?= uv
RUN = $(UV) run

.PHONY: help install db-pglite db-up db-down db-reset db-status migrate seed seed-offline eval run test-unit test-integration test-integration-postgres test test-live lint format typecheck check

help:
	@echo "install | db-pglite | db-up | db-down | db-reset | db-status | migrate | seed | seed-offline | eval | run"
	@echo "test-unit | test-integration | test-integration-postgres | test | test-live | lint | format | typecheck | check"
	@echo "fe-install | fe-dev | fe-build | fe-start | fe-check"

install:
	$(UV) sync
	npm install

db-pglite:     ## foreground local PGlite server; use Ctrl+C to stop
	npm run db:pglite

db-up:          ## start local Supabase + create the integration-test database
	$(SUPABASE) start
	$(RUN) python scripts/create_test_db.py

db-down:
	$(SUPABASE) stop

db-status:
	$(SUPABASE) status

db-reset:       ## wipe local DB, re-apply Alembic schema, re-seed
	$(SUPABASE) db reset
	$(RUN) alembic upgrade head
	$(RUN) python scripts/create_test_db.py
	$(RUN) python scripts/seed.py

migrate:
	$(RUN) alembic upgrade head

seed:          ## compile + seed both companies (real Gemini) and bind mock capabilities
	$(RUN) python scripts/seed.py

seed-offline:  ## same, with the heuristic compiler (no LLM calls for compilation)
	$(RUN) python scripts/seed.py --fake-compiler

eval:          ## routing evals for the seed companies' active versions
	$(RUN) python scripts/run_evals.py

run:
	$(RUN) uvicorn app.main:app --reload

test-unit:
	$(RUN) pytest -m unit

test-integration:
	$(RUN) pytest -m integration

test-integration-postgres:
	$(RUN) pytest -m integration --integration-db=postgres

test:
	$(RUN) pytest -m "unit or integration"

test-live:
	$(RUN) pytest -m live

lint:
	$(RUN) ruff check .
	$(RUN) ruff format --check .

format:
	$(RUN) ruff format .
	$(RUN) ruff check --fix .

typecheck:
	$(RUN) mypy app

check: lint typecheck test

# ---------------------------------------------------------------- frontend (Next.js, ./frontend)
.PHONY: fe-install fe-dev fe-build fe-start fe-check

fe-install:
	cd frontend && npm install

fe-dev:        ## Next.js dev server on http://127.0.0.1:3000 (needs the API on :8000)
	cd frontend && npm run dev

fe-build:
	cd frontend && npm run build

fe-start:
	cd frontend && npm run start

fe-check:      ## lint + typecheck + unit tests for the frontend
	cd frontend && npm run lint && npm run typecheck && npm test
