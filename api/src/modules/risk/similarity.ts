// Deterministic string similarity used by the risk engine.
// Hand-rolled to keep dependencies light and the math auditable.

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length] ?? 0;
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

// Jaro and Jaro-Winkler per Winkler (1990). Returns a score in [0, 1].
export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) /
    3
  );
}

export interface JaroWinklerOptions {
  prefixScale?: number;
  maxPrefix?: number;
}

export function jaroWinklerSimilarity(
  a: string,
  b: string,
  options: JaroWinklerOptions = {},
): number {
  const prefixScale = options.prefixScale ?? 0.1;
  const maxPrefix = options.maxPrefix ?? 4;

  const jaro = jaroSimilarity(a, b);
  if (jaro === 0) return 0;

  let prefix = 0;
  const limit = Math.min(maxPrefix, a.length, b.length);
  for (let i = 0; i < limit; i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }

  return jaro + prefix * prefixScale * (1 - jaro);
}

// Composite score: max(Levenshtein ratio, Jaro-Winkler) — always in [0, 1].
// Using max keeps the engine permissive: either measure alone can flag a risk.
export function similarityScore(a: string, b: string): number {
  return Math.max(levenshteinSimilarity(a, b), jaroWinklerSimilarity(a, b));
}
