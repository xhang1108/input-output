
import { memo, useMemo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow, useNodes, useNodeConnections, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { HandleConfig } from '../../types/NodeDefinition';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

export const SolverNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const { updateNodeData } = useReactFlow();

    // Explicitly define handles to ensure 'symbolic' (Orange) color and avoid stale session data
    const handles: HandleConfig[] = [
        { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'symbolic', label: 'Eq', color: 'var(--color-symbolic)' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'symbolic', color: 'var(--color-symbolic)' }
    ];

    const nodeData = { ...data, handles };

    const nodes = useNodes();
    const incomingConnections = useNodeConnections({ handleType: 'target', handleId: 'in' });

    const variables = useMemo(() => {
        const vars = new Set<string>();

        const extractVars = (text: string) => {
            if (typeof text !== 'string') return;
            const matches = text.match(/\b[a-zA-Z_]\w*\b/g);
            if (!matches) return;

            const blacklist = new Set(['sin', 'cos', 'tan', 'log', 'ln', 'e', 'pi', 'abs', 'sqrt', 'solve', 'integrate', 'derivative']);
            matches.forEach(m => {
                if (!blacklist.has(m) && m !== '0' && m !== '1') {
                    vars.add(m);
                }
            });
        };

        incomingConnections.forEach((conn: any) => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            if (sourceNode && sourceNode.data && sourceNode.data.value !== undefined) {
                const payload = sourceNode.data.value;
                const val = payload ? PayloadUtils.unwrap(payload) : null;
                if (val) {
                    if (typeof val === 'string') {
                        extractVars(val);
                    } else if (Array.isArray(val)) {
                        val.flat(Infinity).forEach(v => {
                            if (typeof v === 'string') extractVars(v);
                            if (typeof v === 'object' && v !== null && 'value' in v) extractVars(String((v as any).value));
                        });
                    } else if (typeof val === 'object' && 'value' in val) {
                        extractVars(String(val.value));
                    }
                }
            }
        });

        return Array.from(vars).sort();
    }, [nodes, incomingConnections]);

    const variable = (data.variable as string) || '';

    const menuItems = useMemo(() => {
        const items: CategorizedMenuItem[] = [
            { id: '', label: 'Auto (Detected)', category: 'Automatic' }
        ];

        variables.forEach(v => {
            items.push({ id: v, label: v, category: 'Detected Variables' });
        });

        if (variable && !variables.includes(variable) && variable !== '') {
            items.push({ id: variable, label: `${variable} (Custom)`, category: 'Manual Entry' });
        }

        return items;
    }, [variables, variable]);

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { variable: item.id });
        closeMenu();
    }, [id, updateNodeData]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { variable: e.target.value });
    };

    const currentLabel = variable === '' ? 'Auto' : variable;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Solver
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider pl-1 font-semibold">Solve For</div>
                    {variables.length > 0 ? (
                        <button
                            className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm"
                            onClick={handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate font-mono">{currentLabel}</span>
                            <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 Transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    ) : (
                        <input
                            className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-2 py-1.5 rounded-lg text-xs w-full text-center focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                            value={variable}
                            onChange={handleInput}
                            placeholder="Type variable..."
                        />
                    )}
                </div>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={menuItems}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Select Variable..."
                    width="32"
                />
            </div>
        </BaseNode>
    );
});

SolverNode.displayName = 'SolverNode';
