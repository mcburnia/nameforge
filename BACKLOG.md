# NameForge — Active Backlog

Updated: 2026-04-24

Authoritative backlog lives in Jira project NMF on lomancavendish.atlassian.net. This file is the in-repo view for session planning.

## In Progress

- INPI (France) company and trademark connectors — live
- EUIPO trademark connector — live

## Completed

### Stage 6 — Companies House (UK)

- [x] `createCompaniesHouseConnector` implementing `RegistryConnector` against `https://api.company-information.service.gov.uk/search/companies` with HTTP Basic auth
- [x] Uses shared `similarityScore` (Levenshtein + Jaro-Winkler) and `TtlCache` — replaces the stub's local overlap proxy for live UK lookups
- [x] Filters by active company status; dissolved / removed / closed are excluded from matches
- [x] `createRegistryDispatch` routes per-jurisdiction so UK can go live while FR/EU stay on the stub; `SearchService` unchanged
- [x] `COMPANIES_HOUSE_API_KEY` opt-in env var — missing key keeps UK on the stub
- [x] `/health` now reports `connectors.company.{UK, FR, EU}` individually
- [x] End-to-end verified: without a key everything stays stubbed; with a placeholder key `/health` reports UK → `companies-house` and the adapter correctly rejects the fake credential (401 → UNKNOWN)
- [x] 16 new unit tests (142 total)

### Stage 5 — First Live Connector

- [x] Generic TTL cache with injectable clock, max-entries cap, expired-first eviction
- [x] IANA RDAP bootstrap loader (RFC 7484) with HTTPS preference, concurrent-load dedup, 24h TTL
- [x] Live RDAP domain connector implementing `DomainConnector`: 200→UNAVAILABLE (extracts registrar + dates), 404→AVAILABLE, 429→UNKNOWN with retry-after, 5xx→ERROR, timeout/network→ERROR, unknown TLD→UNKNOWN without fetch
- [x] Caches AVAILABLE/UNAVAILABLE by fqdn; does not cache transient failures
- [x] `DOMAIN_CONNECTOR` env flag (`stub` | `rdap`), default `stub` so fresh clone works offline
- [x] `GET /health` reports active connectors
- [x] `vitest setupFiles` loads `api/.env` so env-importing app.ts works in tests without dotenv dependency
- [x] End-to-end verified against real RDAP: `example.com` → UNAVAILABLE with IANA registrar evidence, `nameforge-liveprobe-9f4c2b.com` → AVAILABLE with RFC 7480 §5.3 note
- [x] 27 new unit tests (126 total)

### Stage 4 — Frontend MVP

- [x] Shared DTO types (`web/src/lib/types.ts`) mirroring backend `SearchReport`
- [x] `DISCLAIMER` constant in web mirroring the backend
- [x] Typed API client (`createSearch`, `getSearchReport`, `reportMarkdownUrl`, `reportJsonUrl`) with `ApiError`
- [x] `SearchForm` with client-side validation matching Zod rules, toggle chips for jurisdictions and checks, TLD field visible only when DOMAIN is selected
- [x] `ResultsDashboard` with overall `RiskBadge`, grouped results, per-finding risk reason, evidence detail (source, retrieved-at, summary, raw reference, optional sourceUrl)
- [x] `RiskBadge`, `StatusBadge`, `DisclaimerFooter` presentation components
- [x] `SearchPage` (`/`) and `ResultsPage` (`/searches/:id`) via React Router with loading, ready, not-found, and error states
- [x] Markdown and JSON export download buttons on results view
- [x] End-to-end verified via `docker compose up`: POST proxied through Vite to `nmf-api`, persisted, GET returns aggregated report, both exports work
- [x] Fixed: port 5174 collision with another local project → bumped to 5180
- [x] Fixed: Prisma client not generated inside `nmf-api` container → added `prisma generate` to Dockerfile
- [x] Fixed: Vite proxy target hardcoded to `localhost` → now env-driven (`VITE_API_PROXY_TARGET`) so it works both in Docker and on the host

### Stage 3 — Search API

- [x] `POST /api/searches` — validates with `CreateSearchRequestSchema`, runs stubs synchronously, persists nested graph via single Prisma call, returns `{ searchId, status: 'COMPLETED' }`
- [x] `GET /api/searches/:id` — returns `SearchReport` DTO with per-result findings, evidence, and `overallRiskScore` / `overallRiskLevel`
- [x] Scoring mapper converts connector results into explainable `RiskContribution[]` per check type (domain unavailability, exact/similar company/trademark, NICE class overlap, same-jurisdiction bonus)
- [x] `GET /api/searches/:id/report.md` — Markdown exporter with metacharacter escaping and disclaimer footer
- [x] `GET /api/searches/:id/report.json` — JSON exporter with `nameforge.report.v1` format marker and disclaimer
- [x] Shared `DISCLAIMER` constant enforced at the exporter, not the UI
- [x] Integration tests against real `nmf-db` verify POST persists 9 results for 3 TLDs × 3 jurisdictions × 2 checks, GET aggregates risk correctly, and 404 on unknown id
- [x] 37 new unit tests (99 total)

### Stage 2 — Core Services

- [x] `AvailabilityConnector<TReq,TRes>` interface + per-source adapter types
- [x] In-memory stubs for DOMAIN (`domain.stub.ts`), COMPANY (`registry.stub.ts`), TRADEMARK (`trademark.stub.ts`) with seed data (Cranis Limited UK, Cranisoft SAS FR, CRANIS EU trademark classes [9, 42])
- [x] `normaliseName()` — NFD accent strip, lowercase, whitespace/hyphen/underscore collapse, symbol strip
- [x] `levenshteinDistance` + `levenshteinSimilarity` (hand-rolled DP, rolling rows)
- [x] `jaroSimilarity` + `jaroWinklerSimilarity` (Winkler 1990 reference)
- [x] `similarityScore` — max of Levenshtein and Jaro-Winkler
- [x] `scoreFromContributions` — explainable rules-based scoring with defensive array copy, 0–100 clamp, banded levels (LOW / LOW_MODERATE / MODERATE / HIGH / CRITICAL)
- [x] `RISK_WEIGHTS` — named constants for exact/similar matches, jurisdiction bonus, class overlap, domain unavailability, low-confidence penalty
- [x] `CreateSearchRequestSchema` — Zod validation with TLD regex, length caps, non-empty arrays, uniqueness, and DOMAIN-requires-TLDs rule
- [x] 61 new unit tests (62 total including the health endpoint test)

### Stage 1 — Foundation

- [x] Prisma schema (enums, SearchRequest, SearchResult, Finding, EvidenceRecord) with `nmf_`-prefixed tables, UUID PKs, cascade deletes, indexed FKs
- [x] Initial migration `20260424072224_init` applied to `nmf-db`
- [x] Shared PrismaClient at `api/src/lib/prisma.ts`
- [x] `DATABASE_URL` in validated env schema
- [x] `pnpm db:*` scripts (migrate, migrate:deploy, generate, seed, reset, studio)
- [x] Idempotent seed producing sample CRANIS2 search with 2 results, 2 findings, 2 evidence records

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
