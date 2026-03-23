import { useAuthStore } from '../stores/authStore';

let toastCallback: ((msg: string, type: 'error' | 'success' | 'warning') => void) | null = null;

export function setToastCallback(cb: typeof toastCallback) {
    toastCallback = cb;
}

/**
 * Wrapper around fetch() that auto-injects auth headers and handles 401 responses.
 * On 401: clears auth state, redirects to /login, and shows a toast notification.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = useAuthStore.getState().token;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        useAuthStore.getState().logout();
        if (toastCallback) {
            toastCallback('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
        }
        // Redirect to login — use window.location to ensure full navigation
        window.location.href = '/login';
    }

    return response;
}
