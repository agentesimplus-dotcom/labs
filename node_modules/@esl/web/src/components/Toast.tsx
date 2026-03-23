import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
    id: number;
    text: string;
    type: 'success' | 'error' | 'warning';
}

let nextId = 1;
let addToastExternal: ((text: string, type: 'success' | 'error' | 'warning') => void) | null = null;

export function showToast(text: string, type: 'success' | 'error' | 'warning' = 'success') {
    if (addToastExternal) addToastExternal(text, type);
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((text: string, type: 'success' | 'error' | 'warning') => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    useEffect(() => {
        addToastExternal = addToast;
        return () => { addToastExternal = null; };
    }, [addToast]);

    if (toasts.length === 0) return null;

    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-amber-600'
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
            {toasts.map(t => (
                <div key={t.id}
                    className={`${colors[t.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm animate-slide-in`}
                    onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
                    {t.text}
                </div>
            ))}
        </div>
    );
}
