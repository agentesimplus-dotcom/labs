import { FastifyInstance } from 'fastify';
import { prisma, normalizeMac, formatMacForDisplay, isValidMac } from '@esl/shared';
import { requireRole, getTenantId, getPagination } from '../../plugins/rbac';

export default async function adminTagsRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // GET /admin/tags
    fastify.get('/admin/tags', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Tags'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = getTenantId(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = getPagination(request, 'macAddress');
        const query = request.query as any;
        const where: any = { tenantId };
        if (search) {
            const searchNorm = normalizeMac(search);
            where.macAddress = { contains: searchNorm };
        }
        if (status) where.status = status;
        if (query.storeId) where.storeId = query.storeId;
        if (query.modelId) where.modelId = query.modelId;

        const [data, total] = await Promise.all([
            prisma.tag.findMany({
                where, skip, take: pageSize, orderBy: { [sortBy]: sortDir },
                include: { model: { select: { name: true } }, store: { select: { name: true } }, assignment: true }
            }),
            prisma.tag.count({ where })
        ]);

        const formatted = data.map((t: any) => ({
            ...t,
            macDisplay: formatMacForDisplay(t.macAddress),
            lastSeq: t.lastSeq?.toString()
        }));

        return { data: formatted, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });

    // POST /admin/tags
    fastify.post('/admin/tags', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Tags'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = getTenantId(request);
        const { macAddress, storeId, modelId, productId } = request.body as any;

        if (!isValidMac(macAddress)) {
            return reply.status(400).send({ error: 'Invalid MAC address format.' });
        }

        const macNorm = normalizeMac(macAddress);

        const existing = await prisma.tag.findUnique({ where: { macAddress: macNorm } });
        if (existing) return reply.status(409).send({ error: 'A tag with this MAC address already exists.' });

        const tag = await prisma.tag.create({
            data: { macAddress: macNorm, tenantId, storeId, modelId, productId, status: 'UNKNOWN' }
        });
        return reply.code(201).send({ ...tag, macDisplay: formatMacForDisplay(tag.macAddress), lastSeq: tag.lastSeq?.toString() });
    });

    // PUT /admin/tags/:mac
    fastify.put('/admin/tags/:mac', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Tags'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const macNorm = normalizeMac((request.params as any).mac);
        const body = request.body as any;
        const data: any = {};
        if (body.storeId) data.storeId = body.storeId;
        if (body.modelId) data.modelId = body.modelId;
        if (body.productId !== undefined) data.productId = body.productId;
        if (body.status) data.status = body.status;
        const updated = await prisma.tag.update({ where: { macAddress: macNorm }, data });
        return { ...updated, macDisplay: formatMacForDisplay(updated.macAddress), lastSeq: updated.lastSeq?.toString() };
    });

    // GET /admin/tag-models
    fastify.get('/admin/tag-models', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Tag Models'], security: [{ bearerAuth: [] }] }
    }, async () => {
        return prisma.tagModel.findMany({ orderBy: { name: 'asc' } });
    });

    // POST /admin/tag-models
    fastify.post('/admin/tag-models', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Tag Models'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { name, width, height, supportsRed, bitPackingVersion } = request.body as any;
        const model = await prisma.tagModel.create({
            data: { name, width, height, supportsRed: !!supportsRed, bitPackingVersion: bitPackingVersion || 'v2' }
        });
        return reply.code(201).send(model);
    });
}
