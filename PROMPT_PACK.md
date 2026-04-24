# HLD4AI Prompt Pack — Name Availability Intelligence Platform

## Working Product Name
NameForge

## Product Purpose
Build a web application that allows a user to enter a proposed company or product name and receive an availability and risk report covering:

- Domain name availability
- Company name availability
- Trademark availability
- Similarity risks
- Evidence sources
- Exportable report

The system must not provide legal advice. It provides structured availability intelligence and risk indicators.

---

# 1. Claude Code System Prompt

You are acting as a senior full-stack software engineer and solution architect.

Build a production-quality MVP for a name availability intelligence platform.

Use:
- TypeScript
- Node.js
- Fastify
- PostgreSQL
- React
- Clean architecture
- Adapter pattern for external registry connectors
- Test-first implementation where practical

Priorities:
1. Correctness
2. Clear separation of concerns
3. Extensible connector model
4. Evidence capture
5. Simple user experience
6. Avoid hard-coding jurisdiction logic into core services

Do not build throwaway prototype code. Build maintainable product code.

---

# 2. MVP Scope

The MVP must allow a user to:

1. Enter a proposed name
2. Select search jurisdictions:
   - France
   - United Kingdom
   - European Union
3. Select desired checks:
   - Domains
   - Company registries
   - Trademarks
4. Run a search
5. See a scored report
6. Export the report as Markdown and JSON

PDF export may be stubbed initially.

---

# 3. Initial Technical Architecture

## Backend

Use:

- Node.js
- Fastify
- TypeScript
- PostgreSQL
- Zod for validation
- Prisma or Drizzle ORM
- Vitest for tests

Backend modules:

```text
src/
  app.ts
  server.ts

  config/
    env.ts

  modules/
    search/
      search.routes.ts
      search.controller.ts
      search.service.ts
      search.types.ts

    domains/
      domain.adapter.ts
      rdap.adapter.ts
      domain.service.ts

    registries/
      registry.adapter.ts
      france-inpi.adapter.ts
      uk-companies-house.adapter.ts
      registry.service.ts

    trademarks/
      trademark.adapter.ts
      inpi-trademark.adapter.ts
      euipo.adapter.ts
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
    schema.ts
    migrations/

  tests/
```

---

# 4. Frontend Scope

Use:

* React
* TypeScript
* Vite or Next.js
* Simple, clean UI

Screens:

1. Search page
2. Results dashboard
3. Evidence detail view
4. Export report view

UI requirements:

* Single primary search box
* Jurisdiction selector
* Check-type selector
* Results grouped by:

  * Domains
  * Companies
  * Trademarks
* Overall risk score
* Clear “not legal advice” disclaimer

---

# 5. Domain Model

Core entities:

```ts
type SearchRequest = {
  id: string;
  proposedName: string;
  normalisedName: string;
  jurisdictions: Jurisdiction[];
  checks: CheckType[];
  createdAt: string;
};

type Jurisdiction = "FR" | "UK" | "EU";

type CheckType = "DOMAIN" | "COMPANY" | "TRADEMARK";

type SearchResult = {
  id: string;
  searchRequestId: string;
  checkType: CheckType;
  jurisdiction?: Jurisdiction;
  source: string;
  status: ResultStatus;
  confidence: number;
  riskScore: number;
  findings: Finding[];
  evidence: EvidenceRecord[];
  createdAt: string;
};

type ResultStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "SIMILAR_FOUND"
  | "UNKNOWN"
  | "ERROR";

type Finding = {
  title: string;
  description: string;
  matchedName?: string;
  similarityScore?: number;
  riskReason?: string;
};

type EvidenceRecord = {
  id: string;
  sourceName: string;
  sourceUrl?: string;
  retrievedAt: string;
  rawReference?: string;
  summary: string;
};
```

---

# 6. API Contract

## Create Search

```http
POST /api/searches
```

Request:

```json
{
  "proposedName": "CRANIS2",
  "jurisdictions": ["FR", "UK", "EU"],
  "checks": ["DOMAIN", "COMPANY", "TRADEMARK"],
  "domains": [".com", ".fr", ".eu", ".dev"]
}
```

Response:

```json
{
  "searchId": "uuid",
  "status": "QUEUED"
}
```

