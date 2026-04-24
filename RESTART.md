# RESTART.md — NameForge

Last updated: 2026-04-24

## What is NameForge?

A name availability intelligence platform for Loman Cavendish. A user enters a proposed company or product name and receives an availability and risk report spanning domains, company registries, and trademarks across selected jurisdictions (France, United Kingdom, European Union for the MVP). The system captures evidence for every finding, produces an explainable risk score, and exports the report as Markdown and JSON.

NameForge does not provide legal advice. It provides structured availability intelligence and risk indicators.

## Architecture

Three-service Docker Compose application:

- **nmf-db** — PostgreSQL 16 (port 5434)
- **nmf-api** — Fastify REST API with Prisma ORM, TypeScript strict mode (port 3002)
- **nmf-web** — React SPA with Tailwind CSS, built with Vite (port 5180)

### Backend Module Layout

```
api/src/
  app.ts
  server.ts
  config/
    env.ts
  lib/
    prisma.ts                         -- shared Prisma client
  modules/
    search/
      search.routes.ts
      search.controller.ts
      search.service.ts
      search.types.ts
    domains/
      domain.adapter.ts               -- interface
      rdap.adapter.ts                 -- RDAP implementation
      domain.service.ts
    registries/
      registry.adapter.ts             -- interface
      france-inpi.adapter.ts          -- stub first
      uk-companies-house.adapter.ts   -- stub first
      registry.service.ts
    trademarks/
      trademark.adapter.ts            -- interface
      inpi-trademark.adapter.ts       -- stub first
      euipo.adapter.ts                -- stub first
      trademark.service.ts
    risk/
      risk.service.ts
      similarity.service.ts
      scoring.rules.ts
    reports/
      report.service.ts
      markdown.exporter.ts
      json.exporter.ts
    evidence/
      evidence.service.ts
  db/
    schema.prisma
    migrations/
  tests/
```

### Frontend Module Layout

```
web/src/
  lib/api.ts                          -- shared fetch helper
  lib/utils.ts                        -- cn() utility
  components/AppShell.tsx
  components/SearchForm.tsx
  components/ResultsDashboard.tsx
  components/EvidenceDetail.tsx
  components/ui/                      -- Card, PageHeader
  pages/
    SearchPage.tsx
    ResultsPage.tsx
    EvidencePage.tsx
    ExportPage.tsx
  index.css                           -- Tailwind theme
```

### Core Domain Model

```
SearchRequest (id, proposedName, normalisedName, jurisdictions[], checks[], createdAt)
  +-- SearchResult (checkType, jurisdiction, source, status, confidence, riskScore)
        +-- Finding (title, description, matchedName?, similarityScore?, riskReason?)
        +-- EvidenceRecord (sourceName, sourceUrl, retrievedAt, rawReference, summary)

Jurisdiction: FR | UK | EU
CheckType:    DOMAIN | COMPANY | TRADEMARK
ResultStatus: AVAILABLE | UNAVAILABLE | SIMILAR_FOUND | UNKNOWN | ERROR
```

### API Surface

- `POST /api/searches` — create a search request
- `GET  /api/searches/:id` — fetch aggregated results with overall risk score
- `GET  /api/searches/:id/report.md` — export Markdown report
- `GET  /api/searches/:id/report.json` — export JSON report
- `GET  /health` — liveness check

### Risk Scoring

- Range: 0 (no known risk) to 100 (very high risk)
- Levels: LOW 0-20, LOW_MODERATE 21-45, MODERATE 46-70, HIGH 71-90, CRITICAL 91-100
- Explainable by construction: every point of the score is attributable to a named finding with an evidence record
- Initial weights: exact match, similarity, same jurisdiction, class overlap, domain availability, source confidence

### Similarity Engine

- Normalisation: case fold, accent strip, whitespace/hyphen strip
- Distance: Levenshtein + Jaro-Winkler
- Phonetic similarity: optional (deferred past MVP unless needed)
- Variants tested against the CRANIS2 family (CRANIS 2, Cranis Two, Cranis, Kranis)

### Connector Interface

```ts
export interface AvailabilityConnector<TRequest, TResult> {
  name: string;
  sourceType: "DOMAIN" | "COMPANY" | "TRADEMARK";
  search(request: TRequest): Promise<TResult>;
  isAvailable(result: TResult): boolean | null;
  summarise(result: TResult): EvidenceRecord[];
}
```

