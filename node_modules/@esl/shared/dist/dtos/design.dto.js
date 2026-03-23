"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignSchema = exports.DesignElementSchema = exports.LineElementSchema = exports.RectElementSchema = exports.TextElementSchema = exports.ElementBaseSchema = exports.ColorSchema = void 0;
const zod_1 = require("zod");
exports.ColorSchema = zod_1.z.enum(["black", "white", "red"]);
exports.ElementBaseSchema = zod_1.z.object({
    type: zod_1.z.string(),
    x: zod_1.z.number(),
    y: zod_1.z.number(),
    width: zod_1.z.number(),
    height: zod_1.z.number(),
    color: exports.ColorSchema.default("black"),
});
exports.TextElementSchema = exports.ElementBaseSchema.extend({
    type: zod_1.z.literal("text"),
    text: zod_1.z.string(),
    fontSize: zod_1.z.number().min(8),
    fontFamily: zod_1.z.string().default("Arial"),
    textAlign: zod_1.z.enum(["left", "center", "right"]).default("left"),
});
exports.RectElementSchema = exports.ElementBaseSchema.extend({
    type: zod_1.z.literal("rect"),
    fill: zod_1.z.boolean().default(true),
});
exports.LineElementSchema = exports.ElementBaseSchema.extend({
    type: zod_1.z.literal("line"),
    x2: zod_1.z.number(),
    y2: zod_1.z.number(),
    thickness: zod_1.z.number().min(1).default(1),
});
exports.DesignElementSchema = zod_1.z.discriminatedUnion("type", [
    exports.TextElementSchema,
    exports.RectElementSchema,
    exports.LineElementSchema,
]);
exports.DesignSchema = zod_1.z.object({
    width: zod_1.z.number().int().positive(),
    height: zod_1.z.number().int().positive(),
    elements: zod_1.z.array(exports.DesignElementSchema),
});
