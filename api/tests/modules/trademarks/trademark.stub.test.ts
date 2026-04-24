import { describe, expect, it } from 'vitest';
import { createTrademarkStubConnector } from '../../../src/modules/trademarks/trademark.stub.js';

describe('createTrademarkStubConnector', () => {
  it('reports identity metadata', () => {
    const connector = createTrademarkStubConnector();
    expect(connector.name).toBe('trademark-stub');
    expect(connector.sourceType).toBe('TRADEMARK');
  });

  it('returns AVAILABLE when no registered mark matches in the jurisdiction', async () => {
    const connector = createTrademarkStubConnector();
    const result = await connector.search({
      normalisedName: 'nameforge',
      jurisdiction: 'EU',
    });
    expect(result.status).toBe('AVAILABLE');
    expect(result.matches).toHaveLength(0);
  });

  it('returns EXACT_MATCH when the normalised mark matches exactly', async () => {
    const connector = createTrademarkStubConnector();
    const result = await connector.search({
      normalisedName: 'cranis',
      jurisdiction: 'EU',
    });
    expect(result.status).toBe('EXACT_MATCH');
    expect(result.matches[0]?.mark).toBe('CRANIS');
    expect(result.matches[0]?.niceClasses).toEqual([9, 42]);
    expect(connector.isAvailable(result)).toBe(false);
  });

  it('returns SIMILAR_FOUND for a leading-overlap match above threshold', async () => {
    const connector = createTrademarkStubConnector({ similarityThreshold: 0.6 });
    const result = await connector.search({
      normalisedName: 'craniswear',
      jurisdiction: 'EU',
    });
    expect(result.status).toBe('SIMILAR_FOUND');
    expect(result.matches[0]?.similarityScore).toBeGreaterThanOrEqual(0.6);
  });

  it('emits evidence summaries listing NICE classes', async () => {
    const connector = createTrademarkStubConnector();
    const result = await connector.search({
      normalisedName: 'cranis',
      jurisdiction: 'EU',
    });
    const evidence = connector.summarise(result);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.summary).toContain('classes [9, 42]');
  });
});
