import { z } from "zod";

export const ColorSchema = z.enum(["black", "white", "red"]);

export const ElementBaseSchema = z.object({
    type: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: ColorSchema.default("black"),
});

export const TextElementSchema = ElementBaseSchema.extend({
    type: z.literal("text"),
    text: z.string(),
    fontSize: z.number().min(8),
    fontFamily: z.string().default("Arial"),
    textAlign: z.enum(["left", "center", "right"]).default("left"),
});

export const RectElementSchema = ElementBaseSchema.extend({
    type: z.literal("rect"),
    fill: z.boolean().default(true),
});

export const LineElementSchema = ElementBaseSchema.extend({
    type: z.literal("line"),
    x2: z.number(),
    y2: z.number(),
    thickness: z.number().min(1).default(1),
});

export const DesignElementSchema = z.discriminatedUnion("type", [
    TextElementSchema,
    RectElementSchema,
    LineElementSchema,
]);

export const DesignSchema = z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    elements: z.array(DesignElementSchema),
});

export type DesignDTO = z.infer<typeof DesignSchema>;
