import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/prisma.js';
import type { SearchReport } from '../../../src/modules/search/search.types.js';

const UNIQUE_SUFFIX = Math.random().toString(36).slice(2, 8);

describe('search API end-to-end against nmf-db', () => {
  let app: FastifyInstance;
  const createdSearchIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    if (createdSearchIds.length === 0) return;
    await prisma.searchRequest.deleteMany({
      where: { id: { in: createdSearchIds.splice(0, createdSearchIds.length) } },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /api/searches persists results, findings, and evidence', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/searches',
      payload: {
        proposedName: `nameforge-happy-${UNIQUE_SUFFIX}`,
        jurisdictions: ['FR', 'UK', 'EU'],
        checks: ['DOMAIN', 'COMPANY', 'TRADEMARK'],
        domains: ['.com', '.fr', '.eu'],
      },
    });

    expect(response.statusCode).toBe(201);
    const { searchId, status } = response.json() as { searchId: string; status: string };
    createdSearchIds.push(searchId);
    expect(status).toBe('COMPLETED');
    expect(searchId).toMatch(/^[0-9a-f-]{36}$/i);

    const persisted = await prisma.searchRequest.findUnique({
      where: { id: searchId },
      include: {
        results: { include: { findings: true, evidence: true } },
      },
    });
    expect(persisted).not.toBeNull();
    // 3 TLDs + 3 jurisdictions × 2 checks (COMPANY, TRADEMARK) = 9 results
    expect(persisted?.results.length).toBe(9);
    for (const result of persisted?.results ?? []) {
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
    }
  });

  it('GET /api/searches/:id returns the aggregated report with overall risk', async () => {
    // The domain stub marks 'cranis.com' as UNAVAILABLE, and the registry stub
    // treats normalised 'cranis' as EXACT_MATCH in UK. So 'cranis' against UK is
    // a high-signal input for a non-zero overall risk score.
    const postResponse = await app.inject({
      method: 'POST',
      url: '/api/searches',
      payload: {
        proposedName: 'cranis',
        jurisdictions: ['UK'],
        checks: ['DOMAIN', 'COMPANY'],
        domains: ['.com'],
      },
    });
    expect(postResponse.statusCode).toBe(201);
    const { searchId } = postResponse.json() as { searchId: string };
    createdSearchIds.push(searchId);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/searches/${searchId}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const report = getResponse.json() as SearchReport;

    expect(report.searchId).toBe(searchId);
    expect(report.proposedName).toBe('cranis');
    expect(report.normalisedName).toBe('cranis');
    expect(report.jurisdictions).toEqual(['UK']);
    expect(report.results).toHaveLength(2);

    const domainResult = report.results.find((r) => r.checkType === 'DOMAIN');
    const companyResult = report.results.find((r) => r.checkType === 'COMPANY');
    expect(domainResult?.status).toBe('UNAVAILABLE');
    expect(domainResult?.riskScore).toBeGreaterThan(0);
    expect(companyResult?.status).toBe('UNAVAILABLE');
    expect(companyResult?.riskScore).toBeGreaterThan(0);

    expect(report.overallRiskScore).toBeGreaterThan(0);
    expect(report.overallRiskScore).toBeLessThanOrEqual(100);
    expect(report.overallRiskLevel).toMatch(/^(LOW|LOW_MODERATE|MODERATE|HIGH|CRITICAL)$/);
  });

  it('GET /api/searches/:id returns 404 for an unknown id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/searches/00000000-0000-4000-8000-999999999999',
    });
    expect(response.statusCode).toBe(404);
  });
});
