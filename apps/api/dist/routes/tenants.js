"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tenantRoutes;
const shared_1 = require("@esl/shared");
async function tenantRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    fastify.get('/tenants', {
        schema: {
            tags: ['Tenants'],
            security: [{ bearerAuth: [] }, { apiKey: [] }]
        }
    }, async (request, reply) => {
        const { tenantId, type } = request.user;
        // An API Key or normal user only sees their own tenant.
        const tenants = await shared_1.prisma.tenant.findMany({
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
        const stores = await shared_1.prisma.store.findMany({
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
        const gateways = await shared_1.prisma.gateway.findMany({
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
        const tags = await shared_1.prisma.tag.findMany({
            where: { tenantId },
            include: {
                model: true
            }
        });
        return tags;
    });
}
