import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow, useNodes, useHandleConnections } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const SolverNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    // Use hooks to react to graph changes
    const nodes = useNodes();
    const incomingConnections = useHandleConnections({ type: 'target', id: 'in' });

    const variables = useMemo(() => {
        const vars = new Set<string>();

        // Simple regex to find variables avoiding basic math functions
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
                // We fetch the value. In Calctopus, Brain writes the evaluated output to `node.data.value`.
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
    }, [id, nodes, incomingConnections]);

    const solveFor = (data.solveFor as string) || '';

    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateNodeData(id, { solveFor: e.target.value });
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { solveFor: e.target.value });
    };

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Solver
                </div>

                <div className="w-full flex flex-col gap-1">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Solve For</div>
                    {variables.length > 0 ? (
                        <div className="flex gap-1">
                            <select
                                value={variables.includes(solveFor) ? solveFor : (solveFor ? solveFor : '')}
                                onChange={handleSelect}
                                className="nodrag bg-zinc-900 text-zinc-300 text-[10px] w-full p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="">Auto</option>
                                {variables.map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                                {/* Add current custom value if it's not in the auto-detected list */}
                                {solveFor && !variables.includes(solveFor) && (
                                    <option value={solveFor}>{solveFor} (Custom)</option>
                                )}
                            </select>
                        </div>
                    ) : (
                        <input
                            className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500 transition-colors"
                            value={solveFor}
                            onChange={handleInput}
                            placeholder="e.g. x"
                        />
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

SolverNode.displayName = 'SolverNode';
