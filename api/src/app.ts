import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/prisma.js';
import { createDomainStubConnector } from './modules/domains/domain.stub.js';
import { createRegistryStubConnector } from './modules/registries/registry.stub.js';
import { createTrademarkStubConnector } from './modules/trademarks/trademark.stub.js';
import { createSearchService, type SearchService } from './modules/search/search.service.js';
import { searchRoutes } from './modules/search/search.routes.js';

export interface BuildAppOptions {
  logger?: boolean;
  searchService?: SearchService;
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
      domainConnector: createDomainStubConnector(),
      registryConnector: createRegistryStubConnector(),
      trademarkConnector: createTrademarkStubConnector(),
    });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'nmf-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  await app.register(searchRoutes, { searchService });

  return app;
}
