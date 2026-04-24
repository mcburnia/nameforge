import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import type { DomainConnector } from './modules/domains/domain.adapter.js';
import { createDomainStubConnector } from './modules/domains/domain.stub.js';
import { createRdapDomainConnector } from './modules/domains/rdap.adapter.js';
import { createRdapBootstrap } from './modules/domains/rdap.bootstrap.js';
import { createRegistryStubConnector } from './modules/registries/registry.stub.js';
import { createTrademarkStubConnector } from './modules/trademarks/trademark.stub.js';
import { createSearchService, type SearchService } from './modules/search/search.service.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';

export interface BuildAppOptions {
  logger?: boolean;
  searchService?: SearchService;
}

function buildDefaultDomainConnector(): DomainConnector {
  if (env.DOMAIN_CONNECTOR === 'rdap') {
    const bootstrap = createRdapBootstrap({
      fetch: globalThis.fetch.bind(globalThis),
      bootstrapUrl: env.RDAP_BOOTSTRAP_URL,
      timeoutMs: env.RDAP_TIMEOUT_MS,
    });
    return createRdapDomainConnector({
      bootstrap,
      fetch: globalThis.fetch.bind(globalThis),
      timeoutMs: env.RDAP_TIMEOUT_MS,
      cacheTtlMs: env.RDAP_CACHE_TTL_MS,
    });
  }
  return createDomainStubConnector();
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    disableRequestLogging: !options.logger,
  });

  await app.register(cors, { origin: true });

  const searchService =
    options.searchService ??
    createSearchService({
      prisma,
      domainConnector: buildDefaultDomainConnector(),
      registryConnector: createRegistryStubConnector(),
      trademarkConnector: createTrademarkStubConnector(),
    });

  if (options.logger) {
    app.log.info(
      { domainConnector: env.DOMAIN_CONNECTOR },
      'connectors wired',
    );
  }

  app.get('/health', async () => ({
    status: 'ok',
    service: 'nmf-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    connectors: {
      domain: env.DOMAIN_CONNECTOR,
      company: 'stub',
      trademark: 'stub',
    },
  }));

  await app.register(searchRoutes, { searchService });
  await app.register(reportRoutes, { searchService });

  return app;
}
