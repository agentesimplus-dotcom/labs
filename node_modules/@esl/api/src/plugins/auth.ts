import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { prisma } from '@esl/shared';

export default fp(async (fastify: FastifyInstance) => {
    fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET || 'supersecret_esl_platform_key_2026'
    });

    fastify.decorate(
        'authenticate',
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const apiKey = request.headers['x-api-key'] as string;

                if (apiKey) {
                    // Simplified ApiKey logic: Here we would hash the input key and compare with DB.
                    // For now, we compare direct values as prototype (in production strictly hash).
                    const keyRecord = await prisma.apiKey.findUnique({
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
            } catch (err) {
                reply.status(401).send({ error: 'Unauthorized' });
            }
        }
    );
});

// Declare user scope types for TypeScript
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: any;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: { id: string; tenantId: string; email: string; role?: string; name?: string; language?: string };
        user: { id: string; tenantId: string; email?: string; role?: string; name?: string; language?: string; storeScope?: string; scopes?: string[]; type?: string };
    }
}
