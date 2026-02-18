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
import { NumberTheoryNode } from '../components/nodes/NumberTheoryNode';
import { FractionNode } from '../components/nodes/FractionNode';
import { LogicNode } from '../components/nodes/LogicNode';
import { ToggleNode } from '../components/nodes/ToggleNode';
import { ButtonNode } from '../components/nodes/ButtonNode';
import { MagneticEdge } from '../components/edges/MagneticEdge';
import { TextAnnotationNode } from '../components/nodes/TextAnnotationNode';
import { RerouteNode } from '../components/nodes/RerouteNode';

export const nodeTypes = {
    baseNode: BaseNode,
    frame: FrameNode,
    'MA-01': MathNode,
    'MA-02': NumberTheoryNode,
    'MA-03': ConstantNode,
    'MA-04': BaseNode,       // Switch
    'MA-05': LogicNode,      // Consolidated Logic Gate
    'MA-08': ToggleNode,
    'MA-09': ButtonNode,


    'MA-12': FractionNode,   // Fraction
    'MA-13': BaseNode,       // Logic Split
    'MA-14': RoundingNode,   // Rounding (Moved from MA-12)
    'IO-01': InputNode,
    'IO-02': SliderNode,
    'IO-04': InputNode, // String Input uses same UI as Number Input (for now)
    'IO-05': UnitNode,
    'IO-06': RandomNode,
    'IO-08': MatrixInputNode,
    'IO-11': ResultNode,
    'IO-16': MatrixResultNode,
    'IO-17': FormulaResultNode,
    'IO-18': ColorNode,
    'IO-19': ColorResultNode,

    'UI-01': TextAnnotationNode, // Text Annotation
    'UI-03': RerouteNode,        // Reroute
};

export const edgeTypes = {
    magnetic: MagneticEdge,
};
