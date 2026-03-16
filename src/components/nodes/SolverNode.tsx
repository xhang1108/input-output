
import { memo, useMemo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow, useNodes, useNodeConnections, Position } from '@xyflow/react';
import { HandleConfig } from '../../types/NodeDefinition';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeOpSelect } from './NodeOpSelect';
import { CategorizedMenuItem } from '../ui/CategorizedMenu';

export const SolverNode = memo((props: NodeProps) => {
    const { id, data } = props;
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

            const blacklist = new Set([
                'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
                'log', 'ln', 'log10', 'exp', 'pow', 'sqrt', 'abs',
                'e', 'pi', 'i', 'phi', 'tau', 'inf', 'NaN',
                'true', 'false', 'null', 'undefined',
                'det', 'inv', 'dot', 'cross', 'transpose', 'adj', 'rank',
                'diff', 'limit', 'gcd', 'lcm', 'gamma', 'factorial',
                'solve', 'integrate', 'derivative', 'round', 'floor', 'ceil'
            ]);
            matches.forEach(m => {
                if (!blacklist.has(m)) {
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

    // Map extracted variables to menu items
    const detectedOptions: CategorizedMenuItem[] = useMemo(() => {
        const baseOptions: CategorizedMenuItem[] = [
            { id: '', label: 'Auto (First found)', category: 'Automatic' }
        ];
        
        const varOptions = variables.map(v => ({
            id: v,
            label: v,
            category: 'Detected Variables'
        }));

        return [...baseOptions, ...varOptions];
    }, [variables]);

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[130px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Solver
                </div>

                <div className="w-full flex flex-col pt-2 border-t border-zinc-800/50">
                    <NodeOpSelect 
                        nodeId={id} 
                        defId="CL-04" 
                        paramId="variable" 
                        data={data} 
                        label="Solve For"
                        placeholder="Auto"
                        overrideOptions={detectedOptions}
                        width="36"
                    />
                    
                    {/* Fallback info when no variables are found */}
                    {variables.length === 0 && (
                        <div className="mt-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-200/70 text-center animate-in fade-in slide-in-from-top-1">
                            Connect Eq to see vars
                        </div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

SolverNode.displayName = 'SolverNode';
