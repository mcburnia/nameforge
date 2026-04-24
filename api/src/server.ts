import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start(): Promise<void> {
  const app = await buildApp({ logger: true });
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`nmf-api listening on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
