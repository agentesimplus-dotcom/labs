"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminProductsRoutes;
const shared_1 = require("@esl/shared");
const rbac_1 = require("../../plugins/rbac");
async function adminProductsRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // GET /admin/products
    fastify.get('/admin/products', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = (0, rbac_1.getPagination)(request);
        const query = request.query;
        const where = { tenantId };
        if (search)
            where.OR = [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }];
        if (status)
            where.status = status;
        if (query.category)
            where.category = query.category;
        const [data, total] = await Promise.all([
            shared_1.prisma.product.findMany({ where, skip, take: pageSize, orderBy: { [sortBy]: sortDir } }),
            shared_1.prisma.product.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });
    // POST /admin/products
    fastify.post('/admin/products', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { sku, name, category, brand, barcode, price, currency, attributesJson, status } = request.body;
        const product = await shared_1.prisma.product.create({
            data: { tenantId, sku, name, category, brand, barcode, price: price || 0, currency: currency || 'USD', attributesJson, status: status || 'ACTIVE' }
        });
        return reply.code(201).send(product);
    });
    // PUT /admin/products/:id
    fastify.put('/admin/products/:id', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params;
        const body = request.body;
        const data = {};
        for (const key of ['name', 'category', 'brand', 'barcode', 'price', 'currency', 'attributesJson', 'status']) {
            if (body[key] !== undefined)
                data[key] = body[key];
        }
        return shared_1.prisma.product.update({ where: { id }, data });
    });
    // GET /admin/products/categories (distinct categories for filter dropdown)
    fastify.get('/admin/products/categories', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const cats = await shared_1.prisma.product.findMany({
            where: { tenantId, category: { not: null } },
            distinct: ['category'],
            select: { category: true }
        });
        return cats.map(c => c.category).filter(Boolean);
    });
}
