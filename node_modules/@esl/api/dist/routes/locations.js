"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = locationRoutes;
const shared_1 = require("@esl/shared");
async function locationRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // List zones for a store
    fastify.get('/stores/:storeId/locations/zones', {
        schema: { tags: ['Locations'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { storeId } = request.params;
        const { tenantId } = request.user;
        const store = await shared_1.prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store)
            return reply.code(404).send({ error: 'Store not found' });
        return shared_1.prisma.locationZone.findMany({
            where: { storeId },
            include: { slots: { select: { id: true, code: true, status: true } } }
        });
    });
    // Create zone
    fastify.post('/stores/:storeId/locations/zones', {
        schema: {
            tags: ['Locations'], security: [{ bearerAuth: [] }],
            body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }
        }
    }, async (request, reply) => {
        const { storeId } = request.params;
        const { tenantId } = request.user;
        const { name } = request.body;
        const store = await shared_1.prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store)
            return reply.code(404).send({ error: 'Store not found' });
        const zone = await shared_1.prisma.locationZone.create({ data: { tenantId, storeId, name } });
        return reply.code(201).send(zone);
    });
    // List slots for a store
    fastify.get('/stores/:storeId/locations/slots', {
        schema: { tags: ['Locations'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { storeId } = request.params;
        const { tenantId } = request.user;
        return shared_1.prisma.locationSlot.findMany({
            where: { storeId, tenantId },
            include: { zone: { select: { name: true } } },
            orderBy: { code: 'asc' }
        });
    });
    // Create slot(s)
    fastify.post('/stores/:storeId/locations/slots', {
        schema: {
            tags: ['Locations'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object', required: ['zoneId', 'codes'],
                properties: {
                    zoneId: { type: 'string' },
                    codes: { type: 'array', items: { type: 'string' } }
                }
            }
        }
    }, async (request, reply) => {
        const { storeId } = request.params;
        const { tenantId } = request.user;
        const { zoneId, codes } = request.body;
        const store = await shared_1.prisma.store.findFirst({ where: { id: storeId, tenantId } });
        if (!store)
            return reply.code(404).send({ error: 'Store not found' });
        const created = await shared_1.prisma.locationSlot.createMany({
            data: codes.map(code => ({ tenantId, storeId, zoneId, code })),
            skipDuplicates: true
        });
        return reply.code(201).send({ created: created.count });
    });
}
