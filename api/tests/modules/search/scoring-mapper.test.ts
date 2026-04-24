import { describe, expect, it } from 'vitest';
import type { DomainResult } from '../../../src/modules/domains/domain.types.js';
import type { RegistryResult } from '../../../src/modules/registries/registry.types.js';
import type { TrademarkResult } from '../../../src/modules/trademarks/trademark.types.js';
import {
  mapDomainResult,
  mapRegistryResult,
  mapTrademarkResult,
} from '../../../src/modules/search/scoring-mapper.js';
import { RISK_WEIGHTS } from '../../../src/modules/risk/scoring.js';

const CTX = { requestedJurisdictions: ['FR', 'UK', 'EU'] as const };

describe('mapDomainResult', () => {
  it('contributes DOMAIN_UNAVAILABLE when the domain is UNAVAILABLE', () => {
    const result: DomainResult = {
      fqdn: 'cranis.com',
      tld: '.com',
      status: 'UNAVAILABLE',
      retrievedAt: new Date(),
      source: 'domain-stub',
      rawReference: 'stub:cranis.com',
    };
    const scored = mapDomainResult(result, []);
    expect(scored.checkType).toBe('DOMAIN');
    expect(scored.status).toBe('UNAVAILABLE');
    expect(scored.riskScore).toBe(RISK_WEIGHTS.DOMAIN_UNAVAILABLE);
    expect(scored.findings).toHaveLength(1);
    expect(scored.findings[0]?.riskReason).toContain('+');
  });

  it('contributes nothing when the domain is AVAILABLE', () => {
    const result: DomainResult = {
      fqdn: 'nameforge.io',
      tld: '.io',
      status: 'AVAILABLE',
      retrievedAt: new Date(),
      source: 'domain-stub',
    };
    const scored = mapDomainResult(result, []);
    expect(scored.status).toBe('AVAILABLE');
    expect(scored.riskScore).toBe(0);
    expect(scored.contributions).toHaveLength(0);
  });

  it('maps UNKNOWN connector status to UNKNOWN result status', () => {
    const result: DomainResult = {
      fqdn: 'nameforge.io',
      tld: '.io',
      status: 'UNKNOWN',
      retrievedAt: new Date(),
      source: 'domain-stub',
    };
    const scored = mapDomainResult(result, []);
    expect(scored.status).toBe('UNKNOWN');
  });
});

describe('mapRegistryResult', () => {
  const base: Omit<RegistryResult, 'status' | 'matches'> = {
    jurisdiction: 'UK',
    retrievedAt: new Date(),
    source: 'registry-stub',
    rawReference: 'stub:UK:cranis',
  };

  it('contributes EXACT_COMPANY_MATCH + jurisdiction bonus on exact match', () => {
    const result: RegistryResult = {
      ...base,
      status: 'EXACT_MATCH',
      matches: [
        {
          registeredName: 'Cranis Limited',
          companyNumber: '12345678',
          similarityScore: 1,
          activeStatus: 'active',
        },
      ],
    };
    const scored = mapRegistryResult(result, [], CTX);
    expect(scored.status).toBe('UNAVAILABLE');
    expect(scored.riskScore).toBe(
      RISK_WEIGHTS.EXACT_COMPANY_MATCH + RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
    );
    const labels = scored.contributions.map((c) => c.label);
    expect(labels).toContain('exact-company-match');
    expect(labels).toContain('same-jurisdiction-bonus');
  });

  it('contributes SIMILAR_COMPANY_MATCH + jurisdiction bonus on similar match', () => {
    const result: RegistryResult = {
      ...base,
      status: 'SIMILAR_FOUND',
      matches: [
        {
          registeredName: 'Cranis Limited',
          companyNumber: '12345678',
          similarityScore: 0.82,
          activeStatus: 'active',
        },
      ],
    };
    const scored = mapRegistryResult(result, [], CTX);
    expect(scored.status).toBe('SIMILAR_FOUND');
    expect(scored.riskScore).toBe(
      RISK_WEIGHTS.SIMILAR_COMPANY_MATCH + RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
    );
  });

  it('contributes nothing on AVAILABLE', () => {
    const result: RegistryResult = {
      ...base,
      status: 'AVAILABLE',
      matches: [],
    };
    const scored = mapRegistryResult(result, [], CTX);
    expect(scored.status).toBe('AVAILABLE');
    expect(scored.riskScore).toBe(0);
    expect(scored.findings[0]?.title).toContain('No registered companies');
  });

  it('does not apply jurisdiction bonus if the match is outside requested jurisdictions', () => {
    const result: RegistryResult = {
      ...base,
      status: 'SIMILAR_FOUND',
      matches: [
        {
          registeredName: 'Cranis Limited',
          similarityScore: 0.82,
        },
      ],
    };
    const scoped = mapRegistryResult(result, [], { requestedJurisdictions: ['FR'] });
    expect(scoped.riskScore).toBe(RISK_WEIGHTS.SIMILAR_COMPANY_MATCH);
    expect(scoped.contributions.map((c) => c.label)).not.toContain('same-jurisdiction-bonus');
  });
});

