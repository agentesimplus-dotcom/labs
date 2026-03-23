"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pack_to_hex_1 = require("../utils/pack_to_hex");
describe("pack_to_hex", () => {
    it("packs an 8x1 image MSB-first correctly", () => {
        // 10101011 = 0xAB
        const pixels = [1, 0, 1, 0, 1, 0, 1, 1];
        const hex = (0, pack_to_hex_1.pack_to_hex)(pixels, 8, 1, { endianness: "big" });
        expect(hex).toBe("AB");
    });
    it("packs an 8x1 image LSB-first correctly", () => {
        // 10101011 LSB first:
        // bit 0=1, bit 1=0, bit 2=1, bit 3=0, bit 4=1, bit 5=0, bit 6=1, bit 7=1
        // 1 + 4 + 16 + 64 + 128 = 213 = 0xD5
        const pixels = [1, 0, 1, 0, 1, 0, 1, 1];
        const hex = (0, pack_to_hex_1.pack_to_hex)(pixels, 8, 1, { endianness: "little" });
        expect(hex).toBe("D5");
    });
    it("handles width not multiple of 8 (row padding)", () => {
        // width 10, height 2
        // Row 1: 11111111 10 (padded to 2 bytes) -> FF 80
        // Row 2: 00000000 01 (padded to 2 bytes) -> 00 40
        const pixels = [
            1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 1
        ];
        const hex = (0, pack_to_hex_1.pack_to_hex)(pixels, 10, 2, { endianness: "big" });
        expect(hex).toBe("FF800040");
    });
    it("inverts pixels when invert options is passed", () => {
        // All 0s but inverted implies all 1s -> FF
        const pixels = [0, 0, 0, 0, 0, 0, 0, 0];
        const hex = (0, pack_to_hex_1.pack_to_hex)(pixels, 8, 1, { endianness: "big", invert: true });
        expect(hex).toBe("FF");
    });
});
