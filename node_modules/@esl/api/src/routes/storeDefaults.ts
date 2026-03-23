import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';

export default async function storeDefaultRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // Get defaults for a store
    fastify.get('/stores/:storeId/default-templates', {
        schema: { tags: ['Store Defaults'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { storeId } = request.params as any;
        const { tenantId } = request.user;
        const store = await prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store) return reply.code(404).send({ error: 'Store not found' });

        return prisma.storeDefault.findMany({
            where: { storeId, tenantId },
            include: {
                tagModel: { select: { id: true, name: true, width: true, height: true } },
                templateVersion: { select: { id: true, version: true, isPublished: true, template: { select: { name: true } } } }
            }
        });
    });

    // Upsert default for store + tagModel + colorMode
    fastify.put('/stores/:storeId/default-templates', {
        schema: {
            tags: ['Store Defaults'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object', required: ['tagModelId', 'colorMode', 'templateVersionId'],
                properties: {
                    tagModelId: { type: 'string' },
                    colorMode: { type: 'string', enum: ['BW', 'BWR'] },
                    templateVersionId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { storeId } = request.params as any;
        const { tenantId } = request.user;
        const { tagModelId, colorMode, templateVersionId } = request.body as any;

        const store = await prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store) return reply.code(404).send({ error: 'Store not found' });

        const result = await prisma.storeDefault.upsert({
            where: { storeId_tagModelId_colorMode: { storeId, tagModelId, colorMode } },
            create: { tenantId, storeId, tagModelId, colorMode, templateVersionId },
            update: { templateVersionId }
        });
        return result;
    });
}