describe('mapTrademarkResult', () => {
  const base: Omit<TrademarkResult, 'status' | 'matches'> = {
    jurisdiction: 'EU',
    retrievedAt: new Date(),
    source: 'trademark-stub',
    rawReference: 'stub:EU:cranis',
  };

  it('contributes EXACT_TRADEMARK_MATCH + jurisdiction bonus on exact match', () => {
    const result: TrademarkResult = {
      ...base,
      status: 'EXACT_MATCH',
      matches: [
        {
          mark: 'CRANIS',
          registrationNumber: 'EUIPO-1',
          niceClasses: [9, 42],
          similarityScore: 1,
          status: 'registered',
        },
      ],
    };
    const scored = mapTrademarkResult(result, [], CTX);
    expect(scored.status).toBe('UNAVAILABLE');
    expect(scored.riskScore).toBe(
      RISK_WEIGHTS.EXACT_TRADEMARK_MATCH + RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
    );
  });

  it('adds class-overlap when NICE classes intersect', () => {
    const result: TrademarkResult = {
      ...base,
      status: 'SIMILAR_FOUND',
      matches: [
        {
          mark: 'CRANIS',
          niceClasses: [9, 42],
          similarityScore: 0.7,
        },
      ],
    };
    const scored = mapTrademarkResult(result, [], {
      requestedJurisdictions: ['EU'],
      niceClasses: [42],
    });
    const labels = scored.contributions.map((c) => c.label);
    expect(labels).toContain('similar-trademark-match');
    expect(labels).toContain('trademark-class-overlap');
    expect(labels).toContain('same-jurisdiction-bonus');
    expect(scored.riskScore).toBe(
      RISK_WEIGHTS.SIMILAR_TRADEMARK_MATCH +
        RISK_WEIGHTS.TRADEMARK_CLASS_OVERLAP +
        RISK_WEIGHTS.SAME_JURISDICTION_BONUS,
    );
  });

  it('omits class-overlap when NICE classes do not intersect', () => {
    const result: TrademarkResult = {
      ...base,
      status: 'SIMILAR_FOUND',
      matches: [
        {
          mark: 'CRANIS',
          niceClasses: [9, 42],
          similarityScore: 0.7,
        },
      ],
    };
    const scored = mapTrademarkResult(result, [], {
      requestedJurisdictions: ['EU'],
      niceClasses: [1, 2],
    });
    expect(scored.contributions.map((c) => c.label)).not.toContain('trademark-class-overlap');
  });

  it('contributes nothing on AVAILABLE', () => {
    const result: TrademarkResult = {
      ...base,
      status: 'AVAILABLE',
      matches: [],
    };
    const scored = mapTrademarkResult(result, [], CTX);
    expect(scored.riskScore).toBe(0);
    expect(scored.findings[0]?.title).toContain('No registered trademarks');
  });
});
