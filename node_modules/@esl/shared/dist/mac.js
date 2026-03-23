"use strict";
/**
 * MAC Address Utilities
 * Canonical internal format: 12 hex chars, UPPERCASE, no separators (e.g. AABBCCDDEEFF)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMac = normalizeMac;
exports.formatMacForDisplay = formatMacForDisplay;
exports.isValidMac = isValidMac;
/**
 * Normalize any MAC input to canonical format: AABBCCDDEEFF
 * Accepts: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, aabbccddeeff, etc.
 */
function normalizeMac(input) {
    return input.replace(/[:\-.\s]/g, '').toUpperCase();
}
/**
 * Format a normalized MAC for display: AA:BB:CC:DD:EE:FF
 */
function formatMacForDisplay(macNorm) {
    const clean = macNorm.replace(/[:\-.\s]/g, '').toUpperCase();
    return clean.match(/.{1,2}/g)?.join(':') || clean;
}
/**
 * Validate that input is a valid MAC address (after normalization)
 */
function isValidMac(input) {
    const norm = normalizeMac(input);
    return /^[0-9A-F]{12}$/.test(norm);
}
