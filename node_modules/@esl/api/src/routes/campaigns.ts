import { FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';
import { Queue } from 'bullmq';

const renderQueue = new Queue("render-logic", {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
});

export default async function campaignRoutes(fastify: FastifyInstance) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));

    // List campaigns
    fastify.get('/campaigns', {
        schema: { tags: ['Campaigns'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { tenantId } = request.user;
        return prisma.campaign.findMany({
            where: { tenantId },
            include: {
                templateVersion: { select: { id: true, version: true, template: { select: { name: true } } } },
                store: { select: { id: true, name: true } }
            },
            orderBy: { startAt: 'desc' }
        });
    });

    // Create campaign
    fastify.post('/campaigns', {
        schema: {
            tags: ['Campaigns'], security: [{ bearerAuth: [] }],
            body: {
                type: 'object', required: ['name', 'startAt', 'endAt', 'templateVersionId'],
                properties: {
                    name: { type: 'string' },
                    storeId: { type: 'string' },
                    startAt: { type: 'string', format: 'date-time' },
                    endAt: { type: 'string', format: 'date-time' },
                    templateVersionId: { type: 'string' },
                    filterJson: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { tenantId } = request.user;
        const { name, storeId, startAt, endAt, templateVersionId, filterJson } = request.body as any;

        // Validate template version
        const tv = await prisma.templateVersion.findUnique({
            where: { id: templateVersionId }, include: { template: true }
        });
        if (!tv || tv.template.tenantId !== tenantId) return reply.code(404).send({ error: 'Template version not found' });
        if (!tv.isPublished) return reply.code(400).send({ error: 'Template version must be published' });

        const campaign = await prisma.campaign.create({
            data: { tenantId, storeId, name, startAt: new Date(startAt), endAt: new Date(endAt), templateVersionId, filterJson }
        });
        return reply.code(201).send(campaign);
    });

    // Update campaign status
    fastify.post('/campaigns/:id/:action', {
        schema: {
            tags: ['Campaigns'], security: [{ bearerAuth: [] }],
            params: {
                type: 'object', properties: { id: { type: 'string' }, action: { type: 'string', enum: ['activate', 'pause'] } }
            }
        }
    }, async (request, reply) => {
        const { id, action } = request.params as any;
        const { tenantId } = request.user;
        const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
        if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });

        const newStatus = action === 'activate' ? 'ACTIVE' : 'PAUSED';
        if (campaign.status !== newStatus) {
            await prisma.campaign.update({ where: { id }, data: { status: newStatus } });
        }
        return { message: `Campaign ${newStatus}`, status: newStatus };
    });

    // Preview impact: count affected tags
    fastify.get('/campaigns/:id/impact', {
        schema: { tags: ['Campaigns'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params as any;
        const { tenantId } = request.user;
        const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
        if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });

        let filter: any = {};
        if (campaign.filterJson) {
            const parsed = JSON.parse(campaign.filterJson);
            if (parsed.skus?.length) filter.productId = { in: parsed.skus };
        }
        if (campaign.storeId) filter.storeId = campaign.storeId;
        filter.tenantId = tenantId;

        const count = await prisma.tag.count({ where: filter });
        return { campaignId: id, affectedTags: count };
    });

    // Push campaign to gateways
    fastify.post('/campaigns/:id/push', {
        schema: { tags: ['Campaigns'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params as any;
        const { tenantId } = request.user;
        const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
        if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });

        let skus: string[] = [];
        if (campaign.filterJson) {
            try {
                const parsed = JSON.parse(campaign.filterJson);
                if (parsed.skus && Array.isArray(parsed.skus)) skus = parsed.skus;
            } catch (e) { }
        }

        if (skus.length === 0) {
            return reply.code(400).send({ error: 'Campaign has no SKUs targeted' });
        }

        const tagFilter: any = { tenantId, productId: { in: skus }, status: 'ACTIVE' };
        if (campaign.storeId) tagFilter.storeId = campaign.storeId;

        // Update all active TagAssignments for these SKUs to use the campaign's template
        // Wait, TagAssignment actually stores `sku` which matches Product `sku`
        const assignmentFilter: any = { tenantId, sku: { in: skus } };
        if (campaign.storeId) assignmentFilter.storeId = campaign.storeId;

        const result = await prisma.tagAssignment.updateMany({
            where: assignmentFilter,
            data: { templateVersionId: campaign.templateVersionId }
        });

        // Optionally, ensure campaign status is ACTIVE
        if (campaign.status !== 'ACTIVE') {
            await prisma.campaign.update({ where: { id }, data: { status: 'ACTIVE' } });
        }

        // Trigger rendering jobs
        const assignments = await prisma.tagAssignment.findMany({
            where: assignmentFilter,
            include: { tag: true }
        });

        let queuedCount = 0;
        if (assignments.length > 0) {
            // Filter only ONLINE tags if needed, or send to all assigned
            const validAssignments = assignments.filter(a => a.tag?.status === 'ONLINE' || a.tag?.status === 'OFFLINE' || a.tag?.status === 'UNKNOWN');
            const jobs = validAssignments.map(a => ({
                name: "render-tag",
                data: {
                    tenant_id: tenantId,
                    store_id: a.storeId,
                    tag_mac: a.tagMac,
                    template_version_id: campaign.templateVersionId,
                    sku: a.sku
                }
            }));
            await renderQueue.addBulk(jobs);
            queuedCount = jobs.length;
        }

        return { message: 'Campaign pushed successfully', updatedAssignments: result.count, queuedRenders: queuedCount };
    });

    // Delete campaign
    fastify.delete('/campaigns/:id', {
        schema: { tags: ['Campaigns'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params as any;
        const { tenantId } = request.user;
        const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
        if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
        await prisma.campaign.delete({ where: { id } });
        return { message: 'Campaign deleted successfully' };
    });
}
