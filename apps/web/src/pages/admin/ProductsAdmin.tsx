import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Pencil, Search } from 'lucide-react';

import { API_URL } from '../../config';
const API = API_URL;

interface Product { id: string; sku: string; name: string; category: string; brand: string; barcode: string; price: number; currency: string; status: string; }

export default function ProductsAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Product | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ sku: '', name: '', category: '', brand: '', barcode: '', price: '0', currency: 'USD', status: 'ACTIVE' });

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/products?page=${page}&pageSize=25&search=${search}`, { headers: headers() });
        const data = await res.json();
        setProducts(data.data || []); setTotal(data.total || 0);
    }, [page, search, token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API}/admin/products/${editing.id}` : `${API}/admin/products`;
        const body = { ...form, price: parseFloat(form.price) || 0 };
        await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
        setEditing(null); setCreating(false); load();
    };

    const openEdit = (p: Product) => { setForm({ sku: p.sku, name: p.name, category: p.category || '', brand: p.brand || '', barcode: p.barcode || '', price: String(p.price), currency: p.currency, status: p.status }); setEditing(p); setCreating(false); };
    const openCreate = () => { setForm({ sku: '', name: '', category: '', brand: '', barcode: '', price: '0', currency: 'USD', status: 'ACTIVE' }); setEditing(null); setCreating(true); };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('products.title')}</h1>
                <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Plus size={16} /> {t('products.create')}
                </button>
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
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editing ? t('products.edit') : t('products.create')}</h2>
                        <div className="space-y-3">
                            <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder={t('products.sku')} className="w-full px-3 py-2 border rounded-lg text-sm" disabled={!!editing} />
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('products.name')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder={t('products.category')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder={t('products.brand')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder={t('products.barcode')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <div className="flex gap-2">
                                <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder={t('products.price')} className="flex-1 px-3 py-2 border rounded-lg text-sm" type="number" step="0.01" />
                                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-24 px-3 py-2 border rounded-lg text-sm">
                                    {['USD', 'EUR', 'MXN', 'COP', 'BRL', 'ARS'].map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
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
                            <th className="px-4 py-3 text-left">{t('products.sku')}</th>
                            <th className="px-4 py-3 text-left">{t('products.name')}</th>
                            <th className="px-4 py-3 text-left">{t('products.category')}</th>
                            <th className="px-4 py-3 text-left">{t('products.brand')}</th>
                            <th className="px-4 py-3 text-left">{t('products.price')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs text-blue-700 font-medium">{p.sku}</td>
                                <td className="px-4 py-3 text-gray-900">{p.name}</td>
                                <td className="px-4 py-3 text-gray-500">{p.category || '—'}</td>
                                <td className="px-4 py-3 text-gray-500">{p.brand || '—'}</td>
                                <td className="px-4 py-3 text-gray-700 font-medium">{p.currency} {p.price?.toFixed(2)}</td>
                                <td className="px-4 py-3"><button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800"><Pencil size={14} /></button></td>
                            </tr>
                        ))}
                        {products.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('products.noProducts')}</td></tr>}
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
