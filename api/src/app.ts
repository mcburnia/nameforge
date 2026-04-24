import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import type { DomainConnector } from './modules/domains/domain.adapter.js';
import { createDomainStubConnector } from './modules/domains/domain.stub.js';
import { createRdapDomainConnector } from './modules/domains/rdap.adapter.js';
import { createRdapBootstrap } from './modules/domains/rdap.bootstrap.js';
import type { RegistryConnector } from './modules/registries/registry.adapter.js';
import { createRegistryStubConnector } from './modules/registries/registry.stub.js';
import { createCompaniesHouseConnector } from './modules/registries/companies-house.adapter.js';
import { createRechercheEntreprisesConnector } from './modules/registries/recherche-entreprises.adapter.js';
import { createRegistryDispatch } from './modules/registries/registry.dispatch.js';
import { createTrademarkStubConnector } from './modules/trademarks/trademark.stub.js';
import { createSearchService, type SearchService } from './modules/search/search.service.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';

export interface BuildAppOptions {
  logger?: boolean;
  searchService?: SearchService;
}

interface ConnectorReport {
  domain: string;
  company: { UK: string; FR: string; EU: string };
  trademark: string;
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

function buildDefaultRegistryConnector(): {
  connector: RegistryConnector;
  byJurisdictionNames: { UK: string; FR: string; EU: string };
} {
  const stub = createRegistryStubConnector();
  const stubName = stub.name;

  const byJurisdiction: Partial<Record<'UK' | 'FR' | 'EU', RegistryConnector>> = {};
  const names: { UK: string; FR: string; EU: string } = {
    UK: stubName,
    FR: stubName,
    EU: stubName,
  };

  if (env.COMPANIES_HOUSE_API_KEY) {
    const companiesHouse = createCompaniesHouseConnector({
      apiKey: env.COMPANIES_HOUSE_API_KEY,
      fetch: globalThis.fetch.bind(globalThis),
      baseUrl: env.COMPANIES_HOUSE_BASE_URL,
      timeoutMs: env.COMPANIES_HOUSE_TIMEOUT_MS,
      cacheTtlMs: env.COMPANIES_HOUSE_CACHE_TTL_MS,
    });
    byJurisdiction.UK = companiesHouse;
    names.UK = companiesHouse.name;
  }

  if (env.FR_REGISTRY_CONNECTOR === 'recherche-entreprises') {
    const re = createRechercheEntreprisesConnector({
      fetch: globalThis.fetch.bind(globalThis),
      baseUrl: env.RECHERCHE_ENTREPRISES_BASE_URL,
      timeoutMs: env.RECHERCHE_ENTREPRISES_TIMEOUT_MS,
      cacheTtlMs: env.RECHERCHE_ENTREPRISES_CACHE_TTL_MS,
    });
    byJurisdiction.FR = re;
    names.FR = re.name;
  }

  const connector = createRegistryDispatch({
    byJurisdiction,
    fallback: stub,
  });

  return { connector, byJurisdictionNames: names };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    disableRequestLogging: !options.logger,
  });

  await app.register(cors, { origin: true });

  const registry = buildDefaultRegistryConnector();

  const searchService =
    options.searchService ??
    createSearchService({
      prisma,
      domainConnector: buildDefaultDomainConnector(),
      registryConnector: registry.connector,
      trademarkConnector: createTrademarkStubConnector(),
    });

  const connectorReport: ConnectorReport = {
    domain: env.DOMAIN_CONNECTOR,
    company: registry.byJurisdictionNames,
    trademark: 'stub',
  };

  if (options.logger) {
    app.log.info({ connectors: connectorReport }, 'connectors wired');
  }

  app.get('/health', async () => ({
    status: 'ok',
    service: 'nmf-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    connectors: connectorReport,
  }));

  await app.register(searchRoutes, { searchService });
  await app.register(reportRoutes, { searchService });

  return app;
}
