import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';
import { requireRole, getTenantId, getPagination } from '../../plugins/rbac';

export default async function adminStoresRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // GET /admin/stores - list stores with pagination
    fastify.get('/admin/stores', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Stores'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = getTenantId(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = getPagination(request);
        const where: any = { tenantId };
        if (search) where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
        if (status) where.status = status;

        const [data, total] = await Promise.all([
            prisma.store.findMany({ where, skip, take: pageSize, orderBy: { [sortBy]: sortDir } }),
            prisma.store.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });

    // POST /admin/stores - create store
    fastify.post('/admin/stores', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Stores'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = getTenantId(request);
        const { name, code, timezone, address, status } = request.body as any;
        const store = await prisma.store.create({
            data: { tenantId, name, code, timezone: timezone || 'UTC', address, status: status || 'ACTIVE' }
        });
        return reply.code(201).send(store);
    });

    // PUT /admin/stores/:id - update store
    fastify.put('/admin/stores/:id', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Stores'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params as any;
        const tenantId = getTenantId(request);
        const { name, code, timezone, address, status } = request.body as any;
        return prisma.store.update({
            where: { id },
            data: { ...(name && { name }), ...(code !== undefined && { code }), ...(timezone && { timezone }), ...(address !== undefined && { address }), ...(status && { status }) }
        });
    });
}
