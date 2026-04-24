import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns status ok with service metadata', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      status: string;
      service: string;
      version: string;
      timestamp: string;
      connectors: {
        domain: string;
        company: { UK: string; FR: string; EU: string };
        trademark: string;
      };
    };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('nmf-api');
    expect(body.version).toBe('0.1.0');
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(body.connectors.domain).toMatch(/^(stub|rdap)$/);
    expect(body.connectors.company.UK).toMatch(/^(registry-stub|companies-house)$/);
    expect(body.connectors.company.FR).toMatch(/^(registry-stub|recherche-entreprises)$/);
    expect(body.connectors.company.EU).toBe('registry-stub');
    expect(body.connectors.trademark).toBe('stub');
  });
});
