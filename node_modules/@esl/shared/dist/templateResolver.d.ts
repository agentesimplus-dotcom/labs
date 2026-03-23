/**
 * Template Resolution Priority:
 * 1. TagAssignment.templateVersionId (explicit per-tag)
 * 2. StoreDefault (by tagModelId + colorMode)
 * 3. null (unassigned – no render)
 */
export declare function resolveTemplateForTag(tagMac: string, tenantId: string): Promise<{
    templateVersionId: string | null;
    sku: string | null;
    source: string;
}>;
/**
 * Normalize design data into a stable hash key.
 * key = templateVersionId + modelId + colorMode + JSON.stringify(sortedData)
 */
export declare function computeRenderCacheKey(templateVersionId: string, modelId: string, colorMode: string, data: Record<string, unknown>): string;
