import type { CheckType, Jurisdiction, ResultStatus } from '@prisma/client';
import type { EvidenceSummary } from '../connectors/availability.connector.js';
import type { DomainResult } from '../domains/domain.types.js';
import type { RegistryResult } from '../registries/registry.types.js';
import type { TrademarkResult } from '../trademarks/trademark.types.js';
import {
  RISK_WEIGHTS,
  scoreFromContributions,
  type RiskContribution,
} from '../risk/scoring.js';

export interface FindingInput {
  title: string;
  description: string;
  matchedName?: string | null;
  similarityScore?: number | null;
  riskReason?: string | null;
}

export interface ScoredConnectorResult {
  checkType: CheckType;
  jurisdiction: Jurisdiction | null;
  source: string;
  status: ResultStatus;
  confidence: number;
  riskScore: number;
  contributions: RiskContribution[];
  findings: FindingInput[];
  evidenceSummaries: EvidenceSummary[];
}

export interface ScoringContext {
  requestedJurisdictions: readonly Jurisdiction[];
}

export function mapDomainResult(
  result: DomainResult,
  evidenceSummaries: EvidenceSummary[],
): ScoredConnectorResult {
  const status: ResultStatus =
    result.status === 'AVAILABLE'
      ? 'AVAILABLE'
      : result.status === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : result.status === 'ERROR'
          ? 'ERROR'
          : 'UNKNOWN';

  const contributions: RiskContribution[] = [];
  const findings: FindingInput[] = [];

  if (result.status === 'UNAVAILABLE') {
    contributions.push({
      label: 'domain-unavailable',
      points: RISK_WEIGHTS.DOMAIN_UNAVAILABLE,
      reason: `Domain ${result.fqdn} is not available.`,
      evidenceRef: result.rawReference,
    });
    findings.push({
      title: `${result.fqdn} is not available`,
      description:
        result.notes ?? `Domain ${result.fqdn} is already registered per ${result.source}.`,
      riskReason: `${result.fqdn} unavailable contributes +${RISK_WEIGHTS.DOMAIN_UNAVAILABLE} to risk.`,
    });
  } else if (result.status === 'AVAILABLE') {
    findings.push({
      title: `${result.fqdn} appears available`,
      description:
        result.notes ?? `No registration detected for ${result.fqdn} via ${result.source}.`,
    });
  } else {
    findings.push({
      title: `${result.fqdn}: status ${result.status}`,
      description:
        result.notes ??
        `${result.source} returned status ${result.status} for ${result.fqdn}.`,
    });
  }

  const scored = scoreFromContributions(contributions);
  return {
    checkType: 'DOMAIN',
    jurisdiction: null,
    source: result.source,
    status,
    confidence: 1,
    riskScore: scored.score,
    contributions: scored.contributions,
    findings,
    evidenceSummaries,
  };
}

export function mapRegistryResult(
  result: RegistryResult,
  evidenceSummaries: EvidenceSummary[],
  ctx: ScoringContext,
): ScoredConnectorResult {
  const status: ResultStatus =
    result.status === 'AVAILABLE'
      ? 'AVAILABLE'
      : result.status === 'EXACT_MATCH'
        ? 'UNAVAILABLE'
        : result.status === 'SIMILAR_FOUND'
          ? 'SIMILAR_FOUND'
          : result.status === 'ERROR'
            ? 'ERROR'
            : 'UNKNOWN';

  const contributions: RiskContribution[] = [];
  const findings: FindingInput[] = [];
  const jurisdictionRelevant = ctx.requestedJurisdictions.includes(result.jurisdiction);

  for (const match of result.matches) {
    const isExact = match.similarityScore === 1;
    const points = isExact
      ? RISK_WEIGHTS.EXACT_COMPANY_MATCH
      : RISK_WEIGHTS.SIMILAR_COMPANY_MATCH;
    const reason = isExact
      ? `Exact match with active ${result.jurisdiction} company '${match.registeredName}'.`
      : `Similar ${result.jurisdiction} company '${match.registeredName}'${
          match.similarityScore !== undefined
            ? ` (similarity ${match.similarityScore.toFixed(2)})`
            : ''
        }.`;
    contributions.push({
      label: isExact ? 'exact-company-match' : 'similar-company-match',
      points,
      reason,
      evidenceRef: result.rawReference,
    });
    findings.push({
      title: `${result.jurisdiction} company: ${match.registeredName}`,
      description:
        `${result.jurisdiction} Companies register returned ${isExact ? 'an exact' : 'a similar'} match` +
        (match.companyNumber ? ` (${match.companyNumber})` : '') +
        (match.activeStatus ? `, status ${match.activeStatus}` : '') +
        '.',
      matchedName: match.registeredName,
      similarityScore: match.similarityScore ?? null,
      riskReason: reason,
    });
  }

  if (result.matches.length > 0 && jurisdictionRelevant) {
    contributions.push({
      label: 'same-jurisdiction-bonus',
      points: RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
      reason: `Match is in a requested jurisdiction (${result.jurisdiction}).`,
    });
  }

  if (result.matches.length === 0) {
    findings.push({
      title: `No registered companies found in ${result.jurisdiction}`,
      description: `${result.source} returned no matches above threshold for the proposed name.`,
    });
  }

  const scored = scoreFromContributions(contributions);
  return {
    checkType: 'COMPANY',
    jurisdiction: result.jurisdiction,
    source: result.source,
    status,
    confidence: result.status === 'UNKNOWN' ? 0.5 : 1,
    riskScore: scored.score,
    contributions: scored.contributions,
    findings,
    evidenceSummaries,
  };
}

