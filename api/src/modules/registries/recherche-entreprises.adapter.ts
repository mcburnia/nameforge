// Live FR company connector using the French government's keyless public API:
//   https://recherche-entreprises.api.gouv.fr
// This API wraps the INPI RNE (Registre National des Entreprises) plus SIRENE
// data. Documentation: https://api.gouv.fr/documentation/api-recherche-entreprises
//
// No authentication required. Cached by normalised query. Graceful degradation
// on 429 / 5xx / timeout / network. Only active entries (etat_administratif = 'A')
// contribute to risk — ceased ('C') registrations are historical.

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

const DEFAULT_BASE_URL = 'https://recherche-entreprises.api.gouv.fr';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_MAX_MATCHES = 10;
const DEFAULT_PER_PAGE = 25;

interface ReApiResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  etat_administratif?: string; // 'A' active, 'C' ceased
  date_creation?: string;
  nature_juridique?: string;
}

interface ReApiResponse {
  results?: ReApiResult[];
  total_results?: number;
}

export type Fetcher = typeof globalThis.fetch;

export interface RechercheEntreprisesOptions {
  fetch: Fetcher;
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cache?: TtlCache<RegistryResult>;
  similarityThreshold?: number;
  maxMatches?: number;
  perPage?: number;
  clock?: Clock;
}

function cacheKey(normalisedName: string, jurisdiction: Jurisdiction): string {
  return `recherche-entreprises:${jurisdiction}:${normalisedName}`;
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
      headers: { accept: 'application/json' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function pickDisplayName(item: ReApiResult): string | null {
  const candidate = (item.nom_complet ?? item.nom_raison_sociale ?? '').trim();
  return candidate.length > 0 ? candidate : null;
}

export function createRechercheEntreprisesConnector(
  options: RechercheEntreprisesOptions,
): RegistryConnector {
  const {
    fetch: fetcher,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxMatches = DEFAULT_MAX_MATCHES,
    perPage = DEFAULT_PER_PAGE,
  } = options;

  const cache: TtlCache<RegistryResult> =
    options.cache ??
    createTtlCache<RegistryResult>({ ttlMs: cacheTtlMs, clock: options.clock });

  async function lookup(request: RegistryRequest): Promise<RegistryResult> {
    const now = new Date();
    const url =
      `${baseUrl.replace(/\/$/, '')}/search` +
      `?q=${encodeURIComponent(request.normalisedName)}&per_page=${perPage}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(fetcher, url, timeoutMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jurisdiction: request.jurisdiction,
        status: 'ERROR',
        matches: [],
        retrievedAt: now,
        source: 'recherche-entreprises',
        rawReference: `network-error:${url}:${message}`,
      };
    }

    if (response.status === 404) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'AVAILABLE',
        matches: [],
        retrievedAt: now,
        source: 'recherche-entreprises',
        rawReference: `re:${url}:404`,
      };
    }

    if (response.status === 429) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'UNKNOWN',
        matches: [],
        retrievedAt: now,
        source: 'recherche-entreprises',
        rawReference: `re:${url}:429`,
      };
    }

    if (response.status >= 500) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'ERROR',
        matches: [],
        retrievedAt: now,
        source: 'recherche-entreprises',
        rawReference: `re:${url}:${response.status}`,
      };
    }

    if (!response.ok) {
      return {
        jurisdiction: request.jurisdiction,
        status: 'UNKNOWN',
        matches: [],
        retrievedAt: now,
        source: 'recherche-entreprises',
        rawReference: `re:${url}:${response.status}`,
      };
    }

    let body: ReApiResponse;
    try {
      body = (await response.json()) as ReApiResponse;
    } catch {
      return {
        jurisdiction: request.jurisdiction,
        status: 'UNKNOWN',
        matches: [],
        retrievedAt: now,
        source: 'recherche-entreprises',
        rawReference: `re:${url}:parse-error`,
      };
    }

    const items = body.results ?? [];
    const ranked: Array<{ match: RegistryMatch; score: number }> = [];
    let hasExactActive = false;

    for (const item of items) {
      const displayName = pickDisplayName(item);
      if (!displayName) continue;
      const candidateNormalised = normaliseName(displayName);
      if (!candidateNormalised) continue;

      const isActive = (item.etat_administratif ?? '').toUpperCase() === 'A';
      if (!isActive) continue;

      const score = similarityScore(candidateNormalised, request.normalisedName);
      if (score < similarityThreshold && score < 1) continue;

      if (candidateNormalised === request.normalisedName) hasExactActive = true;

      ranked.push({
        match: {
          registeredName: displayName,
          companyNumber: item.siren,
          similarityScore: candidateNormalised === request.normalisedName ? 1 : score,
          activeStatus: 'active',
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
      source: 'recherche-entreprises',
      rawReference: `re:${url}:200`,
    };
  }

  return {
    name: 'recherche-entreprises',
    sourceType: 'COMPANY',

    async search(request: RegistryRequest): Promise<RegistryResult> {
      if (request.jurisdiction !== 'FR') {
        return {
          jurisdiction: request.jurisdiction,
          status: 'UNKNOWN',
          matches: [],
          retrievedAt: new Date(),
          source: 'recherche-entreprises',
          rawReference: `re:out-of-scope:${request.jurisdiction}`,
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
            sourceName: 'recherche-entreprises',
            sourceUrl: 'https://recherche-entreprises.api.gouv.fr',
            retrievedAt: result.retrievedAt,
            rawReference: result.rawReference,
            summary:
              result.status === 'AVAILABLE'
                ? 'No active French company registrations match above similarity threshold.'
                : `No matches (${result.source} ${result.status}).`,
          },
        ];
      }
      return result.matches.map((match) => ({
        sourceName: 'recherche-entreprises',
        sourceUrl: match.companyNumber
          ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${match.companyNumber}`
          : 'https://recherche-entreprises.api.gouv.fr',
        retrievedAt: result.retrievedAt,
        rawReference: result.rawReference,
        summary:
          `FR: ${match.registeredName}` +
          (match.companyNumber ? ` (SIREN ${match.companyNumber})` : '') +
          (match.similarityScore !== undefined
            ? ` — similarity ${match.similarityScore.toFixed(2)}`
            : ''),
      }));
    },
  };
}
