import 'dotenv/config';
import Fastify from "fastify";

// Fix: Prisma returns BigInt for some fields, JSON.stringify can't serialize them
(BigInt.prototype as any).toJSON = function () { return Number(this); };
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyCors from "@fastify/cors";
import { Queue } from "bullmq";
import { prisma, normalizeMac } from "@esl/shared";
import { randomUUID } from "crypto";

import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import healthRoutes from "./routes/health";
import tenantRoutes from "./routes/tenants";
import templateRoutes from "./routes/templates";
import storeDefaultRoutes from "./routes/storeDefaults";
import pairingRoutes from "./routes/pairing";
import locationRoutes from "./routes/locations";
import campaignRoutes from "./routes/campaigns";
import previewRoutes from "./routes/preview";
import adminStoresRoutes from "./routes/admin/stores";
import adminUsersRoutes from "./routes/admin/users";
import adminProductsRoutes from "./routes/admin/products";
import adminTagsRoutes from "./routes/admin/tags";
import adminImportsRoutes from "./routes/admin/imports";
import adminTenantsRoutes from "./routes/admin/tenants";
import adminGatewaysRoutes from "./routes/admin/gateways";

const renderQueue = new Queue("render-logic", {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
});

const server = Fastify({ logger: true });

// Register CORS
server.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || true // In production, set FRONTEND_URL
});

// Register Rate Limiting
server.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute'
});

// Swagger
server.register(fastifySwagger, {
    openapi: {
        info: {
            title: "ESL Platform API",
            description: "API for ESL Enterprise Multi-Tenant Gateway and Tag management",
            version: "3.0.0",
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                apiKey: {
                    type: "apiKey",
                    name: "x-api-key",
                    in: "header"
                }
            },
        },
    },
});

server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "full", deepLinking: false },
});

// Register Plugins and Routes
server.register(authPlugin);
server.register(healthRoutes);
server.register(authRoutes);
server.register(tenantRoutes);
server.register(templateRoutes);
server.register(storeDefaultRoutes);
server.register(pairingRoutes);
server.register(locationRoutes);
server.register(campaignRoutes);
server.register(previewRoutes);
server.register(adminStoresRoutes);
server.register(adminUsersRoutes);
server.register(adminProductsRoutes);
server.register(adminTagsRoutes);
server.register(adminImportsRoutes);
server.register(adminTenantsRoutes);
server.register(adminGatewaysRoutes);

server.post("/tags/bulk-update", {
    preValidation: [async (request, reply) => await server.authenticate(request, reply)],
    schema: {
        tags: ["Tags"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
            type: "object",
            required: ["store_id", "updates"],
            properties: {
                store_id: { type: "string" },
                updates: { type: "array", items: { type: "object" } }
            }
        }
    }
}, async (request, reply) => {
    const { store_id, updates } = request.body as any;
    const { tenantId } = request.user; // injected by auth

    if (!store_id || !Array.isArray(updates)) {
        return reply.status(400).send({ error: "Invalid payload format." });
    }

    const jobs = updates.map((update: any) => ({
        name: "render-tag",
        data: {
            tenant_id: tenantId,
            store_id,
            tag_mac: update.tag_mac,
            design_hash: update.design_hash,
            design: update.design,
        },
    }));

    await renderQueue.addBulk(jobs);

    return { message: `${jobs.length} tags queued for update.` };
});

server.get("/gateways/:mac/status", {
    preValidation: [async (request, reply) => await server.authenticate(request, reply)],
    schema: {
        tags: ["Gateways"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
            type: "object",
            properties: {
                mac: { type: "string" }
            }
        }
    }
}, async (request, reply) => {
    const macNorm = normalizeMac((request.params as any).mac);
    const { tenantId } = request.user;

    const gateway = await prisma.gateway.findFirst({
        where: { macAddress: macNorm, tenantId },
    });

    if (!gateway) return reply.status(404).send({ error: "Gateway not found" });

    return gateway;
});

server.get("/tags/:mac/status", {
    preValidation: [async (request, reply) => await server.authenticate(request, reply)],
    schema: {
        tags: ["Tags"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
            type: "object",
            properties: {
                mac: { type: "string" }
            }
        }
    }
}, async (request, reply) => {
    const macNorm = normalizeMac((request.params as any).mac);
    const { tenantId } = request.user;

    const tag = await prisma.tag.findFirst({
        where: { macAddress: macNorm, tenantId },
    });

    if (!tag) return reply.status(404).send({ error: "Tag not found" });

    return tag;
});

const start = async () => {
    try {
        const port = parseInt(process.env.API_PORT || '3000', 10);
        await server.listen({ port, host: "0.0.0.0" });
        server.log.info(`API server is running on port ${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
