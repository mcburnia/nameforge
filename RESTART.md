# RESTART.md — NameForge

Last updated: 2026-04-24

## What is NameForge?

A name availability intelligence platform for Loman Cavendish. A user enters a proposed company or product name and receives an availability and risk report spanning domains, company registries, and trademarks across selected jurisdictions (France, United Kingdom, European Union for the MVP). The system captures evidence for every finding, produces an explainable risk score, and exports the report as Markdown and JSON.

NameForge does not provide legal advice. It provides structured availability intelligence and risk indicators.

## Architecture

Three-service Docker Compose application:

- **nmf-db** — PostgreSQL 16 (port 5434)
- **nmf-api** — Fastify REST API with Prisma ORM, TypeScript strict mode (port 3002)
- **nmf-web** — React SPA with Tailwind CSS, built with Vite (port 5174)

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
  - Docker Compose stack (`nmf-db` Postgres 16, `nmf-api`, `nmf-web`) on ports 5434/3002/5174
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

## Known Issues

- Jira project NMF still to be created on lomancavendish.atlassian.net (not blocking local development).
- Prisma pinned to 6.x (not 7.x) due to an ESM/CJS `require()` bug in `@prisma/dev` on Node 20. Revisit when Prisma 7 patches land.
- Registry stub uses a character-position overlap ratio as its internal similarity proxy; the shared `similarityScore()` will replace it when Stage 3 wires services together.
- No API endpoints for search yet — `POST /api/searches`, `GET /api/searches/:id`, and the Markdown/JSON exporters land in Stage 3.

## Current Status

**Stage 2 complete. Ready for Stage 3 (search API).**

Next session: wire the search module — `POST /api/searches` dispatches to the connector stubs, persists `SearchRequest`, `SearchResult`, `Finding`, and `EvidenceRecord` through Prisma, and `GET /api/searches/:id` returns the aggregated report with `overallRiskScore` and `overallRiskLevel`. Then Markdown and JSON exporters (`/report.md`, `/report.json`) including the "not legal advice" disclaimer enforced at the exporter.
