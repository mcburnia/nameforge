// Live Companies House (UK) registry connector.
// API docs: https://developer-specs.company-information.service.gov.uk/
// Auth: HTTP Basic with the API key as username and empty password.
// Endpoint used: GET /search/companies?q={query}
// Cached by normalised query with a configurable TTL.
//
// Only matches with an "active" company status contribute to risk — dissolved
// or removed registrations are historical and do not block a new formation.

import type { Jurisdiction } from '@prisma/client';
import type { EvidenceSummary } from '../connectors/availability.connector.js';
import { createTtlCache, type Clock, type TtlCache } from '../cache/ttl-cache.js';
import { normaliseName } from '../risk/normalisation.js';
import { similarityScore } from '../risk/similarity.js';
import type { RegistryConnector } from './registry.adapter.js';
import type {
  RegistryMatch,
  RegistryRequest,
  RegistryResult,
} from './registry.types.js';

const DEFAULT_BASE_URL = 'https://api.company-information.service.gov.uk';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_MAX_MATCHES = 10;
const DEFAULT_ITEMS_PER_PAGE = 20;

const ACTIVE_STATUSES = new Set<string>([
  'active',
  'open',
  'registered',
  'voluntary-arrangement',
  'administration',
  'insolvency-proceedings',
  'liquidation',
  'receivership',
]);

interface ChSearchItem {
  title?: string;
  company_number?: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
}

interface ChSearchResponse {
  items?: ChSearchItem[];
  total_results?: number;
}

export type Fetcher = typeof globalThis.fetch;

export interface CompaniesHouseAdapterOptions {
  apiKey: string;
  fetch: Fetcher;
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cache?: TtlCache<RegistryResult>;
  similarityThreshold?: number;
  maxMatches?: number;
  itemsPerPage?: number;
  clock?: Clock;
}

function cacheKey(normalisedName: string, jurisdiction: Jurisdiction): string {
  return `companies-house:${jurisdiction}:${normalisedName}`;
}

