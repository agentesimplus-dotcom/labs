"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const design_dto_1 = require("../dtos/design.dto");
describe("DesignDTO Validator", () => {
    it("validates a correct design payload", () => {
        const validPayload = {
            width: 400,
            height: 300,
            elements: [
                {
                    type: "text",
                    x: 10,
                    y: 20,
                    width: 100,
                    height: 30,
                    color: "black",
                    text: "Price",
                    fontSize: 14,
                    fontFamily: "Arial",
                    textAlign: "left"
                },
                {
                    type: "rect",
                    x: 0,
                    y: 0,
                    width: 400,
                    height: 50,
                    color: "red",
                    fill: true
                }
            ]
        };
        const result = design_dto_1.DesignSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
    });
    it("rejects payload with invalid dimensions", () => {
        const invalidPayload = {
            width: -100,
            height: 300,
            elements: []
        };
        const result = design_dto_1.DesignSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
    });
    it("rejects elements with missing required fields", () => {
        const invalidPayload = {
            width: 400,
            height: 300,
            elements: [
                {
                    type: "text", // missing text, x, y, width, height...
                }
            ]
        };
        const result = design_dto_1.DesignSchema.safeParse(invalidPayload);
        expect(result.success).toBe(false);
    });
    it("applies default values correctly", () => {
        const defaultPayload = {
            width: 400,
            height: 300,
            elements: [
                {
                    type: "line",
                    x: 10,
                    y: 10,
                    width: 100,
                    height: 1,
                    x2: 110,
                    y2: 10
                    // missing color, thickness
                }
            ]
        };
        const result = design_dto_1.DesignSchema.safeParse(defaultPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.elements[0].color).toBe("black");
            if (result.data.elements[0].type === "line") {
                expect(result.data.elements[0].thickness).toBe(1);
            }
        }
    });
});
