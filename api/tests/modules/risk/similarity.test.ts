import { describe, expect, it } from 'vitest';
import {
  jaroSimilarity,
  jaroWinklerSimilarity,
  levenshteinDistance,
  levenshteinSimilarity,
  similarityScore,
} from '../../../src/modules/risk/similarity.js';
import { normaliseName } from '../../../src/modules/risk/normalisation.js';

describe('levenshteinDistance', () => {
  it('is zero for identical strings', () => {
    expect(levenshteinDistance('cranis', 'cranis')).toBe(0);
  });

  it('equals length for one empty side', () => {
    expect(levenshteinDistance('', 'cranis')).toBe(6);
    expect(levenshteinDistance('cranis', '')).toBe(6);
  });

  it('measures single substitutions, insertions, deletions', () => {
    expect(levenshteinDistance('cranis', 'kranis')).toBe(1);
    expect(levenshteinDistance('cranis', 'cranis2')).toBe(1);
    expect(levenshteinDistance('cranis2', 'cranis')).toBe(1);
  });

  it('is symmetric', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('sitting', 'kitten')).toBe(3);
  });
});

describe('levenshteinSimilarity', () => {
  it('is 1 for identical strings including empty', () => {
    expect(levenshteinSimilarity('cranis', 'cranis')).toBe(1);
    expect(levenshteinSimilarity('', '')).toBe(1);
  });

  it('is 0 when everything changes', () => {
    expect(levenshteinSimilarity('abc', 'xyz')).toBe(0);
  });

  it('rates near-matches highly', () => {
    expect(levenshteinSimilarity('cranis', 'kranis')).toBeGreaterThan(0.8);
  });
});

describe('jaroSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroSimilarity('cranis', 'cranis')).toBe(1);
  });

  it('returns 0 when one side is empty', () => {
    expect(jaroSimilarity('', 'cranis')).toBe(0);
    expect(jaroSimilarity('cranis', '')).toBe(0);
  });

  it('matches the classic MARTHA / MARHTA reference value', () => {
    expect(jaroSimilarity('martha', 'marhta')).toBeCloseTo(0.9444, 3);
  });
});

describe('jaroWinklerSimilarity', () => {
  it('boosts the Jaro score for shared prefixes', () => {
    const jaro = jaroSimilarity('martha', 'marhta');
    const jw = jaroWinklerSimilarity('martha', 'marhta');
    expect(jw).toBeGreaterThan(jaro);
  });

  it('matches the classic MARTHA / MARHTA reference value ~0.9611', () => {
    expect(jaroWinklerSimilarity('martha', 'marhta')).toBeCloseTo(0.9611, 3);
  });

  it('returns 1 for identical strings', () => {
    expect(jaroWinklerSimilarity('cranis2', 'cranis2')).toBe(1);
  });
});

describe('similarityScore against the CRANIS2 family', () => {
  const canonical = normaliseName('CRANIS2');

  it('is 1 for exact canonical match (CRANIS 2)', () => {
    expect(similarityScore(canonical, normaliseName('CRANIS 2'))).toBe(1);
  });

  it('is 1 for hyphenated canonical match (cranis-2)', () => {
    expect(similarityScore(canonical, normaliseName('cranis-2'))).toBe(1);
  });

  it('is high for CRANIS (missing digit)', () => {
    const score = similarityScore(canonical, normaliseName('CRANIS'));
    expect(score).toBeGreaterThan(0.85);
  });

  it('is high for KRANIS (single substitution)', () => {
    const score = similarityScore(canonical, normaliseName('KRANIS'));
    expect(score).toBeGreaterThan(0.7);
  });

  it('is low for unrelated names', () => {
    const score = similarityScore(canonical, normaliseName('ZOOMWIDGET'));
    expect(score).toBeLessThan(0.5);
  });
});
