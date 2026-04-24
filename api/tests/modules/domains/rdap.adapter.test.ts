import { describe, expect, it, vi } from 'vitest';
import { createRdapDomainConnector } from '../../../src/modules/domains/rdap.adapter.js';
import type { RdapBootstrap } from '../../../src/modules/domains/rdap.bootstrap.js';

function bootstrapFor(map: Record<string, string>): RdapBootstrap {
  return {
    async resolveRdapServer(tld) {
      const clean = tld.startsWith('.') ? tld.slice(1) : tld;
      return map[clean.toLowerCase()] ?? null;
    },
    async refresh() {
      /* noop */
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/rdap+json' },
  });
}

function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

describe('createRdapDomainConnector', () => {
  it('reports identity metadata', () => {
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.verisign.com/com/v1/' }),
      fetch: vi.fn<typeof fetch>(),
    });
    expect(connector.name).toBe('rdap');
    expect(connector.sourceType).toBe('DOMAIN');
  });

  it('returns UNKNOWN when the TLD has no RDAP server', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({}),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'anything', tld: '.xyzzy' });
    expect(result.status).toBe('UNKNOWN');
    expect(result.notes).toMatch(/No RDAP server/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns UNAVAILABLE and extracts registrar + registration date on 200', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        ldhName: 'example.com',
        status: ['active'],
        events: [
          { eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' },
          { eventAction: 'expiration', eventDate: '2030-08-13T04:00:00Z' },
        ],
        entities: [
          {
            roles: ['registrar'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['fn', {}, 'text', 'Example Registrar, Inc.'],
              ],
            ],
          },
        ],
      }),
    );
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.verisign.com/com/v1/' }),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'example', tld: '.com' });

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.fqdn).toBe('example.com');
    expect(result.notes).toContain('Example Registrar, Inc.');
    expect(result.notes).toContain('1995-08-14');
    expect(result.rawReference).toContain('rdap.verisign.com');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe('https://rdap.verisign.com/com/v1/domain/example.com');
    expect((init?.headers as Record<string, string> | undefined)?.accept).toContain('application/rdap+json');
  });

  it('returns AVAILABLE on 404', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(404));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'never-registered-zzz', tld: '.com' });
    expect(result.status).toBe('AVAILABLE');
    expect(connector.isAvailable(result)).toBe(true);
  });

  it('returns UNKNOWN on 429 rate limit with retry-after', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(429, { 'retry-after': '60' }));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'x', tld: '.com' });
    expect(result.status).toBe('UNKNOWN');
    expect(result.notes).toContain('rate-limited');
    expect(result.notes).toContain('60');
  });

  it('returns ERROR on 5xx', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(503));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'x', tld: '.com' });
    expect(result.status).toBe('ERROR');
    expect(result.notes).toContain('503');
  });

  it('returns ERROR on network failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'x', tld: '.com' });
    expect(result.status).toBe('ERROR');
    expect(result.notes).toContain('connect ECONNREFUSED');
  });

  it('caches terminal results so repeat lookups do not re-fetch', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(404));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const a = await connector.search({ normalisedName: 'cache-me', tld: '.com' });
    const b = await connector.search({ normalisedName: 'cache-me', tld: '.com' });
    expect(a.status).toBe('AVAILABLE');
    expect(b.status).toBe('AVAILABLE');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache transient failures (UNKNOWN, ERROR)', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(503))
      .mockResolvedValueOnce(emptyResponse(404));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const first = await connector.search({ normalisedName: 'retry-me', tld: '.com' });
    const second = await connector.search({ normalisedName: 'retry-me', tld: '.com' });
    expect(first.status).toBe('ERROR');
    expect(second.status).toBe('AVAILABLE');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('isAvailable maps statuses correctly', () => {
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: vi.fn<typeof fetch>(),
    });
    expect(
      connector.isAvailable({
        fqdn: 'x.com',
        tld: '.com',
        status: 'AVAILABLE',
        retrievedAt: new Date(),
        source: 'rdap',
      }),
    ).toBe(true);
    expect(
      connector.isAvailable({
        fqdn: 'x.com',
        tld: '.com',
        status: 'UNAVAILABLE',
        retrievedAt: new Date(),
        source: 'rdap',
      }),
    ).toBe(false);
    expect(
      connector.isAvailable({
        fqdn: 'x.com',
        tld: '.com',
        status: 'UNKNOWN',
        retrievedAt: new Date(),
        source: 'rdap',
      }),
    ).toBeNull();
  });

  it('summarise emits a single evidence record with summary text', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(404));
    const connector = createRdapDomainConnector({
      bootstrap: bootstrapFor({ com: 'https://rdap.example/com/' }),
      fetch: fetcher,
    });
    const result = await connector.search({ normalisedName: 'x', tld: '.com' });
    const evidence = connector.summarise(result);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.sourceName).toBe('rdap');
    expect(evidence[0]?.summary).toContain('x.com');
    expect(evidence[0]?.summary).toContain('AVAILABLE');
  });
});
