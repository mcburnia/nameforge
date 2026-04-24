import { describe, expect, it } from 'vitest';
import { renderJsonReport } from '../../../src/modules/reports/json.exporter.js';
import { DISCLAIMER } from '../../../src/modules/reports/disclaimer.js';
import type { SearchReport } from '../../../src/modules/search/search.types.js';

const REPORT: SearchReport = {
  searchId: '11111111-1111-4111-8111-111111111111',
  proposedName: 'CRANIS2',
  normalisedName: 'cranis2',
  jurisdictions: ['FR'],
  checks: ['DOMAIN'],
  domains: ['.com'],
  createdAt: '2026-04-24T09:00:00.000Z',
  overallRiskScore: 0,
  overallRiskLevel: 'LOW',
  results: [],
};

describe('renderJsonReport', () => {
  it('adds the format marker', () => {
    const out = renderJsonReport(REPORT);
    expect(out.format).toBe('nameforge.report.v1');
  });

  it('embeds the DISCLAIMER verbatim', () => {
    const out = renderJsonReport(REPORT);
    expect(out.disclaimer).toBe(DISCLAIMER);
  });

  it('carries all SearchReport fields through unchanged', () => {
    const out = renderJsonReport(REPORT);
    expect(out.searchId).toBe(REPORT.searchId);
    expect(out.proposedName).toBe(REPORT.proposedName);
    expect(out.overallRiskScore).toBe(REPORT.overallRiskScore);
    expect(out.overallRiskLevel).toBe(REPORT.overallRiskLevel);
    expect(out.results).toEqual(REPORT.results);
  });
});
