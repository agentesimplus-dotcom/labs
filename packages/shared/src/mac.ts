/**
 * MAC Address Utilities
 * Canonical internal format: 12 hex chars, UPPERCASE, no separators (e.g. AABBCCDDEEFF)
 */

/**
 * Normalize any MAC input to canonical format: AABBCCDDEEFF
 * Accepts: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, aabbccddeeff, etc.
 */
export function normalizeMac(input: string): string {
    return input.replace(/[:\-.\s]/g, '').toUpperCase();
}

/**
 * Format a normalized MAC for display: AA:BB:CC:DD:EE:FF
 */
export function formatMacForDisplay(macNorm: string): string {
    const clean = macNorm.replace(/[:\-.\s]/g, '').toUpperCase();
    return clean.match(/.{1,2}/g)?.join(':') || clean;
}

/**
 * Validate that input is a valid MAC address (after normalization)
 */
export function isValidMac(input: string): boolean {
    const norm = normalizeMac(input);
    return /^[0-9A-F]{12}$/.test(norm);
}
