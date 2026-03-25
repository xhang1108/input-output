'use client';

import { useStore, useReactFlow } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { useCallback, useState, useEffect, useRef } from 'react';
import { X, Cpu } from 'lucide-react';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';
import { NodeParameter } from '../../types/NodeDefinition';
import { PayloadUtils } from '../../utils/PayloadUtils';

// ─── Atomic Field Components ──────────────────────────────────────────────────

function FieldWrapper({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">{label}</label>
            {children}
            {hint && <p className="text-[9px] text-zinc-600 italic">{hint}</p>}
        </div>
    );
}

const inputCls = "w-full bg-surface-base border border-border-dim/80 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-focus/80 outline-none transition-colors font-mono";
const selectCls = "w-full bg-surface-base border border-border-dim/80 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-focus/80 outline-none transition-colors cursor-pointer";

type FieldProps = { param: NodeParameter; value: unknown; nodeId: string; onChange: (id: string, v: unknown) => void };

function NumberField({ param, value, nodeId, onChange }: FieldProps) {
    const toNum = (v: unknown) => {
        const unwrapped = PayloadUtils.unwrap(v);
        return typeof unwrapped === 'number' ? unwrapped : (parseFloat(String(unwrapped)) || 0);
    };
    const [local, setLocal] = useState(() => String(toNum(value)));
    const isFocused = useRef(false);

    // Sync when node switches (always) or external value changes (only if not focused)
    useEffect(() => {
        if (!isFocused.current) {
            setLocal(String(toNum(value)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeId, value]);

    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <input
                type="number"
                min={param.min}
                max={param.max}
                step={param.step ?? 'any'}
                value={local}
                onFocus={(e) => {
                    isFocused.current = true;
                    e.target.select();
                }}
                onChange={e => {
                    setLocal(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(param.id, v);
                }}
                onBlur={() => {
                    isFocused.current = false;
                    // Re-sync to stored value on blur to correct any invalid input
                    setLocal(String(toNum(value)));
                }}
                onMouseDown={e => e.stopPropagation()}
                className={inputCls}
            />
        </FieldWrapper>
    );
}

function StringField({ param, value, nodeId, onChange }: FieldProps) {
    const toStr = (v: unknown) => {
        const unwrapped = PayloadUtils.unwrap(v);
        return typeof unwrapped === 'string' ? unwrapped : String(unwrapped ?? '');
    };
    const [local, setLocal] = useState(() => toStr(value));
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setLocal(toStr(value));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeId, value]);

    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <input
                type="text"
                value={local}
                onFocus={(e) => {
                    isFocused.current = true;
                    e.target.select();
                }}
                onChange={e => {
                    setLocal(e.target.value);
                    onChange(param.id, e.target.value);
                }}
                onBlur={() => { isFocused.current = false; }}
                onMouseDown={e => e.stopPropagation()}
                className={inputCls}
            />
        </FieldWrapper>
    );
}

function BooleanField({ param, value, onChange }: FieldProps) {
    const bool = Boolean(PayloadUtils.unwrap(value));
    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <button
                onClick={() => onChange(param.id, !bool)}
                className={`w-full py-1.5 rounded text-xs font-medium transition-colors border ${bool
                    ? 'bg-cloud/20 border-cloud/50 text-cloud'
                    : 'bg-surface-base border-border-dim text-zinc-500'
                    }`}
            >
                {bool ? '✓ ON' : 'OFF'}
            </button>
        </FieldWrapper>
    );
}

