/**
 * Static Node & Edge Type Maps
 * Extracted from Body.tsx to keep the orchestrator lean.
 */

import { BaseNode } from '../components/nodes/BaseNode';
import { FrameNode } from '../components/nodes/FrameNode';
import { InputNode } from '../components/nodes/InputNode';
import { UnitNode } from '../components/nodes/UnitNode';
import { MathNode } from '../components/nodes/MathNode';
import { ResultNode } from '../components/nodes/ResultNode';
import { ConstantNode } from '../components/nodes/ConstantNode';
import { SliderNode } from '../components/nodes/SliderNode';
import { RandomNode } from '../components/nodes/RandomNode';
import { FormulaResultNode } from '../components/nodes/FormulaResultNode';
import { RoundingNode } from '../components/nodes/RoundingNode';
import { MatrixInputNode } from '../components/nodes/MatrixInputNode';
import { MatrixResultNode } from '../components/nodes/MatrixResultNode';
import { ColorNode } from '../components/nodes/ColorNode';
import { ColorResultNode } from '../components/nodes/ColorResultNode';
import { LogicNode } from '../components/nodes/LogicNode';
import { ToggleNode } from '../components/nodes/ToggleNode';
import { ButtonNode } from '../components/nodes/ButtonNode';
import { MagneticEdge } from '../components/edges/MagneticEdge';

export const nodeTypes = {
    baseNode: BaseNode,
    frame: FrameNode,
    'MA-01': MathNode,
    'MA-03': ConstantNode,
    'MA-04': BaseNode,       // Switch
    'MA-05': LogicNode,      // Consolidated Logic Gate
    'MA-08': ToggleNode,
    'MA-09': ButtonNode,


    'MA-12': RoundingNode,
    'MA-13': BaseNode,       // Logic Split (Renamed from MA-03)
    'IO-01': InputNode,
    'IO-02': SliderNode,
    'IO-05': UnitNode,
    'IO-06': RandomNode,
    'IO-08': MatrixInputNode,
    'IO-11': ResultNode,
    'IO-16': MatrixResultNode,
    'IO-17': FormulaResultNode,
    'IO-18': ColorNode,
    'IO-19': ColorResultNode,
};

export const edgeTypes = {
    magnetic: MagneticEdge,
};
