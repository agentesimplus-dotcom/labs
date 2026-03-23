import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function Tags() {
    const { token } = useAuthStore();
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock fetch for now
        setTimeout(() => {
            setTags([
                { macAddress: 'AA:BB:CC:DD:EE:01', model: { name: '2.13"' }, status: 'ONLINE', productId: 'SKU-001' },
                { macAddress: 'AA:BB:CC:DD:EE:02', model: { name: '4.20"' }, status: 'UPDATING', productId: 'SKU-002' },
                { macAddress: 'AA:BB:CC:DD:EE:03', model: { name: '7.50"' }, status: 'OFFLINE', productId: 'SKU-003' },
            ]);
            setLoading(false);
        }, 500);
    }, [token]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">ESL Tags</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Link Tag</button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAC Address</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                            </tr>
                        ) : tags.map((tag) => (
                            <tr key={tag.macAddress} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tag.macAddress}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tag.model.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tag.productId || 'Unlinked'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tag.status === 'ONLINE' ? 'bg-green-100 text-green-800' :
                                            tag.status === 'UPDATING' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {tag.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
