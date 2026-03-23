"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
exports.requireStoreAccess = requireStoreAccess;
exports.getTenantId = getTenantId;
exports.getPagination = getPagination;
const ROLE_HIERARCHY = {
    SUPER_ADMIN: 100,
    TENANT_ADMIN: 80,
    STORE_ADMIN: 60,
    STORE_OPERATOR: 40,
};
function requireRole(minRole) {
    return async (request, reply) => {
        const user = request.user;
        if (!user || !user.role) {
            return reply.code(403).send({ error: 'Access denied: no role' });
        }
        const userLevel = ROLE_HIERARCHY[user.role] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
        if (userLevel < requiredLevel) {
            return reply.code(403).send({ error: `Access denied: requires ${minRole} or higher` });
        }
    };
}
function requireStoreAccess(getStoreId) {
    return async (request, reply) => {
        const user = request.user;
        if (!user)
            return reply.code(403).send({ error: 'Access denied' });
        // SUPER_ADMIN and TENANT_ADMIN have access to all stores
        if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
            return;
        const storeId = getStoreId(request);
        if (!storeId)
            return; // no store context required
        // STORE_ADMIN/OPERATOR: check storeScope
        if (user.storeScope) {
            try {
                const scopes = JSON.parse(user.storeScope);
                if (!scopes.includes(storeId)) {
                    return reply.code(403).send({ error: 'Access denied: store not in scope' });
                }
            }
            catch {
                return reply.code(403).send({ error: 'Invalid store scope' });
            }
        }
    };
}
// Helper to extract tenantId from JWT (all queries scoped by tenant)
function getTenantId(request) {
    return request.user.tenantId;
}
// Pagination helper
function getPagination(request, defaultSort = 'name') {
    const query = request.query;
    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 25));
    const skip = (page - 1) * pageSize;
    const sortBy = query.sortBy || defaultSort;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const search = query.search || '';
    const status = query.status || '';
    return { page, pageSize, skip, sortBy, sortDir, search, status };
}
