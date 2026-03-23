import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Pencil, Search } from 'lucide-react';
import { API_URL } from '../../config';
const API = API_URL;

const IANA_TIMEZONES = [
    'America/Guayaquil', 'America/Lima', 'America/Bogota', 'America/Quito',
    'America/Mexico_City', 'America/Monterrey', 'America/Cancun', 'America/Tijuana',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Santiago', 'America/Caracas',
    'America/Panama', 'America/Costa_Rica', 'America/Havana', 'America/Santo_Domingo',
    'America/Toronto', 'America/Vancouver', 'America/Winnipeg', 'America/Halifax',
    'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
    'Europe/Amsterdam', 'Europe/Lisbon', 'Europe/Moscow', 'Europe/Istanbul',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
    'Asia/Seoul', 'Asia/Hong_Kong', 'Asia/Bangkok',
    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
    'UTC'
];

interface Store { id: string; name: string; code: string; timezone: string; address: string; status: string; }

export default function StoresAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [stores, setStores] = useState<Store[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Store | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', timezone: 'America/Guayaquil', address: '', status: 'ACTIVE' });
    const [tzSearch, setTzSearch] = useState('');

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/stores?page=${page}&pageSize=25&search=${search}`, { headers: headers() });
        const data = await res.json();
        setStores(data.data || []); setTotal(data.total || 0);
    }, [page, search, token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API}/admin/stores/${editing.id}` : `${API}/admin/stores`;
        await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
        setEditing(null); setCreating(false); load();
    };

    const openEdit = (s: Store) => { setForm({ name: s.name, code: s.code || '', timezone: s.timezone, address: s.address || '', status: s.status }); setEditing(s); setCreating(false); setTzSearch(''); };
    const openCreate = () => { setForm({ name: '', code: '', timezone: 'America/Guayaquil', address: '', status: 'ACTIVE' }); setEditing(null); setCreating(true); setTzSearch(''); };

    const filteredTimezones = useMemo(() => {
        if (!tzSearch) return IANA_TIMEZONES;
        const q = tzSearch.toLowerCase();
        return IANA_TIMEZONES.filter(tz => tz.toLowerCase().includes(q));
    }, [tzSearch]);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('stores.title')}</h1>
                <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <Plus size={16} /> {t('stores.create')}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={tc('common.search')} />
                </div>
            </div>

            {/* Modal */}
            {(creating || editing) && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setCreating(false); setEditing(null); }}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editing ? t('stores.edit') : t('stores.create')}</h2>
                        <div className="space-y-3">
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('stores.name')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={t('stores.code')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('stores.timezone')}</label>
                                <input value={tzSearch} onChange={e => setTzSearch(e.target.value)}
                                    placeholder={t('stores.searchTimezone')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-1" />
                                <select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg text-sm" size={5}>
                                    {filteredTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={t('stores.address')} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="ACTIVE">{tc('common.active')}</option>
                                <option value="INACTIVE">{tc('common.inactive')}</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setCreating(false); setEditing(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.cancel')}</button>
                            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc('common.save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">{t('stores.name')}</th>
                            <th className="px-4 py-3 text-left">{t('stores.code')}</th>
                            <th className="px-4 py-3 text-left">{t('stores.timezone')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.status')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {stores.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.code || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{s.timezone}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                                <td className="px-4 py-3"><button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800"><Pencil size={14} /></button></td>
                            </tr>
                        ))}
                        {stores.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t('stores.noStores')}</td></tr>}
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
