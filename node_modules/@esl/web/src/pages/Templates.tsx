import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface Template {
    id: string; name: string; description?: string; status: string; createdAt: string;
    versions: { id: string; version: number; colorMode: string; isPublished: boolean; createdAt: string }[];
}

import { API_URL } from '../config';
const API = API_URL;

export default function Templates() {
    const { token } = useAuthStore();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [loading, setLoading] = useState(true);

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const fetchTemplates = async () => {
        const res = await fetch(`${API}/templates`, { headers });
        if (res.ok) setTemplates(await res.json());
        setLoading(false);
    };

    useEffect(() => { fetchTemplates(); }, []);

    const createTemplate = async () => {
        if (!newName.trim()) return;
        const res = await fetch(`${API}/templates`, { method: 'POST', headers, body: JSON.stringify({ name: newName, description: newDesc }) });
        if (res.ok) { setNewName(''); setNewDesc(''); fetchTemplates(); }
    };

    if (loading) return <div className="p-8 text-gray-500">Loading templates...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
            </div>

            {/* Create form */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Create Template</h2>
                <div className="flex gap-3 items-end">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button onClick={createTemplate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Create</button>
                </div>
            </div>

            {/* Template list */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50"><tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Versions</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                        {templates.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{t.description || '—'}</td>
                                <td className="px-6 py-4 text-sm">
                                    {t.versions.length === 0 ? <span className="text-gray-400">No versions</span> : (
                                        <div className="flex gap-1.5 flex-wrap">
                                            {t.versions.map(v => (
                                                <span key={v.id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    v{v.version} ({v.colorMode}) {v.isPublished ? '✓' : 'draft'}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{t.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {templates.length === 0 && <div className="p-8 text-center text-gray-400">No templates yet. Create one above.</div>}
            </div>
        </div>
    );
}
