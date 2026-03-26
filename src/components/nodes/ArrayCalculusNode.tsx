import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';
import { HandleConfig, HandleDataType } from '../../types/NodeDefinition';

/**
 * ArrayCalculusNode (DT-06)
 * 
 * Specialized component for Linear Algebra operations.
 * Dynamically updates the number of output handles and their data types (colors)
 * based on the selected operation (e.g., QR returns 2 matrices, DET returns a scalar).
 */
export const ArrayCalculusNode = memo((props: NodeProps) => {
    const { data } = props;
    const op = (data.op as string) || 'INV';

    // ─── Dynamic Handle Logic ──────────────────────────────────────────
    const handles = useMemo<HandleConfig[]>(() => {
        // Input is always a single array
        const h: HandleConfig[] = [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'array' }
        ];

        // Output handles based on operation
        const outBase: Partial<HandleConfig> = { type: 'source', position: Position.Right, variant: 'single' };

        if (op === 'QR') {
            // QR Decomposition -> Q, R
            h.push({ ...outBase, id: 'out_a', dataType: 'array' } as HandleConfig);
            h.push({ ...outBase, id: 'out_b', dataType: 'array' } as HandleConfig);
        } else if (op === 'LU' || op === 'LUP') {
            // LU/LUP Decomposition -> L, U, (P)
            h.push({ ...outBase, id: 'out_a', dataType: 'array' } as HandleConfig);
            h.push({ ...outBase, id: 'out_b', dataType: 'array' } as HandleConfig);
            if (op === 'LUP') {
                h.push({ ...outBase, id: 'out_c', dataType: 'array' } as HandleConfig);
            }
        } else if (op === 'EIGEN') {
            // Eigenvalues & Vectors -> values, vectors
            h.push({ ...outBase, id: 'out_a', dataType: 'array' } as HandleConfig);
            h.push({ ...outBase, id: 'out_b', dataType: 'array' } as HandleConfig);
        } else if (op === 'DET' || op === 'TRACE') {
            // Scalar results
            h.push({ ...outBase, id: 'out_a', dataType: 'scalar' } as HandleConfig);
        } else {
            // INV, TRANSPOSE, etc. -> Single array result
            h.push({ ...outBase, id: 'out_a', dataType: 'array' } as HandleConfig);
        }

        return h;
    }, [op]);

    // Inject dynamic handles into node data for BaseNode to consume
    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5">
                <NodeOpSelect
                    nodeId={props.id}
                    defId={props.type}
                    paramId="op"
                    data={data as Record<string, unknown>}
                    placeholder="Search Operation..."
                    width="48"
                />
            </div>
        </BaseNode>
    );
});

ArrayCalculusNode.displayName = 'ArrayCalculusNode';
