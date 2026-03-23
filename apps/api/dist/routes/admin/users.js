"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminUsersRoutes;
const shared_1 = require("@esl/shared");
const bcrypt_1 = __importDefault(require("bcrypt"));
const rbac_1 = require("../../plugins/rbac");
async function adminUsersRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // GET /admin/users
    fastify.get('/admin/users', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = (0, rbac_1.getPagination)(request);
        const where = { tenantId };
        if (search)
            where.OR = [{ name: { contains: search } }, { email: { contains: search } }];
        if (status)
            where.status = status;
        const [data, total] = await Promise.all([
            shared_1.prisma.user.findMany({
                where, skip, take: pageSize, orderBy: { [sortBy]: sortDir },
                select: { id: true, email: true, name: true, role: true, language: true, status: true, storeScope: true, createdAt: true, updatedAt: true }
            }),
            shared_1.prisma.user.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });
    // POST /admin/users
    fastify.post('/admin/users', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { email, name, password, role, language, storeScope, status } = request.body;
        const passwordHash = await bcrypt_1.default.hash(password || 'changeme123', 10);
        const user = await shared_1.prisma.user.create({
            data: { tenantId, email, name, passwordHash, role: role || 'STORE_OPERATOR', language: language || 'en', storeScope: storeScope ? JSON.stringify(storeScope) : null, status: status || 'ACTIVE' },
            select: { id: true, email: true, name: true, role: true, language: true, status: true }
        });
        return reply.code(201).send(user);
    });
    // PUT /admin/users/:id
    fastify.put('/admin/users/:id', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params;
        const { name, role, language, storeScope, status } = request.body;
        const data = {};
        if (name)
            data.name = name;
        if (role)
            data.role = role;
        if (language)
            data.language = language;
        if (storeScope !== undefined)
            data.storeScope = storeScope ? JSON.stringify(storeScope) : null;
        if (status)
            data.status = status;
        return shared_1.prisma.user.update({ where: { id }, data, select: { id: true, email: true, name: true, role: true, language: true, status: true, storeScope: true } });
    });
    // POST /admin/users/:id/reset-password
    fastify.post('/admin/users/:id/reset-password', {
        preHandler: [(0, rbac_1.requireRole)('TENANT_ADMIN')],
        schema: { tags: ['Admin - Users'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params;
        const { password } = request.body;
        const passwordHash = await bcrypt_1.default.hash(password || 'changeme123', 10);
        await shared_1.prisma.user.update({ where: { id }, data: { passwordHash } });
        return { success: true };
    });
}
