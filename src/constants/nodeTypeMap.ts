import { BaseNode } from '../components/nodes/BaseNode';
import { SolverNode } from '../components/nodes/SolverNode';

import { InputNode } from '../components/nodes/InputNode';
import { UnitNode } from '../components/nodes/UnitNode';
import { GenericSelectorNode } from '../components/nodes/GenericSelectorNode';
import { ResultNode } from '../components/nodes/ResultNode';
import { ConstantNode } from '../components/nodes/ConstantNode';
import { SliderNode } from '../components/nodes/SliderNode';
import { RandomNode } from '../components/nodes/RandomNode';
import { RoundingNode } from '../components/nodes/RoundingNode';
import { MatrixInputNode } from '../components/nodes/MatrixInputNode';
import { ColorNode } from '../components/nodes/ColorNode';
import { AbacusNode } from '../components/nodes/AbacusNode';

import { FractionNode } from '../components/nodes/FractionNode';
import { PlotNode } from '../components/nodes/PlotNode';
import { LogicNode } from '../components/nodes/LogicNode';
import { ToggleNode } from '../components/nodes/ToggleNode';
import { ButtonNode } from '../components/nodes/ButtonNode';
import { MagneticEdge } from '../components/edges/MagneticEdge';
import { TextAnnotationNode } from '../components/nodes/TextAnnotationNode';
import { RerouteNode } from '../components/nodes/RerouteNode';
import { BaseConverterNode } from '../components/nodes/BaseConverterNode';
import { TrigNode } from '../components/nodes/TrigNode';
import { NodeExpression } from '../components/nodes/NodeExpression';
import { DebugNode } from '../components/nodes/DebugNode';
import { VectorUtilsNode } from '../components/nodes/VectorUtilsNode';
import { CombinatoricsNode } from '../components/nodes/CombinatoricsNode';

import { GeometryNode } from '../components/nodes/GeometryNode';
import { ArrayExtractNode } from '../components/nodes/ArrayExtractNode';
import { ArrayBuilderNode } from '../components/nodes/ArrayBuilderNode';
import { VectorFieldNode } from '../components/nodes/VectorFieldNode';

import { ArrayCalculusNode } from '../components/nodes/ArrayCalculusNode';

// Specialized components removed in favor of GenericSelectorNode
// import { MathNode } from '../components/nodes/MathNode';
// import { LogNode } from '../components/nodes/LogNode';
// import { StatisticsNode } from '../components/nodes/StatisticsNode';
// import { ListUtilityNode } from '../components/nodes/ListUtilityNode';
// import { SetOpsNode } from '../components/nodes/SetOpsNode';
// import { MatrixToolsNode } from '../components/nodes/MatrixToolsNode';

import { DifferentialNode } from '../components/nodes/DifferentialNode';
import { IntegralNode } from '../components/nodes/IntegralNode';
import { LimitNode } from '../components/nodes/LimitNode';
import { ODESolverNode } from '../components/nodes/ODESolverNode';
import { SmoothingNode } from '../components/nodes/SmoothingNode';
import { StatusNode } from '../components/nodes/StatusNode';

export const nodeTypes = {
    // ─── 1. Input ──────────────────────────────────────────
    'IN-01': InputNode,      // Number
    'IN-02': SliderNode,
    'IN-04': InputNode,      // String
    'IN-05': ButtonNode,
    'IN-06': ConstantNode,
    'IN-07': MatrixInputNode,
    'IN-08': AbacusNode,
    'IN-09': NodeExpression,

    // ─── 2. Generators ──────────────────────────────────────
    'IN-10': RandomNode,

    // ─── 3. Math ────────────────────────────────────────────
    'MA-01': GenericSelectorNode,
    'MA-02': GenericSelectorNode,
    'MA-03': GenericSelectorNode,
    'MA-04': TrigNode,
    'MA-05': RoundingNode,
    'MA-06': FractionNode,
    'MA-07': GenericSelectorNode,
    'MA-08': CombinatoricsNode,

    // ─── 4. Calculus ────────────────────────────────────────
    'CL-01': DifferentialNode,
    'CL-02': IntegralNode,
    'CL-03': LimitNode,
    'CL-04': SolverNode,
    'CL-05': ODESolverNode,

    // ─── 5. Data & Structures ───────────────────────────────
    'DT-01': ArrayBuilderNode,
    'DT-02': ArrayExtractNode,
    'DT-03': GenericSelectorNode,
    'DT-04': GenericSelectorNode,
    'DT-05': VectorUtilsNode,

    'DT-06': ArrayCalculusNode,

    // ─── 6. Transform ───────────────────────────────────────
    'TR-01': UnitNode,
    'TR-02': BaseConverterNode,
    'TR-03': GeometryNode,
    'TR-04': VectorFieldNode,
    'TR-05': SmoothingNode,
    'TR-06': GenericSelectorNode,

    // ─── 7. Logic & Flow ────────────────────────────────────
    'LG-01': LogicNode,      // Logic Gate
    'LG-02': BaseNode,       // Switch (Using BaseNode or appropriate component)
    'LG-03': BaseNode,       // Logic Split (Using BaseNode)

    // ─── 8. Output ──────────────────────────────────────────
    'OT-01': ResultNode,
    'OT-02': StatusNode,
    'OT-03': PlotNode,
    'OT-04': DebugNode,

    // ─── 9. Utility ─────────────────────────────────────────
    'UT-01': TextAnnotationNode,
    'UT-02': RerouteNode,
    'UT-03': BaseNode,

    // ─── Fallback & Special ─────────────────────────────────
    'baseNode': BaseNode,

    'IN-03': ColorNode,     // New Color ID
};

export const edgeTypes = {
    magnetic: MagneticEdge,
};