function SelectField({ param, value, onChange }: FieldProps) {
    const strVal = String(PayloadUtils.unwrap(value) ?? '');
    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <select
                value={strVal}
                onChange={e => onChange(param.id, e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                className={selectCls}
            >
                {param.options?.map(opt => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </FieldWrapper>
    );
}

function ColorField({ param, value, nodeId, onChange }: FieldProps) {
    const toColor = (v: unknown) => {
        const unwrapped = PayloadUtils.unwrap(v);
        return typeof unwrapped === 'string' && unwrapped.startsWith('#') ? unwrapped : '#FF8C00';
    };
    const [local, setLocal] = useState(() => toColor(value));
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) setLocal(toColor(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeId, value]);

    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={local}
                    onChange={e => {
                        setLocal(e.target.value);
                        onChange(param.id, e.target.value);
                    }}
                    onFocus={(e) => {
                        isFocused.current = true;
                        e.target.select();
                    }}
                    onBlur={() => { isFocused.current = false; }}
                    onMouseDown={e => e.stopPropagation()}
                    className="w-8 h-7 rounded border border-border-dim cursor-pointer bg-surface-base p-0.5"
                />
                <span className="text-xs font-mono text-zinc-400 uppercase">{local}</span>
            </div>
        </FieldWrapper>
    );
}

function TextareaField({ param, value, nodeId, onChange }: FieldProps) {
    const toStr = (v: unknown) =>
        typeof v === 'string' ? v : String(v ?? '');
    const [local, setLocal] = useState(() => toStr(value));
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) setLocal(toStr(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeId, value]);

    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <textarea
                value={local}
                rows={8}
                onFocus={(e) => {
                    isFocused.current = true;
                    e.target.select();
                }}
                onChange={e => {
                    setLocal(e.target.value);
                    onChange(param.id, e.target.value);
                }}
                onBlur={() => { isFocused.current = false; }}
                onMouseDown={e => e.stopPropagation()}
                className={`${inputCls} resize-y font-mono leading-relaxed`}
            />
        </FieldWrapper>
    );
}

// ─── Schema-Driven Settings Section ──────────────────────────────────────────

function SettingsSection({
    params,
    nodeData,
    nodeId,
    onDataChange,
}: {
    params: NodeParameter[];
    nodeData: Record<string, unknown>;
    nodeId: string;
    onDataChange: (key: string, value: unknown) => void;
}) {
    return (
        <div className="space-y-3 p-3 bg-cloud/5 border border-cloud/20 rounded-lg">
            <h3 className="text-[10px] font-bold text-text-cloud uppercase tracking-widest">Node Settings</h3>
            <div className="space-y-3">
                {params.map(param => {
                    if (param.hidden?.(nodeData)) return null;

                    const value = nodeData[param.id];
                    const fieldProps = { param, value, nodeId, onChange: onDataChange };

                    switch (param.type) {
                        case 'number': return <NumberField key={param.id} {...fieldProps} />;
                        case 'string': return <StringField key={param.id} {...fieldProps} />;
                        case 'boolean': return <BooleanField key={param.id} {...fieldProps} />;
                        case 'select': return <SelectField key={param.id} {...fieldProps} />;
                        case 'color': return <ColorField key={param.id} {...fieldProps} />;
                        case 'textarea': return <TextareaField key={param.id} {...fieldProps} />;
                        default: return null;
                    }
                })}
            </div>
        </div>
    );
}


// ─── Main N Panel ─────────────────────────────────────────────────────────────

