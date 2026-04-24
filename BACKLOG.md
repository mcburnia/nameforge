# NameForge — Active Backlog

Updated: 2026-04-24

Authoritative backlog lives in Jira project NMF on lomancavendish.atlassian.net. This file is the in-repo view for session planning.

## In Progress

- Stage 1 foundation — Prisma schema and initial migration

## Completed

### Stage 0 — Setup

- [x] Session capture wired (`.claude/hooks.json`, `.claude/.env`, `scripts/capture-session.sh`)
- [x] Dedicated evidence repo at `/Users/andimcburnie/nameforge-evidence` (independent of PIICII / KeepUsHonest)
- [x] Monorepo structure with pnpm workspaces (`api/`, `web/`, root `package.json`, `pnpm-workspace.yaml`)
- [x] `.gitignore` with credential exclusions per PROJECT-SCAFFOLD.md §8 (and `.env.example` allowance)
- [x] `api/` scaffold: Fastify 5 + TypeScript strict + Zod env + Vitest + `GET /health`
- [x] `web/` scaffold: React 18 + Vite 5 + Tailwind + brand palette + disclaimer footer
- [x] Docker Compose with `nmf-db` (Postgres 16), `nmf-api`, `nmf-web` on ports 5434/3002/5174
- [ ] Jira project NMF on lomancavendish.atlassian.net — **deferred (requires human action)**

## Next Up (MVP)

### Stage 1 — Foundation

- Docker Compose stack: nmf-db (Postgres 16), nmf-api (Fastify/TypeScript), nmf-web (React/Vite)
- Dockerfiles for api and web, `.dockerignore`
- Backend health endpoint `GET /health`
- Prisma schema for SearchRequest, SearchResult, Finding, EvidenceRecord + enums (Jurisdiction, CheckType, ResultStatus)
- Initial migration and seed script

### Stage 2 — Core Services (stubs first, no live APIs)

- Name normalisation service (case fold, accent strip, whitespace/hyphen strip) + unit tests
- Similarity service (Levenshtein, Jaro-Winkler) + unit tests against CRANIS2 variants
- Risk scoring service with explainable contributions + unit tests
- Zod validation schemas for search request + unit tests
- `AvailabilityConnector` interface and in-memory stubs for domain, company, trademark

### Stage 3 — Search API

- `POST /api/searches` — create search, dispatch to stub connectors, persist results + evidence
- `GET /api/searches/:id` — return aggregated results with overall risk score and level
- `GET /api/searches/:id/report.md` — Markdown exporter (with disclaimer)
- `GET /api/searches/:id/report.json` — JSON exporter (with disclaimer)

### Stage 4 — Frontend MVP

- App shell (Tailwind, React Router, minimal nav)
- Search page: name input, jurisdiction multi-select (FR/UK/EU), check-type multi-select (DOMAIN/COMPANY/TRADEMARK), TLD list
- Results dashboard: grouped by check type, overall risk score/level, per-finding risk reason
- Evidence detail view: per-finding source, URL, retrieved-at, summary
- Export page: Markdown and JSON download links
- Disclaimer visible on results and embedded in exports

### Stage 5 — First Live Connector

- RDAP domain connector with caching by (connector, normalised input)
- Graceful degradation when RDAP returns non-200 or rate-limits
- Integration test against a known-registered domain and a known-free domain

## Future Considerations

- INPI (France) company and trademark connectors — live
- Companies House (UK) connector — live
- EUIPO trademark connector — live
- Phonetic similarity (Metaphone/Double Metaphone) for expanded SIMILAR_FOUND coverage
- Semantic proximity (embedding-based) for brand-name fuzziness beyond string distance
- PDF report exporter
- Persistent user accounts and saved-search history
- Rate limiting and abuse protection on public endpoints
- Scheduled re-checks (watchlist) — alert when a previously available name becomes unavailable
- Visual score breakdown in the UI (stacked-bar showing each contribution)

## Parked

- Live API integrations — parked until adapter interfaces are proven against stubs end-to-end
- PDF export — parked; Markdown and JSON cover MVP DoD
