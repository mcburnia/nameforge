import { describe, expect, it } from 'vitest';
import { CreateSearchRequestSchema } from '../../../src/modules/search/search.schemas.js';

describe('CreateSearchRequestSchema', () => {
  const valid = {
    proposedName: 'CRANIS2',
    jurisdictions: ['FR', 'UK', 'EU'] as const,
    checks: ['DOMAIN', 'COMPANY', 'TRADEMARK'] as const,
    domains: ['.com', '.fr', '.eu', '.dev'],
  };

  it('accepts a well-formed request', () => {
    const result = CreateSearchRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proposedName).toBe('CRANIS2');
      expect(result.data.domains).toEqual(['.com', '.fr', '.eu', '.dev']);
    }
  });

  it('trims and lowercases TLDs', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      domains: ['  .COM  ', '.Fr'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domains).toEqual(['.com', '.fr']);
    }
  });

  it('rejects an empty proposedName', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      proposedName: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown jurisdiction', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      jurisdictions: ['US'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown check type', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      checks: ['PATENT'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty jurisdictions array', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      jurisdictions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty checks array', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      checks: [],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one TLD when DOMAIN check is requested', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      domains: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('domains'))).toBe(true);
    }
  });

  it('allows an empty domains array when DOMAIN is not requested', () => {
    const result = CreateSearchRequestSchema.safeParse({
      proposedName: 'CRANIS2',
      jurisdictions: ['FR'],
      checks: ['COMPANY'],
      domains: [],
    });
    expect(result.success).toBe(true);
  });

  it('defaults domains to an empty array when omitted', () => {
    const result = CreateSearchRequestSchema.safeParse({
      proposedName: 'CRANIS2',
      jurisdictions: ['FR'],
      checks: ['COMPANY'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domains).toEqual([]);
    }
  });

  it('rejects malformed TLDs', () => {
    const badCases = ['com', '..com', '.-com', '.CO!M', ''];
    for (const bad of badCases) {
      const result = CreateSearchRequestSchema.safeParse({ ...valid, domains: [bad] });
      expect(result.success, `expected ${JSON.stringify(bad)} to be rejected`).toBe(false);
    }
  });

  it('rejects duplicate jurisdictions, checks, and TLDs', () => {
    expect(
      CreateSearchRequestSchema.safeParse({
        ...valid,
        jurisdictions: ['FR', 'FR'],
      }).success,
    ).toBe(false);
    expect(
      CreateSearchRequestSchema.safeParse({
        ...valid,
        checks: ['DOMAIN', 'DOMAIN'],
      }).success,
    ).toBe(false);
    expect(
      CreateSearchRequestSchema.safeParse({
        ...valid,
        domains: ['.com', '.com'],
      }).success,
    ).toBe(false);
  });

  it('caps proposedName length at 120 characters', () => {
    const result = CreateSearchRequestSchema.safeParse({
      ...valid,
      proposedName: 'a'.repeat(121),
    });
    expect(result.success).toBe(false);
  });
});
