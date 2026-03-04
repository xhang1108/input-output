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
import { PlotNode } from '../components/nodes/PlotNode';
import { LogicNode } from '../components/nodes/LogicNode';
import { ToggleNode } from '../components/nodes/ToggleNode';
import { ButtonNode } from '../components/nodes/ButtonNode';
import { MagneticEdge } from '../components/edges/MagneticEdge';
import { TextAnnotationNode } from '../components/nodes/TextAnnotationNode';
import { RerouteNode } from '../components/nodes/RerouteNode';
import { BaseConverterNode } from '../components/nodes/BaseConverterNode';
import { LogNode } from '../components/nodes/LogNode';
import { TrigNode } from '../components/nodes/TrigNode';
import { NodeExpression } from '../components/nodes/NodeExpression';
import { DebugNode } from '../components/nodes/DebugNode';
import { MatrixToolsNode } from '../components/nodes/MatrixToolsNode';
import { VectorUtilsNode } from '../components/nodes/VectorUtilsNode';
import { CombinatoricsNode } from '../components/nodes/CombinatoricsNode';
import { VectorSplitNode } from '../components/nodes/VectorSplitNode';
import { GeometryNode } from '../components/nodes/GeometryNode';
import { ArrayExtractNode } from '../components/nodes/ArrayExtractNode';
import { ArrayBuilderNode } from '../components/nodes/ArrayBuilderNode';
import { VectorFieldNode } from '../components/nodes/VectorFieldNode';

// Removed legacy calculus nodes
import { DifferentialNode } from '../components/nodes/DifferentialNode';
import { IntegralNode } from '../components/nodes/IntegralNode';
import { LimitNode } from '../components/nodes/LimitNode';
import { ODESolverNode } from '../components/nodes/ODESolverNode';
import { StatisticsNode } from '../components/nodes/StatisticsNode';
import { SmoothingNode } from '../components/nodes/SmoothingNode';
import { ListUtilityNode } from '../components/nodes/ListUtilityNode';
import { SetOpsNode } from '../components/nodes/SetOpsNode';
import { DistributionsNode } from '../components/nodes/DistributionsNode';
import { StatusNode } from '../components/nodes/StatusNode';

export const nodeTypes = {
    // ─── 1. Input ──────────────────────────────────────────
    'IO-01': InputNode,      // Number
    'IO-02': SliderNode,
    'IO-04': InputNode,      // String
    'MA-09': ButtonNode,
    'MA-03': ConstantNode,
    'IO-08': MatrixInputNode,
    'IO-21': AbacusNode,
    'SY-05': NodeExpression,

    // ─── 2. Generators ──────────────────────────────────────
    'IO-06': RandomNode,
    'DA-05': DistributionsNode,

    // ─── 3. Math ────────────────────────────────────────────
    'MA-01': MathNode,
    'MA-16': LogNode,
    'MA-17': TrigNode,
    'MA-14': RoundingNode,
    'MA-12': FractionNode,
    'MA-02': NumberTheoryNode,
    'AD-03': CombinatoricsNode,

    // ─── 4. Calculus ────────────────────────────────────────
    'AD-04': DifferentialNode,
    'AD-05': IntegralNode,
    'AD-11': LimitNode,
    'AD-06': SolverNode,
    'SY-04': ODESolverNode,

    // ─── 5. Data & Structures ───────────────────────────────
    'DA-07': ArrayBuilderNode,
    'DA-06': ArrayExtractNode,
    'DA-03': ListUtilityNode,
    'DA-04': SetOpsNode,
    'AD-02': VectorUtilsNode,
    'AD-09': VectorSplitNode,
    'AD-01': MatrixToolsNode,

    // ─── 6. Transform ───────────────────────────────────────
    'IO-05': UnitNode,
    'MA-15': BaseConverterNode,
    'AD-10': GeometryNode,
    'AD-08': VectorFieldNode,
    'DA-02': SmoothingNode,
    'DA-01': StatisticsNode,

    // ─── 7. Logic & Flow ────────────────────────────────────
    'MA-05': LogicNode,      // Logic Gate
    'MA-04': BaseNode,       // Switch (Using BaseNode or appropriate component)
    'MA-13': BaseNode,       // Logic Split (Using BaseNode)
    'MA-08': ToggleNode,

    // ─── 8. Output ──────────────────────────────────────────
    'IO-11': ResultNode,
    'IO-22': StatusNode,
    'IO-14': PlotNode,
    'UI-99': DebugNode,

    // ─── 9. Utility ─────────────────────────────────────────
    'UI-01': TextAnnotationNode,
    'UI-03': RerouteNode,

    // ─── Fallback & Special ─────────────────────────────────
    'baseNode': BaseNode,
    'frame': FrameNode,
    'IO-16': ResultNode,
    'IO-17': ResultNode,
    'IO-19': ResultNode,
    'IO-18': ColorNode,
};

export const edgeTypes = {
    magnetic: MagneticEdge,
};
