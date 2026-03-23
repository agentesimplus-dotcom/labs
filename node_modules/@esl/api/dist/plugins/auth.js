"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const shared_1 = require("@esl/shared");
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'supersecret_esl_platform_key_2026'
    });
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            const apiKey = request.headers['x-api-key'];
            if (apiKey) {
                // Simplified ApiKey logic: Here we would hash the input key and compare with DB.
                // For now, we compare direct values as prototype (in production strictly hash).
                const keyRecord = await shared_1.prisma.apiKey.findUnique({
                    where: { keyHash: apiKey }
                });
                if (!keyRecord || keyRecord.status !== 'ACTIVE') {
                    return reply.status(401).send({ error: 'Invalid API Key' });
                }
                if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
                    return reply.status(401).send({ error: 'API Key Expired' });
                }
                request.user = {
                    id: keyRecord.userId || 'api-key-user',
                    tenantId: keyRecord.tenantId,
                    scopes: keyRecord.scopes.split(','),
                    type: 'api-key'
                };
                return;
            }
            // Fallback to Bearer JWT Token
            await request.jwtVerify();
            // Decorates request.user with the payload
        }
        catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });
});
