"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const bcrypt_1 = __importDefault(require("bcrypt"));
const shared_1 = require("@esl/shared");
async function authRoutes(fastify) {
    fastify.post('/auth/login', {
        schema: {
            tags: ['Authentication'],
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string' },
                    password: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { email, password } = request.body;
        const user = await shared_1.prisma.user.findUnique({
            where: { email },
            include: { tenant: true }
        });
        if (!user || user.status !== 'ACTIVE') {
            return reply.code(401).send({ error: 'Invalid credentials or inactive user' });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }
        const token = fastify.jwt.sign({
            id: user.id,
            tenantId: user.tenantId,
            email: user.email,
            role: user.role,
            name: user.name,
            language: user.language
        }, { expiresIn: '8h' });
        return reply.send({
            token,
            tenantId: user.tenantId,
            role: user.role,
            language: user.language || (user.tenant?.defaultLanguage) || 'en',
            userName: user.name
        });
    });
    fastify.get('/auth/me', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: {
            tags: ['Authentication'],
            security: [{ bearerAuth: [] }]
        }
    }, async (request, reply) => {
        const u = request.user;
        const user = await shared_1.prisma.user.findUnique({
            where: { id: u.id },
            select: { id: true, email: true, name: true, role: true, language: true, tenantId: true, storeScope: true }
        });
        return user;
    });
    fastify.put('/auth/profile', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: {
            tags: ['Authentication'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                properties: {
                    language: { type: 'string', enum: ['en', 'es'] },
                    name: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const u = request.user;
        const { language, name } = request.body;
        const data = {};
        if (language)
            data.language = language;
        if (name)
            data.name = name;
        const updated = await shared_1.prisma.user.update({
            where: { id: u.id },
            data,
            select: { id: true, language: true, name: true }
        });
        return updated;
    });
    // PUT /auth/change-password — change own password
    fastify.put('/auth/change-password', {
        preValidation: [async (request, reply) => await fastify.authenticate(request, reply)],
        schema: {
            tags: ['Authentication'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['oldPassword', 'newPassword'],
                properties: {
                    oldPassword: { type: 'string' },
                    newPassword: { type: 'string', minLength: 8 }
                }
            }
        }
    }, async (request, reply) => {
        const u = request.user;
        const { oldPassword, newPassword } = request.body;
        const user = await shared_1.prisma.user.findUnique({ where: { id: u.id } });
        if (!user)
            return reply.code(404).send({ error: 'User not found' });
        const isMatch = await bcrypt_1.default.compare(oldPassword, user.passwordHash);
        if (!isMatch)
            return reply.code(400).send({ error: 'Current password is incorrect' });
        const hash = await bcrypt_1.default.hash(newPassword, 10);
        await shared_1.prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
        return { message: 'Password changed successfully' };
    });
}
