import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SearchNotFoundError, type SearchService } from '../search/search.service.js';
import { renderMarkdownReport } from './markdown.exporter.js';
import { renderJsonReport } from './json.exporter.js';

export interface ReportRoutesOptions {
  searchService: SearchService;
}

const SearchIdParamsSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

export const reportRoutes: FastifyPluginAsync<ReportRoutesOptions> = async (
  app: FastifyInstance,
  options,
) => {
  const { searchService } = options;

  app.get('/api/searches/:id/report.md', async (request, reply) => {
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
      const markdown = renderMarkdownReport(report);
      return reply
        .code(200)
        .header('content-type', 'text/markdown; charset=utf-8')
        .send(markdown);
    } catch (err) {
      if (err instanceof SearchNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message });
      }
      throw err;
    }
  });

  app.get('/api/searches/:id/report.json', async (request, reply) => {
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
      return reply.code(200).send(renderJsonReport(report));
    } catch (err) {
      if (err instanceof SearchNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message });
      }
      throw err;
    }
  });
};
