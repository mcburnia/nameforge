# NameForge — Development Session Transcript

**Project:** NameForge
**Client:** Loman Cavendish (internal product)
**Contributor:** Andi McBurnie
**Date:** 2026-04-24
**Tool:** Claude Code (Claude Opus 4.7, 1M context)
**Type:** development_session
**Session scope:** Project kickoff and documentation scaffold

---

## Session Overview

Initiated NameForge as an internal Loman Cavendish product — a name availability intelligence platform covering domains, company registries, and trademarks with evidence capture and explainable risk scoring.

This kickoff session produced the documentation scaffold only. No application code has been written. Implementation begins in the next session against the task defined in `PROMPT_PACK.md` Section 14.

---

## Work Completed

### Prompt Pack Captured

Created `PROMPT_PACK.md` covering:

- Product brief and MVP scope (domains, company registries, trademarks across FR, UK, EU)
- Technical architecture (TypeScript, Node.js, Fastify, PostgreSQL, React, clean architecture, adapter pattern)
- Backend and frontend module layouts
- Core domain model (SearchRequest, SearchResult, Finding, EvidenceRecord, status and jurisdiction enums)
- API contract (`POST /api/searches`, `GET /api/searches/:id`, Markdown and JSON report endpoints)
- Risk scoring rules (0–100, LOW / LOW_MODERATE / MODERATE / HIGH / CRITICAL bands, explainable contributions)
- Similarity engine (normalisation, Levenshtein, Jaro-Winkler, optional phonetic)
- Connector design (`AvailabilityConnector<TRequest, TResult>` interface; RDAP live, INPI/Companies House/EUIPO as stubs first)
- Non-functional requirements (deliverability, affordability, desirability)
- Security requirements (no PII, rate limits, validation, output escaping, env-only secrets)
- Compliance/disclaimer requirement (every report carries the "not legal advice" statement)
- Initial epics and first implementation task
- Definition of Done for the MVP

### Framework Adopted

Loman Cavendish framework documents copied into `scaffold/` and rebranded from their source:

- `scaffold/PRINCIPLES.md` — AI-Assisted Development Principles
- `scaffold/POLICY.md` — AI-Assisted Development Policy (including §3.5 data-safety rules)
- `scaffold/STANDARDS.md` — R&D Evidence and Documentation Standards
- `scaffold/GUIDELINES.md` — Developer Guide (including §10 Jira-driven planning with themes, epics, stories, spikes, dual estimation)
- `scaffold/PROJECT-SCAFFOLD.md` — Project Scaffold

All references to prior owner ("The AI Engineering Imperative") and prior internal product/client names (PIICII, DATAGENTICS, KeepUsHonest) have been replaced with Loman Cavendish and NameForge where appropriate.

### Project Files Initialised

- `CLAUDE.md` — NameForge operating instructions (environment, port map, architecture, key rules, Jira project NMF reference)
- `RESTART.md` — Architecture overview, backend/frontend module layout, domain model, API surface, risk scoring and similarity outline, connector interface, key design decisions, completed work, known issues, current status
- `BACKLOG.md` — Prioritised MVP backlog organised into Stage 0 (setup), Stage 1 (foundation), Stage 2 (core services with stubs), Stage 3 (search API), Stage 4 (frontend MVP), Stage 5 (first live connector), plus future considerations and parked items

---

## Key Decisions

1. **Three-service stack** — nmf-db (Postgres 16), nmf-api (Fastify), nmf-web (React/Vite), mirroring Loman Cavendish's established pattern but on distinct ports (5434, 3002, 5174) to avoid local collisions with other products.
2. **Adapter pattern first** — every source (domain, company registry, trademark office) implements a common `AvailabilityConnector` interface. Jurisdiction logic is isolated to adapters, not core services.
3. **Stubs before live APIs** — the full pipeline runs end-to-end against in-memory stubs before any paid or rate-limited external API is integrated. RDAP is the first live connector because it is free and open.
4. **Evidence-gated scoring** — no finding contributes to the risk score without an evidence record. This keeps reports reproducible without re-hitting external services and makes the score defensible.
5. **Explainable scoring by construction** — the score is a sum of named, evidenced contributions. Reviewers can trace every point back to a finding.
6. **Disclaimer enforced at the exporter** — every Markdown and JSON export carries the "not legal advice" statement. This is not a UI-only affordance.
7. **Cache external calls** — keyed by (connector, normalised input). Keeps MVP running cost low and gives deterministic test behaviour.
8. **Jira project NMF** — tracked on lomancavendish.atlassian.net, following the Loman Cavendish Guidelines §10 planning model (themes > epics > stories/spikes, dual estimation).
9. **No live APIs in the first implementation pass** — scaffold, tests, stubs, and UI first. Live RDAP wiring is Stage 5.
10. **British English** throughout documentation and UI copy.

---

## Uncertainties Identified (for later sessions)

- Similarity thresholds for classifying a finding as SIMILAR_FOUND vs AVAILABLE have not been calibrated yet. Initial thresholds will be picked and then tuned against a small labelled test set.
- The weighting between distance-based similarity and phonetic similarity is not yet decided. Phonetic is parked past MVP; may need to return to it.
- Companies House and INPI have different API shapes and auth models. The adapter interface is expected to survive both, but this needs validation once the stub-vs-live swap happens in Stage 5/6.
- Scoring contributions for "same trademark class" require an ontology of classes that the MVP does not yet model — flagged for early post-MVP work.

---

## Next Session

Execute the First Implementation Task (`PROMPT_PACK.md` §14):

- Monorepo scaffold
- Docker Compose with PostgreSQL
- Backend health endpoint
- Search API skeleton
- In-memory connector stubs
- Basic risk scoring service
- Basic React search form
- Basic results view
- Unit tests: name normalisation, similarity, risk scoring, request validation

Do not integrate live external APIs in this pass.

---

## User Preferences

- Update all MD files, commit, and push at the end of every completed task
- Save conversation transcript to `SESSION.md` at each commit point (session capture hook will handle automated archival to the evidence repo)
- Use British English throughout
- Follow propose-then-implement pattern
- UI-only interaction — everything must be accessible through the browser
- No PII or client-confidential data to reach the Anthropic API
- Every exported report must carry the "not legal advice" disclaimer