MVP connectors: RDAP (live), INPI company (stub), Companies House (stub), INPI trademark (stub), EUIPO (stub). Live wiring happens after the adapter interfaces have shipped and been tested against stubs.

## Key Design Decisions

- **Adapter pattern first** — every jurisdiction/source is a connector behind a single interface so that stubs and live clients are interchangeable.
- **Evidence is a first-class citizen** — no finding contributes to a score without an evidence record. This also keeps the report reproducible without re-hitting external APIs.
- **Explainable scoring** — the score is a sum of named, evidenced contributions. If a reviewer asks "why is this 74?", the answer is a table of contributions, not an opaque model output.
- **Disclaimer is part of the deliverable** — every exported report carries the "not legal advice" disclaimer. This is enforced in the exporter, not a UI afterthought.
- **Cache external calls** — keyed by (connector, normalised input) to keep MVP running costs low and to give deterministic test behaviour.
- **Stubs before live APIs** — connector stubs ship with the interface so the full pipeline runs end-to-end before any paid or rate-limited API is touched.

## Completed Work

- Product brief, architecture prompt, domain model, API contract, risk scoring rules, similarity engine outline, connector design, non-functional and security requirements, compliance/disclaimer requirement, initial epics, and first implementation task captured in `PROMPT_PACK.md` (2026-04-24)
- Loman Cavendish framework docs (Principles, Policy, Standards, Guidelines, Project-Scaffold) copied into `scaffold/` (2026-04-24)
- `CLAUDE.md`, `RESTART.md`, `BACKLOG.md`, `SESSION.md` initialised (2026-04-24)
- **Stage 0 — setup** (2026-04-24):
  - Session capture wired (`.claude/hooks.json`, `.claude/.env`, `scripts/capture-session.sh`)
  - Dedicated evidence repo at `/Users/andimcburnie/nameforge-evidence` (independent of other projects)
  - pnpm workspace established (`api/`, `web/`), Node 20 pinned via `.nvmrc`
  - `api/` scaffold: Fastify 5, Zod-validated env, Vitest, `GET /health` with passing test
  - `web/` scaffold: React 18, Vite 5, Tailwind with brand palette, `/api` proxy to nmf-api
  - Docker Compose stack (`nmf-db` Postgres 16, `nmf-api`, `nmf-web`) on ports 5434/3002/5180
- **Stage 1 — foundation** (2026-04-24):
  - Prisma 6.x schema with enums (Jurisdiction, CheckType, ResultStatus) and models (SearchRequest, SearchResult, Finding, EvidenceRecord)
  - Initial migration `20260424072224_init` applied to `nmf-db`
  - Shared PrismaClient singleton at `api/src/lib/prisma.ts`
  - `DATABASE_URL` required in validated env schema
  - `pnpm db:*` scripts (migrate, generate, seed, reset, studio)
  - Idempotent seed: sample CRANIS2 search with 2 results, 2 findings, 2 evidence records
- **Stage 2 — core services** (2026-04-24):
  - `AvailabilityConnector<TReq,TRes>` base interface + adapter types and in-memory stubs for DOMAIN, COMPANY, TRADEMARK
  - Deterministic name normalisation (NFD accent strip, lowercase, whitespace/hyphen/symbol strip)
  - Hand-rolled similarity engine — Levenshtein (DP with rolling rows) + Jaro-Winkler (Winkler 1990) + composite `similarityScore = max(…)`
  - Explainable risk scoring — `RiskContribution[]` summed, rounded, clamped to [0,100], mapped to bands; named `RISK_WEIGHTS` constants for tuning
  - Zod `CreateSearchRequestSchema` with TLD regex, length caps, uniqueness and DOMAIN-requires-TLDs rules
  - 62 passing unit tests across connectors, normalisation, similarity, scoring, schema, and the health endpoint
- **Stage 3 — search API** (2026-04-24):
  - `search.service.ts` with dependency-injected connectors for testability; `createSearch` dispatches to stubs, maps through the scoring mapper, persists the nested graph in a single Prisma call; `getSearchReport` fetches and builds the DTO with `overallRiskScore` (clamped sum) and `overallRiskLevel`
  - `scoring-mapper.ts` with pure `mapDomainResult` / `mapRegistryResult` / `mapTrademarkResult` that apply `RISK_WEIGHTS` and preserve explainable `RiskContribution[]` per result
  - `search.routes.ts`: `POST /api/searches` (201 with synchronous completion) and `GET /api/searches/:id` (404 via `SearchNotFoundError`)
  - `reports/disclaimer.ts` + Markdown and JSON exporters; disclaimer enforced at the exporter. Markdown escapes metacharacters in user-supplied fields
  - `reports/report.routes.ts`: `GET /api/searches/:id/report.md` (text/markdown) and `GET /api/searches/:id/report.json` (wrapped with `format: 'nameforge.report.v1'` and disclaimer)
  - 37 new tests, 99 total; 3 integration tests run end-to-end against `nmf-db` and clean up after themselves
