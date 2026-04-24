import type { Jurisdiction } from '@prisma/client';
import type { EvidenceSummary } from '../connectors/availability.connector.js';
import type { TrademarkConnector } from './trademark.adapter.js';
import type {
  TrademarkMatch,
  TrademarkRequest,
  TrademarkResult,
} from './trademark.types.js';

interface StubTrademarkRecord {
  normalisedMark: string;
  mark: string;
  jurisdiction: Jurisdiction;
  registrationNumber: string;
  niceClasses: number[];
  status: string;
}

const DEFAULT_TRADEMARKS: StubTrademarkRecord[] = [
  {
    normalisedMark: 'cranis',
    mark: 'CRANIS',
    jurisdiction: 'EU',
    registrationNumber: 'EUIPO-00012345',
    niceClasses: [9, 42],
    status: 'registered',
  },
];

export interface TrademarkStubOptions {
  records?: StubTrademarkRecord[];
  similarityThreshold?: number;
}

function leadingOverlapRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  let shared = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] !== shorter[i]) break;
    shared++;
  }
  return shared / longer.length;
}

export function createTrademarkStubConnector(
  options: TrademarkStubOptions = {},
): TrademarkConnector {
  const records = options.records ?? DEFAULT_TRADEMARKS;
  const threshold = options.similarityThreshold ?? 0.6;

  return {
    name: 'trademark-stub',
    sourceType: 'TRADEMARK',

    async search(request: TrademarkRequest): Promise<TrademarkResult> {
      const candidates = records.filter(
        (r) => r.jurisdiction === request.jurisdiction,
      );

      const matches: TrademarkMatch[] = [];
      let hasExact = false;

      for (const candidate of candidates) {
        const score = leadingOverlapRatio(
          candidate.normalisedMark,
          request.normalisedName,
        );
        if (candidate.normalisedMark === request.normalisedName) {
          hasExact = true;
          matches.push({
            mark: candidate.mark,
            registrationNumber: candidate.registrationNumber,
            niceClasses: candidate.niceClasses,
            similarityScore: 1,
            status: candidate.status,
          });
        } else if (score >= threshold) {
          matches.push({
            mark: candidate.mark,
            registrationNumber: candidate.registrationNumber,
            niceClasses: candidate.niceClasses,
            similarityScore: score,
            status: candidate.status,
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
        source: 'trademark-stub',
        rawReference: `stub:${request.jurisdiction}:${request.normalisedName}`,
      };
    },

    isAvailable(result: TrademarkResult): boolean | null {
      if (result.status === 'AVAILABLE') return true;
      if (result.status === 'EXACT_MATCH') return false;
      return null;
    },

    summarise(result: TrademarkResult): EvidenceSummary[] {
      if (result.matches.length === 0) {
        return [
          {
            sourceName: 'trademark-stub',
            retrievedAt: result.retrievedAt,
            rawReference: result.rawReference,
            summary: `No registered trademarks found in ${result.jurisdiction}.`,
          },
        ];
      }
      return result.matches.map((match) => ({
        sourceName: 'trademark-stub',
        retrievedAt: result.retrievedAt,
        rawReference: result.rawReference,
        summary:
          `${result.jurisdiction}: ${match.mark}` +
          (match.registrationNumber ? ` (${match.registrationNumber})` : '') +
          ` — classes [${match.niceClasses.join(', ')}]` +
          (match.similarityScore !== undefined
            ? `, similarity ${match.similarityScore.toFixed(2)}`
            : ''),
      }));
    },
  };
}
