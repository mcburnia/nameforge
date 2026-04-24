// Risk scoring is rules-based and explainable by construction.
// The score is always the sum of named, evidenced contributions — so a
// reviewer asking 'why 74?' gets a table of contributions, not an opaque
// model output. See PROMPT_PACK.md §7.

export type RiskLevel =
  | 'LOW'
  | 'LOW_MODERATE'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export interface RiskContribution {
  label: string;
  points: number;
  reason: string;
  evidenceRef?: string;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  contributions: RiskContribution[];
}

export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

export function toRiskLevel(score: number): RiskLevel {
  if (score <= 20) return 'LOW';
  if (score <= 45) return 'LOW_MODERATE';
  if (score <= 70) return 'MODERATE';
  if (score <= 90) return 'HIGH';
  return 'CRITICAL';
}

export function scoreFromContributions(
  contributions: readonly RiskContribution[],
): RiskScore {
  const raw = contributions.reduce((sum, c) => sum + c.points, 0);
  const score = Math.min(RISK_SCORE_MAX, Math.max(RISK_SCORE_MIN, Math.round(raw)));
  return {
    score,
    level: toRiskLevel(score),
    contributions: [...contributions],
  };
}

// Weights per PROMPT_PACK.md §7. Kept as named constants so they are easy to
// tune and so any scoring change is greppable in git history.
export const RISK_WEIGHTS = {
  EXACT_TRADEMARK_MATCH: 55,
  EXACT_COMPANY_MATCH: 35,
  SIMILAR_TRADEMARK_MATCH: 25,
  SIMILAR_COMPANY_MATCH: 15,
  SAME_JURISDICTION_BONUS: 5,
  TRADEMARK_CLASS_OVERLAP: 10,
  DOMAIN_UNAVAILABLE: 8,
  LOW_SOURCE_CONFIDENCE: -5,
} as const;
