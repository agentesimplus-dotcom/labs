"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminTenantsRoutes;
const shared_1 = require("@esl/shared");
const rbac_1 = require("../../plugins/rbac");
async function adminTenantsRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // GET /admin/tenants - list all tenants (SUPER_ADMIN) or own tenant (TENANT_ADMIN)
    fastify.get('/admin/tenants', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Tenants'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const user = request.user;
        const { skip, pageSize } = (0, rbac_1.getPagination)(request);
        const query = request.query;
        const search = query.search || '';
        // SUPER_ADMIN sees all tenants, TENANT_ADMIN sees only their own
        const where = {};
        if (user.role !== 'SUPER_ADMIN') {
            where.id = user.tenantId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } },
                { contactEmail: { contains: search } }
            ];
        }
        const [data, total] = await Promise.all([
            shared_1.prisma.tenant.findMany({
                where, skip, take: pageSize,
                orderBy: { name: 'asc' },
                include: { _count: { select: { stores: true, users: true, tags: true } } }
            }),
            shared_1.prisma.tenant.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });
    // GET /admin/tenants/:id
    fastify.get('/admin/tenants/:id', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Tenants'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        // Non-SUPER_ADMIN can only view own tenant
        if (user.role !== 'SUPER_ADMIN' && id !== user.tenantId) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        return shared_1.prisma.tenant.findUnique({
            where: { id },
            include: { _count: { select: { stores: true, users: true, tags: true } } }
        });
    });
    // POST /admin/tenants (SUPER_ADMIN only)
    fastify.post('/admin/tenants', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Tenants'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const body = request.body;
        return shared_1.prisma.tenant.create({
            data: {
                name: body.name,
                code: body.code,
                contactEmail: body.contactEmail,
                defaultLanguage: body.defaultLanguage || 'es',
                maxStores: body.maxStores || 10,
                maxTags: body.maxTags || 1000,
                status: body.status || 'ACTIVE',
            }
        });
    });
    // PUT /admin/tenants/:id
    fastify.put('/admin/tenants/:id', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Tenants'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const body = request.body;
        // Non-SUPER_ADMIN can only edit own tenant (limited fields)
        if (user.role !== 'SUPER_ADMIN' && id !== user.tenantId) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const data = {};
        if (body.name !== undefined)
            data.name = body.name;
        if (body.contactEmail !== undefined)
            data.contactEmail = body.contactEmail;
        if (body.defaultLanguage !== undefined)
            data.defaultLanguage = body.defaultLanguage;
        // Only SUPER_ADMIN can change these
        if (user.role === 'SUPER_ADMIN') {
            if (body.code !== undefined)
                data.code = body.code;
            if (body.maxStores !== undefined)
                data.maxStores = body.maxStores;
            if (body.maxTags !== undefined)
                data.maxTags = body.maxTags;
            if (body.status !== undefined)
                data.status = body.status;
        }
        return shared_1.prisma.tenant.update({ where: { id }, data });
    });
}
