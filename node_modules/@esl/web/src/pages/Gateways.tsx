import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';

export default function Gateways() {
    const { t } = useTranslation('common');
    const { token } = useAuthStore();
    const [gateways, setGateways] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const headers = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

    const fetchGateways = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/gateways`, { headers: headers() });
            if (res.ok) setGateways(await res.json());
        } catch { }
        setLoading(false);
    }, [headers]);

    useEffect(() => { fetchGateways(); }, [fetchGateways]);

    // Auto-refresh every 30s for live status updates
    useEffect(() => {
        const interval = setInterval(fetchGateways, 30000);
        return () => clearInterval(interval);
    }, [fetchGateways]);

    const statusBadge = (gw: any) => {
        const lastSeen = gw.lastSeenAt ? new Date(gw.lastSeenAt) : null;
        const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 120000; // 2 min threshold
        return isOnline
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800';
    };

    const statusLabel = (gw: any) => {
        const lastSeen = gw.lastSeenAt ? new Date(gw.lastSeenAt) : null;
        return lastSeen && (Date.now() - lastSeen.getTime()) < 120000 ? 'ONLINE' : 'OFFLINE';
    };

    const formatMac = (mac: string) => {
        if (!mac || mac.includes(':')) return mac;
        return mac.replace(/(.{2})(?=.)/g, '$1:').toUpperCase();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t('nav.gateways')}</h2>
                <button onClick={fetchGateways} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    ↻ {t('common.refresh') || 'Refresh'}
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAC</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seq</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('gateways.store') || 'Store'}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">{t('common.loading')}</td></tr>
                        ) : gateways.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">{t('gateways.noGateways') || 'No gateways registered.'}</td></tr>
                        ) : gateways.map((gw) => (
                            <tr key={gw.macAddress || gw.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">{formatMac(gw.macAddress)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge(gw)}`}>
                                        {statusLabel(gw)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{gw.lastSeq ?? '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {gw.lastSeenAt ? new Date(gw.lastSeenAt).toLocaleString() : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{gw.store?.name || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('gateways.autoRefresh') || 'Auto-refreshes every 30 seconds.'}</p>
        </div>
    );
}
