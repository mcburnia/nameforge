import type { CheckType, Jurisdiction, ResultStatus } from '@prisma/client';
import type { RiskLevel } from '../risk/scoring.js';

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
