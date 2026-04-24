import type { Jurisdiction } from '@prisma/client';
import type { EvidenceSummary } from '../connectors/availability.connector.js';
import type { RegistryConnector } from './registry.adapter.js';
import type {
  RegistryMatch,
  RegistryRequest,
  RegistryResult,
} from './registry.types.js';

interface StubRegistryRecord {
  normalisedName: string;
  registeredName: string;
  jurisdiction: Jurisdiction;
  companyNumber: string;
  activeStatus: string;
}

const DEFAULT_REGISTRY: StubRegistryRecord[] = [
  {
    normalisedName: 'cranis',
    registeredName: 'Cranis Limited',
    jurisdiction: 'UK',
    companyNumber: '12345678',
    activeStatus: 'active',
  },
  {
    normalisedName: 'cranisoft',
    registeredName: 'Cranisoft SAS',
    jurisdiction: 'FR',
    companyNumber: 'FR-987654',
    activeStatus: 'active',
  },
];

export interface RegistryStubOptions {
  records?: StubRegistryRecord[];
  similarityThreshold?: number;
}

function normalisedHammingLike(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  let shared = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) shared++;
  }
  return shared / longer.length;
}

export function createRegistryStubConnector(
  options: RegistryStubOptions = {},
): RegistryConnector {
  const records = options.records ?? DEFAULT_REGISTRY;
  const threshold = options.similarityThreshold ?? 0.7;

  return {
    name: 'registry-stub',
    sourceType: 'COMPANY',

    async search(request: RegistryRequest): Promise<RegistryResult> {
      const candidates = records.filter(
        (r) => r.jurisdiction === request.jurisdiction,
      );

      const matches: RegistryMatch[] = [];
      let hasExact = false;

      for (const candidate of candidates) {
        const score = normalisedHammingLike(
          candidate.normalisedName,
          request.normalisedName,
        );
        if (candidate.normalisedName === request.normalisedName) {
          hasExact = true;
          matches.push({
            registeredName: candidate.registeredName,
            companyNumber: candidate.companyNumber,
            similarityScore: 1,
            activeStatus: candidate.activeStatus,
          });
        } else if (score >= threshold) {
          matches.push({
            registeredName: candidate.registeredName,
            companyNumber: candidate.companyNumber,
            similarityScore: score,
            activeStatus: candidate.activeStatus,
          });
        }
      }

      const status = hasExact
        ? 'EXACT_MATCH'
        : matches.length > 0
          ? 'SIMILAR_FOUND'
          : 'AVAILABLE';

      return {
        jurisdiction: request.jurisdiction,
        status,
        matches,
        retrievedAt: new Date(),
        source: 'registry-stub',
        rawReference: `stub:${request.jurisdiction}:${request.normalisedName}`,
      };
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
            sourceName: 'registry-stub',
            retrievedAt: result.retrievedAt,
            rawReference: result.rawReference,
            summary: `No registered companies found in ${result.jurisdiction}.`,
          },
        ];
      }
      return result.matches.map((match) => ({
        sourceName: 'registry-stub',
        retrievedAt: result.retrievedAt,
        rawReference: result.rawReference,
        summary:
          `${result.jurisdiction}: ${match.registeredName}` +
          (match.companyNumber ? ` (${match.companyNumber})` : '') +
          (match.similarityScore !== undefined
            ? ` — similarity ${match.similarityScore.toFixed(2)}`
            : ''),
      }));
    },
  };
}
