import { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import {
    LayoutDashboard, PenTool, Radio, Tags, LogOut, FileText, LinkIcon,
    Megaphone, Settings, Globe, KeyRound
} from 'lucide-react';
import { API_URL } from '../config';

export default function DashboardLayout() {
    const { token, role, language, userName, logout, setLanguage } = useAuthStore();
    const location = useLocation();
    const { t } = useTranslation('common');

    // Change password state
    const [showPwdModal, setShowPwdModal] = useState(false);
    const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');

    if (!token) return <Navigate to="/login" replace />;

    const isAdmin = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN' || role === 'STORE_ADMIN';

    // Grouped navigation
    const navSections = [
        {
            label: null, // No label for first item
            items: [
                { label: t('nav.overview'), path: '/', icon: <LayoutDashboard size={18} /> },
            ]
        },
        {
            label: t('nav.operation'),
            items: [
                { label: t('nav.gateways'), path: '/gateways', icon: <Radio size={18} /> },
                { label: t('nav.tags'), path: '/tags', icon: <Tags size={18} /> },
                { label: t('nav.assignments'), path: '/assignments', icon: <LinkIcon size={18} /> },
                { label: t('nav.campaigns'), path: '/campaigns', icon: <Megaphone size={18} /> },
            ]
        },
        {
            label: t('nav.design'),
            items: [
                { label: t('nav.templates'), path: '/templates', icon: <FileText size={18} /> },
                { label: t('nav.designer'), path: '/designer', icon: <PenTool size={18} /> },
            ]
        },
    ];

    const changePassword = async () => {
        setPwdError(''); setPwdSuccess('');
        if (pwdForm.newPassword.length < 8) { setPwdError(t('auth.passwordMinLength')); return; }
        if (pwdForm.newPassword !== pwdForm.confirmPassword) { setPwdError(t('auth.passwordMismatch')); return; }
        try {
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
            });
            if (res.ok) {
                setPwdSuccess(t('auth.passwordChanged'));
                setTimeout(() => { setShowPwdModal(false); setPwdSuccess(''); }, 1500);
            } else {
                const err = await res.json();
                setPwdError(err.error || 'Error');
            }
        } catch { setPwdError('Network error'); }
    };

    const openPwdModal = () => {
        setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setPwdError(''); setPwdSuccess('');
        setShowPwdModal(true);
    };

    return (
        <div className="flex bg-gray-50 min-h-screen font-sans">
            {/* Sidebar */}
            <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shadow-sm">
                <div className="h-14 flex items-center px-5 border-b border-gray-100">
                    <span className="font-bold text-lg text-gray-900 tracking-tight">ESL Platform</span>
                    {/* @ts-ignore */}
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3'}</span>
                </div>

                <nav className="flex-1 px-3 py-3 text-sm font-medium overflow-y-auto">
                    {navSections.map((section, si) => (
                        <div key={si} className={si > 0 ? 'mt-3' : ''}>
                            {section.label && (
                                <div className="px-3 pb-1 pt-2">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{section.label}</span>
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map(item => {
                                    const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                                    return (
                                        <Link key={item.path} to={item.path}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                                            {item.icon}
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="mt-3">
                            <div className="px-3 pb-1 pt-2">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('nav.admin')}</span>
                            </div>
                            <Link to="/admin"
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${location.pathname.startsWith('/admin') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                                <Settings size={18} />
                                {t('nav.admin')}
                            </Link>
                        </div>
                    )}
                </nav>

                <div className="p-3 border-t border-gray-100 space-y-1">
                    <button onClick={openPwdModal}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                        <KeyRound size={18} />
                        {t('auth.changePassword')}
                    </button>
                    <button onClick={logout}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut size={18} />
                        {t('nav.signOut')}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto">
                <div className="h-14 bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 flex items-center justify-between px-6 z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">{t('header.context')}:</span>
                        <select className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5">
                            <option>{t('header.global')}</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <Globe size={16} className="text-gray-400" />
                            <select value={language || 'en'} onChange={(e) => setLanguage(e.target.value)}
                                className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg p-1.5 font-medium">
                                <option value="en">EN</option>
                                <option value="es">ES</option>
                            </select>
                        </div>
                        {userName && <span className="text-sm text-gray-500">{userName}</span>}
                    </div>
                </div>

                <div className="p-6">
                    <Outlet />
                </div>
            </main>

            {/* Change Password Modal */}
            {showPwdModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPwdModal(false)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{t('auth.changePassword')}</h2>
                        {pwdError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{pwdError}</div>}
                        {pwdSuccess && <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{pwdSuccess}</div>}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('auth.currentPassword')}</label>
                                <input value={pwdForm.oldPassword} onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                                    type="password" className="w-full px-3 py-2 border rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('auth.newPassword')}</label>
                                <input value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                                    type="password" className="w-full px-3 py-2 border rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('auth.confirmPassword')}</label>
                                <input value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                                    type="password" className="w-full px-3 py-2 border rounded-lg text-sm" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowPwdModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{t('common.cancel')}</button>
                            <button onClick={changePassword} disabled={!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{t('common.save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
