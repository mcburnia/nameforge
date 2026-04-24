// Vitest setup: load api/.env into process.env before any src/ module that
// validates env at import time (notably src/config/env.ts) runs. Kept as a
// small inline parser so vitest does not depend on a `dotenv` package.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');

try {
  const content = readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    // Only set if not already provided (CI and local overrides win).
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch {
  // .env not present — let src/config/env.ts fail with a clear Zod error
  // if required vars are missing from the real process.env.
}
