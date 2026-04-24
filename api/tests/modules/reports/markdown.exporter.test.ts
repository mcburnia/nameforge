import { describe, expect, it } from 'vitest';
import { renderMarkdownReport } from '../../../src/modules/reports/markdown.exporter.js';
import { DISCLAIMER } from '../../../src/modules/reports/disclaimer.js';
import type { SearchReport } from '../../../src/modules/search/search.types.js';

const REPORT: SearchReport = {
  searchId: '11111111-1111-4111-8111-111111111111',
  proposedName: 'CRANIS2',
  normalisedName: 'cranis2',
  jurisdictions: ['FR', 'UK', 'EU'],
  checks: ['DOMAIN', 'COMPANY'],
  domains: ['.com', '.fr'],
  createdAt: '2026-04-24T09:00:00.000Z',
  overallRiskScore: 24,
  overallRiskLevel: 'LOW_MODERATE',
  results: [
    {
      id: 'r1',
      checkType: 'DOMAIN',
      jurisdiction: null,
      source: 'domain-stub',
      status: 'UNAVAILABLE',
      confidence: 1,
      riskScore: 8,
      createdAt: '2026-04-24T09:00:00.000Z',
      findings: [
        {
          id: 'f1',
          title: 'cranis2.com is not available',
          description: 'Already registered per domain-stub.',
          matchedName: null,
          similarityScore: null,
          riskReason: 'cranis2.com unavailable contributes +8 to risk.',
        },
      ],
      evidence: [
        {
          id: 'e1',
          sourceName: 'domain-stub',
          sourceUrl: null,
          retrievedAt: '2026-04-24T09:00:00.000Z',
          rawReference: 'stub:cranis2.com',
          summary: 'cranis2.com: UNAVAILABLE',
        },
      ],
    },
    {
      id: 'r2',
      checkType: 'COMPANY',
      jurisdiction: 'UK',
      source: 'registry-stub',
      status: 'SIMILAR_FOUND',
      confidence: 1,
      riskScore: 16,
      createdAt: '2026-04-24T09:00:00.000Z',
      findings: [
        {
          id: 'f2',
          title: 'UK company: Cranis Limited',
          description: 'UK Companies register returned a similar match.',
          matchedName: 'Cranis Limited',
          similarityScore: 0.82,
          riskReason: "Similar UK company 'Cranis Limited'.",
        },
      ],
      evidence: [
        {
          id: 'e2',
          sourceName: 'registry-stub',
          sourceUrl: null,
          retrievedAt: '2026-04-24T09:00:00.000Z',
          rawReference: 'stub:UK:cranis2',
          summary: 'UK: Cranis Limited — similarity 0.82',
        },
      ],
    },
  ],
};

describe('renderMarkdownReport', () => {
  const md = renderMarkdownReport(REPORT);

  it('starts with the proposed name as an H1', () => {
    expect(md.startsWith('# NameForge Availability Report — CRANIS2')).toBe(true);
  });

  it('includes the overall risk score and level', () => {
    expect(md).toContain('**24 / 100 — LOW_MODERATE**');
  });

  it('lists each result with its check type and jurisdiction', () => {
    expect(md).toContain('### DOMAIN _(domain-stub)_');
    expect(md).toContain('### COMPANY — UK _(registry-stub)_');
  });

  it('renders findings with similarity and risk reason', () => {
    expect(md).toContain('Similarity: 0.82');
    expect(md).toContain('Matched name: `Cranis Limited`');
  });

  it('renders evidence entries with source and raw reference', () => {
    expect(md).toContain('`stub:cranis2.com`');
    expect(md).toContain('`stub:UK:cranis2`');
  });

  it('always ends with the DISCLAIMER', () => {
    expect(md.trim().endsWith(DISCLAIMER)).toBe(true);
  });

  it('escapes markdown metacharacters in user-supplied fields', () => {
    const spicy: SearchReport = {
      ...REPORT,
      proposedName: 'Cranis*Two|Injection',
      results: [],
    };
    const out = renderMarkdownReport(spicy);
    expect(out).toContain('Cranis\\*Two\\|Injection');
  });

  it('renders the empty-results branch cleanly', () => {
    const empty: SearchReport = { ...REPORT, results: [] };
    const out = renderMarkdownReport(empty);
    expect(out).toContain('_No results._');
    expect(out.trim().endsWith(DISCLAIMER)).toBe(true);
  });
});
