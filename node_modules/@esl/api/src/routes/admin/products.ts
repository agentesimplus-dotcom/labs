import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';
import { requireRole, getTenantId, getPagination } from '../../plugins/rbac';

export default async function adminProductsRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // GET /admin/products
    fastify.get('/admin/products', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = getTenantId(request);
        const { skip, pageSize, sortBy, sortDir, search, status } = getPagination(request);
        const query = request.query as any;
        const where: any = { tenantId };
        if (search) where.OR = [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }];
        if (status) where.status = status;
        if (query.category) where.category = query.category;

        const [data, total] = await Promise.all([
            prisma.product.findMany({ where, skip, take: pageSize, orderBy: { [sortBy]: sortDir } }),
            prisma.product.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });

    // POST /admin/products
    fastify.post('/admin/products', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = getTenantId(request);
        const { sku, name, category, brand, barcode, price, currency, attributesJson, status } = request.body as any;
        const product = await prisma.product.create({
            data: { tenantId, sku, name, category, brand, barcode, price: price || 0, currency: currency || 'USD', attributesJson, status: status || 'ACTIVE' }
        });
        return reply.code(201).send(product);
    });

    // PUT /admin/products/:id
    fastify.put('/admin/products/:id', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params as any;
        const body = request.body as any;
        const data: any = {};
        for (const key of ['name', 'category', 'brand', 'barcode', 'price', 'currency', 'attributesJson', 'status']) {
            if (body[key] !== undefined) data[key] = body[key];
        }
        return prisma.product.update({ where: { id }, data });
    });

    // GET /admin/products/categories (distinct categories for filter dropdown)
    fastify.get('/admin/products/categories', {
        preHandler: [requireRole('STORE_ADMIN')],
        schema: { tags: ['Admin - Products'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = getTenantId(request);
        const cats = await prisma.product.findMany({
            where: { tenantId, category: { not: null } },
            distinct: ['category'],
            select: { category: true }
        });
        return cats.map(c => c.category).filter(Boolean);
    });
}
