"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = healthRoutes;
async function healthRoutes(fastify) {
    fastify.get('/health', {
        schema: {
            tags: ['System'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        // Ideally, we'd also check DB and Redis connectivity here
        return { status: 'OK', timestamp: new Date().toISOString() };
    });
    fastify.get('/metrics', {
        schema: {
            tags: ['System']
        }
    }, async (request, reply) => {
        // In a real scenario, integrate prom-client here
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
    });
}
