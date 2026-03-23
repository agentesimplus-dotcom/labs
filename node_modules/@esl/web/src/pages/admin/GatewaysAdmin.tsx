import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Search, Trash2 } from 'lucide-react';
import { API_URL } from '../../config';
const API = API_URL;

export default function GatewaysAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [gateways, setGateways] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ macAddress: '', storeId: '', firmwareVersion: '' });
    const [stores, setStores] = useState<any[]>([]);
    const [error, setError] = useState('');

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/gateways?page=${page}&pageSize=25&search=${search}`, { headers: headers() });
        const data = await res.json();
        setGateways(data.data || []); setTotal(data.total || 0);
    }, [page, search, token]);

    useEffect(() => {
        load();
        fetch(`${API}/admin/stores?pageSize=100`, { headers: headers() }).then(r => r.json()).then(d => setStores(d.data || []));
    }, [load]);

    const create = async () => {
        setError('');
        const res = await fetch(`${API}/admin/gateways`, {
            method: 'POST', headers: headers(),
            body: JSON.stringify(form)
        });
        if (!res.ok) {
            const err = await res.json();
            setError(err.error || 'Error creating gateway');
            return;
        }
        setCreating(false);
        setForm({ macAddress: '', storeId: '', firmwareVersion: '' });
        load();
    };

    const deleteGateway = async (mac: string) => {
        if (!confirm(tc('common.confirmDelete') || 'Are you sure you want to delete this gateway?')) return;
        const res = await fetch(`${API}/admin/gateways/${encodeURIComponent(mac)}`, { method: 'DELETE', headers: headers() });
        if (res.ok) load();
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('gateways.title')}</h1>
                <button onClick={() => { setCreating(true); setError(''); }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Plus size={16} /> {t('gateways.create')}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={t('gateways.mac')} />
                </div>
            </div>

            {creating && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setCreating(false)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{t('gateways.create')}</h2>
                        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">MAC Address</label>
                                <input value={form.macAddress} onChange={e => setForm({ ...form, macAddress: e.target.value })}
                                    placeholder="AA:BB:CC:DD:EE:FF" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
                                <span className="text-xs text-gray-400 mt-1">Puedes usar formato con o sin : (ej: AABBCCDDEEFF)</span>
                            </div>
                            <select value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="">{t('gateways.store')}</option>
                                {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                            </select>
                            <input value={form.firmwareVersion} onChange={e => setForm({ ...form, firmwareVersion: e.target.value })} placeholder={t('gateways.firmware')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.cancel')}</button>
                            <button onClick={create} disabled={!form.macAddress || !form.storeId} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{tc('common.save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">{t('gateways.mac')}</th>
                            <th className="px-4 py-3 text-left">{t('gateways.store')}</th>
                            <th className="px-4 py-3 text-left">{t('gateways.firmware')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.status')}</th>
                            <th className="px-4 py-3 text-left">{t('gateways.lastSeen')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {gateways.map((gw: any) => (
                            <tr key={gw.macAddress} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs text-gray-700">{gw.macDisplay || gw.macAddress}</td>
                                <td className="px-4 py-3 text-gray-500">{gw.store?.name || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{gw.firmwareVersion || '—'}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${gw.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{gw.status}</span></td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{gw.lastSeenAt ? new Date(gw.lastSeenAt).toLocaleString() : '—'}</td>
                                <td className="px-4 py-3">
                                    <button onClick={() => deleteGateway(gw.macAddress)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors" title={tc('common.delete')}>
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {gateways.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('gateways.noGateways')}</td></tr>}
                    </tbody>
                </table>
            </div>

            {total > 25 && (
                <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                    <span>{tc('common.showing')} {(page - 1) * 25 + 1} {tc('common.to')} {Math.min(page * 25, total)} {tc('common.of')} {total}</span>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">←</button>
                        <button disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-50">→</button>
                    </div>
                </div>
            )}
        </div>
    );
}
