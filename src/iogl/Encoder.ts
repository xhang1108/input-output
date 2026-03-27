
import { InjectableGraph } from '../engine/types';
import { IOGL_MANIFEST } from './manifest';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

export class Encoder {
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
          props.push(`mode: "${modeVal}"`);
        }

        // Data Array & Positional Data (Extreme Merging)
        const schema = manifest.data;
        if (schema) {
          let keys: string[] = [];
          if (Array.isArray(schema)) {
            keys = schema;
          } else {
            const currentMode = String(data[manifest.modeProperty || 'mode'] || '');
            keys = schema[currentMode] || [];
          }

          const values = keys.map(key => {
              const val = data[key];
              let unwrapped = val;
              // 1. Unwrap Payload if it's a NodePayload
              if (val && typeof val === 'object' && 'type' in val && 'value' in val) {
                  unwrapped = val.value;
              }
              // 2. If it's a color object, return its hex string representation for encoding
              if (unwrapped && typeof unwrapped === 'object' && 'hex' in unwrapped) {
                  return (unwrapped as any).hex;
              }
              return unwrapped;
          }).filter(v => v !== undefined);

          if (values.length > 0) {
            // Position-based encoding (Extreme Merging)
            values.forEach(v => {
                const encoded = typeof v === 'string' ? `"${v}"` : JSON.stringify(v);
                positionalData.push(encoded);
            });
          }
        }

        // Auxiliary props
        if (manifest.auxiliary) {
          manifest.auxiliary.forEach(key => {
            if (data[key] !== undefined) {
              props.push(`${key}: ${JSON.stringify(data[key])}`);
            }
          });
        }
      }

      const positionalStr = positionalData.length > 0 ? ` ${positionalData.join(', ')}` : '';
      const propStr = props.length > 0 ? ` { ${props.join(', ')} }` : '';
      const x = Math.round(node.position.x);
      const y = Math.round(node.position.y);
      const labelStr = label !== node.type ? `[${label}] ` : '';

      result += `${labelStr}${node.type}${positionalStr}${propStr} @${x},${y}\n`;
    }

    result += '\n';

    // 2. Encode Edges
    for (const edge of graph.edges) {
      const sourceLabel = idToLabel.get(edge.source) || edge.source;
      const targetLabel = idToLabel.get(edge.target) || edge.target;

      const sourceHandle = this.formatHandle(edge.sourceHandle || 'out_a', true);
      const targetHandle = this.formatHandle(edge.targetHandle || 'in_a', false);

      result += `${sourceLabel}${sourceHandle} -> ${targetLabel}${targetHandle}\n`;
    }

    return result;
  }

  private static formatHandle(handle: string, isSource: boolean): string {
    const h = handle.toLowerCase();
    // Match in_a, out_b, in, out etc.
    const match = h.match(/^(in|out)(_?([a-z]))?$/);
    
    if (match) {
      // If it's just "in" or "out", prefix it with 'a'
      const char = match[3] || 'a';
      return `.${char}`;
    }

    return `:${handle}`; // Fallback to colon format for custom handles
  }
}
