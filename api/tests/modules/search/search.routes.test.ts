import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import {
  SearchNotFoundError,
  type SearchService,
} from '../../../src/modules/search/search.service.js';
import type { SearchReport } from '../../../src/modules/search/search.types.js';

const SAMPLE_SEARCH_ID = '11111111-1111-4111-8111-111111111111';

const SAMPLE_REPORT: SearchReport = {
  searchId: SAMPLE_SEARCH_ID,
  proposedName: 'CRANIS2',
  normalisedName: 'cranis2',
  jurisdictions: ['FR', 'UK', 'EU'],
  checks: ['DOMAIN'],
  domains: ['.com'],
  createdAt: new Date('2026-04-24T09:00:00Z').toISOString(),
  overallRiskScore: 0,
  overallRiskLevel: 'LOW',
  results: [],
};

describe('search routes', () => {
  let app: FastifyInstance;
  const createSearch = vi.fn<SearchService['createSearch']>();
  const getSearchReport = vi.fn<SearchService['getSearchReport']>();

  beforeAll(async () => {
    const mockService: SearchService = {
      createSearch,
      getSearchReport,
    };
    app = await buildApp({ logger: false, searchService: mockService });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/searches', () => {
    it('returns 201 and the new searchId on valid input', async () => {
      createSearch.mockResolvedValueOnce({ searchId: SAMPLE_SEARCH_ID });
      const response = await app.inject({
        method: 'POST',
        url: '/api/searches',
        payload: {
          proposedName: 'CRANIS2',
          jurisdictions: ['FR', 'UK', 'EU'],
          checks: ['DOMAIN'],
          domains: ['.com'],
        },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ searchId: SAMPLE_SEARCH_ID, status: 'COMPLETED' });
      expect(createSearch).toHaveBeenCalledOnce();
    });

    it('returns 400 on schema violation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/searches',
        payload: {
          proposedName: '',
          jurisdictions: ['FR'],
          checks: ['DOMAIN'],
          domains: ['.com'],
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'ValidationError' });
    });

    it('returns 400 when DOMAIN is requested without TLDs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/searches',
        payload: {
          proposedName: 'CRANIS2',
          jurisdictions: ['FR'],
          checks: ['DOMAIN'],
          domains: [],
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/searches/:id', () => {
    it('returns 200 with the aggregated report', async () => {
      getSearchReport.mockResolvedValueOnce(SAMPLE_REPORT);
      const response = await app.inject({
        method: 'GET',
        url: `/api/searches/${SAMPLE_SEARCH_ID}`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(SAMPLE_REPORT);
    });

    it('returns 404 when the search does not exist', async () => {
      getSearchReport.mockRejectedValueOnce(new SearchNotFoundError(SAMPLE_SEARCH_ID));
      const response = await app.inject({
        method: 'GET',
        url: `/api/searches/${SAMPLE_SEARCH_ID}`,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: 'NotFound' });
    });

    it('returns 400 when id is not a UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/searches/not-a-uuid',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
