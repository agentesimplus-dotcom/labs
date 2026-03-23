"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
// Fix: Prisma returns BigInt for some fields, JSON.stringify can't serialize them
BigInt.prototype.toJSON = function () { return Number(this); };
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const cors_1 = __importDefault(require("@fastify/cors"));
const bullmq_1 = require("bullmq");
const shared_1 = require("@esl/shared");
const auth_1 = __importDefault(require("./plugins/auth"));
const auth_2 = __importDefault(require("./routes/auth"));
const health_1 = __importDefault(require("./routes/health"));
const tenants_1 = __importDefault(require("./routes/tenants"));
const templates_1 = __importDefault(require("./routes/templates"));
const storeDefaults_1 = __importDefault(require("./routes/storeDefaults"));
const pairing_1 = __importDefault(require("./routes/pairing"));
const locations_1 = __importDefault(require("./routes/locations"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const preview_1 = __importDefault(require("./routes/preview"));
const stores_1 = __importDefault(require("./routes/admin/stores"));
const users_1 = __importDefault(require("./routes/admin/users"));
const products_1 = __importDefault(require("./routes/admin/products"));
const tags_1 = __importDefault(require("./routes/admin/tags"));
const imports_1 = __importDefault(require("./routes/admin/imports"));
const tenants_2 = __importDefault(require("./routes/admin/tenants"));
const gateways_1 = __importDefault(require("./routes/admin/gateways"));
const renderQueue = new bullmq_1.Queue("render-logic", {
    connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
});
const server = (0, fastify_1.default)({ logger: true });
// Register CORS
server.register(cors_1.default, {
    origin: process.env.FRONTEND_URL || true // In production, set FRONTEND_URL
});
// Register Rate Limiting
server.register(rate_limit_1.default, {
    max: 100,
    timeWindow: '1 minute'
});
// Swagger
server.register(swagger_1.default, {
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
server.register(swagger_ui_1.default, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "full", deepLinking: false },
});
// Register Plugins and Routes
server.register(auth_1.default);
server.register(health_1.default);
server.register(auth_2.default);
server.register(tenants_1.default);
server.register(templates_1.default);
server.register(storeDefaults_1.default);
server.register(pairing_1.default);
server.register(locations_1.default);
server.register(campaigns_1.default);
server.register(preview_1.default);
server.register(stores_1.default);
server.register(users_1.default);
server.register(products_1.default);
server.register(tags_1.default);
server.register(imports_1.default);
server.register(tenants_2.default);
server.register(gateways_1.default);
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
    const { store_id, updates } = request.body;
    const { tenantId } = request.user; // injected by auth
    if (!store_id || !Array.isArray(updates)) {
        return reply.status(400).send({ error: "Invalid payload format." });
    }
    const jobs = updates.map((update) => ({
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
    const macNorm = (0, shared_1.normalizeMac)(request.params.mac);
    const { tenantId } = request.user;
    const gateway = await shared_1.prisma.gateway.findFirst({
        where: { macAddress: macNorm, tenantId },
    });
    if (!gateway)
        return reply.status(404).send({ error: "Gateway not found" });
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
    const macNorm = (0, shared_1.normalizeMac)(request.params.mac);
    const { tenantId } = request.user;
    const tag = await shared_1.prisma.tag.findFirst({
        where: { macAddress: macNorm, tenantId },
    });
    if (!tag)
        return reply.status(404).send({ error: "Tag not found" });
    return tag;
});
const start = async () => {
    try {
        const port = parseInt(process.env.API_PORT || '3000', 10);
        await server.listen({ port, host: "0.0.0.0" });
        server.log.info(`API server is running on port ${port}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
