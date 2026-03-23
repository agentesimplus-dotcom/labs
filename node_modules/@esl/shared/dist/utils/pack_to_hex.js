"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pack_to_hex = pack_to_hex;
/**
 * Packs an array of pixel values (0 or 1) into a hex string.
 * This simulates the Jingles v2 format or similar E-ink packing.
 */
function pack_to_hex(pixels, width, height, options = {}) {
    const isLittleEndian = options.endianness === "little";
    const invert = options.invert ?? false;
    if (pixels.length !== width * height) {
        throw new Error("Pixel array length does not match width * height");
    }
    // Row padding: Each row might need to be byte-aligned depending on the hardware.
    const bytesPerRow = Math.ceil(width / 8);
    const outBuffer = Buffer.alloc(bytesPerRow * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let pixel = pixels[y * width + x];
            if (invert) {
                pixel = pixel === 1 ? 0 : 1;
            }
            if (pixel) {
                const byteIndex = y * bytesPerRow + Math.floor(x / 8);
                const bitOffset = x % 8;
                let bitMask = 0;
                if (isLittleEndian) {
                    bitMask = 1 << bitOffset; // LSB first
                }
                else {
                    bitMask = 1 << (7 - bitOffset); // MSB first
                }
                outBuffer[byteIndex] |= bitMask;
            }
        }
    }
    return outBuffer.toString("hex").toUpperCase();
}
