// Composite RegistryConnector that routes each request to a per-jurisdiction
// backend, with a fallback connector for unlisted jurisdictions. The search
// service depends only on RegistryConnector, so dispatch stays hidden inside
// this adapter — no changes required in the service layer.

import type { Jurisdiction } from '@prisma/client';
import type { EvidenceSummary } from '../connectors/availability.connector.js';
import type { RegistryConnector } from './registry.adapter.js';
import type { RegistryRequest, RegistryResult } from './registry.types.js';

export interface RegistryDispatchOptions {
  byJurisdiction: Partial<Record<Jurisdiction, RegistryConnector>>;
  fallback: RegistryConnector;
}

export function createRegistryDispatch(
  options: RegistryDispatchOptions,
): RegistryConnector {
  const { byJurisdiction, fallback } = options;

  function select(jurisdiction: Jurisdiction): RegistryConnector {
    return byJurisdiction[jurisdiction] ?? fallback;
  }

  return {
    name: 'registry-dispatch',
    sourceType: 'COMPANY',

    async search(request: RegistryRequest): Promise<RegistryResult> {
      const connector = select(request.jurisdiction);
      const result = await connector.search(request);
      return { ...result, source: connector.name };
    },

    isAvailable(result: RegistryResult): boolean | null {
      if (result.status === 'AVAILABLE') return true;
      if (result.status === 'EXACT_MATCH') return false;
      return null;
    },

    summarise(result: RegistryResult): EvidenceSummary[] {
      const connector = select(result.jurisdiction);
      return connector.summarise(result);
    },
  };
}
