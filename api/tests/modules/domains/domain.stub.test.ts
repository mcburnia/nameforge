import { describe, expect, it } from 'vitest';
import { createDomainStubConnector } from '../../../src/modules/domains/domain.stub.js';

describe('createDomainStubConnector', () => {
  it('reports status and identity metadata', () => {
    const connector = createDomainStubConnector();
    expect(connector.name).toBe('domain-stub');
    expect(connector.sourceType).toBe('DOMAIN');
  });

  it('returns UNAVAILABLE for built-in taken fqdns', async () => {
    const connector = createDomainStubConnector();
    const result = await connector.search({ normalisedName: 'google', tld: '.com' });
    expect(result.fqdn).toBe('google.com');
    expect(result.status).toBe('UNAVAILABLE');
    expect(connector.isAvailable(result)).toBe(false);
  });

  it('returns AVAILABLE for a free fqdn', async () => {
    const connector = createDomainStubConnector();
    const result = await connector.search({
      normalisedName: 'nameforge-example-xyz',
      tld: '.dev',
    });
    expect(result.status).toBe('AVAILABLE');
    expect(connector.isAvailable(result)).toBe(true);
  });

  it('accepts additional taken fqdns via options', async () => {
    const connector = createDomainStubConnector({
      takenFqdns: ['cranis2.dev'],
    });
    const result = await connector.search({ normalisedName: 'cranis2', tld: '.dev' });
    expect(result.status).toBe('UNAVAILABLE');
  });

  it('emits a single evidence summary per result', async () => {
    const connector = createDomainStubConnector();
    const result = await connector.search({ normalisedName: 'free', tld: '.io' });
    const evidence = connector.summarise(result);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.sourceName).toBe('domain-stub');
    expect(evidence[0]?.summary).toContain('AVAILABLE');
  });
});
