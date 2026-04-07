import { InjectableGraph } from '@/engine/types/engineTypes';
import { IOGL_MANIFEST } from './manifest';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { IOGLUtils } from './IOGLUtils';

/**
 * ️ IOGL 1.0 Encoder
 * Converts internal Engine graph state into IOGL 1.0 script format.
 * Utilizes IOGLUtils for standardized handle and value formatting.
 */
export class Encoder {
  private static formatLabel(label: string): string {
    if (!label) return '';
    // IOGL 1.0 Law: Labels MUST be bracketed at all times for consistency.
    return `[${label}]`;
  }

  public static encode(graph: InjectableGraph): string {
    let result = '';
    const idToLabel = new Map<string, string>();

    // 1. Encode Nodes
    for (const node of graph.nodes) {
      const def = NODE_DEFINITIONS.find(d => d.id === node.type);
      const label = (node.data as any).label || def?.label || node.id;
      idToLabel.set(node.id, label);

      const props: string[] = [];
      const positionalData: string[] = [];
      const manifest = IOGL_MANIFEST[node.type];
      const data = node.data as any;

      if (manifest) {
        // Mode - ONLY encode if manifest.modeProperty is defined
        if (manifest.modeProperty && data[manifest.modeProperty] !== undefined) {
          let modeVal = data[manifest.modeProperty];
          if (manifest.modeMapping) {
            const mappingKey = Object.keys(manifest.modeMapping).find(k => manifest.modeMapping![k] === modeVal);
            if (mappingKey) modeVal = mappingKey;
          }
          props.push(`mode: ${JSON.stringify(modeVal)}`);
        }

        // Data Array & Positional Data (Extreme Merging)
        const schema = manifest.data;
        if (schema) {
          let keys: string[] = [];
          if (Array.isArray(schema)) {
            keys = schema;
          } else {
            const currentMode = String(data[manifest.modeProperty || 'mode'] || '');
            keys = (schema as any)[currentMode] || [];
          }

          const values = keys.map(key => {
            return IOGLUtils.unwrapValue(data[key]);
          }).filter(v => v !== undefined);

          if (values.length > 0) {
            // Position-based encoding (Extreme Merging)
            values.forEach(v => {
              positionalData.push(JSON.stringify(v));
            });
          }
        }

        // Auxiliary props (with [V1.0] Dimension Shorthand {W, H} support)
        if (manifest.auxiliary) {
          const hasWidth = data.width !== undefined;
          const hasHeight = data.height !== undefined;
          const useShorthand = hasWidth && hasHeight && manifest.auxiliary.includes('width') && manifest.auxiliary.includes('height');

          if (useShorthand) {
            const w = Math.round(data.width);
            const h = Math.round(data.height);
            props.push(`${w},${h}`);
          }

          manifest.auxiliary.forEach((key: string) => {
            // Skip width/height if already handled by shorthand
            if (useShorthand && (key === 'width' || key === 'height')) return;

            if (data[key] !== undefined) {
              let val = data[key];
              // Round size-related auxiliary properties to 1-pixel precision
              if ((key === 'width' || key === 'height') && typeof val === 'number') {
                val = Math.round(val);
              }
              props.push(`${key}: ${JSON.stringify(val)}`);
            }
          });
        }
      }

      const positionalStr = positionalData.length > 0 ? ` ${positionalData.join(', ')}` : '';
      const propStr = props.length > 0 ? ` {${props.join(',')}}` : '';
      const x = Math.round(node.position.x);
      const y = Math.round(node.position.y);

      // IOGL 1.0 Law: All nodes MUST have bracketed labels in output
      const labelStr = `${this.formatLabel(label)} `;

      result += `${labelStr}${node.type}${positionalStr}${propStr} @${x},${y}\n`;
    }

    result += '\n';

    // 2. Encode Edges
    for (const edge of graph.edges) {
      const sNode = graph.nodes.find(n => n.id === edge.source);
      const tNode = graph.nodes.find(n => n.id === edge.target);

      if (sNode && tNode) {
        const sMan = IOGL_MANIFEST[sNode.type] || IOGL_MANIFEST[sNode.type.toUpperCase()];
        const tMan = IOGL_MANIFEST[tNode.type] || IOGL_MANIFEST[tNode.type.toUpperCase()];

        if (sMan?.outputs && sNode.data) {
          const mProp = sMan.modeProperty || 'mode';
          const mVal = String(sNode.data[mProp] || '');
          const v = Array.isArray(sMan.outputs) ? sMan.outputs : (sMan.outputs as any)[mVal];
          if (v && !v.includes(edge.sourceHandle)) continue;
        }

        if (tMan?.inputs && tNode.data) {
          const mProp = tMan.modeProperty || 'mode';
          const mVal = String(tNode.data[mProp] || '');
          const v = Array.isArray(tMan.inputs) ? tMan.inputs : (tMan.inputs as any)[mVal];
          if (v && !v.includes(edge.targetHandle)) continue;
        }
      }

      const sLabelRaw = idToLabel.get(edge.source) || edge.source;
      const tLabelRaw = idToLabel.get(edge.target) || edge.target;

      const sourceLabel = this.formatLabel(sLabelRaw);
      const targetLabel = this.formatLabel(tLabelRaw);

      const sourceHandle = IOGLUtils.formatHandle(edge.sourceHandle || 'out_a');
      const targetHandle = IOGLUtils.formatHandle(edge.targetHandle || 'in_a');

      result += `${sourceLabel}${sourceHandle} -> ${targetLabel}${targetHandle}\n`;
    }

    return result;
  }
}

