"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminStoresRoutes;
const shared_1 = require("@esl/shared");
const rbac_1 = require("../../plugins/rbac");
async function adminStoresRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // GET /admin/stores - list stores with pagination
    fastify.get('/admin/stores', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Stores'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = (0, rbac_1.getPagination)(request);
        const where = { tenantId };
        if (search)
            where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
        if (status)
            where.status = status;
        const [data, total] = await Promise.all([
            shared_1.prisma.store.findMany({ where, skip, take: pageSize, orderBy: { [sortBy]: sortDir } }),
            shared_1.prisma.store.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });
    // POST /admin/stores - create store
    fastify.post('/admin/stores', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Stores'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { name, code, timezone, address, status } = request.body;
        const store = await shared_1.prisma.store.create({
            data: { tenantId, name, code, timezone: timezone || 'UTC', address, status: status || 'ACTIVE' }
        });
        return reply.code(201).send(store);
    });
    // PUT /admin/stores/:id - update store
    fastify.put('/admin/stores/:id', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Stores'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params;
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { name, code, timezone, address, status } = request.body;
        return shared_1.prisma.store.update({
            where: { id },
            data: { ...(name && { name }), ...(code !== undefined && { code }), ...(timezone && { timezone }), ...(address !== undefined && { address }), ...(status && { status }) }
        });
    });
}
