// Deterministic, explainable name normalisation used across the whole pipeline.
// Applied once at search intake so similarity, scoring, and cache keys all
// operate on the same canonical form.

export function normaliseName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s\-_]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}
