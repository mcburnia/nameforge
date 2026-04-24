import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),

  // Connector wiring — defaults to the in-memory stubs so that a fresh clone
  // runs end-to-end without touching any external service.
  DOMAIN_CONNECTOR: z.enum(['stub', 'rdap']).default('stub'),
  RDAP_BOOTSTRAP_URL: z.string().url().default('https://data.iana.org/rdap/dns.json'),
  RDAP_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  RDAP_CACHE_TTL_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),

  // Companies House (UK). When an API key is provided, UK company searches go
  // live; other jurisdictions continue to hit the stub via the dispatch
  // connector. Leave COMPANIES_HOUSE_API_KEY unset to keep everything stubbed.
  COMPANIES_HOUSE_API_KEY: z.string().optional(),
  COMPANIES_HOUSE_BASE_URL: z
    .string()
    .url()
    .default('https://api.company-information.service.gov.uk'),
  COMPANIES_HOUSE_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  COMPANIES_HOUSE_CACHE_TTL_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),

  // French company register (INPI / RNE + SIRENE) via the keyless public API
  // at https://recherche-entreprises.api.gouv.fr. Opt-in because a fresh
  // clone should stay offline and deterministic by default; set
  // FR_REGISTRY_CONNECTOR=recherche-entreprises to enable live FR lookups.
  FR_REGISTRY_CONNECTOR: z.enum(['stub', 'recherche-entreprises']).default('stub'),
  RECHERCHE_ENTREPRISES_BASE_URL: z
    .string()
    .url()
    .default('https://recherche-entreprises.api.gouv.fr'),
  RECHERCHE_ENTREPRISES_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  RECHERCHE_ENTREPRISES_CACHE_TTL_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
