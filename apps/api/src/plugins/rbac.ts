import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'STORE_ADMIN' | 'STORE_OPERATOR';

const ROLE_HIERARCHY: Record<Role, number> = {
    SUPER_ADMIN: 100,
    TENANT_ADMIN: 80,
    STORE_ADMIN: 60,
    STORE_OPERATOR: 40,
};

export function requireRole(minRole: Role) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        if (!user || !user.role) {
            return reply.code(403).send({ error: 'Access denied: no role' });
        }
        const userLevel = ROLE_HIERARCHY[user.role as Role] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
        if (userLevel < requiredLevel) {
            return reply.code(403).send({ error: `Access denied: requires ${minRole} or higher` });
        }
    };
}

export function requireStoreAccess(getStoreId: (request: FastifyRequest) => string | undefined) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        if (!user) return reply.code(403).send({ error: 'Access denied' });

        // SUPER_ADMIN and TENANT_ADMIN have access to all stores
        if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') return;

        const storeId = getStoreId(request);
        if (!storeId) return; // no store context required

        // STORE_ADMIN/OPERATOR: check storeScope
        if (user.storeScope) {
            try {
                const scopes: string[] = JSON.parse(user.storeScope);
                if (!scopes.includes(storeId)) {
                    return reply.code(403).send({ error: 'Access denied: store not in scope' });
                }
            } catch {
                return reply.code(403).send({ error: 'Invalid store scope' });
            }
        }
    };
}

// Helper to extract tenantId from JWT (all queries scoped by tenant)
export function getTenantId(request: FastifyRequest): string {
    return (request.user as any).tenantId;
}

// Pagination helper
export function getPagination(request: FastifyRequest, defaultSort: string = 'name') {
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 25));
    const skip = (page - 1) * pageSize;
    const sortBy = query.sortBy || defaultSort;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const search = query.search || '';
    const status = query.status || '';
    return { page, pageSize, skip, sortBy, sortDir, search, status };
}
