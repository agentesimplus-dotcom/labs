"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = storeDefaultRoutes;
const shared_1 = require("@esl/shared");
async function storeDefaultRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // Get defaults for a store
    fastify.get('/stores/:storeId/default-templates', {
        schema: { tags: ['Store Defaults'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { storeId } = request.params;
        const { tenantId } = request.user;
        const store = await shared_1.prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store)
            return reply.code(404).send({ error: 'Store not found' });
        return shared_1.prisma.storeDefault.findMany({
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
        const { storeId } = request.params;
        const { tenantId } = request.user;
        const { tagModelId, colorMode, templateVersionId } = request.body;
        const store = await shared_1.prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store)
            return reply.code(404).send({ error: 'Store not found' });
        const result = await shared_1.prisma.storeDefault.upsert({
            where: { storeId_tagModelId_colorMode: { storeId, tagModelId, colorMode } },
            create: { tenantId, storeId, tagModelId, colorMode, templateVersionId },
            update: { templateVersionId }
        });
        return result;
    });
}