---

## Get Search Result

```http
GET /api/searches/:id
```

Response:

```json
{
  "searchId": "uuid",
  "proposedName": "CRANIS2",
  "overallRiskScore": 24,
  "overallRiskLevel": "LOW_MODERATE",
  "results": []
}
```

---

## Export Report

```http
GET /api/searches/:id/report.md
GET /api/searches/:id/report.json
```

---

# 7. Risk Scoring Rules

Risk score range:

```text
0   = no known risk
100 = very high risk
```

Risk levels:

```text
0-20   LOW
21-45  LOW_MODERATE
46-70  MODERATE
71-90  HIGH
91-100 CRITICAL
```

Scoring inputs:

* Exact match found
* Similar match found
* Same jurisdiction
* Same trademark class
* Domain unavailable
* Phonetic similarity
* String similarity
* Semantic proximity
* Source confidence

Initial algorithm:

```ts
riskScore =
  exactMatchWeight +
  similarityWeight +
  jurisdictionWeight +
  classOverlapWeight +
  domainAvailabilityWeight;
```

All risk scoring must be explainable.

---

# 8. Similarity Engine

Implement:

* Normalisation
* Case folding
* Accent stripping
* Whitespace removal
* Hyphen removal
* Levenshtein distance
* Jaro-Winkler similarity
* Optional phonetic similarity

Example variants:

```text
CRANIS2
CRANIS 2
Cranis Two
Cranis
Kranis
```

---

# 9. Connector Design

All connectors must implement a common interface:

```ts
export interface AvailabilityConnector<TRequest, TResult> {
  name: string;
  sourceType: "DOMAIN" | "COMPANY" | "TRADEMARK";

  search(request: TRequest): Promise<TResult>;

  isAvailable(result: TResult): boolean | null;

  summarise(result: TResult): EvidenceRecord[];
}
```

Initial connectors:

* RDAP domain connector
* Stub INPI company connector
* Stub Companies House connector
* Stub INPI trademark connector
* Stub EUIPO connector

Use stubs first if public API integration is not immediately available.

---

# 10. Non-Functional Requirements

## Deliverability

* Modular connector architecture
* Simple local development
* Docker Compose support
* Automated tests
* Clear environment configuration

## Affordability

* Cache external searches
* Avoid paid APIs in MVP where possible
* Use open data first
* Store only necessary evidence

## Desirability

* Results in under 10 seconds where possible
* Clear risk explanation
* Simple one-screen result summary
* Exportable evidence report

---

# 11. Security Requirements

* No sensitive personal data required
* Rate-limit public endpoints
* Validate all inputs
* Escape all report output
* Log errors without leaking API keys
* Store API keys only in environment variables

---

# 12. Compliance / Disclaimer Requirement

Every report must include:

```text
This report provides automated availability intelligence only. It is not legal advice, does not guarantee registrability, and should not replace professional trademark or legal review.
```

---

# 13. Initial Epics

## Epic 1 — Search Intake

User can submit a proposed name and select checks.

## Epic 2 — Domain Availability

System checks selected TLDs and returns availability.

## Epic 3 — Company Registry Checks

System checks company-name availability through jurisdiction adapters.

## Epic 4 — Trademark Checks

System checks trademark conflicts through trademark adapters.

## Epic 5 — Risk Scoring

System produces explainable risk score and risk level.

## Epic 6 — Reporting

System exports Markdown and JSON evidence reports.

---

# 14. First Implementation Task for Claude Code

Create the initial repository structure for a TypeScript Fastify backend and React frontend.

Include:

* Docker Compose with PostgreSQL
* Backend health endpoint
* Search API skeleton
* In-memory connector stubs
* Basic risk scoring service
* Basic React search form
* Basic results view
* Unit tests for:

  * name normalisation
  * similarity scoring
  * risk scoring
  * search request validation

Do not integrate live external APIs yet. Create clean adapter interfaces and stubs first.

---

# 15. Definition of Done for MVP

The MVP is complete when:

* A user can enter a proposed name
* Domain checks return structured results
* Registry and trademark connectors return stubbed or live results
* Risk score is generated
* Evidence is stored
* Markdown and JSON reports can be exported
* System runs locally via Docker Compose
* Core services have unit tests
