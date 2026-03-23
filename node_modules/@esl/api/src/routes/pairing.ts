import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';
import { Queue } from 'bullmq';

const renderQueue = new Queue("render-logic", {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
});

export default async function pairingRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // Inline template resolver to avoid workspace barrel import issues
    async function resolveTemplateForTag(tagMac: string, tenantId: string) {
        const assignment = await prisma.tagAssignment.findUnique({ where: { tagMac } });
        if (assignment?.templateVersionId) {
            return { templateVersionId: assignment.templateVersionId, sku: assignment.sku, source: 'ASSIGNMENT' };
        }
        let sku = assignment?.sku || null;
        const tag = await prisma.tag.findUnique({ where: { macAddress: tagMac }, include: { model: true } });
        if (tag) {
            const colorMode = tag.model.supportsRed ? 'BWR' : 'BW';
            const sd = await prisma.storeDefault.findUnique({
                where: { storeId_tagModelId_colorMode: { storeId: tag.storeId, tagModelId: tag.modelId, colorMode } }
            });
            if (sd) return { templateVersionId: sd.templateVersionId, sku, source: 'STORE_DEFAULT' };
        }
        return { templateVersionId: null, sku, source: 'NONE' };
    }

    // Web assignment: get counts of assignments by SKU
    fastify.post('/tags/assignments/count-by-skus', {
        schema: {
            tags: ['Pairing'], security: [{ bearerAuth: [] }],
            body: { type: 'object', properties: { skus: { type: 'array', items: { type: 'string' } } } }
        }
    }, async (request) => {
        const { tenantId } = request.user;
        const { skus } = request.body as any;
        if (!skus || !skus.length) return {};

        const assignments = await prisma.tagAssignment.groupBy({
            by: ['sku'],
            where: { tenantId, sku: { in: skus } },
            _count: { tagMac: true }
        });

        const counts: Record<string, number> = {};
        for (const a of assignments) {
            if (a.sku) counts[a.sku] = a._count.tagMac;
        }
        return counts;
    });

    // Web assignment: assign tag to SKU/location/template
    fastify.post('/tags/:mac/assign', {
        schema: {
            tags: ['Pairing'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                properties: {
                    sku: { type: 'string' },
                    locationSlotId: { type: 'string' },
                    templateVersionId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { mac } = request.params as any;
        const { tenantId, id: userId } = request.user;
        let { sku, locationSlotId, templateVersionId } = request.body as any;

        const tag = await prisma.tag.findFirst({ where: { macAddress: mac, tenantId } });
        if (!tag) return reply.code(404).send({ error: 'Tag not found' });

        // Validate SKU / Lookup by barcode
        if (sku) {
            const product = await prisma.product.findFirst({
                where: {
                    tenantId,
                    OR: [{ sku: sku }, { barcode: sku }]
                }
            });
            if (!product) return reply.code(404).send({ error: 'Product not found by SKU or Barcode' });
            sku = product.sku; // Use the actual SKU
        }

        const assignment = await prisma.tagAssignment.upsert({
            where: { tagMac: mac },
            create: {
                tagMac: mac, tenantId, storeId: tag.storeId,
                sku, locationSlotId, templateVersionId,
                assignedBy: userId, source: 'WEB'
            },
            update: {
                sku, locationSlotId, templateVersionId,
                assignedBy: userId, assignedAt: new Date(), source: 'WEB'
            }
        });

        // Enqueue render if we can resolve a template
        const resolved = await resolveTemplateForTag(mac, tenantId);
        if (resolved.templateVersionId && resolved.sku) {
            await renderQueue.add('render-tag', {
                tenant_id: tenantId,
                store_id: tag.storeId,
                tag_mac: mac,
                template_version_id: resolved.templateVersionId,
                sku: resolved.sku
            });
        }

        return assignment;
    });

    // Mobile pairing endpoint
    fastify.post('/mobile/pair', {
        schema: {
            tags: ['Mobile Pairing'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object', required: ['tag_mac', 'sku'],
                properties: {
                    tag_mac: { type: 'string' },
                    sku: { type: 'string' },
                    location_slot_code: { type: 'string' },
                    store_id: { type: 'string' },
                    auto_apply_default: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        const { tenantId, id: userId } = request.user;
        const { tag_mac, sku, location_slot_code, store_id, auto_apply_default = true } = request.body as any;

        const tag = await prisma.tag.findFirst({ where: { macAddress: tag_mac, tenantId } });
        if (!tag) return reply.code(404).send({ error: 'Tag not found' });

        const storeId = store_id || tag.storeId;

        // Resolve location slot if provided
        let locationSlotId: string | null = null;
        if (location_slot_code) {
            const slot = await prisma.locationSlot.findUnique({
                where: { storeId_code: { storeId, code: location_slot_code } }
            });
            if (slot) locationSlotId = slot.id;
        }

        // Create/update assignment
        const assignment = await prisma.tagAssignment.upsert({
            where: { tagMac: tag_mac },
            create: {
                tagMac: tag_mac, tenantId, storeId,
                sku, locationSlotId,
                assignedBy: userId, source: 'MOBILE'
            },
            update: {
                sku, locationSlotId,
                assignedBy: userId, assignedAt: new Date(), source: 'MOBILE'
            }
        });

        // Auto-apply default template if requested
        let jobId: string | null = null;
        if (auto_apply_default) {
            const resolved = await resolveTemplateForTag(tag_mac, tenantId);
            if (resolved.templateVersionId) {
                const job = await renderQueue.add('render-tag', {
                    tenant_id: tenantId,
                    store_id: storeId,
                    tag_mac,
                    template_version_id: resolved.templateVersionId,
                    sku
                });
                jobId = job.id || null;
            }
        }

        return { assignment, jobId, message: jobId ? 'Tag paired and render queued' : 'Tag paired (no template to apply)' };
    });
}
