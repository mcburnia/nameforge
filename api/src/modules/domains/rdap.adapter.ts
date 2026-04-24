// Live RDAP domain connector (RFC 7482 / 7483). Resolves TLD -> RDAP server via
// the IANA bootstrap, then issues GET {server}/domain/{fqdn}. Cached by
// (connector name, fqdn) with a configurable TTL so repeat lookups do not
// hammer upstream registries.
//
// Graceful degradation:
//   200 -> UNAVAILABLE (domain registered; extract registrar and dates for evidence)
//   404 -> AVAILABLE (RFC 7480 §5.3: 404 means the object does not exist)
//   429 -> UNKNOWN with 'rate limited' note
//   5xx -> ERROR with status code
//   timeout / network error -> ERROR with message
//   TLD not in IANA bootstrap -> UNKNOWN with 'no RDAP server' note

import type { EvidenceSummary } from '../connectors/availability.connector.js';
import { createTtlCache, type Clock, type TtlCache } from '../cache/ttl-cache.js';
import type { DomainConnector } from './domain.adapter.js';
import type { DomainRequest, DomainResult } from './domain.types.js';
import type { Fetcher, RdapBootstrap } from './rdap.bootstrap.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

export interface RdapConnectorOptions {
  bootstrap: RdapBootstrap;
  fetch: Fetcher;
  cache?: TtlCache<DomainResult>;
  cacheTtlMs?: number;
  timeoutMs?: number;
  clock?: Clock;
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown;
  handle?: string;
}

interface RdapDomainBody {
  ldhName?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
}

function cacheKey(fqdn: string): string {
  return `rdap:${fqdn}`;
}

function extractRegistrarName(entities: RdapEntity[] | undefined): string | undefined {
  if (!entities) return undefined;
  for (const entity of entities) {
    if (!entity.roles?.includes('registrar')) continue;
    const card = entity.vcardArray;
    if (!Array.isArray(card) || card.length < 2) continue;
    const properties = card[1];
    if (!Array.isArray(properties)) continue;
    for (const prop of properties) {
      if (
        Array.isArray(prop) &&
        prop[0] === 'fn' &&
        typeof prop[3] === 'string'
      ) {
        return prop[3];
      }
    }
  }
  return undefined;
}

function findEvent(events: RdapEvent[] | undefined, action: string): string | undefined {
  return events?.find((e) => e.eventAction === action)?.eventDate;
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, {
      signal: controller.signal,
      headers: { accept: 'application/rdap+json, application/json' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createRdapDomainConnector(options: RdapConnectorOptions): DomainConnector {
  const {
    bootstrap,
    fetch: fetcher,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  } = options;
  const cache: TtlCache<DomainResult> =
    options.cache ??
    createTtlCache<DomainResult>({
      ttlMs: cacheTtlMs,
      clock: options.clock,
    });

  async function lookup(fqdn: string, tld: string): Promise<DomainResult> {
    const now = new Date();
    const server = await bootstrap.resolveRdapServer(tld);
    if (!server) {
      return {
        fqdn,
        tld,
        status: 'UNKNOWN',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `iana-bootstrap:no-server:${tld}`,
        notes: `No RDAP server registered with IANA for TLD '${tld}'.`,
      };
    }

    const url = `${server}domain/${encodeURIComponent(fqdn)}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(fetcher, url, timeoutMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        fqdn,
        tld,
        status: 'ERROR',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `network-error:${url}`,
        notes: `RDAP fetch failed: ${message}`,
      };
    }

    if (response.status === 404) {
      return {
        fqdn,
        tld,
        status: 'AVAILABLE',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `rdap:${url}:404`,
        notes: `RDAP server returned 404 for ${fqdn} — treated as AVAILABLE (RFC 7480 §5.3).`,
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') ?? undefined;
      return {
        fqdn,
        tld,
        status: 'UNKNOWN',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `rdap:${url}:429`,
        notes: `RDAP server rate-limited the request${retryAfter ? ` (retry-after ${retryAfter})` : ''}.`,
      };
    }

    if (response.status >= 500) {
      return {
        fqdn,
        tld,
        status: 'ERROR',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `rdap:${url}:${response.status}`,
        notes: `RDAP server returned HTTP ${response.status}.`,
      };
    }

    if (!response.ok) {
      return {
        fqdn,
        tld,
        status: 'UNKNOWN',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `rdap:${url}:${response.status}`,
        notes: `RDAP server returned unexpected HTTP ${response.status}.`,
      };
    }

    let body: RdapDomainBody;
    try {
      body = (await response.json()) as RdapDomainBody;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        fqdn,
        tld,
        status: 'UNKNOWN',
        retrievedAt: now,
        source: 'rdap',
        rawReference: `rdap:${url}:parse-error`,
        notes: `RDAP 200 OK but response body failed to parse: ${message}.`,
      };
    }

    const registrar = extractRegistrarName(body.entities);
    const registered = findEvent(body.events, 'registration');
    const expires =
      findEvent(body.events, 'expiration') ?? findEvent(body.events, 'expiry');
    const statusList = body.status?.join(', ');
    const noteParts = [
      registrar ? `registrar ${registrar}` : null,
      registered ? `registered ${registered}` : null,
      expires ? `expires ${expires}` : null,
      statusList ? `status [${statusList}]` : null,
    ].filter((s): s is string => s !== null);

    return {
      fqdn,
      tld,
      status: 'UNAVAILABLE',
      retrievedAt: now,
      source: 'rdap',
      rawReference: `rdap:${url}:200`,
      notes:
        `RDAP server returned a domain record for ${fqdn}` +
        (noteParts.length > 0 ? ` — ${noteParts.join('; ')}` : '') +
        '.',
    };
  }

  return {
    name: 'rdap',
    sourceType: 'DOMAIN',

    async search(request: DomainRequest): Promise<DomainResult> {
      const tld = request.tld.startsWith('.') ? request.tld.slice(1) : request.tld;
      const fqdn = `${request.normalisedName}${
        request.tld.startsWith('.') ? request.tld : `.${request.tld}`
      }`.toLowerCase();
      const key = cacheKey(fqdn);
      const cached = cache.get(key);
      if (cached) return cached;
      const result = await lookup(fqdn, tld);
      // Only cache terminal, trusted outcomes. Transient failures should retry.
      if (result.status === 'AVAILABLE' || result.status === 'UNAVAILABLE') {
        cache.set(key, result);
      }
      return result;
    },

    isAvailable(result: DomainResult): boolean | null {
      if (result.status === 'AVAILABLE') return true;
      if (result.status === 'UNAVAILABLE') return false;
      return null;
    },

    summarise(result: DomainResult): EvidenceSummary[] {
      return [
        {
          sourceName: 'rdap',
          sourceUrl:
            result.rawReference?.startsWith('rdap:')
              ? result.rawReference.slice('rdap:'.length).split(':')[0]
              : undefined,
          retrievedAt: result.retrievedAt,
          rawReference: result.rawReference,
          summary:
            `${result.fqdn}: ${result.status}` +
            (result.notes ? ` — ${result.notes}` : ''),
        },
      ];
    },
  };
}
