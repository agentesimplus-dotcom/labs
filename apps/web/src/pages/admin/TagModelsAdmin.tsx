import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Pencil } from 'lucide-react';

import { API_URL } from '../../config';
const API = API_URL;

interface TagModel { id: string; name: string; width: number; height: number; colorProfile: string; packingVersion: string; }

export default function TagModelsAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [models, setModels] = useState<TagModel[]>([]);
    const [editing, setEditing] = useState<TagModel | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', width: '296', height: '128', colorProfile: 'BWR', packingVersion: 'v1' });

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/tag-models`, { headers: headers() });
        const data = await res.json();
        setModels(Array.isArray(data) ? data : data.data || []);
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API}/admin/tag-models/${editing.id}` : `${API}/admin/tag-models`;
        const body = { ...form, width: parseInt(form.width) || 296, height: parseInt(form.height) || 128 };
        await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
        setEditing(null); setCreating(false); load();
    };

    const openEdit = (m: TagModel) => { setForm({ name: m.name, width: String(m.width), height: String(m.height), colorProfile: m.colorProfile || 'BWR', packingVersion: m.packingVersion || 'v1' }); setEditing(m); setCreating(false); };
    const openCreate = () => { setForm({ name: '', width: '296', height: '128', colorProfile: 'BWR', packingVersion: 'v1' }); setEditing(null); setCreating(true); };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('tagModels.title')}</h1>
                <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Plus size={16} /> {t('tagModels.create')}
                </button>
            </div>

            {(creating || editing) && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setCreating(false); setEditing(null); }}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editing ? t('tagModels.edit') : t('tagModels.create')}</h2>
                        <div className="space-y-3">
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('tagModels.name')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <div className="flex gap-2">
                                <input value={form.width} onChange={e => setForm({ ...form, width: e.target.value })} placeholder={t('tagModels.width')} className="flex-1 px-3 py-2 border rounded-lg text-sm" type="number" />
                                <input value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} placeholder={t('tagModels.height')} className="flex-1 px-3 py-2 border rounded-lg text-sm" type="number" />
                            </div>
                            <select value={form.colorProfile} onChange={e => setForm({ ...form, colorProfile: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="BW">BW (Black & White)</option>
                                <option value="BWR">BWR (Black, White & Red)</option>
                                <option value="BWY">BWY (Black, White & Yellow)</option>
                            </select>
                            <input value={form.packingVersion} onChange={e => setForm({ ...form, packingVersion: e.target.value })} placeholder={t('tagModels.packingVersion')} className="w-full px-3 py-2 border rounded-lg text-sm" />
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
                            <th className="px-4 py-3 text-left">{t('tagModels.name')}</th>
                            <th className="px-4 py-3 text-left">{t('tagModels.width')} × {t('tagModels.height')}</th>
                            <th className="px-4 py-3 text-left">{t('tagModels.supportsRed')}</th>
                            <th className="px-4 py-3 text-left">{t('tagModels.packingVersion')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {models.map(m => (
                            <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.width} × {m.height} px</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${m.colorProfile === 'BWR' || m.colorProfile === 'BWY' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {m.colorProfile || 'BW'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs">{m.packingVersion || '—'}</td>
                                <td className="px-4 py-3"><button onClick={() => openEdit(m)} className="text-blue-600 hover:text-blue-800"><Pencil size={14} /></button></td>
                            </tr>
                        ))}
                        {models.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t('tagModels.noModels')}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
