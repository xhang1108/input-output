import { type Node, type Edge, type NodeTypes, type EdgeTypes } from '@xyflow/react';
import { NodeInput } from '../nodes/NodeInput';
import { NodeInputNumber } from '../nodes/NodeInputNumber';
import { NodeInputMatrix } from '../nodes/NodeInputMatrix';
import { NodeMath } from '../nodes/NodeMath';
import { NodeUnary } from '../nodes/NodeUnary';
import { NodeLogic } from '../nodes/NodeLogic';
import { NodeCompare } from '../nodes/NodeCompare';
import { NodeOutput } from '../nodes/NodeOutput';
import { NodeNumber } from '../nodes/NodeNumber';
import { NodeMatrix } from '../nodes/NodeMatrix';
import { NodeFormula } from '../nodes/NodeFormula';
import { NodeSolver } from '../nodes/NodeSolver';
import { NodeSwitch } from '../nodes/NodeSwitch';
import { NodeGroup } from '../nodes/NodeGroup';
import { NodeSlider } from '../nodes/NodeSlider';
import { CustomEdge } from '../edges/CustomEdge';

export const nodeTypes: NodeTypes = {
    inputNode: NodeInput, // legacy
    inputNumber: NodeInputNumber,
    inputMatrix: NodeInputMatrix,
    mathNode: NodeMath,
    unaryNode: NodeUnary,
    logicNode: NodeLogic,
    compareNode: NodeCompare,
    outputNode: NodeOutput, // Legacy support
    numberNode: NodeNumber,
    matrixNode: NodeMatrix,
    formulaNode: NodeFormula,
    solverNode: NodeSolver,
    switchNode: NodeSwitch,
    groupNode: NodeGroup,
    sliderNode: NodeSlider,
};

export const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

export const defaultNodes: Node[] = [
    {
        id: 'input-a',
        type: 'inputNode',
        position: { x: 100, y: 100 },
        data: { label: 'Value A', value: 10, rawExpression: '10' },
    },
    {
        id: 'input-b',
        type: 'inputNode',
        position: { x: 100, y: 300 },
        data: { label: 'Value B', value: 7, rawExpression: '7' },
    },
    {
        id: 'math-1',
        type: 'mathNode',
        position: { x: 350, y: 180 },
        data: { operation: 'add' },
    },
    {
        id: 'output-1',
        type: 'outputNode',
        position: { x: 550, y: 180 },
        data: { value: 0 },
    },
];

export const defaultEdges: Edge[] = [
    { id: 'e1', source: 'input-a', target: 'math-1', targetHandle: 'inputA', type: 'customEdge' },
    { id: 'e2', source: 'input-b', target: 'math-1', targetHandle: 'inputB', type: 'customEdge' },
    { id: 'e3', source: 'math-1', target: 'output-1', targetHandle: 'inputA', type: 'customEdge' },
];

export const nodeColor = (n: Node) => {
    if (n.type === 'inputNode') return '#3b82f6'; // blue-500
    if (n.type === 'outputNode') return '#22c55e'; // green-500
    if (n.type === 'mathNode') return '#f97316'; // orange-500
    return '#71717a'; // zinc-500
};

export const defaultEdgeOptions = {
    type: 'customEdge',
    animated: true,
};
