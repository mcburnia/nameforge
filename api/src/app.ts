import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    disableRequestLogging: !options.logger,
  });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'nmf-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  return app;
}
