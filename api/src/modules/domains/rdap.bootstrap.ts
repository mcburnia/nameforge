// IANA publishes the RDAP bootstrap registry at
//   https://data.iana.org/rdap/dns.json
// mapping TLDs to the RDAP base URLs that answer for them. We pull it once
// per process (with a long TTL) and resolve lookups locally thereafter.

import { createTtlCache, type Clock, type TtlCache } from '../cache/ttl-cache.js';

const IANA_DEFAULT_URL = 'https://data.iana.org/rdap/dns.json';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'iana:dns';

// Shape of the IANA bootstrap document per RFC 7484.
interface BootstrapDocument {
  services: Array<[readonly string[], readonly string[]]>;
}

export type Fetcher = typeof globalThis.fetch;

export interface RdapBootstrap {
  resolveRdapServer(tld: string): Promise<string | null>;
  // Exposed for tests and for forced refresh.
  refresh(): Promise<void>;
}

export interface RdapBootstrapOptions {
  fetch: Fetcher;
  bootstrapUrl?: string;
  ttlMs?: number;
  clock?: Clock;
  timeoutMs?: number;
}

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function normaliseTld(tld: string): string {
  const trimmed = tld.trim().toLowerCase();
  return trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
}

function buildLookup(doc: BootstrapDocument): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [tlds, servers] of doc.services) {
    const firstHttps = servers.find((s) => s.startsWith('https://')) ?? servers[0];
    if (!firstHttps) continue;
    const base = withTrailingSlash(firstHttps);
    for (const tld of tlds) {
      lookup.set(tld.toLowerCase(), base);
    }
  }
  return lookup;
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function createRdapBootstrap(options: RdapBootstrapOptions): RdapBootstrap {
  const url = options.bootstrapUrl ?? IANA_DEFAULT_URL;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const cache: TtlCache<Map<string, string>> = createTtlCache<Map<string, string>>({
    ttlMs,
    clock: options.clock,
  });
  let inflight: Promise<Map<string, string>> | null = null;

  async function load(): Promise<Map<string, string>> {
    const cached = cache.get(CACHE_KEY);
    if (cached) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        const response = await fetchWithTimeout(options.fetch, url, timeoutMs);
        if (!response.ok) {
          throw new Error(
            `IANA RDAP bootstrap fetch failed: HTTP ${response.status}`,
          );
        }
        const doc = (await response.json()) as BootstrapDocument;
        if (!doc || !Array.isArray(doc.services)) {
          throw new Error('IANA RDAP bootstrap document is malformed');
        }
        const lookup = buildLookup(doc);
        cache.set(CACHE_KEY, lookup);
        return lookup;
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  }

  return {
    async resolveRdapServer(tld) {
      const lookup = await load();
      return lookup.get(normaliseTld(tld)) ?? null;
    },
    async refresh() {
      cache.delete(CACHE_KEY);
      await load();
    },
  };
}
