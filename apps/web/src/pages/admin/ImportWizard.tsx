import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Download, CheckCircle2, Loader2 } from 'lucide-react';

import { API_URL } from '../../config';
const API = API_URL;
const ENTITIES = ['PRODUCTS', 'TAGS', 'GATEWAYS', 'STORES', 'USERS', 'LOCATION_SLOTS'] as const;

const FIELD_MAPS: Record<string, string[]> = {
    PRODUCTS: ['sku', 'name', 'category', 'brand', 'barcode', 'price', 'currency'],
    TAGS: ['mac_address', 'store_code', 'store_id', 'model_name', 'model_id'],
    GATEWAYS: ['mac_address', 'store_code', 'store_id', 'firmware_version'],
    STORES: ['code', 'name', 'timezone', 'address'],
    USERS: ['email', 'name', 'role', 'language', 'password'],
    LOCATION_SLOTS: ['store_code', 'zone_name', 'slot_code'],
};

export default function ImportWizard() {
    const { t } = useTranslation('import');
    const { t: tc } = useTranslation('common');
    const { token } = useAuthStore();
    const [step, setStep] = useState(1);
    const [entity, setEntity] = useState('');
    const [pastedText, setPastedText] = useState('');
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [mode, setMode] = useState('UPSERT');
    const [validResult, setValidResult] = useState<any>(null);
    const [executing, setExecuting] = useState(false);
    const [result, setResult] = useState<any>(null);

    const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

    // Step 2: Parse pasted data
    const parsePaste = (text: string) => {
        setPastedText(text);
        const lines = text.trim().split('\n').filter(l => l.trim());
        if (lines.length === 0) return;
        const headerLine = lines[0].split('\t');
        setHeaders(headerLine.map(h => h.trim()));
        const rows = lines.slice(1).map(l => {
            const cols = l.split('\t');
            const row: any = {};
            headerLine.forEach((h, i) => { row[h.trim()] = (cols[i] || '').trim(); });
            return row;
        });
        setParsedRows(rows);
        // Auto-map columns
        const fields = FIELD_MAPS[entity] || [];
        const autoMapping: Record<string, string> = {};
        headerLine.forEach(h => {
            const ht = h.trim().toLowerCase().replace(/[\s_-]/g, '');
            const match = fields.find(f => f.replace(/_/g, '').toLowerCase() === ht || f.toLowerCase() === h.trim().toLowerCase());
            autoMapping[h.trim()] = match || '__skip__';
        });
        setMapping(autoMapping);
    };

    // Step 4: Dry-run validation
    const runValidation = async () => {
        const mappedRows = parsedRows.map(row => {
            const mapped: any = {};
            Object.entries(mapping).forEach(([src, tgt]) => { if (tgt !== '__skip__') mapped[tgt] = row[src]; });
            return mapped;
        });
        const res = await fetch(`${API}/imports/prepare`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ entity, rows: mappedRows, mapping, mode })
        });
        const data = await res.json();
        setValidResult(data);
    };

    // Step 5: Execute
    const runImport = async () => {
        if (!validResult?.importId) return;
        setExecuting(true);
        const mappedRows = parsedRows.map(row => {
            const mapped: any = {};
            Object.entries(mapping).forEach(([src, tgt]) => { if (tgt !== '__skip__') mapped[tgt] = row[src]; });
            return mapped;
        });
        const res = await fetch(`${API}/imports/execute`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ importId: validResult.importId, rows: mappedRows, mapping })
        });
        const data = await res.json();
        setResult(data);
        setExecuting(false);
    };

    const downloadTemplate = () => {
        window.open(`${API}/imports/templates/${entity}`, '_blank');
    };

    const downloadErrors = () => {
        if (result?.importId) window.open(`${API}/imports/${result.importId}/errors.csv`, '_blank');
    };

    const fields = FIELD_MAPS[entity] || [];

    return (
        <div className="max-w-4xl">
            <h1 className="text-xl font-bold text-gray-900 mb-6">{t('wizard.title')}</h1>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3, 4, 5, 6].map(s => (
                    <div key={s} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${s === step ? 'bg-blue-100 text-blue-700' : s < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {s < step ? <CheckCircle2 size={12} /> : null}
                        {t(`wizard.step${s}` as any)}
                    </div>
                ))}
            </div>

            {/* Step 1: Select Entity */}
            {step === 1 && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('entity.select')}</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {ENTITIES.map(e => (
                            <button key={e} onClick={() => { setEntity(e); setStep(2); }}
                                className={`p-4 border rounded-xl text-left hover:border-blue-400 hover:bg-blue-50 transition-colors ${entity === e ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                                <span className="font-medium text-gray-900">{t(`entity.${e}` as any)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: Provide Data */}
            {step === 2 && (
                <div className="bg-white rounded-xl border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">{t('data.pasteData')}</h2>
                        <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                            <Download size={14} /> {t('data.downloadTemplate')}
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{t('data.pasteHint')}</p>
                    <textarea value={pastedText}
                        onChange={e => parsePaste(e.target.value)}
                        className="w-full h-48 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-y"
                        placeholder={`sku\tname\tprice\nSKU-001\tProduct 1\t9.99\nSKU-002\tProduct 2\t19.99`}
                    />
                    {parsedRows.length > 0 && (
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                            <span className="text-green-600 font-medium">✓ {t('data.rowsDetected', { count: parsedRows.length })}</span>
                            <span>{t('data.columnsDetected', { count: headers.length })}</span>
                        </div>
                    )}
                    <div className="flex justify-between mt-4">
                        <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.back')}</button>
                        <button onClick={() => setStep(3)} disabled={parsedRows.length === 0}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{tc('common.next')}</button>
                    </div>
                </div>
            )}

            {/* Step 3: Map Columns */}
            {step === 3 && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('mapping.title')}</h2>
                    <div className="space-y-2">
                        {headers.map(h => (
                            <div key={h} className="flex items-center gap-3">
                                <span className="w-40 text-sm font-mono text-gray-700 truncate">{h}</span>
                                <span className="text-gray-400">→</span>
                                <select value={mapping[h] || '__skip__'} onChange={e => setMapping({ ...mapping, [h]: e.target.value })}
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm">
                                    <option value="__skip__">{t('mapping.skip')}</option>
                                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                {mapping[h] && mapping[h] !== '__skip__' && <span className="text-xs text-green-600">{t('mapping.autoDetected')}</span>}
                            </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <label className="text-sm font-medium text-gray-700">{t('mode.label')}</label>
                        <select value={mode} onChange={e => setMode(e.target.value)} className="ml-2 px-3 py-2 border rounded-lg text-sm">
                            <option value="UPSERT">{t('mode.UPSERT')}</option>
                            <option value="CREATE_ONLY">{t('mode.CREATE_ONLY')}</option>
                            <option value="UPDATE_ONLY">{t('mode.UPDATE_ONLY')}</option>
                        </select>
                    </div>
                    <div className="flex justify-between mt-4">
                        <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.back')}</button>
                        <button onClick={() => { setStep(4); runValidation(); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc('common.next')}</button>
                    </div>
                </div>
            )}

            {/* Step 4: Validation */}
            {step === 4 && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('validation.title')}</h2>
                    {!validResult ? (
                        <div className="flex items-center gap-2 text-gray-500"><Loader2 size={16} className="animate-spin" /> {tc('common.loading')}</div>
                    ) : (
                        <>
                            <div className="flex gap-4 mb-4">
                                <div className="flex-1 bg-green-50 p-4 rounded-xl">
                                    <div className="text-2xl font-bold text-green-700">{validResult.validCount}</div>
                                    <div className="text-sm text-green-600">{t('validation.validRows')}</div>
                                </div>
                                <div className="flex-1 bg-red-50 p-4 rounded-xl">
                                    <div className="text-2xl font-bold text-red-700">{validResult.errorCount}</div>
                                    <div className="text-sm text-red-600">{t('validation.invalidRows')}</div>
                                </div>
                            </div>
                            {validResult.errors?.length > 0 && (
                                <div className="max-h-48 overflow-auto border rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead className="bg-red-50 text-red-700">
                                            <tr>
                                                <th className="px-3 py-2 text-left">{t('validation.row')}</th>
                                                <th className="px-3 py-2 text-left">{t('validation.field')}</th>
                                                <th className="px-3 py-2 text-left">{t('validation.message')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {validResult.errors.map((e: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-1.5">{e.rowNumber}</td>
                                                    <td className="px-3 py-1.5 font-mono">{e.field}</td>
                                                    <td className="px-3 py-1.5 text-red-600">{e.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="mt-3 text-sm text-gray-500 italic">{t('validation.dryRunComplete')}</p>
                        </>
                    )}
                    <div className="flex justify-between mt-4">
                        <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tc('common.back')}</button>
                        <button onClick={() => { setStep(5); runImport(); }} disabled={!validResult || validResult.validCount === 0}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {t('validation.readyToImport', { count: validResult?.validCount || 0 })}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 5: Executing */}
            {step === 5 && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('execution.title')}</h2>
                    {executing ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 size={40} className="animate-spin text-blue-500" />
                            <p className="text-gray-600">{t('execution.processing')}</p>
                        </div>
                    ) : result ? (
                        <div className="text-center py-4">
                            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-green-700">{t('execution.complete')}</h3>
                            <button onClick={() => setStep(6)} className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc('common.next')}</button>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Step 6: Results */}
            {step === 6 && result && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">{t('results.title')}</h2>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-gray-900">{(result.successCount || 0) + (result.errorCount || 0)}</div>
                            <div className="text-sm text-gray-500">{t('results.totalProcessed')}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-green-700">{result.successCount}</div>
                            <div className="text-sm text-green-600">{t('results.successful')}</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-red-700">{result.errorCount}</div>
                            <div className="text-sm text-red-600">{t('results.failed')}</div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {result.errorCount > 0 && (
                            <button onClick={downloadErrors} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                                <Download size={14} /> {t('results.downloadErrors')}
                            </button>
                        )}
                        <button onClick={() => { setStep(1); setEntity(''); setPastedText(''); setParsedRows([]); setHeaders([]); setMapping({}); setValidResult(null); setResult(null); }}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            {t('results.importAnother')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
