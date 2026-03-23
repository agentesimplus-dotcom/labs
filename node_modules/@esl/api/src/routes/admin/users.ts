import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';
import bcrypt from 'bcrypt';
import { requireRole, getTenantId, getPagination } from '../../plugins/rbac';

export default async function adminUsersRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // GET /admin/users
    fastify.get('/admin/users', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = getTenantId(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = getPagination(request);
        const where: any = { tenantId };
        if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];
        if (status) where.status = status;

        const [data, total] = await Promise.all([
            prisma.user.findMany({
                where, skip, take: pageSize, orderBy: { [sortBy]: sortDir },
                select: { id: true, email: true, name: true, role: true, language: true, status: true, storeScope: true, createdAt: true, updatedAt: true }
            }),
            prisma.user.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });

    // POST /admin/users
    fastify.post('/admin/users', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = getTenantId(request);
        const { email, name, password, role, language, storeScope, status } = request.body as any;
        const passwordHash = await bcrypt.hash(password || 'changeme123', 10);
        const user = await prisma.user.create({
            data: { tenantId, email, name, passwordHash, role: role || 'STORE_OPERATOR', language: language || 'en', storeScope: storeScope ? JSON.stringify(storeScope) : null, status: status || 'ACTIVE' },
            select: { id: true, email: true, name: true, role: true, language: true, status: true }
        });
        return reply.code(201).send(user);
    });

    // PUT /admin/users/:id
    fastify.put('/admin/users/:id', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params as any;
        const { name, role, language, storeScope, status } = request.body as any;
        const data: any = {};
        if (name) data.name = name;
        if (role) data.role = role;
        if (language) data.language = language;
        if (storeScope !== undefined) data.storeScope = storeScope ? JSON.stringify(storeScope) : null;
        if (status) data.status = status;
        return prisma.user.update({ where: { id }, data, select: { id: true, email: true, name: true, role: true, language: true, status: true, storeScope: true } });
    });

    // POST /admin/users/:id/reset-password
    fastify.post('/admin/users/:id/reset-password', {
        preHandler: [requireRole('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params as any;
        const { password } = request.body as any;
        const passwordHash = await bcrypt.hash(password || 'changeme123', 10);
        await prisma.user.update({ where: { id }, data: { passwordHash } });
        return { success: true };
    });
}
