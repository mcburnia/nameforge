import { describe, expect, it, vi } from 'vitest';
import { createCompaniesHouseConnector } from '../../../src/modules/registries/companies-house.adapter.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

function searchBody(
  items: Array<{
    title: string;
    company_number?: string;
    company_status?: string;
  }>,
): Record<string, unknown> {
  return {
    page_number: 1,
    items_per_page: items.length,
    total_results: items.length,
    items,
  };
}

describe('createCompaniesHouseConnector', () => {
  it('reports identity metadata and throws without an apiKey', () => {
    expect(() =>
      createCompaniesHouseConnector({
        apiKey: '',
        fetch: vi.fn<typeof fetch>(),
      }),
    ).toThrow(/apiKey/);

    const connector = createCompaniesHouseConnector({
      apiKey: 'secret',
      fetch: vi.fn<typeof fetch>(),
    });
    expect(connector.name).toBe('companies-house');
    expect(connector.sourceType).toBe('COMPANY');
  });

  it('returns UNKNOWN and does not fetch for non-UK jurisdictions', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const connector = createCompaniesHouseConnector({ apiKey: 'k', fetch: fetcher });
    const result = await connector.search({ normalisedName: 'cranis', jurisdiction: 'FR' });
    expect(result.status).toBe('UNKNOWN');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends a basic-auth request to the search endpoint', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createCompaniesHouseConnector({
      apiKey: 'my-key',
      fetch: fetcher,
      baseUrl: 'https://api.ch.example',
    });

    const result = await connector.search({ normalisedName: 'cranis', jurisdiction: 'UK' });

    expect(result.status).toBe('AVAILABLE');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain('https://api.ch.example/search/companies?q=cranis');
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.authorization).toBe(
      `Basic ${Buffer.from('my-key:', 'utf-8').toString('base64')}`,
    );
    expect(headers?.accept).toBe('application/json');
  });

  it('returns EXACT_MATCH when an active item matches the normalised name exactly', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          {
            title: 'CRANIS LIMITED',
            company_number: '12345678',
            company_status: 'active',
          },
        ]),
      ),
    );
    const connector = createCompaniesHouseConnector({
      apiKey: 'k',
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'cranislimited', jurisdiction: 'UK' });
    expect(result.status).toBe('EXACT_MATCH');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.registeredName).toBe('CRANIS LIMITED');
    expect(result.matches[0]?.similarityScore).toBe(1);
    expect(connector.isAvailable(result)).toBe(false);
  });

  it('returns SIMILAR_FOUND for near matches, ranks by score, and caps maxMatches', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { title: 'CRANIS LIMITED', company_number: '1', company_status: 'active' },
          { title: 'CRANISOFT SOLUTIONS LIMITED', company_number: '2', company_status: 'active' },
          { title: 'UNRELATED WIDGETS LTD', company_number: '3', company_status: 'active' },
        ]),
      ),
    );
    const connector = createCompaniesHouseConnector({
      apiKey: 'k',
      fetch: fetcher,
      maxMatches: 1,
      similarityThreshold: 0.6,
    });
    const result = await connector.search({ normalisedName: 'cranis', jurisdiction: 'UK' });
    expect(result.status).toBe('SIMILAR_FOUND');
    expect(result.matches).toHaveLength(1);
    // Highest-scoring match should be 'CRANIS LIMITED' (more similar than Cranisoft).
    expect(result.matches[0]?.registeredName).toBe('CRANIS LIMITED');
  });

  it('excludes dissolved / non-active companies from matches', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { title: 'CRANIS LIMITED', company_number: '1', company_status: 'dissolved' },
          { title: 'CRANIS OLD', company_number: '2', company_status: 'removed' },
        ]),
      ),
    );
    const connector = createCompaniesHouseConnector({
      apiKey: 'k',
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'cranislimited', jurisdiction: 'UK' });
    expect(result.status).toBe('AVAILABLE');
    expect(result.matches).toHaveLength(0);
  });

  it('returns AVAILABLE when the API returns no items', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createCompaniesHouseConnector({ apiKey: 'k', fetch: fetcher });
    const result = await connector.search({ normalisedName: 'zzzz', jurisdiction: 'UK' });
    expect(result.status).toBe('AVAILABLE');
    expect(connector.isAvailable(result)).toBe(true);
  });

  it('returns UNKNOWN on 429 rate limit (and does not cache)', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(429))
      .mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createCompaniesHouseConnector({ apiKey: 'k', fetch: fetcher });
    const first = await connector.search({ normalisedName: 'x', jurisdiction: 'UK' });
    expect(first.status).toBe('UNKNOWN');
    const second = await connector.search({ normalisedName: 'x', jurisdiction: 'UK' });
    expect(second.status).toBe('AVAILABLE');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('returns ERROR on 5xx and ERROR on network failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(503))
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT'));
    const connector = createCompaniesHouseConnector({ apiKey: 'k', fetch: fetcher });
    const first = await connector.search({ normalisedName: 'x', jurisdiction: 'UK' });
    expect(first.status).toBe('ERROR');
    const second = await connector.search({ normalisedName: 'x', jurisdiction: 'UK' });
    expect(second.status).toBe('ERROR');
  });

  it('caches terminal results so repeat queries do not re-fetch', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createCompaniesHouseConnector({ apiKey: 'k', fetch: fetcher });
    await connector.search({ normalisedName: 'cacheme', jurisdiction: 'UK' });
    await connector.search({ normalisedName: 'cacheme', jurisdiction: 'UK' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('summarise emits evidence lines with number, status, and similarity', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { title: 'Cranis Limited', company_number: '12345678', company_status: 'active' },
        ]),
      ),
    );
    const connector = createCompaniesHouseConnector({ apiKey: 'k', fetch: fetcher });
    const result = await connector.search({ normalisedName: 'cranislimited', jurisdiction: 'UK' });
    const evidence = connector.summarise(result);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.summary).toContain('Cranis Limited');
    expect(evidence[0]?.summary).toContain('12345678');
    expect(evidence[0]?.summary).toContain('status active');
  });
});
