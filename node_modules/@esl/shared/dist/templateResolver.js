"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplateForTag = resolveTemplateForTag;
exports.computeRenderCacheKey = computeRenderCacheKey;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Template Resolution Priority:
 * 1. TagAssignment.templateVersionId (explicit per-tag)
 * 2. StoreDefault (by tagModelId + colorMode)
 * 3. null (unassigned – no render)
 */
async function resolveTemplateForTag(tagMac, tenantId) {
    // 1. Check explicit assignment
    const assignment = await prisma.tagAssignment.findUnique({
        where: { tagMac },
        include: { templateVersion: true }
    });
    if (assignment?.templateVersionId) {
        return {
            templateVersionId: assignment.templateVersionId,
            sku: assignment.sku,
            source: 'ASSIGNMENT'
        };
    }
    // 2. Resolve SKU from assignment or product placement
    let sku = assignment?.sku || null;
    if (!sku && assignment?.locationSlotId) {
        const placement = await prisma.productPlacement.findFirst({
            where: { locationSlotId: assignment.locationSlotId, active: true },
            orderBy: { effectiveFrom: 'desc' }
        });
        sku = placement?.sku || null;
    }
    // 3. Check store default by tag model + color mode
    const tag = await prisma.tag.findUnique({
        where: { macAddress: tagMac },
        include: { model: true }
    });
    if (tag) {
        const colorMode = tag.model.supportsRed ? 'BWR' : 'BW';
        const storeDefault = await prisma.storeDefault.findUnique({
            where: {
                storeId_tagModelId_colorMode: {
                    storeId: tag.storeId,
                    tagModelId: tag.modelId,
                    colorMode
                }
            }
        });
        if (storeDefault) {
            return {
                templateVersionId: storeDefault.templateVersionId,
                sku,
                source: 'STORE_DEFAULT'
            };
        }
    }
    // 4. No template found
    return { templateVersionId: null, sku, source: 'NONE' };
}
/**
 * Normalize design data into a stable hash key.
 * key = templateVersionId + modelId + colorMode + JSON.stringify(sortedData)
 */
function computeRenderCacheKey(templateVersionId, modelId, colorMode, data) {
    const normalizedData = JSON.stringify(data, Object.keys(data).sort());
    const crypto = require('crypto');
    return crypto.createHash('sha256')
        .update(`${templateVersionId}:${modelId}:${colorMode}:${normalizedData}`)
        .digest('hex');
}
