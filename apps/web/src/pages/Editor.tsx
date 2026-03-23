import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fabric } from 'fabric';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../config';
import { showToast } from '../components/Toast';

/* ─── Constants ─────────────────────────────────────────────────── */
const PALETTES: Record<string, string[]> = {
    BWR: ['#000000', '#FFFFFF', '#FF0000'],
    BW: ['#000000', '#FFFFFF']
};

const ALLOWED_FONTS = [
    'Arial', 'Roboto', 'Open Sans', 'Lato', 'Inter',
    'Montserrat', 'Oswald', 'Noto Sans', 'Ubuntu', 'Merriweather Sans'
];

const DATA_TOKENS = [
    { label: 'SKU Name', token: '{{sku.name}}' },
    { label: 'SKU Price', token: '{{sku.price}}' },
    { label: 'SKU Barcode', token: '{{sku.barcode}}' },
    { label: 'SKU Brand', token: '{{sku.brand}}' },
    { label: 'SKU Category', token: '{{sku.category}}' },
    { label: 'Campaign Text', token: '{{campaign.text}}' },
    { label: 'Campaign Discount', token: '{{campaign.discount}}' },
    { label: 'Store Name', token: '{{store.name}}' },
];

const GRID_SIZE = 5;
const MAX_HISTORY = 50;

