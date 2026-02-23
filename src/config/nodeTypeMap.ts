/**
 * Static Node & Edge Type Maps
 * Extracted from Body.tsx to keep the orchestrator lean.
 */

import { BaseNode } from '../components/nodes/BaseNode';
import { SolverNode } from '../components/nodes/SolverNode';
import { FrameNode } from '../components/nodes/FrameNode';
import { InputNode } from '../components/nodes/InputNode';
import { UnitNode } from '../components/nodes/UnitNode';
import { MathNode } from '../components/nodes/MathNode';
import { ResultNode } from '../components/nodes/ResultNode';
import { ConstantNode } from '../components/nodes/ConstantNode';
import { SliderNode } from '../components/nodes/SliderNode';
import { RandomNode } from '../components/nodes/RandomNode';
import { RoundingNode } from '../components/nodes/RoundingNode';
import { MatrixInputNode } from '../components/nodes/MatrixInputNode';
import { ColorNode } from '../components/nodes/ColorNode';
import { AbacusNode } from '../components/nodes/AbacusNode';
import { NumberTheoryNode } from '../components/nodes/NumberTheoryNode';
import { FractionNode } from '../components/nodes/FractionNode';
import { LogicNode } from '../components/nodes/LogicNode';
import { ToggleNode } from '../components/nodes/ToggleNode';
import { ButtonNode } from '../components/nodes/ButtonNode';
import { MagneticEdge } from '../components/edges/MagneticEdge';
import { TextAnnotationNode } from '../components/nodes/TextAnnotationNode';
import { RerouteNode } from '../components/nodes/RerouteNode';
import { BaseConverterNode } from '../components/nodes/BaseConverterNode';
import { LogNode } from '../components/nodes/LogNode';
import { NodeExpression } from '../components/nodes/NodeExpression';
import { DebugNode } from '../components/nodes/DebugNode';
import { MatrixToolsNode } from '../components/nodes/MatrixToolsNode';
import { VectorUtilsNode } from '../components/nodes/VectorUtilsNode';
import { CombinatoricsNode } from '../components/nodes/CombinatoricsNode';
import { VectorSplitNode } from '../components/nodes/VectorSplitNode';
import { GeometryNode } from '../components/nodes/GeometryNode';
import { ArrayExtractNode } from '../components/nodes/ArrayExtractNode';
import { ArrayBuilderNode } from '../components/nodes/ArrayBuilderNode';
import { DerivativeNode } from '../components/nodes/DerivativeNode';
import { IntegralNode } from '../components/nodes/IntegralNode';

export const nodeTypes = {
    baseNode: BaseNode,
    frame: FrameNode,
    'AD-04': DerivativeNode,
    'AD-05': IntegralNode,
    'AD-06': SolverNode,
    'MA-01': MathNode,
    'MA-02': NumberTheoryNode,
    'MA-03': ConstantNode,
    'MA-04': BaseNode,       // Switch
    'MA-05': LogicNode,      // Consolidated Logic Gate
    'MA-08': ButtonNode,
    'MA-09': ButtonNode,


    'MA-12': FractionNode,   // Fraction
    'MA-13': BaseNode,       // Logic Split (Placeholder/Generic)
    'MA-14': RoundingNode,   // Rounding (Moved from MA-12)
    'MA-15': BaseConverterNode, // Base Converter
    'MA-16': LogNode,           // Logarithm
    'IO-01': InputNode,
    'IO-02': SliderNode,
    'IO-04': InputNode,      // String
    'IO-05': UnitNode,       // Unit
    'IO-06': RandomNode,     // Random
    'IO-08': MatrixInputNode, // Matrix Provider
    'IO-11': ResultNode,     // Universal Result (Scalar, Matrix, Color, Formula)
    'IO-16': ResultNode,     // Fallback mapping to prevent crashes from old graphs
    'IO-17': ResultNode,     // Fallback mapping
    'IO-18': ColorNode,      // Color Provider
    'IO-19': ResultNode,     // Fallback mapping for latex
    'IO-21': AbacusNode,     // Abacus
    'SY-05': NodeExpression, // AST Formula Evaluator
    'UI-01': TextAnnotationNode, // Markdown
    'UI-03': RerouteNode,    // Flow alignment
    'UI-99': DebugNode,

    // Linear Algebra & Array Processing
    'AD-01': MatrixToolsNode,
    'AD-02': VectorUtilsNode,
    'AD-03': CombinatoricsNode,
    'AD-09': VectorSplitNode,
    'AD-10': GeometryNode,
    'DA-06': ArrayExtractNode,
    'DA-07': ArrayBuilderNode,
};

export const edgeTypes = {
    magnetic: MagneticEdge,
};
