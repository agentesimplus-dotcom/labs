import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, Store, Package, Radio, Tags, LinkIcon, Megaphone } from 'lucide-react';
import { API_URL } from '../config';
const API = API_URL;

interface CheckItem {
    key: string;
    label: string;
    description: string;
    link: string;
    icon: React.ReactNode;
    count: number;
    done: boolean;
}

export default function Onboarding() {
    const { t } = useTranslation('common');
    const { token } = useAuthStore();
    const [checks, setChecks] = useState<CheckItem[]>([]);
    const [loading, setLoading] = useState(true);

    const headers = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

    useEffect(() => {
        const loadCounts = async () => {
            try {
                const [stores, products, gateways, tags, campaigns] = await Promise.all([
                    fetch(`${API}/admin/stores?pageSize=1`, { headers: headers() }).then(r => r.json()),
                    fetch(`${API}/admin/products?pageSize=1`, { headers: headers() }).then(r => r.json()),
                    fetch(`${API}/admin/gateways?pageSize=1`, { headers: headers() }).then(r => r.json()),
                    fetch(`${API}/admin/tags?pageSize=1`, { headers: headers() }).then(r => r.json()),
                    fetch(`${API}/campaigns`, { headers: headers() }).then(r => r.json()),
                ]);

                const storeCount = stores.total || 0;
                const productCount = products.total || 0;
                const gatewayCount = gateways.total || 0;
                const tagCount = tags.total || 0;
                const campaignCount = Array.isArray(campaigns) ? campaigns.length : 0;

                setChecks([
                    {
                        key: 'store', label: t('onboarding.createStore'),
                        description: t('onboarding.createStoreDesc'),
                        link: '/admin/stores', icon: <Store size={20} />,
                        count: storeCount, done: storeCount > 0
                    },
                    {
                        key: 'products', label: t('onboarding.loadProducts'),
                        description: t('onboarding.loadProductsDesc'),
                        link: '/admin/products', icon: <Package size={20} />,
                        count: productCount, done: productCount > 0
                    },
                    {
                        key: 'gateway', label: t('onboarding.registerGateway'),
                        description: t('onboarding.registerGatewayDesc'),
                        link: '/admin/gateways', icon: <Radio size={20} />,
                        count: gatewayCount, done: gatewayCount > 0
                    },
                    {
                        key: 'tags', label: t('onboarding.importTags'),
                        description: t('onboarding.importTagsDesc'),
                        link: '/admin/tags', icon: <Tags size={20} />,
                        count: tagCount, done: tagCount > 0
                    },
                    {
                        key: 'assign', label: t('onboarding.assignTags'),
                        description: t('onboarding.assignTagsDesc'),
                        link: '/assignments', icon: <LinkIcon size={20} />,
                        count: 0, done: false // Would need assignment query
                    },
                    {
                        key: 'campaign', label: t('onboarding.createCampaign'),
                        description: t('onboarding.createCampaignDesc'),
                        link: '/campaigns', icon: <Megaphone size={20} />,
                        count: campaignCount, done: campaignCount > 0
                    },
                ]);
            } catch (e) {
                console.error('Error loading onboarding data', e);
            }
            setLoading(false);
        };
        loadCounts();
    }, [headers, t]);

    const completedCount = checks.filter(c => c.done).length;
    const totalCount = checks.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    if (loading) return <div className="p-8 text-gray-500">{t('common.loading')}</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('onboarding.title')}</h1>
            <p className="text-sm text-gray-500 mb-6">{t('onboarding.subtitle')}</p>

            {/* Progress Bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{t('onboarding.progress')}</span>
                    <span className="text-sm font-bold text-blue-600">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-2">{completedCount} {t('common.of')} {totalCount} {t('onboarding.stepsCompleted')}</p>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
                {checks.map((item, i) => (
                    <Link key={item.key} to={item.link}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${item.done
                            ? 'bg-green-50/50 border-green-200'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                            }`}>
                        <div className="mt-0.5">
                            {item.done
                                ? <CheckCircle2 size={22} className="text-green-500" />
                                : <Circle size={22} className="text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{i + 1}</span>
                                {item.icon}
                                <span className={`text-sm font-semibold ${item.done ? 'text-green-700 line-through' : 'text-gray-900'}`}>{item.label}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            {item.count > 0 && (
                                <span className="inline-block mt-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                    {item.count} {t('onboarding.registered')}
                                </span>
                            )}
                        </div>
                        <ArrowRight size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
