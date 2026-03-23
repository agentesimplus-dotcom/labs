import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Package, Tag, Radio, Upload, Store } from 'lucide-react';

export default function AdminLayout() {
    const { t } = useTranslation('admin');
    const location = useLocation();

    const sections = [
        { label: t('tenants.title'), path: '/admin/tenants', icon: <Building2 size={16} /> },
        { label: t('stores.title'), path: '/admin/stores', icon: <Store size={16} /> },
        { label: t('users.title'), path: '/admin/users', icon: <Users size={16} /> },
        { label: t('products.title'), path: '/admin/products', icon: <Package size={16} /> },
        { label: t('tags.title'), path: '/admin/tags', icon: <Tag size={16} /> },
        { label: t('gateways.title'), path: '/admin/gateways', icon: <Radio size={16} /> },
        { label: t('tagModels.title'), path: '/admin/tag-models', icon: <Tag size={16} /> },
        { label: t('imports.title'), path: '/admin/imports', icon: <Upload size={16} /> },
    ];

    return (
        <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
            {/* Admin Sub-sidebar */}
            <nav className="w-48 flex-shrink-0">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">{t('title')}</h2>
                <div className="space-y-0.5">
                    {sections.map(s => {
                        const active = location.pathname === s.path || location.pathname.startsWith(s.path + '/');
                        return (
                            <Link key={s.path} to={s.path}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                                {s.icon}
                                {s.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
            {/* Admin Content */}
            <div className="flex-1 min-w-0">
                <Outlet />
            </div>
        </div>
    );
}
