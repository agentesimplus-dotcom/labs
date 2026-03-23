import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

import { API_URL } from '../config';
const API = API_URL;

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');
            setAuth(data.token, data.tenantId, data.role, data.language, data.userName);
            navigate('/');
        } catch (err: any) {
            setError(err.message || t('login.error'));
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">{t('login.title')}</h1>
                    <p className="text-blue-200 mt-2">{t('login.subtitle')}</p>
                </div>
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.email')}</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="admin@enterprise.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.password')}</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="••••••••" />
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25">
                        {loading ? t('login.signingIn') : t('login.submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}
