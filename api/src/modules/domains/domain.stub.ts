import type { EvidenceSummary } from '../connectors/availability.connector.js';
import type { DomainConnector } from './domain.adapter.js';
import type { DomainRequest, DomainResult } from './domain.types.js';

const DEFAULT_TAKEN_FQDNS = new Set<string>([
  'google.com',
  'facebook.com',
  'amazon.com',
  'cranis.com',
]);

export interface DomainStubOptions {
  takenFqdns?: Iterable<string>;
}

export function createDomainStubConnector(
  options: DomainStubOptions = {},
): DomainConnector {
  const taken = new Set<string>(
    [...DEFAULT_TAKEN_FQDNS, ...(options.takenFqdns ?? [])].map((f) =>
      f.toLowerCase(),
    ),
  );

  return {
    name: 'domain-stub',
    sourceType: 'DOMAIN',

    async search(request: DomainRequest): Promise<DomainResult> {
      const fqdn = `${request.normalisedName}${request.tld}`.toLowerCase();
      const status = taken.has(fqdn) ? 'UNAVAILABLE' : 'AVAILABLE';
      return {
        fqdn,
        tld: request.tld,
        status,
        retrievedAt: new Date(),
        source: 'domain-stub',
        rawReference: `stub:${fqdn}`,
        notes:
          status === 'UNAVAILABLE'
            ? `stub: ${fqdn} present in built-in taken list`
            : `stub: ${fqdn} absent from built-in taken list`,
      };
    },

    isAvailable(result: DomainResult): boolean | null {
      if (result.status === 'AVAILABLE') return true;
      if (result.status === 'UNAVAILABLE') return false;
      return null;
    },

    summarise(result: DomainResult): EvidenceSummary[] {
      return [
        {
          sourceName: 'domain-stub',
          retrievedAt: result.retrievedAt,
          rawReference: result.rawReference,
          summary: `${result.fqdn}: ${result.status}`,
        },
      ];
    },
  };
}
