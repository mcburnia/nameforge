import { describe, expect, it } from 'vitest';
import { normaliseName } from '../../../src/modules/risk/normalisation.js';

describe('normaliseName', () => {
  it('lowercases input', () => {
    expect(normaliseName('CRANIS')).toBe('cranis');
  });

  it('strips whitespace, hyphens, and underscores', () => {
    expect(normaliseName('Cranis 2')).toBe('cranis2');
    expect(normaliseName('cranis-two')).toBe('cranistwo');
    expect(normaliseName('cranis_two')).toBe('cranistwo');
  });

  it('strips accents via NFD decomposition', () => {
    expect(normaliseName('Café')).toBe('cafe');
    expect(normaliseName('Crânis')).toBe('cranis');
    expect(normaliseName('Ñoño')).toBe('nono');
  });

  it('drops punctuation and symbols', () => {
    expect(normaliseName('Cranis!')).toBe('cranis');
    expect(normaliseName('Cranis.co')).toBe('cranisco');
    expect(normaliseName('Cranis & Sons')).toBe('cranissons');
  });

  it('preserves digits', () => {
    expect(normaliseName('CRANIS2')).toBe('cranis2');
    expect(normaliseName('CRANIS 2')).toBe('cranis2');
  });

  it('collapses all CRANIS2 variants to the same canonical form', () => {
    const canonical = 'cranis2';
    const variants = ['CRANIS2', 'CRANIS 2', 'cranis-2', 'Cranis_2', ' Cranis2 '];
    for (const variant of variants) {
      expect(normaliseName(variant)).toBe(canonical);
    }
  });

  it('returns empty string for empty input', () => {
    expect(normaliseName('')).toBe('');
    expect(normaliseName('   ')).toBe('');
  });
});
