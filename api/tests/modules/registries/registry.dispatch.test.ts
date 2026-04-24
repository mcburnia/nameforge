import { describe, expect, it, vi } from 'vitest';
import type { RegistryConnector } from '../../../src/modules/registries/registry.adapter.js';
import type {
  RegistryRequest,
  RegistryResult,
} from '../../../src/modules/registries/registry.types.js';
import { createRegistryDispatch } from '../../../src/modules/registries/registry.dispatch.js';

function makeConnector(name: string): RegistryConnector {
  return {
    name,
    sourceType: 'COMPANY',
    search: vi.fn(
      async (request: RegistryRequest): Promise<RegistryResult> => ({
        jurisdiction: request.jurisdiction,
        status: 'AVAILABLE',
        matches: [],
        retrievedAt: new Date(),
        source: name,
        rawReference: `${name}:${request.jurisdiction}:${request.normalisedName}`,
      }),
    ),
    isAvailable: vi.fn(() => true),
    summarise: vi.fn(() => [
      {
        sourceName: name,
        retrievedAt: new Date(),
        summary: `${name} summary`,
      },
    ]),
  };
}

describe('createRegistryDispatch', () => {
  it('routes UK to the UK-specific connector', async () => {
    const uk = makeConnector('companies-house');
    const fallback = makeConnector('registry-stub');
    const dispatch = createRegistryDispatch({
      byJurisdiction: { UK: uk },
      fallback,
    });

    await dispatch.search({ normalisedName: 'cranis', jurisdiction: 'UK' });
    expect(uk.search).toHaveBeenCalledTimes(1);
    expect(fallback.search).not.toHaveBeenCalled();
  });

  it('falls back for jurisdictions without a specific connector', async () => {
    const uk = makeConnector('companies-house');
    const fallback = makeConnector('registry-stub');
    const dispatch = createRegistryDispatch({
      byJurisdiction: { UK: uk },
      fallback,
    });

    await dispatch.search({ normalisedName: 'cranis', jurisdiction: 'FR' });
    expect(uk.search).not.toHaveBeenCalled();
    expect(fallback.search).toHaveBeenCalledTimes(1);
  });

  it('rewrites the result source to the selected connector name', async () => {
    const uk = makeConnector('companies-house');
    const fallback = makeConnector('registry-stub');
    const dispatch = createRegistryDispatch({
      byJurisdiction: { UK: uk },
      fallback,
    });

    const uKResult = await dispatch.search({ normalisedName: 'x', jurisdiction: 'UK' });
    const frResult = await dispatch.search({ normalisedName: 'x', jurisdiction: 'FR' });
    expect(uKResult.source).toBe('companies-house');
    expect(frResult.source).toBe('registry-stub');
  });

  it('summarise delegates to the per-jurisdiction connector', async () => {
    const uk = makeConnector('companies-house');
    const fallback = makeConnector('registry-stub');
    const dispatch = createRegistryDispatch({
      byJurisdiction: { UK: uk },
      fallback,
    });
    const result = await dispatch.search({ normalisedName: 'x', jurisdiction: 'UK' });
    const evidence = dispatch.summarise(result);
    expect(uk.summarise).toHaveBeenCalledTimes(1);
    expect(fallback.summarise).not.toHaveBeenCalled();
    expect(evidence[0]?.summary).toContain('companies-house');
  });

  it('works with an all-stub configuration (no per-jurisdiction connectors)', async () => {
    const fallback = makeConnector('registry-stub');
    const dispatch = createRegistryDispatch({
      byJurisdiction: {},
      fallback,
    });
    await dispatch.search({ normalisedName: 'x', jurisdiction: 'UK' });
    await dispatch.search({ normalisedName: 'x', jurisdiction: 'FR' });
    await dispatch.search({ normalisedName: 'x', jurisdiction: 'EU' });
    expect(fallback.search).toHaveBeenCalledTimes(3);
  });
});
