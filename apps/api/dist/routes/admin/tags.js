"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminTagsRoutes;
const shared_1 = require("@esl/shared");
const rbac_1 = require("../../plugins/rbac");
async function adminTagsRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // GET /admin/tags
    fastify.get('/admin/tags', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Tags'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = (0, rbac_1.getPagination)(request, 'macAddress');
        const query = request.query;
        const where = { tenantId };
        if (search) {
            const searchNorm = (0, shared_1.normalizeMac)(search);
            where.macAddress = { contains: searchNorm };
        }
        if (status)
            where.status = status;
        if (query.storeId)
            where.storeId = query.storeId;
        if (query.modelId)
            where.modelId = query.modelId;
        const [data, total] = await Promise.all([
            shared_1.prisma.tag.findMany({
                where, skip, take: pageSize, orderBy: { [sortBy]: sortDir },
                include: { model: { select: { name: true } }, store: { select: { name: true } }, assignment: true }
            }),
            shared_1.prisma.tag.count({ where })
        ]);
        const formatted = data.map((t) => ({
            ...t,
            macDisplay: (0, shared_1.formatMacForDisplay)(t.macAddress),
            lastSeq: t.lastSeq?.toString()
        }));
        return { data: formatted, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });
    // POST /admin/tags
    fastify.post('/admin/tags', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Tags'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { macAddress, storeId, modelId, productId } = request.body;
        if (!(0, shared_1.isValidMac)(macAddress)) {
            return reply.status(400).send({ error: 'Invalid MAC address format.' });
        }
        const macNorm = (0, shared_1.normalizeMac)(macAddress);
        const existing = await shared_1.prisma.tag.findUnique({ where: { macAddress: macNorm } });
        if (existing)
            return reply.status(409).send({ error: 'A tag with this MAC address already exists.' });
        const tag = await shared_1.prisma.tag.create({
            data: { macAddress: macNorm, tenantId, storeId, modelId, productId, status: 'UNKNOWN' }
        });
        return reply.code(201).send({ ...tag, macDisplay: (0, shared_1.formatMacForDisplay)(tag.macAddress), lastSeq: tag.lastSeq?.toString() });
    });
    // PUT /admin/tags/:mac
    fastify.put('/admin/tags/:mac', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Tags'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const macNorm = (0, shared_1.normalizeMac)(request.params.mac);
        const body = request.body;
        const data = {};
        if (body.storeId)
            data.storeId = body.storeId;
        if (body.modelId)
            data.modelId = body.modelId;
        if (body.productId !== undefined)
            data.productId = body.productId;
        if (body.status)
            data.status = body.status;
        const updated = await shared_1.prisma.tag.update({ where: { macAddress: macNorm }, data });
        return { ...updated, macDisplay: (0, shared_1.formatMacForDisplay)(updated.macAddress), lastSeq: updated.lastSeq?.toString() };
    });
    // GET /admin/tag-models
    fastify.get('/admin/tag-models', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Tag Models'], security: [{ bearerAuth: [] }] }
    }, async () => {
        return shared_1.prisma.tagModel.findMany({ orderBy: { name: 'asc' } });
    });
    // POST /admin/tag-models
    fastify.post('/admin/tag-models', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Tag Models'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { name, width, height, supportsRed, bitPackingVersion } = request.body;
        const model = await shared_1.prisma.tagModel.create({
            data: { name, width, height, supportsRed: !!supportsRed, bitPackingVersion: bitPackingVersion || 'v2' }
        });
        return reply.code(201).send(model);
    });
}