export function mapTrademarkResult(
  result: TrademarkResult,
  evidenceSummaries: EvidenceSummary[],
  ctx: ScoringContext & { niceClasses?: number[] },
): ScoredConnectorResult {
  const status: ResultStatus =
    result.status === 'AVAILABLE'
      ? 'AVAILABLE'
      : result.status === 'EXACT_MATCH'
        ? 'UNAVAILABLE'
        : result.status === 'SIMILAR_FOUND'
          ? 'SIMILAR_FOUND'
          : result.status === 'ERROR'
            ? 'ERROR'
            : 'UNKNOWN';

  const contributions: RiskContribution[] = [];
  const findings: FindingInput[] = [];
  const jurisdictionRelevant = ctx.requestedJurisdictions.includes(result.jurisdiction);
  const requestedClasses = new Set<number>(ctx.niceClasses ?? []);

  for (const match of result.matches) {
    const isExact = match.similarityScore === 1;
    const points = isExact
      ? RISK_WEIGHTS.EXACT_TRADEMARK_MATCH
      : RISK_WEIGHTS.SIMILAR_TRADEMARK_MATCH;
    const reason = isExact
      ? `Exact trademark match '${match.mark}' registered in ${result.jurisdiction}.`
      : `Similar trademark '${match.mark}'${
          match.similarityScore !== undefined
            ? ` (similarity ${match.similarityScore.toFixed(2)})`
            : ''
        } registered in ${result.jurisdiction}.`;
    contributions.push({
      label: isExact ? 'exact-trademark-match' : 'similar-trademark-match',
      points,
      reason,
      evidenceRef: result.rawReference,
    });

    findings.push({
      title: `${result.jurisdiction} trademark: ${match.mark}`,
      description:
        `${result.source} returned ${isExact ? 'an exact' : 'a similar'} trademark registration` +
        (match.registrationNumber ? ` (${match.registrationNumber})` : '') +
        ` in classes [${match.niceClasses.join(', ')}]` +
        (match.status ? `, status ${match.status}` : '') +
        '.',
      matchedName: match.mark,
      similarityScore: match.similarityScore ?? null,
      riskReason: reason,
    });

    if (requestedClasses.size > 0) {
      const overlap = match.niceClasses.filter((c) => requestedClasses.has(c));
      if (overlap.length > 0) {
        contributions.push({
          label: 'trademark-class-overlap',
          points: RISK_WEIGHTS.TRADEMARK_CLASS_OVERLAP,
          reason: `NICE class overlap with '${match.mark}': [${overlap.join(', ')}].`,
          evidenceRef: result.rawReference,
        });
      }
    }
  }

  if (result.matches.length > 0 && jurisdictionRelevant) {
    contributions.push({
      label: 'same-jurisdiction-bonus',
      points: RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
      reason: `Match is in a requested jurisdiction (${result.jurisdiction}).`,
    });
  }

  if (result.matches.length === 0) {
    findings.push({
      title: `No registered trademarks found in ${result.jurisdiction}`,
      description: `${result.source} returned no matches above threshold for the proposed name.`,
    });
  }

  const scored = scoreFromContributions(contributions);
  return {
    checkType: 'TRADEMARK',
    jurisdiction: result.jurisdiction,
    source: result.source,
    status,
    confidence: result.status === 'UNKNOWN' ? 0.5 : 1,
    riskScore: scored.score,
    contributions: scored.contributions,
    findings,
    evidenceSummaries,
  };
}
