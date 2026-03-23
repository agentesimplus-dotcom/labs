import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { Worker, Job, Queue } from "bullmq";
import { prisma } from "@esl/shared";
import mqtt from "mqtt";
import { randomUUID } from "crypto";

const redisConnection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

// ─── MQTT Client ──────────────────────────────────────────────────
const mqttUrl = `mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || '1883'}`;
const mqttClient = mqtt.connect(mqttUrl, {
    clientId: `worker_${randomUUID()}`,
});

mqttClient.on("connect", () => {
    console.log("Worker connected to MQTT broker");
    mqttClient.subscribe("gateways/+/acks");
});

mqttClient.on("message", async (topic, message) => {
    if (topic.endsWith("/acks")) {
        try {
            const payload = JSON.parse(message.toString());
            const { command_id, tag_mac, status } = payload;
            console.log(`ACK: cmd=${command_id}, tag=${tag_mac}, status=${status}`);

            if (command_id && status === "SUCCESS") {
                await prisma.eSLCommand.update({
                    where: { id: command_id },
                    data: { status: "ACK", ackAt: new Date() }
                });
                await prisma.tag.update({
                    where: { macAddress: tag_mac },
                    data: { status: "ONLINE", lastSeenAt: new Date() }
                });
            }
        } catch (err) {
            console.error("Failed to process ACK", err);
        }
    }
});

// ─── Render Worker ────────────────────────────────────────────────
const renderQueue = new Queue("render-logic", { connection: redisConnection });

