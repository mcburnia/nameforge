// DTO shapes returned by the API. Kept in sync with api/src/modules/search/search.types.ts.
// The backend is the source of truth — when this drifts, migrate both in the same commit.

export type Jurisdiction = 'FR' | 'UK' | 'EU';
export type CheckType = 'DOMAIN' | 'COMPANY' | 'TRADEMARK';

export type ResultStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'SIMILAR_FOUND'
  | 'UNKNOWN'
  | 'ERROR';

export type RiskLevel = 'LOW' | 'LOW_MODERATE' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface FindingDto {
  id: string;
  title: string;
  description: string;
  matchedName: string | null;
  similarityScore: number | null;
  riskReason: string | null;
}

export interface EvidenceDto {
  id: string;
  sourceName: string;
  sourceUrl: string | null;
  retrievedAt: string;
  rawReference: string | null;
  summary: string;
}

export interface SearchResultDto {
  id: string;
  checkType: CheckType;
  jurisdiction: Jurisdiction | null;
  source: string;
  status: ResultStatus;
  confidence: number;
  riskScore: number;
  createdAt: string;
  findings: FindingDto[];
  evidence: EvidenceDto[];
}

export interface SearchReport {
  searchId: string;
  proposedName: string;
  normalisedName: string;
  jurisdictions: Jurisdiction[];
  checks: CheckType[];
  domains: string[];
  createdAt: string;
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  results: SearchResultDto[];
}

export interface CreateSearchInput {
  proposedName: string;
  jurisdictions: Jurisdiction[];
  checks: CheckType[];
  domains: string[];
}

export interface CreateSearchResponse {
  searchId: string;
  status: 'COMPLETED' | 'QUEUED';
}
