"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminImportsRoutes;
const shared_1 = require("@esl/shared");
const rbac_1 = require("../../plugins/rbac");
async function adminImportsRoutes(fastify) {
    fastify.addHook('preValidation', async (request, reply) => await fastify.authenticate(request, reply));
    // GET /admin/imports - list import history
    fastify.get('/admin/imports', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Admin - Imports'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const { skip, pageSize, sortDir } = (0, rbac_1.getPagination)(request);
        const query = request.query;
        const where = { tenantId };
        if (query.entity)
            where.entity = query.entity;
        if (query.status)
            where.status = query.status;
        const [data, total] = await Promise.all([
            shared_1.prisma.import.findMany({ where, skip, take: pageSize, orderBy: { createdAt: sortDir } }),
            shared_1.prisma.import.count({ where })
        ]);
        return { data, total, page: Math.floor(skip / pageSize) + 1, pageSize };
    });
    // POST /imports/prepare - dry-run validation
    fastify.post('/imports/prepare', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Imports'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const tenantId = (0, rbac_1.getTenantId)(request);
        const user = request.user;
        const { entity, rows, mapping, mode } = request.body;
        // Create import record in VALIDATING state
        const imp = await shared_1.prisma.import.create({
            data: {
                tenantId, entity, status: 'VALIDATING', mode: mode || 'UPSERT',
                mappingJson: JSON.stringify(mapping), totalRows: rows.length,
                createdBy: user.id
            }
        });
        // Run validation (dry-run)
        const errors = [];
        const validRows = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowErrors = await validateRow(entity, row, mapping, tenantId, i + 1);
            if (rowErrors.length > 0) {
                errors.push(...rowErrors);
            }
            else {
                validRows.push(row);
            }
        }
        // Save errors to DB
        if (errors.length > 0) {
            await shared_1.prisma.importError.createMany({
                data: errors.map(e => ({
                    importId: imp.id, rowNumber: e.rowNumber, field: e.field,
                    errorMessage: e.message, rawRowJson: JSON.stringify(e.rawRow)
                }))
            });
        }
        await shared_1.prisma.import.update({
            where: { id: imp.id },
            data: { status: 'VALIDATED', errorCount: errors.length, successCount: validRows.length }
        });
        return {
            importId: imp.id, totalRows: rows.length,
            validCount: validRows.length, errorCount: errors.length,
            errors: errors.slice(0, 50) // preview first 50 errors
        };
    });
    // POST /imports/execute - execute import
    fastify.post('/imports/execute', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Imports'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { importId, rows, mapping } = request.body;
        const tenantId = (0, rbac_1.getTenantId)(request);
        const user = request.user;
        const imp = await shared_1.prisma.import.findFirst({ where: { id: importId, tenantId } });
        if (!imp)
            return reply.code(404).send({ error: 'Import not found' });
        await shared_1.prisma.import.update({ where: { id: importId }, data: { status: 'PROCESSING' } });
        // Process in chunks
        const CHUNK_SIZE = 500;
        let successCount = 0;
        let errorCount = 0;
        const finalErrors = [];
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            for (let j = 0; j < chunk.length; j++) {
                try {
                    await upsertRow(imp.entity, chunk[j], mapping, tenantId, imp.mode);
                    successCount++;
                }
                catch (err) {
                    errorCount++;
                    finalErrors.push({
                        rowNumber: i + j + 1, field: null,
                        message: err.message, rawRow: chunk[j]
                    });
                }
            }
        }
        // Save final errors
        if (finalErrors.length > 0) {
            await shared_1.prisma.importError.createMany({
                data: finalErrors.map(e => ({
                    importId, rowNumber: e.rowNumber, field: e.field,
                    errorMessage: e.message, rawRowJson: JSON.stringify(e.rawRow)
                }))
            });
        }
        await shared_1.prisma.import.update({
            where: { id: importId },
            data: { status: 'COMPLETED', successCount, errorCount, completedAt: new Date() }
        });
        return { importId, successCount, errorCount };
    });
    // GET /imports/:id/status
    fastify.get('/imports/:id/status', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Imports'], security: [{ bearerAuth: [] }] }
    }, async (request) => {
        const { id } = request.params;
        const tenantId = (0, rbac_1.getTenantId)(request);
        return shared_1.prisma.import.findFirst({ where: { id, tenantId } });
    });
    // GET /imports/:id/errors.csv
    fastify.get('/imports/:id/errors.csv', {
        preHandler: [(0, rbac_1.requireRole)('STORE_ADMIN')],
        schema: { tags: ['Imports'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const { id } = request.params;
        const errors = await shared_1.prisma.importError.findMany({ where: { importId: id }, orderBy: { rowNumber: 'asc' } });
        const csv = ['row_number,field,error_message,raw_row'];
        for (const e of errors) {
            csv.push(`${e.rowNumber},"${e.field || ''}","${e.errorMessage.replace(/"/g, '""')}","${(e.rawRowJson || '').replace(/"/g, '""')}"`);
        }
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename=import_${id}_errors.csv`);
        return csv.join('\n');
    });
    // GET /imports/templates/:entity - download CSV template
    fastify.get('/imports/templates/:entity', {
        schema: { tags: ['Imports'] }
    }, async (request, reply) => {
        const { entity } = request.params;
        const templates = {
            PRODUCTS: 'sku,name,category,brand,barcode,price,currency',
            TAGS: 'mac_address,store_code,model_name',
            GATEWAYS: 'mac_address,store_code,firmware_version',
            STORES: 'code,name,timezone,address',
            USERS: 'email,name,role,language',
            LOCATION_SLOTS: 'store_code,zone_name,slot_code'
        };
        const header = templates[entity] || 'field1,field2';
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename=${entity.toLowerCase()}_template.csv`);
        return header + '\n';
    });
}
// ─── Validation helpers ────────────────────────────────────────────
async function validateRow(entity, row, mapping, tenantId, rowNum) {
    const errors = [];
    const mapped = applyMapping(row, mapping);
    switch (entity) {
        case 'PRODUCTS':
            if (!mapped.sku)
                errors.push({ rowNumber: rowNum, field: 'sku', message: 'SKU is required', rawRow: row });
            if (!mapped.name)
                errors.push({ rowNumber: rowNum, field: 'name', message: 'Name is required', rawRow: row });
            break;
        case 'TAGS':
            if (!mapped.mac_address)
                errors.push({ rowNumber: rowNum, field: 'mac_address', message: 'MAC address is required', rawRow: row });
            else if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mapped.mac_address.trim()))
                errors.push({ rowNumber: rowNum, field: 'mac_address', message: 'Invalid MAC format (XX:XX:XX:XX:XX:XX)', rawRow: row });
            if (!mapped.store_code && !mapped.store_id)
                errors.push({ rowNumber: rowNum, field: 'store_code', message: 'Store code or store_id is required', rawRow: row });
            if (!mapped.model_name && !mapped.model_id)
                errors.push({ rowNumber: rowNum, field: 'model_name', message: 'Model name or model_id is required', rawRow: row });
            break;
        case 'GATEWAYS':
            if (!mapped.mac_address)
                errors.push({ rowNumber: rowNum, field: 'mac_address', message: 'MAC address is required', rawRow: row });
            if (!mapped.store_code && !mapped.store_id)
                errors.push({ rowNumber: rowNum, field: 'store_code', message: 'Store code or store_id is required', rawRow: row });
            break;
        case 'STORES':
            if (!mapped.code)
                errors.push({ rowNumber: rowNum, field: 'code', message: 'Code is required', rawRow: row });
            if (!mapped.name)
                errors.push({ rowNumber: rowNum, field: 'name', message: 'Name is required', rawRow: row });
            break;
        case 'USERS':
            if (!mapped.email)
                errors.push({ rowNumber: rowNum, field: 'email', message: 'Email is required', rawRow: row });
            if (!mapped.name)
                errors.push({ rowNumber: rowNum, field: 'name', message: 'Name is required', rawRow: row });
            break;
    }
    return errors;
}
function applyMapping(row, mapping) {
    const result = {};
    if (!mapping)
        return row;
    for (const [sourceCol, targetField] of Object.entries(mapping)) {
        if (targetField && targetField !== '__skip__') {
            result[targetField] = row[sourceCol];
        }
    }
    return Object.keys(result).length > 0 ? result : row;
}
async function upsertRow(entity, row, mapping, tenantId, mode) {
    const data = applyMapping(row, mapping);
    switch (entity) {
        case 'PRODUCTS': {
            const sku = (data.sku || '').trim();
            if (!sku)
                throw new Error('SKU is required');
            if (mode === 'CREATE_ONLY') {
                await shared_1.prisma.product.create({ data: { tenantId, sku, name: data.name, category: data.category, brand: data.brand, barcode: data.barcode, price: parseFloat(data.price) || 0, currency: data.currency || 'USD' } });
            }
            else if (mode === 'UPDATE_ONLY') {
                await shared_1.prisma.product.update({ where: { tenantId_sku: { tenantId, sku } }, data: { name: data.name, category: data.category, brand: data.brand, barcode: data.barcode, price: parseFloat(data.price) || 0 } });
            }
            else {
                await shared_1.prisma.product.upsert({ where: { tenantId_sku: { tenantId, sku } }, update: { name: data.name, category: data.category, brand: data.brand, barcode: data.barcode, price: parseFloat(data.price) || 0 }, create: { tenantId, sku, name: data.name, category: data.category, brand: data.brand, barcode: data.barcode, price: parseFloat(data.price) || 0, currency: data.currency || 'USD' } });
            }
            break;
        }
        case 'TAGS': {
            const mac = (data.mac_address || '').toUpperCase().trim();
            if (!mac)
                throw new Error('MAC address is required');
            // Resolve store by code
            let storeId = data.store_id;
            if (!storeId && data.store_code) {
                const store = await shared_1.prisma.store.findFirst({ where: { tenantId, code: data.store_code.trim() } });
                if (!store)
                    throw new Error(`Store not found: ${data.store_code}`);
                storeId = store.id;
            }
            // Resolve model by name
            let modelId = data.model_id;
            if (!modelId && data.model_name) {
                const model = await shared_1.prisma.tagModel.findFirst({ where: { name: data.model_name.trim() } });
                if (!model)
                    throw new Error(`Tag model not found: ${data.model_name}`);
                modelId = model.id;
            }
            await shared_1.prisma.tag.upsert({
                where: { macAddress: mac },
                update: { storeId, modelId },
                create: { macAddress: mac, tenantId, storeId, modelId, status: 'UNKNOWN' }
            });
            break;
        }
        case 'GATEWAYS': {
            const mac = (data.mac_address || '').toUpperCase().trim();
            let storeId = data.store_id;
            if (!storeId && data.store_code) {
                const store = await shared_1.prisma.store.findFirst({ where: { tenantId, code: data.store_code.trim() } });
                if (!store)
                    throw new Error(`Store not found: ${data.store_code}`);
                storeId = store.id;
            }
            await shared_1.prisma.gateway.upsert({
                where: { macAddress: mac },
                update: { storeId, firmwareVersion: data.firmware_version },
                create: { macAddress: mac, tenantId, storeId, status: 'UNKNOWN', firmwareVersion: data.firmware_version }
            });
            break;
        }
        case 'STORES': {
            const code = (data.code || '').trim();
            await shared_1.prisma.store.upsert({
                where: { tenantId_code: { tenantId, code } },
                update: { name: data.name, timezone: data.timezone || 'UTC', address: data.address },
                create: { tenantId, code, name: data.name, timezone: data.timezone || 'UTC', address: data.address }
            });
            break;
        }
        case 'USERS': {
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
            const email = (data.email || '').trim().toLowerCase();
            const hash = await bcrypt.hash(data.password || 'changeme123', 10);
            await shared_1.prisma.user.upsert({
                where: { email },
                update: { name: data.name, role: data.role || 'STORE_OPERATOR', language: data.language || 'en' },
                create: { tenantId, email, name: data.name, passwordHash: hash, role: data.role || 'STORE_OPERATOR', language: data.language || 'en' }
            });
            break;
        }
    }
}
