import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fabric } from 'fabric';
import { useAuthStore } from '../stores/authStore';
import { Plus, Play, Pause, Search, Rocket } from 'lucide-react';
import { showToast } from '../components/Toast';
import { API_URL } from '../config';
const API = API_URL;

interface Campaign {
    id: string; name: string; status: string; startAt: string; endAt: string;
    templateVersion: { id: string; version: number; template: { name: string } } | null;
    store?: { id: string; name: string } | null;
}

interface Product {
    id: string; sku: string; name: string; price: number;
    currency: string; category?: string; brand?: string; barcode?: string;
}

export default function Campaigns() {
    const { t } = useTranslation('common');
    const { token } = useAuthStore();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [step, setStep] = useState(1); // 1=basics, 2=template, 3=skus, 4=preview

    // Wizard form
    const [form, setForm] = useState({ name: '', storeId: '', startAt: '', endAt: '', templateVersionId: '' });
    const [stores, setStores] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [versions, setVersions] = useState<any[]>([]);

    // Step 3: Product Selection
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('');
    const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());

    // Step 4: Preview
    const [previewSku, setPreviewSku] = useState<string | null>(null);
    const [skuCounts, setSkuCounts] = useState<Record<string, number>>({});
    const [canvasScale, setCanvasScale] = useState(1);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.StaticCanvas | null>(null);

    const headers = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

    const fetchCampaigns = useCallback(async () => {
        const res = await fetch(`${API}/campaigns`, { headers: headers() });
        if (res.ok) setCampaigns(await res.json());
        setLoading(false);
    }, [headers]);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    // Fetch affected tag counts when entering Step 4
    useEffect(() => {
        if (step === 4 && selectedSkus.size > 0) {
            fetch(`${API}/tags/assignments/count-by-skus`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ skus: Array.from(selectedSkus) })
            }).then(r => r.json()).then(data => {
                setSkuCounts(data || {});
            }).catch(console.error);
        }
    }, [step, selectedSkus]);

    const loadWizardData = async () => {
        const [s, t, cats] = await Promise.all([
            fetch(`${API}/admin/stores?pageSize=100`, { headers: headers() }).then(r => r.json()),
            fetch(`${API}/templates`, { headers: headers() }).then(r => r.json()),
            fetch(`${API}/admin/products/categories`, { headers: headers() }).then(r => r.json())
        ]);
        setStores(s.data || []);
        setTemplates(Array.isArray(t) ? t : []);
        setCategories(Array.isArray(cats) ? cats : []);
    };

    const fetchProducts = async () => {
        let url = `${API}/admin/products?pageSize=1000`;
        if (productSearch) url += `&search=${encodeURIComponent(productSearch)}`;
        if (productCategory) url += `&category=${encodeURIComponent(productCategory)}`;
        const res = await fetch(url, { headers: headers() });
        const data = await res.json();
        setProducts(data.data || []);
    };

    useEffect(() => {
        if (creating && step === 3) fetchProducts();
    }, [step, productSearch, productCategory, creating]);

    const openWizard = () => {
        setForm({ name: '', storeId: '', startAt: '', endAt: '', templateVersionId: '' });
        setStep(1); setCreating(true); setVersions([]); setSelectedSkus(new Set()); setPreviewSku(null);
        loadWizardData();
    };

    const selectTemplate = async (templateId: string) => {
        if (!templateId) { setVersions([]); return; }
        const res = await fetch(`${API}/templates/${templateId}/versions`, { headers: headers() });
        if (res.ok) {
            const v = await res.json();
            setVersions(v.filter((x: any) => x.isPublished));
        }
    };

    const createCampaign = async () => {
        if (!form.name || !form.startAt || !form.endAt || !form.templateVersionId) {
            showToast(t('campaigns.fillRequired') || 'Please fill required fields', 'warning');
            return;
        }
        if (selectedSkus.size === 0) {
            showToast('Please select at least one SKU', 'warning');
            return;
        }
        const body: any = {
            name: form.name,
            startAt: new Date(form.startAt).toISOString(),
            endAt: new Date(form.endAt).toISOString(),
            templateVersionId: form.templateVersionId,
            filterJson: JSON.stringify({ skus: Array.from(selectedSkus) })
        };
        if (form.storeId) body.storeId = form.storeId;

        const res = await fetch(`${API}/campaigns`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        if (res.ok) {
            showToast(t('campaigns.created') || 'Campaign created', 'success');
            setCreating(false); fetchCampaigns();
        } else {
            const err = await res.json();
            showToast(err.error || 'Error', 'error');
        }
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        const action = currentStatus === 'ACTIVE' ? 'pause' : 'activate';
        await fetch(`${API}/campaigns/${id}/${action}`, { method: 'POST', headers: headers(), body: JSON.stringify({}) });
        fetchCampaigns();
    };

    const deleteCampaign = async (id: string) => {
        if (!confirm(t('common.confirmDelete') || 'Are you sure you want to delete this campaign?')) return;
        const res = await fetch(`${API}/campaigns/${id}`, { method: 'DELETE', headers: headers() });
        if (res.ok) {
            showToast(t('common.deleted') || 'Campaign deleted', 'success');
            fetchCampaigns();
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to delete', 'error');
        }
    };

    const pushCampaign = async (id: string) => {
        if (!confirm('Are you sure you want to push this campaign to all gateways now?')) return;
        const res = await fetch(`${API}/campaigns/${id}/push`, { method: 'POST', headers: headers(), body: JSON.stringify({}) });
        if (res.ok) {
            const data = await res.json();
            showToast(`Campaign pushed. Updated ${data.updatedAssignments} tags.`, 'success');
            fetchCampaigns();
        } else {
            const err = await res.json();
            showToast(err.error || 'Push failed', 'error');
        }
    };

    const statusColor = (s: string) => {
        switch (s) {
            case 'ACTIVE': return 'bg-green-100 text-green-700';
            case 'PAUSED': return 'bg-yellow-100 text-yellow-700';
            case 'COMPLETED': return 'bg-gray-100 text-gray-600';
            case 'DRAFT': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Preview Logic
    useEffect(() => {
        if (step === 4 && canvasRef.current && !fabricRef.current) {
            fabricRef.current = new fabric.StaticCanvas(canvasRef.current);
        }
    }, [step]);

    useEffect(() => {
        if (step === 4 && fabricRef.current && previewSku && form.templateVersionId) {
            const tv = versions.find(v => v.id === form.templateVersionId);
            const product = products.find(p => p.sku === previewSku);
            if (tv && tv.fabricJson && product) {
                // Determine target dimensions
                const model = tv.tagModel;
                if (model) {
                    fabricRef.current.setWidth(model.width);
                    fabricRef.current.setHeight(model.height);
                    // Also clear previous objects
                    fabricRef.current.clear();
                }

                try {
                    console.log('--- WIZARD PREVIEW DEBUG ---');
                    console.log('1. Original Template Version FabricJSON:', tv.fabricJson);

                    const parsed = JSON.parse(tv.fabricJson);

                    // Safely replace text tokens inside the parsed Fabric JSON object
                    const replacements: Record<string, string> = {
                        '{{sku.name}}': product.name || '',
                        '{{sku.price}}': `${product.price || 0}`,
                        '{{sku.currency}}': product.currency || '',
                        '{{sku.barcode}}': product.barcode || '',
                        '{{sku.brand}}': product.brand || '',
                        '{{sku.category}}': product.category || '',
                    };

                    console.log('2. Available Replacements (from Selected SKU):', replacements);

                    const replaceText = (objects: any[]) => {
                        if (!objects) return;
                        for (const obj of objects) {
                            if ((obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') && obj.text) {
                                for (const [token, val] of Object.entries(replacements)) {
                                    // Use split/join for safe replacement of exact strings
                                    obj.text = obj.text.split(token).join(val);
                                }
                            }
                            if (obj.objects) replaceText(obj.objects); // Handle grouped objects
                        }
                    };
                    replaceText(parsed.objects);

                    console.log('3. Resulting FabricJSON object after replacement:', parsed);

                    fabricRef.current.loadFromJSON(parsed, () => {
                        fabricRef.current?.renderAll();
                        // Calculate optimal scale based on container width (approx 500px available)
                        const optimalScale = Math.min(2, 500 / model.width);
                        setCanvasScale(optimalScale);
                        console.log(`4. Canvas renderAll() invoked successfully. Scale: ${optimalScale}`);
                    });
                } catch (err) {
                    console.error('Canvas preview error', err);
                }
            } else if (tv && tv.fabricJson) {
                // Determine target dimensions
                const model = tv.tagModel;
                if (model) {
                    fabricRef.current.setWidth(model.width);
                    fabricRef.current.setHeight(model.height);
                    fabricRef.current.clear();
                }
                // Just load without replacements if no product or basic template
                fabricRef.current.loadFromJSON(tv.fabricJson, () => {
                    fabricRef.current?.renderAll();
                    if (model) setCanvasScale(Math.min(2, 500 / model.width));
                });
            }
        }
    }, [previewSku, step, form.templateVersionId, versions, products]);

    const toggleSku = (sku: string) => {
        const next = new Set(selectedSkus);
        if (next.has(sku)) next.delete(sku);
        else next.add(sku);
        setSelectedSkus(next);
    };

    if (loading) return <div className="p-8 text-gray-500">{t('common.loading')}</div>;

    const selectedProductsList = Array.from(selectedSkus).map(sku => products.find(p => p.sku === sku)).filter(Boolean) as Product[];

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{t('campaigns.title')}</h1>
                <button onClick={openWizard} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <Plus size={16} /> {t('campaigns.create') || 'New Campaign'}
                </button>
            </div>

            {creating && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCreating(false)}>
                    <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">{t('campaigns.create') || 'New Campaign'}</h2>
                            <div className="flex gap-2 mt-4">
                                {[1, 2, 3, 4].map(s => (
                                    <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-100'}`} />
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            {step === 1 && (
                                <div className="space-y-4 max-w-lg mx-auto">
                                    <p className="font-semibold text-gray-900 text-lg">Step 1: Campaign Details</p>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
                                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="Black Friday Sale" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Store</label>
                                        <select value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                                            <option value="">{t('campaigns.allStores')} (Global)</option>
                                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('campaigns.startDate') || 'Start Date'}</label>
                                            <input type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('campaigns.endDate') || 'End Date'}</label>
                                            <input type="datetime-local" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4 max-w-lg mx-auto">
                                    <p className="font-semibold text-gray-900 text-lg">Step 2: Select Template</p>
                                    <select onChange={e => selectTemplate(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                                        <option value="">{t('campaigns.selectTemplate') || 'Select template...'}</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>

                                    {versions.length > 0 && (
                                        <div className="space-y-2 mt-4">
                                            <label className="block text-sm font-medium text-gray-700">{t('campaigns.selectVersion') || 'Select published version:'}</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {versions.map((v: any) => (
                                                    <label key={v.id} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${form.templateVersionId === v.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                                                        <input type="radio" name="version" value={v.id} checked={form.templateVersionId === v.id}
                                                            onChange={() => setForm({ ...form, templateVersionId: v.id })} className="w-4 h-4 text-blue-600" />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-gray-900">Version {v.version} {v.name ? `— ${v.name}` : ''} <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full ml-2">{v.colorMode}</span></div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{new Date(v.createdAt).toLocaleString()}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {versions.length === 0 && templates.length > 0 && (
                                        <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-100">
                                            {t('campaigns.noPublishedVersions') || 'No published versions. Publish a template version first.'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 3 && (
                                <div className="flex flex-col h-full space-y-4">
                                    <div className="flex justify-between items-end">
                                        <p className="font-semibold text-gray-900 text-lg">Step 3: Target SKUs</p>
                                        <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{selectedSkus.size} SKU(s) Selected</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" placeholder="Search by name or SKU..." />
                                        </div>
                                        <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
                                            <option value="">All Categories</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div className="border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col min-h-[300px]">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0 shadow-sm border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 w-10 text-center"><input type="checkbox" onChange={e => {
                                                        if (e.target.checked) setSelectedSkus(new Set(products.map(p => p.sku)));
                                                        else setSelectedSkus(new Set());
                                                    }} checked={products.length > 0 && selectedSkus.size === products.length} /></th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">SKU</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Product Name</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white overflow-y-auto">
                                                {products.map(p => (
                                                    <tr key={p.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => toggleSku(p.sku)}>
                                                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                            <input type="checkbox" checked={selectedSkus.has(p.sku)} onChange={() => toggleSku(p.sku)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                                                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                                        <td className="px-4 py-3 text-gray-500">{p.category || '—'}</td>
                                                        <td className="px-4 py-3 font-medium text-gray-700">{p.price} {p.currency}</td>
                                                    </tr>
                                                ))}
                                                {products.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 bg-white">No products found.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="flex h-full min-h-[400px]">
                                    {/* Left: Selected SKUs List */}
                                    <div className="w-1/3 border-r border-gray-200 pr-4 flex flex-col">
                                        <p className="font-semibold text-gray-900 text-lg mb-4">Step 4: Dynamic Preview</p>
                                        <p className="text-sm text-gray-500 mb-2">Select a product to preview how it looks on the E-Ink display.</p>
                                        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                            {selectedProductsList.map(p => {
                                                const count = skuCounts[p.sku] || 0;
                                                return (
                                                    <button key={p.sku} onClick={() => setPreviewSku(p.sku)}
                                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all flex justify-between items-center ${previewSku === p.sku ? 'bg-blue-50 border-blue-200 text-blue-800 font-medium shadow-sm' : 'border-transparent hover:bg-gray-50 text-gray-700'}`}>
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <div className="truncate">{p.name}</div>
                                                            <div className="text-xs text-gray-400 font-mono mt-0.5">{p.sku}</div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${count > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {count} tag{count !== 1 ? 's' : ''}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right: E-Ink Preview Canvas */}
                                    <div className="w-2/3 pl-6 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-100 ml-4 relative">
                                        {!previewSku ? (
                                            <div className="text-gray-400 text-center">
                                                <div className="mx-auto w-12 h-12 mb-3 bg-gray-200 rounded-full flex items-center justify-center">👀</div>
                                                <p>Select a product from the list</p>
                                            </div>
                                        ) : (
                                            <div className="bg-white shadow-xl ring-1 ring-black/5 overflow-hidden transition-all duration-300 transform-gpu" style={{ transform: `scale(${canvasScale})`, transformOrigin: 'center' }}>
                                                <canvas ref={canvasRef} />
                                            </div>
                                        )}
                                        {previewSku && (
                                            <div className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                                LIVE PREVIEW {canvasScale !== 1 && `(${(canvasScale * 100).toFixed(0)}%)`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-xl">
                            <button onClick={() => step > 1 ? setStep(step - 1) : setCreating(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white border text-center border-transparent hover:border-gray-200 hover:shadow-sm rounded-lg transition-all">{step > 1 ? t('common.back') : t('common.cancel')}</button>
                            {step < 4 ? (
                                <button onClick={() => setStep(step + 1)} disabled={(step === 1 && (!form.name || !form.startAt || !form.endAt)) || (step === 2 && !form.templateVersionId) || (step === 3 && selectedSkus.size === 0)}
                                    className="px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all">{t('common.next')}</button>
                            ) : (
                                <button onClick={createCampaign}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-green-600 text-white rounded-lg shadow-sm hover:shadow-md hover:bg-green-700 disabled:opacity-50 disabled:shadow-none transition-all">
                                    <Rocket size={16} /> {t('campaigns.launch') || 'Launch Campaign'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50"><tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.name')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('campaigns.template')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('gateways.store')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('campaigns.schedule')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.status')}</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {campaigns.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-gray-900">{c.name}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-900 font-medium">{c.templateVersion?.template?.name}</div>
                                    <div className="text-xs text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mt-1 font-mono">v{c.templateVersion?.version}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{c.store?.name || <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-bold">GLOBAL</span>}</td>
                                <td className="px-6 py-4 text-xs font-medium text-gray-600">
                                    <div className="mb-0.5">{new Date(c.startAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                    <div className="text-gray-400">{new Date(c.endAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                </td>
                                <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${statusColor(c.status)}`}>{c.status}</span></td>
                                <td className="px-6 py-4 flex gap-2 justify-end">
                                    <button onClick={() => deleteCampaign(c.id)} className="p-2 rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                    </button>
                                    {(c.status === 'ACTIVE' || c.status === 'PAUSED' || c.status === 'DRAFT') && (
                                        <button onClick={() => toggleStatus(c.id, c.status)}
                                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 shadow-sm transition-all" title={c.status === 'ACTIVE' ? t('campaigns.pause') : t('campaigns.activate')}>
                                            {c.status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                    )}
                                    {c.status === 'ACTIVE' && (
                                        <button onClick={() => pushCampaign(c.id)} className="p-2 rounded-lg bg-blue-600 text-white shadow-sm hover:shadow-md hover:bg-blue-700 transition-all font-medium flex items-center gap-1.5" title="Push to Gateways">
                                            <Rocket size={16} /> Push
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {campaigns.length === 0 && <div className="p-12 text-center text-gray-400 text-sm font-medium">{t('campaigns.noCampaigns')}</div>}
            </div>
        </div>
    );
}
