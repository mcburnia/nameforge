import { describe, expect, it } from 'vitest';
import { createRegistryStubConnector } from '../../../src/modules/registries/registry.stub.js';

describe('createRegistryStubConnector', () => {
  it('reports identity metadata', () => {
    const connector = createRegistryStubConnector();
    expect(connector.name).toBe('registry-stub');
    expect(connector.sourceType).toBe('COMPANY');
  });

  it('returns AVAILABLE when no candidate in the jurisdiction matches', async () => {
    const connector = createRegistryStubConnector();
    const result = await connector.search({
      normalisedName: 'nameforge',
      jurisdiction: 'UK',
    });
    expect(result.status).toBe('AVAILABLE');
    expect(result.matches).toHaveLength(0);
    expect(connector.isAvailable(result)).toBe(true);
  });

  it('returns EXACT_MATCH when the normalised name matches an active registration', async () => {
    const connector = createRegistryStubConnector();
    const result = await connector.search({
      normalisedName: 'cranis',
      jurisdiction: 'UK',
    });
    expect(result.status).toBe('EXACT_MATCH');
    expect(result.matches[0]?.registeredName).toBe('Cranis Limited');
    expect(connector.isAvailable(result)).toBe(false);
  });

  it('does not match across jurisdictions', async () => {
    const connector = createRegistryStubConnector();
    const result = await connector.search({
      normalisedName: 'cranis',
      jurisdiction: 'FR',
    });
    expect(result.status).toBe('AVAILABLE');
  });

  it('emits one evidence summary per match with similarity score', async () => {
    const connector = createRegistryStubConnector();
    const result = await connector.search({
      normalisedName: 'cranis',
      jurisdiction: 'UK',
    });
    const evidence = connector.summarise(result);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.summary).toContain('Cranis Limited');
    expect(evidence[0]?.summary).toContain('12345678');
  });
});