export function NPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { setNodes, updateNodeData } = useReactFlow();
    const brain = useBrain();

    // Single selected node (reactive to React Flow store)
    const selectedNode = useStore(s => {
        const selected = s.nodes.filter(n => n.selected);
        return selected.length === 1 ? selected[0] : null;
    });

    // Look up the node definition to get params schema
    const nodeDef = selectedNode
        ? NODE_DEFINITIONS.find(d => d.id === selectedNode.type)
        : null;

    // Unified data change handler — updates React Flow state AND Brain
    const handleDataChange = useCallback((key: string, value: unknown) => {
        if (!selectedNode) return;

        // 1. Update React Flow state immediately
        // SPECIAL CASE: 'value' is managed strictly by the Brain as a rich Payload object.
        // We skip updateNodeData for 'value' to match the behavior of on-canvas nodes (e.g. InputNode).
        // This ensures the structure doesn't flicker between primitive and object.
        // For other metadata (min, max, label), we update immediately for UI responsiveness.
        if (key !== 'value') {
            updateNodeData(selectedNode.id, { [key]: value });
        }

        // 2. Specialized Brain Sync
        if (key === 'value') {
            brain.applyTransaction({
                type: 'UPDATE_VALUE',
                payload: { id: selectedNode.id, value }
            });
        }
    }, [selectedNode, updateNodeData]);

    // Position / Label updates (use setNodes for position which isn't part of data)
    const handlePositionChange = useCallback((axis: 'x' | 'y', rawValue: string) => {
        if (!selectedNode) return;
        const num = parseFloat(rawValue);
        if (isNaN(num)) return;

        setNodes(nds => nds.map(n =>
            n.id === selectedNode.id
                ? { ...n, position: { ...n.position, [axis]: num } }
                : n
        ));
    }, [selectedNode, setNodes]);

    if (!isOpen) return null;

    const nodeData = (selectedNode?.data ?? {}) as Record<string, unknown>;
    const posX = selectedNode ? selectedNode.position.x.toFixed(1) : '0';
    const posY = selectedNode ? selectedNode.position.y.toFixed(1) : '0';
    const labelVal = typeof nodeData.label === 'string' ? nodeData.label : '';

    return (
        <div className="absolute top-0 right-0 h-full w-80 bg-surface-dim border-l border-surface-light z-40 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-light bg-surface-base/50">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
                    <Cpu className="w-4 h-4" />
                    N PANEL
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-surface-light rounded-sm text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-5 overflow-y-auto h-[calc(100vh-50px)]">
                {!selectedNode ? (
                    <div className="text-zinc-500 text-sm text-center py-10 italic">
                        Select a node to inspect
                    </div>
                ) : (
                    <>
                        {/* ── Identity ── */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Identity</h3>

                            <FieldWrapper label="Label">
                                <input
                                    type="text"
                                    defaultValue={labelVal}
                                    key={`label-${selectedNode.id}-${labelVal}`}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={e => handleDataChange('label', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleDataChange('label', (e.target as HTMLInputElement).value);
                                    }}
                                    onMouseDown={e => e.stopPropagation()}
                                    className={inputCls}
                                />
                            </FieldWrapper>

                            <FieldWrapper label="Type / ID">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                                        {selectedNode.type}
                                    </span>
                                    <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5 text-[10px] text-zinc-500 font-mono truncate select-all">
                                        {selectedNode.id}
                                    </div>
                                </div>
                            </FieldWrapper>
                        </div>

                        {/* ── Transform ── */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Transform</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <FieldWrapper label="X Position">
                                    <input
                                        type="number"
                                        defaultValue={posX}
                                        key={`pos-x-${selectedNode.id}-${posX}`}
                                        onFocus={(e) => e.target.select()}
                                        onBlur={e => handlePositionChange('x', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handlePositionChange('x', (e.target as HTMLInputElement).value);
                                        }}
                                        onMouseDown={e => e.stopPropagation()}
                                        className={inputCls}
                                    />
                                </FieldWrapper>
                                <FieldWrapper label="Y Position">
                                    <input
                                        type="number"
                                        defaultValue={posY}
                                        key={`pos-y-${selectedNode.id}-${posY}`}
                                        onFocus={(e) => e.target.select()}
                                        onBlur={e => handlePositionChange('y', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handlePositionChange('y', (e.target as HTMLInputElement).value);
                                        }}
                                        onMouseDown={e => e.stopPropagation()}
                                        className={inputCls}
                                    />
                                </FieldWrapper>
                            </div>
                        </div>

                        {/* ── Schema-Driven Node Settings ── */}
                        {nodeDef?.params && nodeDef.params.length > 0 && (
                            <SettingsSection
                                params={nodeDef.params}
                                nodeData={nodeData}
                                nodeId={selectedNode.id}
                                onDataChange={handleDataChange}
                            />
                        )}

                        {/* ── Raw Data (Debug) ── */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center justify-between">
                                Raw Data
                                <span className="text-[9px] bg-zinc-800 px-1 py-0.5 rounded text-zinc-500">READ ONLY</span>
                            </h3>
                            <div className="w-full bg-zinc-950 border border-zinc-800/50 rounded p-2 text-[10px] text-zinc-500 font-mono overflow-auto max-h-32">
                                <pre>{JSON.stringify(nodeData, null, 2)}</pre>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
