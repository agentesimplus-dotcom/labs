import { create } from 'zustand';
import i18n from '../i18n/i18n';
import { API_URL } from '../config';

interface AuthState {
    token: string | null;
    tenantId: string | null;
    role: string | null;
    language: string | null;
    userName: string | null;
    setAuth: (token: string, tenantId: string, role?: string, language?: string, userName?: string) => void;
    setLanguage: (lang: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem('esl_token'),
    tenantId: localStorage.getItem('esl_tenant'),
    role: localStorage.getItem('esl_role'),
    language: localStorage.getItem('esl_language') || 'en',
    userName: localStorage.getItem('esl_userName'),
    setAuth: (token, tenantId, role, language, userName) => {
        localStorage.setItem('esl_token', token);
        localStorage.setItem('esl_tenant', tenantId);
        if (role) localStorage.setItem('esl_role', role);
        if (language) {
            localStorage.setItem('esl_language', language);
            i18n.changeLanguage(language);
        }
        if (userName) localStorage.setItem('esl_userName', userName);
        set({ token, tenantId, role: role || null, language: language || 'en', userName: userName || null });
    },
    setLanguage: (lang) => {
        localStorage.setItem('esl_language', lang);
        i18n.changeLanguage(lang);
        set({ language: lang });
        // Also persist to backend (fire-and-forget)
        const token = localStorage.getItem('esl_token');
        if (token) {
            fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ language: lang })
            }).catch(() => { }); // silent fail
        }
    },
    logout: () => {
        localStorage.removeItem('esl_token');
        localStorage.removeItem('esl_tenant');
        localStorage.removeItem('esl_role');
        localStorage.removeItem('esl_language');
        localStorage.removeItem('esl_userName');
        set({ token: null, tenantId: null, role: null, language: null, userName: null });
    },
}));