- **Stage 4 — frontend MVP** (2026-04-24):
  - Shared DTO types and `DISCLAIMER` mirrored from backend; typed API client with `ApiError`
  - `SearchForm` with client-side validation matching the Zod rules, toggle chips for jurisdictions and checks, conditional TLD field
  - Presentation components: `RiskBadge`, `StatusBadge`, `DisclaimerFooter`, `ResultCard`, `ResultsDashboard`
  - Pages and routing: `SearchPage` at `/`, `ResultsPage` at `/searches/:id` with loading/ready/not-found/error states
  - Markdown and JSON download buttons on the results view
  - Port 5180 (host) for `nmf-web` to avoid collision with other local projects
  - `VITE_API_PROXY_TARGET` env var so the Vite dev proxy works both inside Docker (`http://nmf-api:3002`) and on the host (`http://localhost:3002` default)
  - `prisma generate` baked into `api/Dockerfile` so the `@prisma/client` import resolves inside the container
  - Verified end-to-end: browser loads the SPA at `localhost:5180`, POST/GET through the proxy, Markdown and JSON reports download cleanly
- **Stage 5 — first live connector (RDAP domain)** (2026-04-24):
  - Generic `TtlCache<T>` in `modules/cache/` with injectable clock (deterministic tests), max-entries guard, expired-first then oldest eviction
  - `createRdapBootstrap` fetches the IANA RFC 7484 registry once per 24h, prefers HTTPS when a TLD lists both, dedupes concurrent first-loads
  - `createRdapDomainConnector` implements `DomainConnector`: 200→UNAVAILABLE (extracts registrar from vcardArray, registration and expiration dates from `events`), 404→AVAILABLE (RFC 7480 §5.3), 429→UNKNOWN with retry-after, 5xx/timeout/network→ERROR, unknown TLD→UNKNOWN without network call. Caches terminal outcomes; transient failures retry on next request
  - Env-flag wiring via `DOMAIN_CONNECTOR` (`stub` default, `rdap` opt-in). `buildDefaultDomainConnector()` picks by env and shares `globalThis.fetch`
  - `GET /health` reports which connector is active for each source type
  - `vitest setupFiles` loads `api/.env` before `src/config/env.ts` runs; no dotenv dependency
  - Verified live end-to-end with `DOMAIN_CONNECTOR=rdap`: `example.com` → UNAVAILABLE with IANA registrar evidence, a random junk name → AVAILABLE with RFC 7480 §5.3 note

## Known Issues

- Jira project NMF still to be created on lomancavendish.atlassian.net (not blocking local development).
- Prisma pinned to 6.x (not 7.x) due to an ESM/CJS `require()` bug in `@prisma/dev` on Node 20. Revisit when Prisma 7 patches land.
- Registry and trademark stubs use a character-position overlap ratio as their internal similarity proxy; the shared `similarityScore()` will replace it when the live company / trademark connectors land.
- Integration tests require `nmf-db` to be running (`docker compose up -d nmf-db`). Test-database isolation (separate `nameforge_test` schema) deferred until the suite is large enough to warrant it.
- No frontend unit tests yet — component tests with `@testing-library/react` + `jsdom` are a deferred Stage 4.1 task. End-to-end sanity checked manually via `docker compose up` and curl.
- RDAP cache is in-process only. A Redis-backed or Prisma-backed cache replaces `TtlCache` when we need horizontal scale or cross-process sharing.

## Current Status

**Stage 5 complete — RDAP live. Stubs still drive company and trademark checks.**

Next sessions tackle the remaining live connectors one at a time behind the same adapter pattern and env-flag wiring: Companies House (UK), INPI (France) for both company and trademark, and EUIPO for EU trademarks. Each brings its own auth model (Companies House needs an API key, INPI is open, EUIPO has a public search API), so each gets its own `{SOURCE}_CONNECTOR` env flag with `stub` as the default.
