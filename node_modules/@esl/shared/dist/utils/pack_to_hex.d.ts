export interface PackOptions {
    endianness?: "big" | "little";
    invert?: boolean;
}
/**
 * Packs an array of pixel values (0 or 1) into a hex string.
 * This simulates the Jingles v2 format or similar E-ink packing.
 */
export declare function pack_to_hex(pixels: number[], width: number, height: number, options?: PackOptions): string;
