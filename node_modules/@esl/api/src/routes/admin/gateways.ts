import { FastifyInstance } from 'fastify';
import { prisma, normalizeMac, formatMacForDisplay, isValidMac } from '@esl/shared';

export default async function adminGatewaysRoutes(fastify: FastifyInstance) {

    // GET /admin/gateways — list with search + pagination
    fastify.get('/admin/gateways', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: { tags: ['Admin - Gateways'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { tenantId, role } = request.user;
        const query = request.query as any;
        const page = parseInt(query.page || '1', 10);
        const pageSize = Math.min(parseInt(query.pageSize || '25', 10), 100);
        const search = (query.search || '').trim();
        const storeId = query.storeId || '';

        const where: any = { tenantId };
        if (search) {
            const searchNorm = normalizeMac(search);
            where.macAddress = { contains: searchNorm };
        }
        if (storeId) where.storeId = storeId;

        const [data, total] = await Promise.all([
            prisma.gateway.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { macAddress: 'asc' },
                include: { store: { select: { name: true, code: true } } }
            }),
            prisma.gateway.count({ where })
        ]);

        const formatted = data.map((gw: any) => ({
            ...gw,
            macDisplay: formatMacForDisplay(gw.macAddress),
            lastSeq: gw.lastSeq?.toString()
        }));

        return { data: formatted, total, page, pageSize };
    });

    // POST /admin/gateways — create
    fastify.post('/admin/gateways', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: {
            tags: ['Admin - Gateways'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['macAddress', 'storeId'],
                properties: {
                    macAddress: { type: 'string' },
                    storeId: { type: 'string' },
                    firmwareVersion: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const body = request.body as any;

        if (!isValidMac(body.macAddress)) {
            return reply.status(400).send({ error: 'Invalid MAC address format. Expected 12 hex characters (e.g. AABBCCDDEEFF or AA:BB:CC:DD:EE:FF).' });
        }

        const macNorm = normalizeMac(body.macAddress);

        // Verify store belongs to tenant
        const store = await prisma.store.findFirst({ where: { id: body.storeId, tenantId } });
        if (!store) return reply.status(400).send({ error: 'Store not found or does not belong to this tenant.' });

        // Check duplicate
        const existing = await prisma.gateway.findUnique({ where: { macAddress: macNorm } });
        if (existing) return reply.status(409).send({ error: 'A gateway with this MAC address already exists.' });

        const gateway = await prisma.gateway.create({
            data: {
                macAddress: macNorm,
                tenantId,
                storeId: body.storeId,
                firmwareVersion: body.firmwareVersion || null,
                status: 'UNKNOWN'
            }
        });

        return { ...gateway, macDisplay: formatMacForDisplay(gateway.macAddress), lastSeq: gateway.lastSeq?.toString() };
    });

    // PUT /admin/gateways/:mac — update
    fastify.put('/admin/gateways/:mac', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: {
            tags: ['Admin - Gateways'],
            security: [{ bearerAuth: [] }],
            params: { type: 'object', properties: { mac: { type: 'string' } } },
            body: {
                type: 'object',
                properties: {
                    storeId: { type: 'string' },
                    firmwareVersion: { type: 'string' },
                    status: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const macNorm = normalizeMac((request.params as any).mac);
        const body = request.body as any;

        const gateway = await prisma.gateway.findUnique({ where: { macAddress: macNorm } });
        if (!gateway || gateway.tenantId !== tenantId) {
            return reply.status(404).send({ error: 'Gateway not found.' });
        }

        const data: any = {};
        if (body.storeId) {
            const store = await prisma.store.findFirst({ where: { id: body.storeId, tenantId } });
            if (!store) return reply.status(400).send({ error: 'Store not found.' });
            data.storeId = body.storeId;
        }
        if (body.firmwareVersion !== undefined) data.firmwareVersion = body.firmwareVersion;
        if (body.status) data.status = body.status;

        const updated = await prisma.gateway.update({ where: { macAddress: macNorm }, data });
        return { ...updated, macDisplay: formatMacForDisplay(updated.macAddress), lastSeq: updated.lastSeq?.toString() };
    });

    // DELETE /admin/gateways/:mac
    fastify.delete('/admin/gateways/:mac', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: {
            tags: ['Admin - Gateways'],
            security: [{ bearerAuth: [] }],
            params: { type: 'object', properties: { mac: { type: 'string' } } }
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const macNorm = normalizeMac((request.params as any).mac);

        const gateway = await prisma.gateway.findUnique({ where: { macAddress: macNorm } });
        if (!gateway || gateway.tenantId !== tenantId) {
            return reply.status(404).send({ error: 'Gateway not found.' });
        }

        await prisma.gateway.delete({ where: { macAddress: macNorm } });
        return { message: 'Gateway deleted.' };
    });
}
