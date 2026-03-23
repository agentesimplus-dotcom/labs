import { z } from "zod";
export declare const ColorSchema: z.ZodEnum<["black", "white", "red"]>;
export declare const ElementBaseSchema: z.ZodObject<{
    type: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
}, {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: "black" | "white" | "red" | undefined;
}>;
export declare const TextElementSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
} & {
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
    fontSize: z.ZodNumber;
    fontFamily: z.ZodDefault<z.ZodString>;
    textAlign: z.ZodDefault<z.ZodEnum<["left", "center", "right"]>>;
}, "strip", z.ZodTypeAny, {
    type: "text";
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
    text: string;
    fontSize: number;
    fontFamily: string;
    textAlign: "left" | "center" | "right";
}, {
    type: "text";
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize: number;
    color?: "black" | "white" | "red" | undefined;
    fontFamily?: string | undefined;
    textAlign?: "left" | "center" | "right" | undefined;
}>;
export declare const RectElementSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
} & {
    type: z.ZodLiteral<"rect">;
    fill: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
    fill: boolean;
}, {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    color?: "black" | "white" | "red" | undefined;
    fill?: boolean | undefined;
}>;
export declare const LineElementSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
} & {
    type: z.ZodLiteral<"line">;
    x2: z.ZodNumber;
    y2: z.ZodNumber;
    thickness: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "line";
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
    x2: number;
    y2: number;
    thickness: number;
}, {
    type: "line";
    x: number;
    y: number;
    width: number;
    height: number;
    x2: number;
    y2: number;
    color?: "black" | "white" | "red" | undefined;
    thickness?: number | undefined;
}>;
export declare const DesignElementSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
} & {
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
    fontSize: z.ZodNumber;
    fontFamily: z.ZodDefault<z.ZodString>;
    textAlign: z.ZodDefault<z.ZodEnum<["left", "center", "right"]>>;
}, "strip", z.ZodTypeAny, {
    type: "text";
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
    text: string;
    fontSize: number;
    fontFamily: string;
    textAlign: "left" | "center" | "right";
}, {
    type: "text";
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize: number;
    color?: "black" | "white" | "red" | undefined;
    fontFamily?: string | undefined;
    textAlign?: "left" | "center" | "right" | undefined;
}>, z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
} & {
    type: z.ZodLiteral<"rect">;
    fill: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
    fill: boolean;
}, {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    color?: "black" | "white" | "red" | undefined;
    fill?: boolean | undefined;
}>, z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
} & {
    type: z.ZodLiteral<"line">;
    x2: z.ZodNumber;
    y2: z.ZodNumber;
    thickness: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "line";
    x: number;
    y: number;
    width: number;
    height: number;
    color: "black" | "white" | "red";
    x2: number;
    y2: number;
    thickness: number;
}, {
    type: "line";
    x: number;
    y: number;
    width: number;
    height: number;
    x2: number;
    y2: number;
    color?: "black" | "white" | "red" | undefined;
    thickness?: number | undefined;
}>]>;
export declare const DesignSchema: z.ZodObject<{
    width: z.ZodNumber;
    height: z.ZodNumber;
    elements: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
    } & {
        type: z.ZodLiteral<"text">;
        text: z.ZodString;
        fontSize: z.ZodNumber;
        fontFamily: z.ZodDefault<z.ZodString>;
        textAlign: z.ZodDefault<z.ZodEnum<["left", "center", "right"]>>;
    }, "strip", z.ZodTypeAny, {
        type: "text";
        x: number;
        y: number;
        width: number;
        height: number;
        color: "black" | "white" | "red";
        text: string;
        fontSize: number;
        fontFamily: string;
        textAlign: "left" | "center" | "right";
    }, {
        type: "text";
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
        fontSize: number;
        color?: "black" | "white" | "red" | undefined;
        fontFamily?: string | undefined;
        textAlign?: "left" | "center" | "right" | undefined;
    }>, z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
    } & {
        type: z.ZodLiteral<"rect">;
        fill: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "rect";
        x: number;
        y: number;
        width: number;
        height: number;
        color: "black" | "white" | "red";
        fill: boolean;
    }, {
        type: "rect";
        x: number;
        y: number;
        width: number;
        height: number;
        color?: "black" | "white" | "red" | undefined;
        fill?: boolean | undefined;
    }>, z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        color: z.ZodDefault<z.ZodEnum<["black", "white", "red"]>>;
    } & {
        type: z.ZodLiteral<"line">;
        x2: z.ZodNumber;
        y2: z.ZodNumber;
        thickness: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "line";
        x: number;
        y: number;
        width: number;
        height: number;
        color: "black" | "white" | "red";
        x2: number;
        y2: number;
        thickness: number;
    }, {
        type: "line";
        x: number;
        y: number;
        width: number;
        height: number;
        x2: number;
        y2: number;
        color?: "black" | "white" | "red" | undefined;
        thickness?: number | undefined;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    elements: ({
        type: "text";
        x: number;
        y: number;
        width: number;
        height: number;
        color: "black" | "white" | "red";
        text: string;
        fontSize: number;
        fontFamily: string;
        textAlign: "left" | "center" | "right";
    } | {
        type: "rect";
        x: number;
        y: number;
        width: number;
        height: number;
        color: "black" | "white" | "red";
        fill: boolean;
    } | {
        type: "line";
        x: number;
        y: number;
        width: number;
        height: number;
        color: "black" | "white" | "red";
        x2: number;
        y2: number;
        thickness: number;
    })[];
}, {
    width: number;
    height: number;
    elements: ({
        type: "text";
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
        fontSize: number;
        color?: "black" | "white" | "red" | undefined;
        fontFamily?: string | undefined;
        textAlign?: "left" | "center" | "right" | undefined;
    } | {
        type: "rect";
        x: number;
        y: number;
        width: number;
        height: number;
        color?: "black" | "white" | "red" | undefined;
        fill?: boolean | undefined;
    } | {
        type: "line";
        x: number;
        y: number;
        width: number;
        height: number;
        x2: number;
        y2: number;
        color?: "black" | "white" | "red" | undefined;
        thickness?: number | undefined;
    })[];
}>;
export type DesignDTO = z.infer<typeof DesignSchema>;
