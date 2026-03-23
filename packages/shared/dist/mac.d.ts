/**
 * MAC Address Utilities
 * Canonical internal format: 12 hex chars, UPPERCASE, no separators (e.g. AABBCCDDEEFF)
 */
/**
 * Normalize any MAC input to canonical format: AABBCCDDEEFF
 * Accepts: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, aabbccddeeff, etc.
 */
export declare function normalizeMac(input: string): string;
/**
 * Format a normalized MAC for display: AA:BB:CC:DD:EE:FF
 */
export declare function formatMacForDisplay(macNorm: string): string;
/**
 * Validate that input is a valid MAC address (after normalization)
 */
export declare function isValidMac(input: string): boolean;
