import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CreateSearchRequestSchema } from './search.schemas.js';
import { SearchNotFoundError, type SearchService } from './search.service.js';

export interface SearchRoutesOptions {
  searchService: SearchService;
}

const SearchIdParamsSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

export const searchRoutes: FastifyPluginAsync<SearchRoutesOptions> = async (
  app: FastifyInstance,
  options,
) => {
  const { searchService } = options;

  app.post('/api/searches', async (request, reply) => {
    const parsed = CreateSearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        message: 'Invalid search request',
        issues: parsed.error.issues,
      });
    }
    const { searchId } = await searchService.createSearch(parsed.data);
    return reply.code(201).send({ searchId, status: 'COMPLETED' });
  });

  app.get('/api/searches/:id', async (request, reply) => {
    const params = SearchIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        message: 'Invalid search id',
        issues: params.error.issues,
      });
    }
    try {
      const report = await searchService.getSearchReport(params.data.id);
      return reply.code(200).send(report);
    } catch (err) {
      if (err instanceof SearchNotFoundError) {
        return reply.code(404).send({
          error: 'NotFound',
          message: err.message,
        });
      }
      throw err;
    }
  });
};
