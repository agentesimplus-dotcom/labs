// Central API configuration
// In production, set VITE_API_URL in .env.production (e.g., http://your-server:8001)
// In development, falls back to http://localhost:3000
export const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000';
