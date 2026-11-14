'use client';

import { useStore, useReactFlow } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { useCallback, useState, useEffect, useRef } from 'react';

import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { NodeParameter } from '../../types/nodeDefinitions';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { StringInput } from '../common/StringInput';
import { NumericInput } from '../common/NumericInput';
import { CategorizedMenu, CategorizedMenuItem } from './CategorizedMenu';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { useNodeEdit } from '../../hooks/useNodeEdit';
import { Transaction } from '../../engine/types/engineTypes';
import { useHistoryStore } from '../../store/useHistoryStore';
import { indexNodes, toAbsolute } from '../../utils/coordinates';

/** Burst window for collapsing repeated position edits into one undo step. */
const MOVE_HISTORY_MERGE_MS = 800;
/** Same burst window for repeated edits of one settings field. */
const FIELD_HISTORY_MERGE_MS = 800;

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

const inputCls = "w-full bg-surface-base border border-border-dim/80 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:border-focus/80 outline-none transition-colors font-mono";
const selectCls = "w-full bg-surface-base border border-border-dim/80 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:border-focus/80 outline-none transition-colors cursor-pointer";

type FieldProps = { param: NodeParameter; value: unknown; nodeId: string; onChange: (id: string, v: unknown) => void };

function NumberField({ param, value, onChange }: FieldProps) {
    const val = PayloadUtils.unwrap(value);
    const num = typeof val === 'number' ? val : (parseFloat(String(val)) || 0);

    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <NumericInput
                value={num}
                onChange={(v) => onChange(param.id, v)}
                hideLabel={true}
                inputClassName="w-full py-1.5"
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
            <StringInput
                value={local}
                onChange={val => {
                    setLocal(val);
                    onChange(param.id, val);
                }}
                onBlur={() => { isFocused.current = false; }}
                variant="standard"
                monospace={true} // Internal data is usually better in mono
                inputClassName="w-full py-1.5"
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
                className={`w-full py-1.5 rounded-md text-xs font-medium transition-colors border ${bool
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
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const strVal = String(PayloadUtils.unwrap(value) ?? '');
    
    const options = (param.options || []).map(opt => ({
        id: String(opt.value),
        label: opt.label,
        category: param.label
    }));

    const activeLabel = options.find(o => o.id === strVal)?.label || strVal || 'Select...';

    const handleSelect = (item: CategorizedMenuItem) => {
        onChange(param.id, item.id);
        closeMenu();
    };

    return (
        <FieldWrapper label={param.label} hint={param.hint}>
            <button
                onClick={handleTrigger}
                onMouseDown={e => e.stopPropagation()}
                className={`${selectCls} flex items-center justify-between group h-[34px]`}
            >
                <span className="truncate group-hover:text-white transition-colors">{activeLabel}</span>
                <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <CategorizedMenu
                isOpen={menuOpen}
                items={options}
                position={menuPos}
                trigger={trigger}
                onClose={closeMenu}
                onSelect={handleSelect}
                width="full"
                showSearch={options.length > 8}
                selectedId={strVal}
            />
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
                    className="w-8 h-7 rounded-md border border-border-dim cursor-pointer bg-surface-base p-0.5"
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
            <StringInput
                multiline={true}
                value={local}
                rows={8}
                onChange={val => {
                    setLocal(val);
                    onChange(param.id, val);
                }}
                onBlur={() => { isFocused.current = false; }}
                variant="standard"
                monospace={true}
                inputClassName="w-full py-1.5 resize-y leading-relaxed"
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
        <div className="space-y-3 p-3 bg-cloud/5 border border-cloud/20 rounded-md">
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

export function NPanel({ isOpen, onClose, isReadOnly = false }: { isOpen: boolean; onClose: () => void; isReadOnly?: boolean }) {
    const { setNodes, updateNodeData } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);
    const replaceLastHistory = useHistoryStore(s => s.replaceLast);
    const nodeEdit = useNodeEdit({ isReadOnly });

    // Consecutive edits of the same position field collapse into one history
    // entry, so undo returns to the value before typing started instead of
    // stepping back through every keystroke.
    const lastMove = useRef<{
        nodeId: string;
        entryId: string;
        at: number;
        inverse: Transaction;
    } | null>(null);

    // Single selected node (reactive to React Flow store)
    const selectedNode = useStore(s => {
        const selected = s.nodes.filter(n => n.selected);
        return selected.length === 1 ? selected[0] : null;
    });

    // Ancestor lookup for the derived absolute position of nested nodes.
    const allNodes = useStore(s => s.nodes);

    // Look up the node definition to get params schema
    const nodeDef = selectedNode
        ? NODE_DEFINITIONS.find(d => d.id === selectedNode.type)
        : null;

    // Unified data change handler — records history AND updates React Flow state.
    // 'value' is owned by the Brain as a rich Payload, so it goes through
    // UPDATE_VALUE and is never written back through updateNodeData.
    const handleDataChange = useCallback((key: string, value: unknown) => {
        if (!selectedNode || isReadOnly) return;

        const mergeId = `npanel-${selectedNode.id}-${key}`;

        if (key === 'value') {
            nodeEdit.editNodeValue(selectedNode.id, value, {
                description: `Edit ${key}`,
                mergeId,
                mergeWindowMs: FIELD_HISTORY_MERGE_MS,
            });
            return;
        }

        const patch = { [key]: value };
        const recorded = nodeEdit.editNodesData([{ id: selectedNode.id, patch }], {
            description: `Edit ${key}`,
            mergeId,
            mergeWindowMs: FIELD_HISTORY_MERGE_MS,
        });
        // Immediate UI feedback for metadata (min, max, label); the Brain sync
        // lands on the same value, so the follow-up diff is idempotent.
        if (recorded) updateNodeData(selectedNode.id, patch);
    }, [selectedNode, isReadOnly, updateNodeData, nodeEdit]);

    // Position / Label updates (use setNodes for position which isn't part of data)
    // `node.position` is parent-local (world for roots). The panel always writes
    // that local value back through MOVE_NODE, never an absolute position.
    const handlePositionChange = useCallback((axis: 'x' | 'y', rawValue: string) => {
        if (!selectedNode || isReadOnly) return;
        const num = parseFloat(rawValue);
        if (isNaN(num)) return;

        const previous = { ...selectedNode.position };
        if (Math.abs(num - previous[axis]) < 0.001) return;

        const position = { ...previous, [axis]: num };
        const forward: Transaction = { type: 'MOVE_NODE', payload: { id: selectedNode.id, position } };
        const inverse: Transaction = { type: 'MOVE_NODE', payload: { id: selectedNode.id, position: previous } };

        const res = brain.applyTransaction(forward);
        if (!res.success) return;

        const now = Date.now();
        const pending = lastMove.current;
        const mergeable = !!pending
            && pending.nodeId === selectedNode.id
            && now - pending.at < MOVE_HISTORY_MERGE_MS
            && replaceLastHistory(pending.entryId, {
                id: pending.entryId,
                description: `Move ${selectedNode.id}`,
                forward: [forward],
                // Keep the inverse from the first edit of the burst.
                inverse: [pending.inverse],
            });

        if (!mergeable) {
            const entryId = `npanel_move_${selectedNode.id}_${now}`;
            pushHistory({
                id: entryId,
                description: `Move ${selectedNode.id}`,
                forward: [forward],
                inverse: [inverse],
            });
            lastMove.current = { nodeId: selectedNode.id, entryId, at: now, inverse };
        } else if (pending) {
            lastMove.current = { ...pending, at: now };
        }

        // Immediate UI feedback; the Brain sync lands on the same local value.
        setNodes(nds => nds.map(n =>
            n.id === selectedNode.id
                ? { ...n, position }
                : n
        ));
    }, [selectedNode, isReadOnly, brain, pushHistory, replaceLastHistory, setNodes]);

    if (!isOpen) return null;

    const nodeData = (selectedNode?.data ?? {}) as Record<string, unknown>;
    const posX = selectedNode ? selectedNode.position.x.toFixed(1) : '0';
    const posY = selectedNode ? selectedNode.position.y.toFixed(1) : '0';
    // Derived only: nested nodes also show their world position for reference.
    const absolutePosition = selectedNode?.parentId
        ? toAbsolute(indexNodes(allNodes), selectedNode.id)
        : null;
    const labelVal = typeof nodeData.label === 'string' ? nodeData.label : '';

    return (
        <div className="absolute top-0 right-0 h-full w-80 bg-surface-dim border-l border-surface-light z-40 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-light bg-surface-base/50">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm tracking-tight">
                    N PANEL
                </div>
                <button
                    onClick={onClose}
                    className="px-2 py-1 hover:bg-surface-light rounded-md text-zinc-400 hover:text-white transition-colors text-[10px] font-bold tracking-widest"
                >
                    CLOSE
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
                                <StringInput
                                    value={labelVal}
                                    key={`label-${selectedNode.id}-${labelVal}`}
                                    onChange={val => handleDataChange('label', val)}
                                    // Use standard Enter/Escape blur behavior of StringInput
                                    variant="standard"
                                    inputClassName="w-full py-1.5"
                                />
                            </FieldWrapper>

                            <FieldWrapper label="Type / ID">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                                        {selectedNode.type}
                                    </span>
                                    <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md px-2 py-1.5 text-[10px] text-zinc-500 font-mono truncate select-all">
                                        {selectedNode.id}
                                    </div>
                                </div>
                            </FieldWrapper>
                        </div>

                        {/* ── Transform ── */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Transform</h3>
                            {selectedNode.parentId && (
                                <p className="text-[9px] text-zinc-600 italic">X / Y are parent-local.</p>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <NumericInput
                                    label="X Position"
                                    value={parseFloat(posX)}
                                    onChange={(val) => handlePositionChange('x', String(val))}
                                    inputClassName="h-8"
                                />
                                <NumericInput
                                    label="Y Position"
                                    value={parseFloat(posY)}
                                    onChange={(val) => handlePositionChange('y', String(val))}
                                    inputClassName="h-8"
                                />
                            </div>
                            {absolutePosition && (
                                <div className="flex items-center justify-between gap-2 bg-surface-base border border-border-dim/80 rounded-md px-2 py-1.5">
                                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Absolute</span>
                                    <span className="text-[10px] font-mono text-zinc-400">
                                        {absolutePosition.x.toFixed(1)}, {absolutePosition.y.toFixed(1)}
                                    </span>
                                </div>
                            )}
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
                                <span className="text-xs bg-zinc-800 px-1 py-0.5 rounded-md text-zinc-500">READ ONLY</span>
                            </h3>
                            <div className="w-full bg-zinc-950 border border-zinc-800/50 rounded-md p-2 text-[10px] text-zinc-500 font-mono overflow-auto max-h-32">
                                <pre>{JSON.stringify(nodeData, null, 2)}</pre>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

