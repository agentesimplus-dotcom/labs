import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';

import { API_URL } from '../../config';
const API = API_URL;

type Step = 'scan-tag' | 'enter-sku' | 'confirm' | 'done';

export default function MobilePairing() {
    const { token, logout } = useAuthStore();
    const [step, setStep] = useState<Step>('scan-tag');
    const [tagMac, setTagMac] = useState('');
    const [sku, setSku] = useState('');
    const [locationCode, setLocationCode] = useState('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const handlePair = async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API}/mobile/pair`, {
                method: 'POST', headers,
                body: JSON.stringify({
                    tag_mac: tagMac.trim(), sku: sku.trim(),
                    location_slot_code: locationCode.trim() || undefined,
                    auto_apply_default: true
                })
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Pairing failed'); }
            setResult(await res.json());
            setStep('done');
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    const reset = () => { setStep('scan-tag'); setTagMac(''); setSku(''); setLocationCode(''); setResult(null); setError(''); };

    if (!token) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
                <div className="text-center text-white">
                    <h1 className="text-xl font-bold mb-4">ESL Mobile Pairing</h1>
                    <p className="text-blue-200 mb-4">Please login from the main app first</p>
                    <a href="/login" className="px-4 py-2 bg-white text-blue-700 rounded-lg font-medium">Go to Login</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 text-white">
                <h1 className="text-lg font-bold">ESL Pairing</h1>
                <button onClick={logout} className="text-sm text-blue-200 hover:text-white">Logout</button>
            </div>

            {/* Progress */}
            <div className="flex justify-center gap-2 px-4 mb-6">
                {['scan-tag', 'enter-sku', 'confirm', 'done'].map((s, i) => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${['scan-tag', 'enter-sku', 'confirm', 'done'].indexOf(step) >= i ? 'bg-white' : 'bg-white/30'
                        }`} />
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 px-4 pb-4">
                <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[400px] flex flex-col">

                    {step === 'scan-tag' && (
                        <>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Step 1: Scan Tag</h2>
                            <p className="text-sm text-gray-500 mb-4">Scan the QR code on the ESL tag or enter the MAC address manually</p>
                            <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-4">
                                <video ref={videoRef} className="hidden" />
                                <div className="text-center p-4">
                                    <div className="text-4xl mb-2">📷</div>
                                    <p className="text-xs text-gray-400">Camera scan coming soon</p>
                                </div>
                            </div>
                            <input value={tagMac} onChange={e => setTagMac(e.target.value)} placeholder="Enter Tag MAC (e.g. AA:BB:CC:00:00:01)"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono mb-4" />
                            <button onClick={() => tagMac.trim() && setStep('enter-sku')} disabled={!tagMac.trim()}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                                Next →
                            </button>
                        </>
                    )}

                    {step === 'enter-sku' && (
                        <>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Step 2: Enter SKU</h2>
                            <p className="text-sm text-gray-500 mb-4">Scan the product barcode or type the SKU</p>
                            <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                                <span className="text-xs text-blue-600 font-medium">Tag:</span>
                                <span className="text-xs font-mono text-blue-800">{tagMac}</span>
                            </div>
                            <input value={sku} onChange={e => setSku(e.target.value)} placeholder="Enter SKU (e.g. SKU-001)"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3" />
                            <input value={locationCode} onChange={e => setLocationCode(e.target.value)} placeholder="Location code (optional, e.g. A1-B2-S3-P4)"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 mb-4" />
                            <div className="flex gap-2">
                                <button onClick={() => setStep('scan-tag')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm">← Back</button>
                                <button onClick={() => sku.trim() && setStep('confirm')} disabled={!sku.trim()}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50">Next →</button>
                            </div>
                        </>
                    )}

                    {step === 'confirm' && (
                        <>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Step 3: Confirm</h2>
                            <p className="text-sm text-gray-500 mb-4">Review and confirm the pairing</p>
                            <div className="space-y-3 mb-6 flex-1">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Tag MAC</div>
                                    <div className="text-sm font-mono font-medium">{tagMac}</div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Product SKU</div>
                                    <div className="text-sm font-medium">{sku}</div>
                                </div>
                                {locationCode && <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Location</div>
                                    <div className="text-sm font-mono">{locationCode}</div>
                                </div>}
                                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                    <div className="text-xs text-green-600 font-medium">✓ Auto-apply default template</div>
                                </div>
                            </div>
                            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-700">{error}</div>}
                            <div className="flex gap-2">
                                <button onClick={() => setStep('enter-sku')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm">← Back</button>
                                <button onClick={handlePair} disabled={loading}
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50">
                                    {loading ? 'Pairing...' : '✓ Pair & Update'}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'done' && result && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="text-6xl mb-4">✅</div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Paired Successfully!</h2>
                            <p className="text-sm text-gray-500 mb-2">{result.message}</p>
                            {result.jobId && <p className="text-xs text-gray-400 mb-6">Job ID: {result.jobId}</p>}
                            <button onClick={reset} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium">Pair Another Tag</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
