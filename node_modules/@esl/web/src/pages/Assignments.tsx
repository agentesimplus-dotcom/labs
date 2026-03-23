import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { showToast } from '../components/Toast';

import { API_URL } from '../config';
const API = API_URL;

interface Assignment {
    id: string; tagMac: string; sku: string | null; source: string; status: string; assignedAt: string;
    templateVersion?: { id: string; version: number } | null;
}

export default function Assignments() {
    const { token } = useAuthStore();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
    const [loading, setLoading] = useState(true);

    // Assign Modal state
    const [assigningTag, setAssigningTag] = useState<Assignment | null>(null);
    const [skuInput, setSkuInput] = useState('');

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const fetchTags = async () => {
        const res = await fetch(`${API}/tags`, { headers });
        if (res.ok) {
            const tags = await res.json();
            setAssignments(tags.map((t: any) => ({
                id: t.macAddress, tagMac: t.macAddress, sku: t.assignment?.sku || t.productId,
                source: t.assignment?.source || 'WEB', status: t.status, assignedAt: t.assignment?.assignedAt || t.lastUpdateAt || ''
            })));
        }
        setLoading(false);
    };

    useEffect(() => { fetchTags(); }, []);

    const submitAssign = async () => {
        if (!assigningTag) return;
        try {
            // Note: skuInput can be empty to unassign
            const res = await fetch(`${API}/tags/${encodeURIComponent(assigningTag.tagMac)}/assign`, {
                method: 'POST', headers, body: JSON.stringify({ sku: skuInput || null })
            });
            if (res.ok) {
                showToast('Assignment updated', 'success');
                setAssigningTag(null);
                setSkuInput('');
                fetchTags();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to assign', 'error');
            }
        } catch { showToast('Network error', 'error'); }
    };

    const filtered = assignments.filter(a => {
        if (filter === 'assigned') return !!a.sku;
        if (filter === 'unassigned') return !a.sku;
        return true;
    });

    if (loading) return <div className="p-8 text-gray-500">Loading assignments...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Tag Assignments</h1>
                <div className="flex gap-2">
                    {(['all', 'assigned', 'unassigned'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {assigningTag && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setAssigningTag(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Assign Tag</h2>
                        <p className="text-sm font-mono text-gray-500 mb-4">{assigningTag.tagMac}</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">SKU or Barcode</label>
                                <input autoFocus value={skuInput} onChange={e => setSkuInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAssign()}
                                    placeholder="e.g. 123456789" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                <p className="text-xs text-gray-500 mt-1.5">Leave blank to unassign.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setAssigningTag(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                            <button onClick={submitAssign} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">Save Assignment</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50"><tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tag MAC</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                        {filtered.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50 group cursor-pointer" onClick={() => { setAssigningTag(a); setSkuInput(a.sku || ''); }}>
                                <td className="px-6 py-4 text-sm font-mono text-gray-900">{a.tagMac}</td>
                                <td className="px-6 py-4 text-sm">{a.sku ? <span className="font-medium">{a.sku}</span> : <span className="text-gray-400 italic font-medium">Unassigned</span>}</td>
                                <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{a.source}</span></td>
                                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.status}</span></td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={(e) => { e.stopPropagation(); setAssigningTag(a); setSkuInput(a.sku || ''); }}
                                        className="text-sm text-blue-600 font-medium hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {a.sku ? 'Change' : '+ Assign'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div className="p-12 text-center text-gray-400 font-medium text-sm">No assignments found matching this filter.</div>}
            </div>
        </div>
    );
}