/* ─── Font Loader ───────────────────────────────────────────────── */
const loadedFonts = new Set<string>(['Arial']);
function loadGoogleFont(fontName: string): Promise<void> {
    if (loadedFonts.has(fontName)) return Promise.resolve();
    return new Promise((resolve) => {
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700&display=swap`;
        link.rel = 'stylesheet';
        link.onload = () => { loadedFonts.add(fontName); resolve(); };
        link.onerror = () => resolve(); // fail silently
        document.head.appendChild(link);
    });
}

// Preload all fonts
ALLOWED_FONTS.forEach(f => f !== 'Arial' && loadGoogleFont(f));

/* ─── Component ─────────────────────────────────────────────────── */
export default function Editor() {
    const { t } = useTranslation('common');
    const { token } = useAuthStore();
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const initRef = useRef(false);
    const [, forceUpdate] = useState(0);
    const [dithering, setDithering] = useState(false);
    const [colorMode, setColorMode] = useState<string>('BWR');

    // TagModel & Template state
    const [tagModels, setTagModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const canvasSize = useRef({ width: 400, height: 300 });

    // Selected object properties
    const [selProps, setSelProps] = useState<any>(null);

    // Undo/Redo
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isRestoringRef = useRef(false);

    const getCanvas = useCallback((): fabric.Canvas | null => fabricRef.current, []);
    const headers = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

    /* ─── Fetch TagModels & Templates ─────────────────────────────── */
    useEffect(() => {
        fetch(`${API_URL}/admin/tag-models`, { headers: headers() }).then(r => r.json()).then(d => {
            const models = Array.isArray(d) ? d : [];
            setTagModels(models);
            if (models.length > 0) {
                setSelectedModel(models[0]);
                canvasSize.current = { width: models[0].width, height: models[0].height };
            }
        }).catch(() => { });
        fetch(`${API_URL}/templates`, { headers: headers() }).then(r => r.json()).then(d => {
            setTemplates(Array.isArray(d) ? d : []);
        }).catch(() => { });
    }, []);

    /* ─── Canvas Initialization ───────────────────────────────────── */
    useEffect(() => {
        if (initRef.current || !canvasElRef.current) return;
        initRef.current = true;

        const c = new fabric.Canvas(canvasElRef.current, {
            width: canvasSize.current.width,
            height: canvasSize.current.height,
            backgroundColor: '#FFFFFF',
            preserveObjectStacking: true,
            selection: true,
            stopContextMenu: true,
            fireRightClick: true,
        });
        fabricRef.current = c;

        c.on('object:added', (e) => {
            const obj = e.target;
            if (obj) obj.set({
                selectable: true, evented: true, hasControls: true, hasBorders: true,
                lockRotation: false, borderColor: '#2563eb', cornerColor: '#2563eb',
                cornerStyle: 'circle', cornerSize: 8, transparentCorners: false, borderScaleFactor: 1.5,
            });
            if (!isRestoringRef.current) saveHistory();
        });

        c.on('object:moving', (e) => {
            const obj = e.target;
            if (!obj) return;
            obj.set({
                left: Math.round((obj.left || 0) / GRID_SIZE) * GRID_SIZE,
                top: Math.round((obj.top || 0) / GRID_SIZE) * GRID_SIZE,
            });
            clampToBounds(obj);
        });

        c.on('object:scaling', (e) => { if (e.target) clampToBounds(e.target); });
        c.on('object:modified', () => { if (!isRestoringRef.current) saveHistory(); updateSelProps(); });
        c.on('selection:created', updateSelProps);
        c.on('selection:updated', updateSelProps);
        c.on('selection:cleared', () => setSelProps(null));

        const json = JSON.stringify(c.toJSON());
        historyRef.current = [json];
        historyIndexRef.current = 0;
        forceUpdate(n => n + 1);
    }, []);

    /* ─── Update canvas size when model changes ───────────────────── */
    const handleModelChange = (modelId: string) => {
        const model = tagModels.find(m => m.id === modelId);
        if (!model) return;
        setSelectedModel(model);
        setColorMode(model.supportsRed ? 'BWR' : 'BW');
        canvasSize.current = { width: model.width, height: model.height };
        const c = fabricRef.current;
        if (c) {
            c.setWidth(model.width);
            c.setHeight(model.height);
            c.renderAll();
        }
    };

    /* ─── Selection properties ────────────────────────────────────── */
    function updateSelProps() {
        const c = fabricRef.current;
        if (!c) return;
        const active = c.getActiveObject();
        if (!active) { setSelProps(null); return; }
        const props: any = {
            type: active.type,
            fill: active.fill,
            left: Math.round(active.left || 0),
            top: Math.round(active.top || 0),
        };
        if (active.type === 'i-text') {
            const txt = active as fabric.IText;
            props.text = txt.text;
            props.fontFamily = txt.fontFamily;
            props.fontSize = txt.fontSize;
            props.fontWeight = txt.fontWeight;
            props.fontStyle = txt.fontStyle;
            props.textAlign = txt.textAlign;
            props.underline = txt.underline;
        }
        if (active.type === 'rect') {
            const r = active as fabric.Rect;
            props.width = Math.round((r.width || 0) * (r.scaleX || 1));
            props.height = Math.round((r.height || 0) * (r.scaleY || 1));
        }
        setSelProps(props);
    }

    /* ─── History ──────────────────────────────────────────────────── */
    const saveHistory = useCallback(() => {
        const c = fabricRef.current; if (!c) return;
        const json = JSON.stringify(c.toJSON());
        const idx = historyIndexRef.current;
        historyRef.current = historyRef.current.slice(0, idx + 1);
        historyRef.current.push(json);
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
        historyIndexRef.current = historyRef.current.length - 1;
    }, []);

    const restoreFromHistory = useCallback(() => {
        const c = fabricRef.current; if (!c) return;
        isRestoringRef.current = true;
        const json = historyRef.current[historyIndexRef.current];
        c.loadFromJSON(JSON.parse(json), () => {
            c.renderAll();
            c.getObjects().forEach(obj => obj.set({
                selectable: true, evented: true, hasControls: true, hasBorders: true,
                borderColor: '#2563eb', cornerColor: '#2563eb', cornerStyle: 'circle',
                cornerSize: 8, transparentCorners: false,
            }));
            isRestoringRef.current = false;
        });
    }, []);

    const undo = useCallback(() => { if (historyIndexRef.current <= 0) return; historyIndexRef.current--; restoreFromHistory(); }, [restoreFromHistory]);
    const redo = useCallback(() => { if (historyIndexRef.current >= historyRef.current.length - 1) return; historyIndexRef.current++; restoreFromHistory(); }, [restoreFromHistory]);

    /* ─── Keyboard shortcuts ──────────────────────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && ((e.key === 'y') || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const c = fabricRef.current;
                if (c) { const a = c.getActiveObject(); if (a && !(a as any).isEditing) { c.remove(a); c.discardActiveObject(); c.renderAll(); } }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);

    function clampToBounds(obj: fabric.Object) {
        const size = canvasSize.current;
        const b = obj.getBoundingRect();
        if (b.left < 0) obj.set('left', (obj.left || 0) - b.left);
        if (b.top < 0) obj.set('top', (obj.top || 0) - b.top);
        if (b.left + b.width > size.width) obj.set('left', (obj.left || 0) - (b.left + b.width - size.width));
        if (b.top + b.height > size.height) obj.set('top', (obj.top || 0) - (b.top + b.height - size.height));
    }

    /* ─── Object Actions ──────────────────────────────────────────── */
    const addText = () => {
        const c = fabricRef.current; if (!c) return;
        const text = new fabric.IText('New Text', { left: 50, top: 50, fontFamily: 'Arial', fontSize: 24, fill: '#000000' });
        c.add(text); c.setActiveObject(text); c.renderAll();
    };

    const addToken = (token: string) => {
        const c = fabricRef.current; if (!c) return;
        const text = new fabric.IText(token, { left: 50, top: 50, fontFamily: 'Arial', fontSize: 18, fill: '#000000' });
        (text as any).__dataToken = token;
        c.add(text); c.setActiveObject(text); c.renderAll();
    };

    const addRect = () => {
        const c = fabricRef.current; if (!c) return;
        c.add(new fabric.Rect({ left: 100, top: 100, width: 100, height: 50, fill: '#FF0000', rx: 0, ry: 0 }));
        c.renderAll();
    };

    const addLine = () => {
        const c = fabricRef.current; if (!c) return;
        c.add(new fabric.Line([50, 150, 200, 150], { stroke: '#000000', strokeWidth: 2 }));
        c.renderAll();
    };

    const addCircle = () => {
        const c = fabricRef.current; if (!c) return;
        c.add(new fabric.Circle({ left: 150, top: 100, radius: 30, fill: '#000000' }));
        c.renderAll();
    };

    const addImage = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast('Image must be less than 2MB', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                fabric.Image.fromURL(dataUrl, (img) => {
                    const c = fabricRef.current; if (!c) return;
                    const size = canvasSize.current;
                    // Scale image to fit canvas if too large
                    const maxW = size.width * 0.8;
                    const maxH = size.height * 0.8;
                    if (img.width! > maxW || img.height! > maxH) {
                        const scale = Math.min(maxW / img.width!, maxH / img.height!);
                        img.scaleToWidth(img.width! * scale);
                    }
                    img.set({ left: 20, top: 20 });
                    c.add(img);
                    c.setActiveObject(img);
                    c.renderAll();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const deleteSelected = () => {
        const c = fabricRef.current; if (!c) return;
        const active = c.getActiveObject();
        if (active) {
            if ((active as any).type === 'activeSelection') {
                (active as fabric.ActiveSelection).forEachObject((obj) => c.remove(obj));
                c.discardActiveObject();
            } else { c.remove(active); }
            c.renderAll();
        }
    };

    const clearCanvas = () => {
        const c = fabricRef.current;
        if (c) { c.clear(); c.setBackgroundColor('#FFFFFF', c.renderAll.bind(c)); }
    };

    /* ─── Z-Order ─────────────────────────────────────────────────── */
    const bringForward = () => { const c = getCanvas(); if (!c) return; const a = c.getActiveObject(); if (a) { c.bringForward(a); c.renderAll(); } };
    const sendBackward = () => { const c = getCanvas(); if (!c) return; const a = c.getActiveObject(); if (a) { c.sendBackwards(a); c.renderAll(); } };
    const bringToFront = () => { const c = getCanvas(); if (!c) return; const a = c.getActiveObject(); if (a) { c.bringToFront(a); c.renderAll(); } };
    const sendToBack = () => { const c = getCanvas(); if (!c) return; const a = c.getActiveObject(); if (a) { c.sendToBack(a); c.renderAll(); } };

    /* ─── Color & Font ────────────────────────────────────────────── */
    const handleColorChange = (color: string) => {
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active) {
            if (active.type === 'line') active.set('stroke', color);
            else active.set('fill', color);
            c.renderAll(); updateSelProps();
        }
    };

    const handleFontChange = async (font: string) => {
        await loadGoogleFont(font);
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active && active.type === 'i-text') {
            (active as fabric.IText).set('fontFamily', font);
            c.renderAll(); updateSelProps();
        }
    };

    const handleFontSizeChange = (size: number) => {
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active && active.type === 'i-text') {
            (active as fabric.IText).set('fontSize', size);
            c.renderAll(); updateSelProps();
        }
    };

    const toggleBold = () => {
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active && active.type === 'i-text') {
            const txt = active as fabric.IText;
            txt.set('fontWeight', txt.fontWeight === 'bold' ? 'normal' : 'bold');
            c.renderAll(); updateSelProps();
        }
    };

    const toggleItalic = () => {
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active && active.type === 'i-text') {
            const txt = active as fabric.IText;
            txt.set('fontStyle', txt.fontStyle === 'italic' ? 'normal' : 'italic');
            c.renderAll(); updateSelProps();
        }
    };

    const toggleUnderline = () => {
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active && active.type === 'i-text') {
            const txt = active as fabric.IText;
            txt.set('underline', !txt.underline);
            c.renderAll(); updateSelProps();
        }
    };

    const setTextAlign = (align: string) => {
        const c = getCanvas(); if (!c) return;
        const active = c.getActiveObject();
        if (active && active.type === 'i-text') {
            (active as fabric.IText).set('textAlign', align);
            c.renderAll(); updateSelProps();
        }
    };

    /* ─── Export ───────────────────────────────────────────────────── */
    const exportNormalizedDto = (): string => {
        const c = fabricRef.current; if (!c) return '{}';
        const objects = c.getObjects();
        const size = canvasSize.current;
        const elements = objects.map((obj) => {
            const base: any = { type: obj.type, x: Math.round(obj.left || 0), y: Math.round(obj.top || 0) };
            if (obj.type === 'i-text') {
                const t = obj as fabric.IText;
                base.type = 'text'; base.text = t.text; base.font = t.fontFamily; base.size = t.fontSize;
                base.color = t.fill; base.bold = t.fontWeight === 'bold'; base.italic = t.fontStyle === 'italic';
                base.underline = !!t.underline; base.align = t.textAlign || 'left';
                if ((obj as any).__dataToken) base.dataToken = (obj as any).__dataToken;
            } else if (obj.type === 'rect') {
                const r = obj as fabric.Rect;
                base.w = Math.round((r.width || 0) * (r.scaleX || 1));
                base.h = Math.round((r.height || 0) * (r.scaleY || 1));
                base.color = r.fill;
            } else if (obj.type === 'circle') {
                const ci = obj as fabric.Circle;
                base.r = Math.round((ci.radius || 0) * (ci.scaleX || 1));
                base.color = ci.fill;
            } else if (obj.type === 'line') {
                const l = obj as fabric.Line;
                base.x2 = Math.round(l.x2 || 0); base.y2 = Math.round(l.y2 || 0);
                base.stroke = l.stroke; base.strokeWidth = l.strokeWidth;
            } else if (obj.type === 'image') {
                base.type = 'image';
                base.w = Math.round((obj.width || 0) * (obj.scaleX || 1));
                base.h = Math.round((obj.height || 0) * (obj.scaleY || 1));
                base.src = (obj as fabric.Image).getSrc();
            }
            return base;
        });
        return JSON.stringify({
            elements, canvasWidth: size.width, canvasHeight: size.height,
            colorMode, tagModelId: selectedModel?.id
        }, null, 2);
    };

    /* ─── Save Draft → API ────────────────────────────────────────── */
    const saveDraft = async () => {
        const c = fabricRef.current; if (!c) return;
        if (!selectedTemplate) { showToast(t('editor.selectTemplate'), 'warning'); return; }
        if (!selectedModel) { showToast(t('editor.selectModel'), 'warning'); return; }

        const fabricJson = JSON.stringify(c.toJSON());
        const normalizedDtoJson = exportNormalizedDto();

        try {
            const res = await fetch(`${API_URL}/templates/${selectedTemplate}/versions`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ tagModelId: selectedModel.id, colorMode, fabricJson, normalizedDtoJson })
            });
            if (res.ok) {
                showToast(t('editor.draftSaved'), 'success');
                // Refresh templates
                fetch(`${API_URL}/templates`, { headers: headers() }).then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : []));
            } else {
                const err = await res.json();
                showToast(err.error || 'Error saving draft', 'error');
            }
        } catch { showToast('Network error', 'error'); }
    };

    /* ─── Publish ─────────────────────────────────────────────────── */
    const publishVersion = async () => {
        if (!selectedTemplate) { showToast(t('editor.selectTemplate'), 'warning'); return; }

        const versionName = prompt(t('editor.enterVersionName') || 'Enter a name for this version (e.g., Summer Promo)');
        if (versionName === null) return; // User cancelled

        // First save as draft, then publish the latest version
        await saveDraft();
        try {
            // Get latest version
            const versionsRes = await fetch(`${API_URL}/templates/${selectedTemplate}/versions`, { headers: headers() });
            if (!versionsRes.ok) return;
            const versions = await versionsRes.json();
            if (versions.length === 0) return;
            const latest = versions[0]; // sorted desc
            if (latest.isPublished) { showToast(t('editor.alreadyPublished'), 'warning'); return; }

            const res = await fetch(`${API_URL}/templates/versions/${latest.id}/publish`, {
                method: 'POST', headers: headers(), body: JSON.stringify({ name: versionName })
            });
            if (res.ok) {
                showToast(t('editor.published'), 'success');
                // Refresh templates to show the named version
                const tmplRes = await fetch(`${API_URL}/templates`, { headers: headers() });
                const tmplData = await tmplRes.json();
                setTemplates(Array.isArray(tmplData) ? tmplData : []);
            }
            else showToast('Error publishing', 'error');
        } catch { showToast('Network error', 'error'); }
    };

    /* ─── Load Template Version into Canvas ───────────────────────── */
    const loadVersion = async (templateId: string) => {
        try {
            const res = await fetch(`${API_URL}/templates/${templateId}/versions`, { headers: headers() });
            if (!res.ok) return;
            const versions = await res.json();
            if (versions.length === 0) return;
            const latest = versions[0];
            if (latest.fabricJson) {
                const c = fabricRef.current; if (!c) return;
                isRestoringRef.current = true;
                c.loadFromJSON(JSON.parse(latest.fabricJson), () => {
                    c.renderAll();
                    c.getObjects().forEach(obj => obj.set({
                        selectable: true, evented: true, hasControls: true, hasBorders: true,
                        borderColor: '#2563eb', cornerColor: '#2563eb', cornerStyle: 'circle',
                        cornerSize: 8, transparentCorners: false,
                    }));
                    isRestoringRef.current = false;
                    saveHistory();
                });
                if (latest.colorMode) setColorMode(latest.colorMode);
                if (latest.tagModelId) {
                    const model = tagModels.find(m => m.id === latest.tagModelId);
                    if (model) handleModelChange(model.id);
                }
            }
        } catch { }
    };

    const size = canvasSize.current;
    const isTextSelected = selProps?.type === 'i-text';

    /* ─── Render ──────────────────────────────────────────────────── */
    return (
        <div className="flex h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Left Sidebar — Properties */}
            <div className="w-60 border-r border-gray-200 bg-gray-50/50 flex flex-col overflow-y-auto text-xs">
                {/* Template & Model Selectors */}
                <div className="p-3 border-b border-gray-100 space-y-2">
                    <label className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px]">{t('editor.template') || 'Template'}</label>
                    <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); if (e.target.value) loadVersion(e.target.value); }}
                        className="w-full px-2 py-1.5 border rounded-lg bg-white text-xs">
                        <option value="">{t('editor.selectTemplate') || 'Select template...'}</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <label className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px] mt-2">{t('editor.tagModel') || 'Tag Model'}</label>
                    <select value={selectedModel?.id || ''} onChange={e => handleModelChange(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded-lg bg-white text-xs">
                        {tagModels.map(m => <option key={m.id} value={m.id}>{m.name} ({m.width}×{m.height})</option>)}
                    </select>

                    <label className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px] mt-2">{t('editor.colorMode') || 'Color Mode'}</label>
                    <select value={colorMode} onChange={e => setColorMode(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded-lg bg-white text-xs">
                        <option value="BW">BW (Black & White)</option>
                        <option value="BWR">BWR (Black, White, Red)</option>
                    </select>
                </div>

                {/* Color Palette */}
                <div className="p-3 border-b border-gray-100">
                    <label className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-2">{t('editor.colors') || 'Colors'}</label>
                    <div className="flex gap-1.5">
                        {(PALETTES[colorMode] || PALETTES.BW).map((color) => (
                            <button key={color} onClick={() => handleColorChange(color)}
                                className="w-7 h-7 rounded border-2 shadow-sm hover:scale-110 transition-transform"
                                style={{ backgroundColor: color, borderColor: color === '#FFFFFF' ? '#d1d5db' : color }} />
                        ))}
                    </div>
                </div>

                {/* Text Properties (if text selected) */}
                {isTextSelected && (
                    <div className="p-3 border-b border-gray-100 space-y-2">
                        <label className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Text Properties</label>
                        <select value={selProps?.fontFamily || 'Arial'} onChange={e => handleFontChange(e.target.value)}
                            className="w-full px-2 py-1.5 border rounded-lg bg-white text-xs">
                            {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <div className="flex gap-1 items-center">
                            <label className="text-[10px] text-gray-400 w-8">Size</label>
                            <input type="number" value={selProps?.fontSize || 24} min={8} max={200}
                                onChange={e => handleFontSizeChange(parseInt(e.target.value) || 24)}
                                className="w-16 px-2 py-1 border rounded-lg bg-white text-xs" />
                        </div>
                        <div className="flex gap-1">
                            <button onClick={toggleBold} className={`px-2 py-1 rounded border text-xs font-bold ${selProps?.fontWeight === 'bold' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200'}`}>B</button>
                            <button onClick={toggleItalic} className={`px-2 py-1 rounded border text-xs italic ${selProps?.fontStyle === 'italic' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200'}`}>I</button>
                            <button onClick={toggleUnderline} className={`px-2 py-1 rounded border text-xs underline ${selProps?.underline ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200'}`}>U</button>
                            <div className="h-5 w-px bg-gray-200 mx-0.5" />
                            <button onClick={() => setTextAlign('left')} className={`px-2 py-1 rounded border text-xs ${selProps?.textAlign === 'left' || !selProps?.textAlign ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}>≡</button>
                            <button onClick={() => setTextAlign('center')} className={`px-2 py-1 rounded border text-xs ${selProps?.textAlign === 'center' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}>≡</button>
                            <button onClick={() => setTextAlign('right')} className={`px-2 py-1 rounded border text-xs ${selProps?.textAlign === 'right' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}>≡</button>
                        </div>
                    </div>
                )}

                {/* Data Tokens */}
                <div className="p-3 border-b border-gray-100">
                    <label className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-2">{t('editor.dataTokens') || 'Data Tokens'}</label>
                    <div className="space-y-1">
                        {DATA_TOKENS.map(dt => (
                            <button key={dt.token} onClick={() => addToken(dt.token)}
                                className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors text-[11px] font-mono truncate">
                                {dt.label} <span className="text-gray-400">{dt.token}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col">
                {/* Top Toolbar */}
                <div className="flex items-center justify-between p-2.5 border-b border-gray-100 bg-gray-50/50 flex-wrap gap-1.5">
                    <div className="flex gap-1 items-center flex-wrap">
                        {/* Object tools */}
                        <div className="flex gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
                            <button onClick={addText} className="px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Add Text">T</button>
                            <button onClick={addRect} className="px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Add Rectangle">▭</button>
                            <button onClick={addCircle} className="px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Add Circle">○</button>
                            <button onClick={addLine} className="px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Add Line">╱</button>
                            <button onClick={addImage} className="px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Add Image">🖼</button>
                        </div>

                        <div className="h-5 w-px bg-gray-200" />

                        {/* Z-order */}
                        <div className="flex gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
                            <button onClick={bringToFront} className="px-1.5 py-1 rounded text-xs hover:bg-gray-100" title="Bring to Front">⤒</button>
                            <button onClick={bringForward} className="px-1.5 py-1 rounded text-xs hover:bg-gray-100" title="Bring Forward">↑</button>
                            <button onClick={sendBackward} className="px-1.5 py-1 rounded text-xs hover:bg-gray-100" title="Send Backward">↓</button>
                            <button onClick={sendToBack} className="px-1.5 py-1 rounded text-xs hover:bg-gray-100" title="Send to Back">⤓</button>
                        </div>

                        <div className="h-5 w-px bg-gray-200" />

                        {/* Undo/Redo */}
                        <div className="flex gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
                            <button onClick={undo} className="px-1.5 py-1 rounded text-xs hover:bg-gray-100" title="Undo (Ctrl+Z)">↩</button>
                            <button onClick={redo} className="px-1.5 py-1 rounded text-xs hover:bg-gray-100" title="Redo (Ctrl+Y)">↪</button>
                        </div>

                        <div className="h-5 w-px bg-gray-200" />

                        <button onClick={deleteSelected} className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-red-600 hover:bg-red-50" title="Delete">✕</button>
                    </div>

                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                            <input type="checkbox" checked={dithering} onChange={(e) => setDithering(e.target.checked)} className="rounded text-blue-600" />
                            E-Ink
                        </label>
                        <button onClick={clearCanvas} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs border border-red-200">Clear</button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-auto bg-gray-100 p-6 flex items-center justify-center relative">
                    <div className="relative shadow-lg rounded" style={{ width: size.width, height: size.height }}>
                        <div className={`absolute inset-0 pointer-events-none transition-all duration-300 z-10 ${dithering ? 'opacity-100' : 'opacity-0'}`}
                            style={{
                                backdropFilter: 'grayscale(0.6) contrast(1.5)',
                                background: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2rVrvwMTAwMQMAAwAIAAAuAAb/T+JDUAAAAASUVORK5CYII=) repeat'
                            }} />
                        <canvas ref={canvasElRef} />
                    </div>
                </div>

                {/* Action Bar */}
                <div className="p-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                        {size.width}×{size.height} | {colorMode} | {selectedModel?.name || 'No model'} | Grid: {GRID_SIZE}px
                    </div>
                    <div className="flex gap-2">
                        <button onClick={saveDraft} className="px-4 py-1.5 border border-gray-300 text-gray-700 bg-white shadow-sm hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
                            {t('editor.saveDraft')}
                        </button>
                        <button onClick={publishVersion} className="px-4 py-1.5 bg-blue-600 text-white shadow hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
                            {t('editor.publishVersion')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
