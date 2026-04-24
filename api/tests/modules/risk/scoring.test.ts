import { describe, expect, it } from 'vitest';
import {
  RISK_WEIGHTS,
  scoreFromContributions,
  toRiskLevel,
  type RiskContribution,
} from '../../../src/modules/risk/scoring.js';

describe('toRiskLevel', () => {
  it('maps the band boundaries per PROMPT_PACK §7', () => {
    expect(toRiskLevel(0)).toBe('LOW');
    expect(toRiskLevel(20)).toBe('LOW');
    expect(toRiskLevel(21)).toBe('LOW_MODERATE');
    expect(toRiskLevel(45)).toBe('LOW_MODERATE');
    expect(toRiskLevel(46)).toBe('MODERATE');
    expect(toRiskLevel(70)).toBe('MODERATE');
    expect(toRiskLevel(71)).toBe('HIGH');
    expect(toRiskLevel(90)).toBe('HIGH');
    expect(toRiskLevel(91)).toBe('CRITICAL');
    expect(toRiskLevel(100)).toBe('CRITICAL');
  });
});

describe('scoreFromContributions', () => {
  it('returns 0 / LOW for no contributions', () => {
    const result = scoreFromContributions([]);
    expect(result.score).toBe(0);
    expect(result.level).toBe('LOW');
    expect(result.contributions).toEqual([]);
  });

  it('sums contributions and maps to the right level', () => {
    const contributions: RiskContribution[] = [
      {
        label: 'similar-company',
        points: RISK_WEIGHTS.SIMILAR_COMPANY_MATCH,
        reason: 'stub match in UK',
      },
      {
        label: 'jurisdiction-bonus',
        points: RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
        reason: 'same jurisdiction as proposed name',
      },
    ];
    const result = scoreFromContributions(contributions);
    expect(result.score).toBe(20);
    expect(result.level).toBe('LOW');
  });

  it('caps at 100 / CRITICAL even when contributions exceed the ceiling', () => {
    const contributions: RiskContribution[] = [
      { label: 'exact-trademark', points: RISK_WEIGHTS.EXACT_TRADEMARK_MATCH, reason: 'x' },
      { label: 'exact-company', points: RISK_WEIGHTS.EXACT_COMPANY_MATCH, reason: 'x' },
      { label: 'class-overlap', points: RISK_WEIGHTS.TRADEMARK_CLASS_OVERLAP, reason: 'x' },
      { label: 'domain-unavailable', points: RISK_WEIGHTS.DOMAIN_UNAVAILABLE, reason: 'x' },
    ];
    const result = scoreFromContributions(contributions);
    expect(result.score).toBe(100);
    expect(result.level).toBe('CRITICAL');
  });

  it('floors at 0 if negative contributions dominate', () => {
    const contributions: RiskContribution[] = [
      {
        label: 'low-confidence',
        points: RISK_WEIGHTS.LOW_SOURCE_CONFIDENCE,
        reason: 'source flagged low confidence',
      },
    ];
    const result = scoreFromContributions(contributions);
    expect(result.score).toBe(0);
    expect(result.level).toBe('LOW');
  });

  it('rounds fractional contributions to the nearest whole score', () => {
    const contributions: RiskContribution[] = [
      { label: 'partial', points: 24.6, reason: 'fractional' },
    ];
    const result = scoreFromContributions(contributions);
    expect(result.score).toBe(25);
    expect(result.level).toBe('LOW_MODERATE');
  });

  it('preserves the contributions verbatim so every point is attributable', () => {
    const contributions: RiskContribution[] = [
      { label: 'a', points: 10, reason: 'reason a', evidenceRef: 'ev-1' },
      { label: 'b', points: 15, reason: 'reason b' },
    ];
    const result = scoreFromContributions(contributions);
    expect(result.contributions).toHaveLength(2);
    expect(result.contributions[0]).toEqual(contributions[0]);
    expect(result.contributions[1]).toEqual(contributions[1]);
    // Defensive array copy — caller mutations should not affect the result.
    expect(result.contributions).not.toBe(contributions);
  });

  it('produces MODERATE at the 46-point boundary', () => {
    const contributions: RiskContribution[] = [
      { label: 'sum', points: 46, reason: 'boundary' },
    ];
    expect(scoreFromContributions(contributions).level).toBe('MODERATE');
  });
});
