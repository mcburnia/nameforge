import type { PrismaClient } from '@prisma/client';
import type { DomainConnector } from '../domains/domain.adapter.js';
import type { RegistryConnector } from '../registries/registry.adapter.js';
import type { TrademarkConnector } from '../trademarks/trademark.adapter.js';
import { normaliseName } from '../risk/normalisation.js';
import {
  RISK_SCORE_MAX,
  RISK_SCORE_MIN,
  toRiskLevel,
} from '../risk/scoring.js';
import type { CreateSearchRequest } from './search.schemas.js';
import {
  mapDomainResult,
  mapRegistryResult,
  mapTrademarkResult,
  type ScoredConnectorResult,
} from './scoring-mapper.js';
import type {
  EvidenceDto,
  FindingDto,
  SearchReport,
  SearchResultDto,
} from './search.types.js';

export interface SearchServiceDeps {
  prisma: PrismaClient;
  domainConnector: DomainConnector;
  registryConnector: RegistryConnector;
  trademarkConnector: TrademarkConnector;
}

export class SearchNotFoundError extends Error {
  constructor(public readonly searchId: string) {
    super(`Search ${searchId} not found`);
    this.name = 'SearchNotFoundError';
  }
}

export function createSearchService(deps: SearchServiceDeps) {
  const { prisma, domainConnector, registryConnector, trademarkConnector } = deps;

  async function runConnectors(
    request: CreateSearchRequest,
    normalisedName: string,
  ): Promise<ScoredConnectorResult[]> {
    const scored: ScoredConnectorResult[] = [];
    const ctx = { requestedJurisdictions: request.jurisdictions };

    if (request.checks.includes('DOMAIN')) {
      for (const tld of request.domains) {
        const connectorResult = await domainConnector.search({ normalisedName, tld });
        const evidence = domainConnector.summarise(connectorResult);
        scored.push(mapDomainResult(connectorResult, evidence));
      }
    }

    if (request.checks.includes('COMPANY')) {
      for (const jurisdiction of request.jurisdictions) {
        const connectorResult = await registryConnector.search({
          normalisedName,
          jurisdiction,
        });
        const evidence = registryConnector.summarise(connectorResult);
        scored.push(mapRegistryResult(connectorResult, evidence, ctx));
      }
    }

    if (request.checks.includes('TRADEMARK')) {
      for (const jurisdiction of request.jurisdictions) {
        const connectorResult = await trademarkConnector.search({
          normalisedName,
          jurisdiction,
        });
        const evidence = trademarkConnector.summarise(connectorResult);
        scored.push(mapTrademarkResult(connectorResult, evidence, ctx));
      }
    }

    return scored;
  }

  async function createSearch(request: CreateSearchRequest): Promise<{ searchId: string }> {
    const normalisedName = normaliseName(request.proposedName);
    const scoredResults = await runConnectors(request, normalisedName);

    const searchRequest = await prisma.searchRequest.create({
      data: {
        proposedName: request.proposedName,
        normalisedName,
        jurisdictions: request.jurisdictions,
        checks: request.checks,
        domains: request.domains,
        results: {
          create: scoredResults.map((scored) => ({
            checkType: scored.checkType,
            jurisdiction: scored.jurisdiction,
            source: scored.source,
            status: scored.status,
            confidence: scored.confidence,
            riskScore: scored.riskScore,
            findings: {
              create: scored.findings.map((f) => ({
                title: f.title,
                description: f.description,
                matchedName: f.matchedName ?? null,
                similarityScore: f.similarityScore ?? null,
                riskReason: f.riskReason ?? null,
              })),
            },
            evidence: {
              create: scored.evidenceSummaries.map((e) => ({
                sourceName: e.sourceName,
                sourceUrl: e.sourceUrl ?? null,
                retrievedAt: e.retrievedAt,
                rawReference: e.rawReference ?? null,
                summary: e.summary,
              })),
            },
          })),
        },
      },
      select: { id: true },
    });

    return { searchId: searchRequest.id };
  }

  async function getSearchReport(searchId: string): Promise<SearchReport> {
    const search = await prisma.searchRequest.findUnique({
      where: { id: searchId },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
          include: {
            findings: { orderBy: { createdAt: 'asc' } },
            evidence: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!search) throw new SearchNotFoundError(searchId);

    const results: SearchResultDto[] = search.results.map((r) => {
      const findings: FindingDto[] = r.findings.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        matchedName: f.matchedName,
        similarityScore: f.similarityScore,
        riskReason: f.riskReason,
      }));
      const evidence: EvidenceDto[] = r.evidence.map((e) => ({
        id: e.id,
        sourceName: e.sourceName,
        sourceUrl: e.sourceUrl,
        retrievedAt: e.retrievedAt.toISOString(),
        rawReference: e.rawReference,
        summary: e.summary,
      }));
      return {
        id: r.id,
        checkType: r.checkType,
        jurisdiction: r.jurisdiction,
        source: r.source,
        status: r.status,
        confidence: r.confidence,
        riskScore: r.riskScore,
        createdAt: r.createdAt.toISOString(),
        findings,
        evidence,
      };
    });

    const rawOverall = results.reduce((sum, r) => sum + r.riskScore, 0);
    const overallRiskScore = Math.min(
      RISK_SCORE_MAX,
      Math.max(RISK_SCORE_MIN, rawOverall),
    );

    return {
      searchId: search.id,
      proposedName: search.proposedName,
      normalisedName: search.normalisedName,
      jurisdictions: search.jurisdictions,
      checks: search.checks,
      domains: search.domains,
      createdAt: search.createdAt.toISOString(),
      overallRiskScore,
      overallRiskLevel: toRiskLevel(overallRiskScore),
      results,
    };
  }

  return { createSearch, getSearchReport };
}

export type SearchService = ReturnType<typeof createSearchService>;
