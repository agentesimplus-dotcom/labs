import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Pencil, Search, Building2, Users, Tag, Store } from 'lucide-react';

import { API_URL } from '../../config';
const API = API_URL;

interface Tenant {
    id: string; name: string; code: string; status: string;
    contactEmail: string; defaultLanguage: string;
    maxStores: number; maxTags: number;
    _count?: { stores: number; users: number; tags: number };
}

export default function TenantsAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token, role } = useAuthStore();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Tenant | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', contactEmail: '', defaultLanguage: 'es', maxStores: '10', maxTags: '1000', status: 'ACTIVE' });

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
    const isSuperAdmin = role === 'SUPER_ADMIN';

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/tenants?page=${page}&pageSize=25&search=${search}`, { headers: headers() });
        const data = await res.json();
        setTenants(data.data || []); setTotal(data.total || 0);
    }, [page, search, token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API}/admin/tenants/${editing.id}` : `${API}/admin/tenants`;
        const body = { ...form, maxStores: parseInt(form.maxStores) || 10, maxTags: parseInt(form.maxTags) || 1000 };
        await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
        setEditing(null); setCreating(false); load();
    };

    const openEdit = (t: Tenant) => {
        setForm({
            name: t.name, code: t.code || '', contactEmail: t.contactEmail || '',
            defaultLanguage: t.defaultLanguage || 'es',
            maxStores: String(t.maxStores || 10), maxTags: String(t.maxTags || 1000),
            status: t.status
        });
        setEditing(t); setCreating(false);
    };
    const openCreate = () => {
        setForm({ name: '', code: '', contactEmail: '', defaultLanguage: 'es', maxStores: '10', maxTags: '1000', status: 'ACTIVE' });
        setEditing(null); setCreating(true);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('tenants.title')}</h1>
                {isSuperAdmin && (
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        <Plus size={16} /> {t('tenants.create')}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={tc('common.search')} />
                </div>
            </div>

            {(creating || editing) && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setCreating(false); setEditing(null); }}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editing ? t('tenants.edit') : t('tenants.create')}</h2>
                        <div className="space-y-3">
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('tenants.name')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            {isSuperAdmin && <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder={t('tenants.code')} className="w-full px-3 py-2 border rounded-lg text-sm" />}
                            <input value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} placeholder={t('tenants.contactEmail')} className="w-full px-3 py-2 border rounded-lg text-sm" type="email" />
                            <select value={form.defaultLanguage} onChange={e => setForm({ ...form, defaultLanguage: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="es">Español</option>
                                <option value="en">English</option>
                            </select>
                            {isSuperAdmin && (
                                <>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500">{t('tenants.maxStores')}</label>
                                            <input value={form.maxStores} onChange={e => setForm({ ...form, maxStores: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" type="number" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500">{t('tenants.maxTags')}</label>
                                            <input value={form.maxTags} onChange={e => setForm({ ...form, maxTags: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" type="number" />
                                        </div>
                                    </div>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                        <option value="ACTIVE">{tc('common.active')}</option>
                                        <option value="INACTIVE">{tc('common.inactive')}</option>
                                    </select>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setCreating(false); setEditing(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.cancel')}</button>
                            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc('common.save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">{t('tenants.name')}</th>
                            <th className="px-4 py-3 text-left">{t('tenants.code')}</th>
                            <th className="px-4 py-3 text-left">{t('tenants.contactEmail')}</th>
                            <th className="px-4 py-3 text-center"><Store size={14} className="inline" /></th>
                            <th className="px-4 py-3 text-center"><Users size={14} className="inline" /></th>
                            <th className="px-4 py-3 text-center"><Tag size={14} className="inline" /></th>
                            <th className="px-4 py-3 text-left">{tc('common.status')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tenants.map(tenant => (
                            <tr key={tenant.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={16} className="text-blue-500" />
                                        {tenant.name}
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{tenant.code || '—'}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs">{tenant.contactEmail || '—'}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-xs font-medium">{tenant._count?.stores || 0}</span>
                                    <span className="text-gray-400 text-xs">/{tenant.maxStores}</span>
                                </td>
                                <td className="px-4 py-3 text-center text-xs font-medium">{tenant._count?.users || 0}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-xs font-medium">{tenant._count?.tags || 0}</span>
                                    <span className="text-gray-400 text-xs">/{tenant.maxTags}</span>
                                </td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{tenant.status}</span></td>
                                <td className="px-4 py-3"><button onClick={() => openEdit(tenant)} className="text-blue-600 hover:text-blue-800"><Pencil size={14} /></button></td>
                            </tr>
                        ))}
                        {tenants.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t('tenants.noTenants')}</td></tr>}
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
