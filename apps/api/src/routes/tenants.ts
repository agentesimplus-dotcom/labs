import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';

export default async function tenantRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    fastify.get('/tenants', {
        schema: {
            tags: ['Tenants'],
            security: [{ bearerAuth: [] }, { apiKey: [] }]
        }
    }, async (request, reply) => {
        const { tenantId, type } = request.user;

        // An API Key or normal user only sees their own tenant.
        const tenants = await prisma.tenant.findMany({
            where: { id: tenantId }
        });
        return tenants;
    });

    fastify.get('/stores', {
        schema: {
            tags: ['Stores'],
            security: [{ bearerAuth: [] }, { apiKey: [] }]
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const stores = await prisma.store.findMany({
            where: { tenantId }
        });
        return stores;
    });

    fastify.get('/gateways', {
        schema: {
            tags: ['Gateways'],
            security: [{ bearerAuth: [] }, { apiKey: [] }]
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        // We can also allow filtering by store_id later
        const gateways = await prisma.gateway.findMany({
            where: { tenantId },
            include: { store: { select: { id: true, name: true } } }
        });
        return gateways;
    });

    fastify.get('/tags', {
        schema: {
            tags: ['Tags'],
            security: [{ bearerAuth: [] }, { apiKey: [] }]
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const tags = await prisma.tag.findMany({
            where: { tenantId },
            include: {
                model: true
            }
        });
        return tags;
    });
}
