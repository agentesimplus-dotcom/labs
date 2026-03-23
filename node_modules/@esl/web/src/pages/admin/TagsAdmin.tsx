import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Search } from 'lucide-react';

import { API_URL } from '../../config';
const API = API_URL;

export default function TagsAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [tags, setTags] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ macAddress: '', storeId: '', modelId: '' });
    const [stores, setStores] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/tags?page=${page}&pageSize=25&search=${search}`, { headers: headers() });
        const data = await res.json();
        setTags(data.data || []); setTotal(data.total || 0);
    }, [page, search, token]);

    useEffect(() => {
        load();
        fetch(`${API}/admin/stores?pageSize=100`, { headers: headers() }).then(r => r.json()).then(d => setStores(d.data || []));
        fetch(`${API}/admin/tag-models`, { headers: headers() }).then(r => r.json()).then(d => setModels(d || []));
    }, [load]);

    const create = async () => {
        await fetch(`${API}/admin/tags`, { method: 'POST', headers: headers(), body: JSON.stringify(form) });
        setCreating(false); load();
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('tags.title')}</h1>
                <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Plus size={16} /> {t('tags.create')}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="MAC address..." />
                </div>
            </div>

            {creating && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setCreating(false)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{t('tags.create')}</h2>
                        <div className="space-y-3">
                            <input value={form.macAddress} onChange={e => setForm({ ...form, macAddress: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
                            <select value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="">Select Store</option>
                                {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                            </select>
                            <select value={form.modelId} onChange={e => setForm({ ...form, modelId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="">Select Model</option>
                                {models.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.width}x{m.height})</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.cancel')}</button>
                            <button onClick={create} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc('common.save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">{t('tags.mac')}</th>
                            <th className="px-4 py-3 text-left">{t('tags.model')}</th>
                            <th className="px-4 py-3 text-left">{t('tags.store')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.status')}</th>
                            <th className="px-4 py-3 text-left">{t('tags.lastSeen')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tags.map((tag: any) => (
                            <tr key={tag.macAddress} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs text-gray-700">{tag.macAddress}</td>
                                <td className="px-4 py-3 text-gray-500">{tag.model?.name || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{tag.store?.name || '—'}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${tag.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{tag.status}</span></td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{tag.lastSeenAt ? new Date(tag.lastSeenAt).toLocaleString() : '—'}</td>
                            </tr>
                        ))}
                        {tags.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t('tags.noTags')}</td></tr>}
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
