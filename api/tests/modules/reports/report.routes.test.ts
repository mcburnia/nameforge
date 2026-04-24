import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import {
  SearchNotFoundError,
  type SearchService,
} from '../../../src/modules/search/search.service.js';
import { DISCLAIMER } from '../../../src/modules/reports/disclaimer.js';
import type { SearchReport } from '../../../src/modules/search/search.types.js';

const SAMPLE_SEARCH_ID = '22222222-2222-4222-8222-222222222222';

const SAMPLE_REPORT: SearchReport = {
  searchId: SAMPLE_SEARCH_ID,
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

describe('report routes', () => {
  let app: FastifyInstance;
  const createSearch = vi.fn<SearchService['createSearch']>();
  const getSearchReport = vi.fn<SearchService['getSearchReport']>();

  beforeAll(async () => {
    const mockService: SearchService = { createSearch, getSearchReport };
    app = await buildApp({ logger: false, searchService: mockService });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/searches/:id/report.md', () => {
    it('returns Markdown with the correct content-type and disclaimer', async () => {
      getSearchReport.mockResolvedValueOnce(SAMPLE_REPORT);
      const response = await app.inject({
        method: 'GET',
        url: `/api/searches/${SAMPLE_SEARCH_ID}/report.md`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.body).toContain('# NameForge Availability Report — CRANIS2');
      expect(response.body.trim().endsWith(DISCLAIMER)).toBe(true);
    });

    it('returns 404 when the search does not exist', async () => {
      getSearchReport.mockRejectedValueOnce(new SearchNotFoundError(SAMPLE_SEARCH_ID));
      const response = await app.inject({
        method: 'GET',
        url: `/api/searches/${SAMPLE_SEARCH_ID}/report.md`,
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 400 on non-UUID id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/searches/not-a-uuid/report.md',
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/searches/:id/report.json', () => {
    it('returns JSON with the format marker and disclaimer', async () => {
      getSearchReport.mockResolvedValueOnce(SAMPLE_REPORT);
      const response = await app.inject({
        method: 'GET',
        url: `/api/searches/${SAMPLE_SEARCH_ID}/report.json`,
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { format: string; disclaimer: string; searchId: string };
      expect(body.format).toBe('nameforge.report.v1');
      expect(body.disclaimer).toBe(DISCLAIMER);
      expect(body.searchId).toBe(SAMPLE_SEARCH_ID);
    });

    it('returns 404 when the search does not exist', async () => {
      getSearchReport.mockRejectedValueOnce(new SearchNotFoundError(SAMPLE_SEARCH_ID));
      const response = await app.inject({
        method: 'GET',
        url: `/api/searches/${SAMPLE_SEARCH_ID}/report.json`,
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 400 on non-UUID id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/searches/not-a-uuid/report.json',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