const worker = new Worker(
    "render-logic",
    async (job: Job) => {
        const { tenant_id, store_id, tag_mac, design_hash, template_version_id, sku } = job.data;
        console.log(`Render job: tag=${tag_mac}`);

        const tag = await prisma.tag.findUnique({
            where: { macAddress: tag_mac },
            include: { model: true },
        });
        if (!tag) throw new Error(`Tag ${tag_mac} not found`);

        const { width, height } = tag.model;
        const hash = design_hash || `render_${template_version_id || 'default'}_${sku || 'none'}`;

        // Fetch template version and product for rendering
        let finalFabricJson = "";
        let colorMode = "BW";

        if (template_version_id && sku) {
            const [tv, prod] = await Promise.all([
                prisma.templateVersion.findUnique({ where: { id: template_version_id } }),
                prisma.product.findFirst({ where: { tenantId: tenant_id, sku } })
            ]);

            if (tv && tv.fabricJson) {
                colorMode = tv.colorMode || "BW";
                const parsed = JSON.parse(tv.fabricJson);

                if (prod) {
                    const replacements: Record<string, string> = {
                        '{{sku.name}}': prod.name || '',
                        '{{sku.price}}': `${prod.price || 0}`,
                        '{{sku.currency}}': prod.currency || '',
                        '{{sku.barcode}}': prod.barcode || '',
                        '{{sku.brand}}': prod.brand || '',
                        '{{sku.category}}': prod.category || '',
                    };
                    const replaceText = (objects: any[]) => {
                        if (!objects) return;
                        for (const obj of objects) {
                            if ((obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') && obj.text) {
                                for (const [token, val] of Object.entries(replacements)) {
                                    obj.text = obj.text.split(token).join(val);
                                }
                            }
                            if (obj.objects) replaceText(obj.objects);
                        }
                    };
                    replaceText(parsed.objects);
                }
                finalFabricJson = JSON.stringify(parsed);
            }
        }

        // Check cache
        let cached = await prisma.eSLRenderCache.findUnique({ where: { designHash: hash } });

        if (!cached) {
            let hexBlack = "";
            let hexRed: string | null = null;
            const { pack_to_hex } = await import("@esl/shared");

            if (finalFabricJson) {
                // Real render using node-canvas and fabric
                const { fabric } = require('fabric');
                const canvas = new fabric.StaticCanvas(null, { width, height });

                await new Promise<void>((resolve, reject) => {
                    canvas.loadFromJSON(finalFabricJson, () => {
                        try {
                            canvas.renderAll();
                            const ctx = canvas.getContext('2d');
                            const imageData = ctx.getImageData(0, 0, width, height).data;

                            const blackPixels = new Array(width * height).fill(0);
                            const redPixels = new Array(width * height).fill(0);

                            for (let i = 0; i < imageData.length; i += 4) {
                                const r = imageData[i];
                                const g = imageData[i + 1];
                                const b = imageData[i + 2];
                                const a = imageData[i + 3];
                                const pixelIndex = i / 4;

                                // White background is default, alpha=0 is white
                                if (a < 128) continue;

                                // Red logic: high red, low green/blue
                                if (r > 150 && g < 100 && b < 100) {
                                    redPixels[pixelIndex] = 1;
                                }
                                // Black logic: dark pixels
                                else if (r < 128 && g < 128 && b < 128) {
                                    blackPixels[pixelIndex] = 1;
                                }
                            }

                            // For Goodisplay/Waveshare e-ink, 1 is usually black/red, 0 is white.
                            // Options may require tweaking based on gateway firmware expectations.
                            hexBlack = pack_to_hex(blackPixels, width, height, { endianness: "big" });
                            if (colorMode === 'BWR') {
                                hexRed = pack_to_hex(redPixels, width, height, { endianness: "big" });
                            }
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    });
                });
            } else {
                // Fallback mock dump
                const totalPixels = width * height;
                const dummyPixels = new Array(totalPixels).fill(0);
                hexBlack = pack_to_hex(dummyPixels, width, height, { endianness: "big" });
            }

            cached = await prisma.eSLRenderCache.create({
                data: { designHash: hash, modelId: tag.modelId, width, height, hexBlack, hexRed }
            });
        }

        // Find gateway & create outbox command
        const gateway = await prisma.gateway.findFirst({ where: { storeId: store_id } });
        if (!gateway) throw new Error("No gateway found for store");

        const seq = Date.now();
        const command = await prisma.eSLCommand.create({
            data: {
                id: randomUUID(), tenantId: tenant_id, storeId: store_id,
                gatewayMac: gateway.macAddress, tagMac: tag_mac,
                seq: BigInt(seq), payloadHash: hash, status: "PENDING",
            },
        });

        // Publish MQTT
        const topic = `gateways/${gateway.macAddress}/commands/update`;
        const payload = JSON.stringify({
            command_id: command.id, tag_mac, seq: Number(seq), hex_black: cached.hexBlack,
        });

        mqttClient.publish(topic, payload, { qos: 1 }, async (err) => {
            if (!err) {
                await prisma.eSLCommand.update({ where: { id: command.id }, data: { status: "SENT" } });
            }
        });
    },
    { connection: redisConnection }
);

worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
worker.on("failed", (job, err) => console.log(`Job ${job?.id} failed: ${err.message}`));

// ─── Scheduled Jobs (BullMQ Repeatable) ───────────────────────────
const schedulerQueue = new Queue("scheduler", { connection: redisConnection });

// Setup repeatable jobs
async function setupScheduledJobs() {
    // 1. Campaign Applier – every 5 minutes
    await schedulerQueue.add("campaign-applier", {}, {
        repeat: { pattern: "*/5 * * * *" },
        jobId: "campaign-applier",
    });

    // 2. Reconcile Gateway Status – every 3 minutes
    await schedulerQueue.add("reconcile-gateways", {}, {
        repeat: { pattern: "*/3 * * * *" },
        jobId: "reconcile-gateways",
    });

    // 3. Retry Failed Commands – every 1 minute
    await schedulerQueue.add("retry-failed", {}, {
        repeat: { pattern: "* * * * *" },
        jobId: "retry-failed",
    });

    // 4. Housekeeping – daily at 3 AM
    await schedulerQueue.add("housekeeping", {}, {
        repeat: { pattern: "0 3 * * *" },
        jobId: "housekeeping",
    });

    console.log("Scheduled jobs registered.");
}

const schedulerWorker = new Worker(
    "scheduler",
    async (job: Job) => {
        const now = new Date();

        switch (job.name) {
            case "campaign-applier": {
                // Find campaigns that should be active now
                const toActivate = await prisma.campaign.findMany({
                    where: { status: "ACTIVE", startAt: { lte: now }, endAt: { gt: now } }
                });

                for (const campaign of toActivate) {
                    let tagFilter: any = { tenantId: campaign.tenantId };
                    if (campaign.storeId) tagFilter.storeId = campaign.storeId;
                    if (campaign.filterJson) {
                        const filters = JSON.parse(campaign.filterJson);
                        if (filters.skus?.length) tagFilter.productId = { in: filters.skus };
                    }

                    const tags = await prisma.tag.findMany({ where: tagFilter, take: 500 });
                    if (tags.length > 0) {
                        const jobs = tags.map(t => ({
                            name: "render-tag",
                            data: {
                                tenant_id: campaign.tenantId,
                                store_id: t.storeId,
                                tag_mac: t.macAddress,
                                template_version_id: campaign.templateVersionId,
                                sku: t.productId
                            }
                        }));
                        await renderQueue.addBulk(jobs);
                        console.log(`Campaign "${campaign.name}": queued ${jobs.length} tags`);
                    }
                }

                // Complete expired campaigns
                await prisma.campaign.updateMany({
                    where: { status: "ACTIVE", endAt: { lte: now } },
                    data: { status: "COMPLETED" }
                });
                break;
            }

            case "reconcile-gateways": {
                const threshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 min timeout
                const staleGateways = await prisma.gateway.updateMany({
                    where: { status: "ONLINE", lastSeenAt: { lt: threshold } },
                    data: { status: "OFFLINE" }
                });
                const staleTags = await prisma.tag.updateMany({
                    where: { status: "ONLINE", lastSeenAt: { lt: threshold } },
                    data: { status: "OFFLINE" }
                });
                if (staleGateways.count > 0 || staleTags.count > 0) {
                    console.log(`Reconcile: ${staleGateways.count} gateways, ${staleTags.count} tags marked OFFLINE`);
                }
                break;
            }

            case "retry-failed": {
                const retryable = await prisma.eSLCommand.findMany({
                    where: {
                        status: { in: ["PENDING", "FAILED"] },
                        attempts: { lt: 5 },
                        nextRetryAt: { lte: now }
                    },
                    take: 50
                });

                for (const cmd of retryable) {
                    const backoff = Math.pow(2, cmd.attempts) * 10000; // exponential backoff
                    await prisma.eSLCommand.update({
                        where: { id: cmd.id },
                        data: {
                            attempts: cmd.attempts + 1,
                            nextRetryAt: new Date(now.getTime() + backoff),
                            status: "PENDING"
                        }
                    });

                    // Re-publish MQTT
                    const cached = await prisma.eSLRenderCache.findUnique({ where: { designHash: cmd.payloadHash } });
                    if (cached) {
                        const topic = `gateways/${cmd.gatewayMac}/commands/update`;
                        mqttClient.publish(topic, JSON.stringify({
                            command_id: cmd.id, tag_mac: cmd.tagMac,
                            seq: Number(cmd.seq), hex_black: cached.hexBlack,
                        }), { qos: 1 }, async (err) => {
                            if (!err) {
                                await prisma.eSLCommand.update({ where: { id: cmd.id }, data: { status: "SENT" } });
                            }
                        });
                    }
                }
                if (retryable.length > 0) console.log(`Retry: re-sent ${retryable.length} commands`);
                break;
            }

            case "housekeeping": {
                // Archive old ACK'd commands (older than 30 days)
                const cutoff = new Date(now.getTime() - 30 * 86400000);
                const archived = await prisma.eSLCommand.deleteMany({
                    where: { status: "ACK", createdAt: { lt: cutoff } }
                });
                console.log(`Housekeeping: archived ${archived.count} old commands`);

                // Clean old render cache (older than 90 days)
                const cacheCutoff = new Date(now.getTime() - 90 * 86400000);
                const cleaned = await prisma.eSLRenderCache.deleteMany({
                    where: { createdAt: { lt: cacheCutoff } }
                });
                console.log(`Housekeeping: cleaned ${cleaned.count} old cache entries`);
                break;
            }
        }
    },
    { connection: redisConnection }
);

schedulerWorker.on("completed", (job) => console.log(`Scheduled job ${job.name} completed`));
schedulerWorker.on("failed", (job, err) => console.log(`Scheduled job ${job?.name} failed: ${err.message}`));

setupScheduledJobs().catch(console.error);
