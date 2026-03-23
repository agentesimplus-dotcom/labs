import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Plus, Pencil, Search, KeyRound } from 'lucide-react';
import { API_URL } from '../../config';
const API = API_URL;

interface User { id: string; email: string; name: string; role: string; language: string; status: string; storeScope?: string; }

export default function UsersAdmin() {
    const { t } = useTranslation('admin');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<User | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ email: '', name: '', password: '', role: 'STORE_OPERATOR', language: 'en', status: 'ACTIVE' });

    // Password reset modal state
    const [resetTarget, setResetTarget] = useState<User | null>(null);
    const [pwdForm, setPwdForm] = useState({ newPassword: '', confirmPassword: '' });
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');

    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    const load = useCallback(async () => {
        const res = await fetch(`${API}/admin/users?page=${page}&pageSize=25&search=${search}`, { headers: headers() });
        const data = await res.json();
        setUsers(data.data || []); setTotal(data.total || 0);
    }, [page, search, token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API}/admin/users/${editing.id}` : `${API}/admin/users`;
        await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
        setEditing(null); setCreating(false); load();
    };

    const resetPassword = async () => {
        setPwdError(''); setPwdSuccess('');
        if (pwdForm.newPassword.length < 8) { setPwdError(t('users.passwordMinLength')); return; }
        if (pwdForm.newPassword !== pwdForm.confirmPassword) { setPwdError(t('users.passwordMismatch')); return; }
        const res = await fetch(`${API}/admin/users/${resetTarget!.id}/reset-password`, {
            method: 'POST', headers: headers(), body: JSON.stringify({ password: pwdForm.newPassword })
        });
        if (res.ok) {
            setPwdSuccess(t('users.passwordResetSuccess'));
            setTimeout(() => { setResetTarget(null); setPwdSuccess(''); }, 1500);
        } else {
            const err = await res.json();
            setPwdError(err.error || 'Error');
        }
    };

    const openResetPassword = (u: User) => {
        setResetTarget(u);
        setPwdForm({ newPassword: '', confirmPassword: '' });
        setPwdError(''); setPwdSuccess('');
    };

    const openEdit = (u: User) => { setForm({ email: u.email, name: u.name, password: '', role: u.role, language: u.language, status: u.status }); setEditing(u); setCreating(false); };
    const openCreate = () => { setForm({ email: '', name: '', password: '', role: 'STORE_OPERATOR', language: 'en', status: 'ACTIVE' }); setEditing(null); setCreating(true); };

    const roles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_ADMIN', 'STORE_OPERATOR'];
    const roleLabel = (r: string) => t(`users.roles.${r}` as any) || r;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">{t('users.title')}</h1>
                <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <Plus size={16} /> {t('users.create')}
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={tc('common.search')} />
                </div>
            </div>

            {/* Create/Edit User Modal */}
            {(creating || editing) && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setCreating(false); setEditing(null); }}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editing ? t('users.edit') : t('users.create')}</h2>
                        <div className="space-y-3">
                            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t('users.email')} className="w-full px-3 py-2 border rounded-lg text-sm" disabled={!!editing} />
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('users.name')} className="w-full px-3 py-2 border rounded-lg text-sm" />
                            {!editing && <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Password" className="w-full px-3 py-2 border rounded-lg text-sm" />}
                            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                {roles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                            </select>
                            <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="en">English</option>
                                <option value="es">Español</option>
                            </select>
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

            {/* Password Reset Modal */}
            {resetTarget && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setResetTarget(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-1">{t('users.resetPassword')}</h2>
                        <p className="text-sm text-gray-500 mb-4">{resetTarget.name} ({resetTarget.email})</p>
                        {pwdError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{pwdError}</div>}
                        {pwdSuccess && <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{pwdSuccess}</div>}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('users.newPassword')}</label>
                                <input value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                                    type="password" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t('users.newPassword')} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('users.confirmPassword')}</label>
                                <input value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                                    type="password" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={t('users.confirmPassword')} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.cancel')}</button>
                            <button onClick={resetPassword} disabled={!pwdForm.newPassword || !pwdForm.confirmPassword}
                                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">{t('users.resetPassword')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">{t('users.email')}</th>
                            <th className="px-4 py-3 text-left">{t('users.name')}</th>
                            <th className="px-4 py-3 text-left">{t('users.role')}</th>
                            <th className="px-4 py-3 text-left">{t('users.language')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.status')}</th>
                            <th className="px-4 py-3 text-left">{tc('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs text-gray-700">{u.email}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">{roleLabel(u.role)}</span></td>
                                <td className="px-4 py-3 text-gray-500">{u.language?.toUpperCase()}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{u.status}</span></td>
                                <td className="px-4 py-3 flex gap-2">
                                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800"><Pencil size={14} /></button>
                                    <button onClick={() => openResetPassword(u)} className="text-amber-600 hover:text-amber-800" title={t('users.resetPassword')}><KeyRound size={14} /></button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('users.noUsers')}</td></tr>}
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
