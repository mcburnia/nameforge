import { describe, expect, it, vi } from 'vitest';
import { createRechercheEntreprisesConnector } from '../../../src/modules/registries/recherche-entreprises.adapter.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function searchBody(
  results: Array<{
    siren?: string;
    nom_complet?: string;
    nom_raison_sociale?: string;
    etat_administratif?: 'A' | 'C';
  }>,
): Record<string, unknown> {
  return {
    total_results: results.length,
    results,
  };
}

describe('createRechercheEntreprisesConnector', () => {
  it('reports identity metadata', () => {
    const connector = createRechercheEntreprisesConnector({
      fetch: vi.fn<typeof fetch>(),
    });
    expect(connector.name).toBe('recherche-entreprises');
    expect(connector.sourceType).toBe('COMPANY');
  });

  it('returns UNKNOWN and does not fetch for non-FR jurisdictions', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const uk = await connector.search({ normalisedName: 'cranis', jurisdiction: 'UK' });
    const eu = await connector.search({ normalisedName: 'cranis', jurisdiction: 'EU' });
    expect(uk.status).toBe('UNKNOWN');
    expect(eu.status).toBe('UNKNOWN');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('issues a keyless GET with accept: application/json', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createRechercheEntreprisesConnector({
      fetch: fetcher,
      baseUrl: 'https://re.example',
    });
    await connector.search({ normalisedName: 'cranis', jurisdiction: 'FR' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain('https://re.example/search?q=cranis');
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.accept).toBe('application/json');
    expect(headers?.authorization).toBeUndefined();
  });

  it('returns EXACT_MATCH for an active entry whose normalised name matches', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          {
            siren: '123456789',
            nom_complet: 'CRANIS SAS',
            etat_administratif: 'A',
          },
        ]),
      ),
    );
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const result = await connector.search({ normalisedName: 'cranissas', jurisdiction: 'FR' });
    expect(result.status).toBe('EXACT_MATCH');
    expect(result.matches[0]?.registeredName).toBe('CRANIS SAS');
    expect(result.matches[0]?.companyNumber).toBe('123456789');
    expect(result.matches[0]?.similarityScore).toBe(1);
    expect(connector.isAvailable(result)).toBe(false);
  });

  it('returns SIMILAR_FOUND for near matches and ranks by similarity', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { siren: '1', nom_complet: 'CRANIS CONSEIL', etat_administratif: 'A' },
          { siren: '2', nom_complet: 'CRANISOFT FRANCE', etat_administratif: 'A' },
          { siren: '3', nom_complet: 'UNRELATED WIDGETS', etat_administratif: 'A' },
        ]),
      ),
    );
    const connector = createRechercheEntreprisesConnector({
      fetch: fetcher,
      maxMatches: 2,
      similarityThreshold: 0.6,
    });
    const result = await connector.search({ normalisedName: 'cranis', jurisdiction: 'FR' });
    expect(result.status).toBe('SIMILAR_FOUND');
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]?.registeredName).toBe('CRANIS CONSEIL');
  });

  it('excludes ceased (etat_administratif = C) entries', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { siren: '1', nom_complet: 'CRANIS SAS', etat_administratif: 'C' },
          { siren: '2', nom_complet: 'CRANIS ANCIEN', etat_administratif: 'C' },
        ]),
      ),
    );
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const result = await connector.search({ normalisedName: 'cranissas', jurisdiction: 'FR' });
    expect(result.status).toBe('AVAILABLE');
    expect(result.matches).toHaveLength(0);
  });

  it('falls back to nom_raison_sociale when nom_complet is missing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { siren: '1', nom_raison_sociale: 'CRANIS SARL', etat_administratif: 'A' },
        ]),
      ),
    );
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const result = await connector.search({ normalisedName: 'cranissarl', jurisdiction: 'FR' });
    expect(result.status).toBe('EXACT_MATCH');
    expect(result.matches[0]?.registeredName).toBe('CRANIS SARL');
  });

  it('returns AVAILABLE when the API returns no results', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const result = await connector.search({ normalisedName: 'zzzz', jurisdiction: 'FR' });
    expect(result.status).toBe('AVAILABLE');
    expect(connector.isAvailable(result)).toBe(true);
  });

  it('returns UNKNOWN on 429 and does not cache', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(429))
      .mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const first = await connector.search({ normalisedName: 'x', jurisdiction: 'FR' });
    const second = await connector.search({ normalisedName: 'x', jurisdiction: 'FR' });
    expect(first.status).toBe('UNKNOWN');
    expect(second.status).toBe('AVAILABLE');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('returns ERROR on 5xx and on network failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(503))
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT'));
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const first = await connector.search({ normalisedName: 'x', jurisdiction: 'FR' });
    const second = await connector.search({ normalisedName: 'x', jurisdiction: 'FR' });
    expect(first.status).toBe('ERROR');
    expect(second.status).toBe('ERROR');
  });

  it('caches terminal results across repeat queries', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(searchBody([])));
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    await connector.search({ normalisedName: 'cacheme', jurisdiction: 'FR' });
    await connector.search({ normalisedName: 'cacheme', jurisdiction: 'FR' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('summarise emits a clickable annuaire-entreprises URL and SIREN number', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        searchBody([
          { siren: '123456789', nom_complet: 'CRANIS SAS', etat_administratif: 'A' },
        ]),
      ),
    );
    const connector = createRechercheEntreprisesConnector({ fetch: fetcher });
    const result = await connector.search({ normalisedName: 'cranissas', jurisdiction: 'FR' });
    const evidence = connector.summarise(result);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.summary).toContain('SIREN 123456789');
    expect(evidence[0]?.sourceUrl).toBe(
      'https://annuaire-entreprises.data.gouv.fr/entreprise/123456789',
    );
  });
});
