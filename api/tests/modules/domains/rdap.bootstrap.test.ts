import { describe, expect, it, vi } from 'vitest';
import { createRdapBootstrap } from '../../../src/modules/domains/rdap.bootstrap.js';

const SAMPLE_DOC = {
  services: [
    [
      ['com', 'net'],
      ['https://rdap.verisign.com/com/v1/', 'https://rdap.verisign.com/net/v1/'],
    ],
    [['fr'], ['https://rdap.nic.fr/']],
    [['dev'], ['https://rdap.nic.google/']],
  ],
};

function mockFetchResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createRdapBootstrap', () => {
  it('resolves a TLD to its RDAP server (accepts with or without leading dot)', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => mockFetchResponse(SAMPLE_DOC));
    const bootstrap = createRdapBootstrap({ fetch: fetcher });

    expect(await bootstrap.resolveRdapServer('com')).toBe('https://rdap.verisign.com/com/v1/');
    expect(await bootstrap.resolveRdapServer('.com')).toBe('https://rdap.verisign.com/com/v1/');
    expect(await bootstrap.resolveRdapServer('FR')).toBe('https://rdap.nic.fr/');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns null for a TLD not in the bootstrap registry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => mockFetchResponse(SAMPLE_DOC));
    const bootstrap = createRdapBootstrap({ fetch: fetcher });
    expect(await bootstrap.resolveRdapServer('unknownxyz')).toBeNull();
  });

  it('refreshes when the TTL expires', async () => {
    let now = 0;
    const clock = () => now;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => mockFetchResponse(SAMPLE_DOC));
    const bootstrap = createRdapBootstrap({
      fetch: fetcher,
      ttlMs: 1000,
      clock,
    });
    await bootstrap.resolveRdapServer('com');
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 500;
    await bootstrap.resolveRdapServer('com');
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 1500;
    await bootstrap.resolveRdapServer('com');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent first-load calls', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        () =>
          new Promise<Response>((resolve) =>
            setTimeout(() => resolve(mockFetchResponse(SAMPLE_DOC)), 10),
          ),
      );
    const bootstrap = createRdapBootstrap({ fetch: fetcher });
    const [a, b] = await Promise.all([
      bootstrap.resolveRdapServer('com'),
      bootstrap.resolveRdapServer('fr'),
    ]);
    expect(a).toBe('https://rdap.verisign.com/com/v1/');
    expect(b).toBe('https://rdap.nic.fr/');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('raises when the IANA fetch returns a non-2xx response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('nope', { status: 503 }));
    const bootstrap = createRdapBootstrap({ fetch: fetcher });
    await expect(bootstrap.resolveRdapServer('com')).rejects.toThrow(/HTTP 503/);
  });

  it('raises when the IANA document is malformed', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => mockFetchResponse({ unexpected: 'shape' }));
    const bootstrap = createRdapBootstrap({ fetch: fetcher });
    await expect(bootstrap.resolveRdapServer('com')).rejects.toThrow(/malformed/);
  });

  it('prefers HTTPS when multiple servers are listed', async () => {
    const httpFirst = {
      services: [
        [['io'], ['http://legacy.example/io/', 'https://secure.example/io/']],
      ],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(mockFetchResponse(httpFirst));
    const bootstrap = createRdapBootstrap({ fetch: fetcher });
    expect(await bootstrap.resolveRdapServer('io')).toBe('https://secure.example/io/');
  });

  it('refresh() forces a re-fetch even within TTL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => mockFetchResponse(SAMPLE_DOC));
    const bootstrap = createRdapBootstrap({ fetch: fetcher });
    await bootstrap.resolveRdapServer('com');
    await bootstrap.refresh();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
