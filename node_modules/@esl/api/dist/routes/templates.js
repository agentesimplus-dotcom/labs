"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = templateRoutes;
const shared_1 = require("@esl/shared");
async function templateRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // List templates
    fastify.get('/templates', {
        schema: { tags: ['Templates'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { tenantId } = request.user;
        return shared_1.prisma.template.findMany({
            where: { tenantId, status: 'ACTIVE' },
            include: { versions: { select: { id: true, version: true, colorMode: true, isPublished: true, createdAt: true } } },
            orderBy: { createdAt: 'desc' }
        });
    });
    // Create template
    fastify.post('/templates', {
        schema: {
            tags: ['Templates'], security: [{ bearerAuth: [] }],
            body: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } }
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const { name, description } = request.body;
        const template = await shared_1.prisma.template.create({ data: { tenantId, name, description } });
        return reply.code(201).send(template);
    });
    // List versions for a template
    fastify.get('/templates/:id/versions', {
        schema: { tags: ['Templates'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params;
        const { tenantId } = request.user;
        const template = await shared_1.prisma.template.findFirst({ where: { id, tenantId } });
        if (!template)
            return reply.code(404).send({ error: 'Template not found' });
        return shared_1.prisma.templateVersion.findMany({
            where: { templateId: id },
            orderBy: { version: 'desc' },
            include: { tagModel: true }
        });
    });
    // Create new version (draft)
    fastify.post('/templates/:id/versions', {
        schema: {
            tags: ['Templates'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object', required: ['tagModelId', 'colorMode'],
                properties: {
                    tagModelId: { type: 'string' },
                    colorMode: { type: 'string', enum: ['BW', 'BWR'] },
                    fabricJson: { type: 'string' },
                    normalizedDtoJson: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const { tenantId } = request.user;
        const { tagModelId, colorMode, fabricJson, normalizedDtoJson } = request.body;
        const template = await shared_1.prisma.template.findFirst({ where: { id, tenantId } });
        if (!template)
            return reply.code(404).send({ error: 'Template not found' });
        // Get next version number
        const latest = await shared_1.prisma.templateVersion.findFirst({
            where: { templateId: id }, orderBy: { version: 'desc' }
        });
        const nextVersion = (latest?.version || 0) + 1;
        const version = await shared_1.prisma.templateVersion.create({
            data: { templateId: id, version: nextVersion, tagModelId, colorMode, fabricJson, normalizedDtoJson }
        });
        return reply.code(201).send(version);
    });
    // Publish a version (make immutable)
    fastify.post('/templates/versions/:versionId/publish', {
        schema: { tags: ['Templates'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { versionId } = request.params;
        const { tenantId } = request.user;
        const version = await shared_1.prisma.templateVersion.findUnique({
            where: { id: versionId },
            include: { template: true }
        });
        if (!version || version.template.tenantId !== tenantId) {
            return reply.code(404).send({ error: 'Version not found' });
        }
        if (version.isPublished) {
            return reply.code(400).send({ error: 'Version already published' });
        }
        // Compute design hash from normalized DTO
        const crypto = require('crypto');
        const designHash = crypto.createHash('sha256')
            .update(version.normalizedDtoJson || version.fabricJson || '')
            .digest('hex');
        const updated = await shared_1.prisma.templateVersion.update({
            where: { id: versionId },
            data: { isPublished: true, designHash }
        });
        return updated;
    });
}
