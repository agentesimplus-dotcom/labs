import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';

export default async function previewRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // Preview render (returns mockup for now since node-canvas is Docker-only)
    fastify.post('/render/preview', {
        schema: {
            tags: ['Preview'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                properties: {
                    templateVersionId: { type: 'string' },
                    sampleData: { type: 'object' }
                }
            }
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const { templateVersionId, sampleData } = request.body as any;

        if (templateVersionId) {
            const version = await prisma.templateVersion.findUnique({
                where: { id: templateVersionId },
                include: { template: true, tagModel: true }
            });
            if (!version || version.template.tenantId !== tenantId) {
                return reply.code(404).send({ error: 'Template version not found' });
            }

            return {
                templateVersionId: version.id,
                tagModel: { width: version.tagModel.width, height: version.tagModel.height, name: version.tagModel.name },
                colorMode: version.colorMode,
                fabricJson: version.fabricJson,
                normalizedDto: version.normalizedDtoJson ? JSON.parse(version.normalizedDtoJson) : null,
                sampleData,
                message: 'Preview data ready. Full server-side render requires Docker worker.'
            };
        }

        return reply.code(400).send({ error: 'templateVersionId is required' });
    });
}