function basicAuthHeader(apiKey: string): string {
  const raw = `${apiKey}:`;
  const encoded = Buffer.from(raw, 'utf-8').toString('base64');
  return `Basic ${encoded}`;
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  auth: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, {
      signal: controller.signal,
      headers: {
        authorization: auth,
        accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createCompaniesHouseConnector(
  options: CompaniesHouseAdapterOptions,
): RegistryConnector {
  const {
    apiKey,
    fetch: fetcher,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxMatches = DEFAULT_MAX_MATCHES,
    itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  } = options;

  if (!apiKey) {
    throw new Error('companies-house connector requires a non-empty apiKey');
  }

  const cache: TtlCache<RegistryResult> =
    options.cache ??
    createTtlCache<RegistryResult>({ ttlMs: cacheTtlMs, clock: options.clock });
  const auth = basicAuthHeader(apiKey);

  async function lookup(request: RegistryRequest): Promise<RegistryResult> {
    const now = new Date();
    const query = request.normalisedName;
    const url =
      `${baseUrl.replace(/\/$/, '')}/search/companies` +
      `?q=${encodeURIComponent(query)}&items_per_page=${itemsPerPage}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(fetcher, url, auth, timeoutMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jurisdiction: request.jurisdiction,
        status: 'ERROR',
        matches: [],
        retrievedAt: now,
        source: 'companies-house',
        rawReference: `network-error:${url}`,
      };
    }

    if (response.status === 404) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'AVAILABLE',
        matches: [],
        retrievedAt: now,
        source: 'companies-house',
        rawReference: `ch:${url}:404`,
      };
    }

    if (response.status === 429) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'UNKNOWN',
        matches: [],
        retrievedAt: now,
        source: 'companies-house',
        rawReference: `ch:${url}:429`,
      };
    }

    if (response.status >= 500) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'ERROR',
        matches: [],
        retrievedAt: now,
        source: 'companies-house',
        rawReference: `ch:${url}:${response.status}`,
      };
    }

    if (!response.ok) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'UNKNOWN',
        matches: [],
        retrievedAt: now,
        source: 'companies-house',
        rawReference: `ch:${url}:${response.status}`,
      };
    }

    let body: ChSearchResponse;
    try {
      body = (await response.json()) as ChSearchResponse;
    } catch {
      return {
        jurisdiction: request.jurisdiction,
        status: 'UNKNOWN',
        matches: [],
        retrievedAt: now,
        source: 'companies-house',
        rawReference: `ch:${url}:parse-error`,
      };
    }

    const items = body.items ?? [];
    const ranked: Array<{ match: RegistryMatch; score: number }> = [];
    let hasExactActive = false;

    for (const item of items) {
      const title = item.title?.trim();
      if (!title) continue;
      const candidateNormalised = normaliseName(title);
      if (!candidateNormalised) continue;

      const score = similarityScore(candidateNormalised, query);
      const status = (item.company_status ?? '').toLowerCase();
      const isActive = ACTIVE_STATUSES.has(status);
      if (!isActive) continue;

      if (score < similarityThreshold && score < 1) continue;

      if (candidateNormalised === query) {
        hasExactActive = true;
      }

      ranked.push({
        match: {
          registeredName: title,
          companyNumber: item.company_number,
          similarityScore: candidateNormalised === query ? 1 : score,
          activeStatus: status,
        },
        score,
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    const matches = ranked.slice(0, maxMatches).map((r) => r.match);

    const status = hasExactActive
      ? 'EXACT_MATCH'
      : matches.length > 0
        ? 'SIMILAR_FOUND'
        : 'AVAILABLE';

    return {
      jurisdiction: request.jurisdiction,
      status,
      matches,
      retrievedAt: now,
      source: 'companies-house',
      rawReference: `ch:${url}:200`,
    };
  }

  return {
    name: 'companies-house',
    sourceType: 'COMPANY',

    async search(request: RegistryRequest): Promise<RegistryResult> {
      if (request.jurisdiction !== 'UK') {
        return {
          jurisdiction: request.jurisdiction,
          status: 'UNKNOWN',
          matches: [],
          retrievedAt: new Date(),
          source: 'companies-house',
          rawReference: `ch:out-of-scope:${request.jurisdiction}`,
        };
      }

      const key = cacheKey(request.normalisedName, request.jurisdiction);
      const cached = cache.get(key);
      if (cached) return cached;

      const result = await lookup(request);
      if (
        result.status === 'AVAILABLE' ||
        result.status === 'EXACT_MATCH' ||
        result.status === 'SIMILAR_FOUND'
      ) {
        cache.set(key, result);
      }
      return result;
    },

    isAvailable(result: RegistryResult): boolean | null {
      if (result.status === 'AVAILABLE') return true;
      if (result.status === 'EXACT_MATCH') return false;
      return null;
    },

    summarise(result: RegistryResult): EvidenceSummary[] {
      if (result.matches.length === 0) {
        return [
          {
            sourceName: 'companies-house',
            retrievedAt: result.retrievedAt,
            rawReference: result.rawReference,
            summary:
              result.status === 'AVAILABLE'
                ? `No active UK company registrations match '${result.jurisdiction}' search.`
                : `No matches above similarity threshold (${result.source} ${result.status}).`,
          },
        ];
      }
      return result.matches.map((match) => ({
        sourceName: 'companies-house',
        retrievedAt: result.retrievedAt,
        rawReference: result.rawReference,
        summary:
          `UK: ${match.registeredName}` +
          (match.companyNumber ? ` (${match.companyNumber})` : '') +
          (match.activeStatus ? ` — status ${match.activeStatus}` : '') +
          (match.similarityScore !== undefined
            ? `, similarity ${match.similarityScore.toFixed(2)}`
            : ''),
      }));
    },
  };
}
