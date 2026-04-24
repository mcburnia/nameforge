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
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
