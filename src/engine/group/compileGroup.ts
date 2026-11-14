import { DataType, type NodePayload } from '../../types/payload';
import type { BoundaryPort, GroupNodeData, SubGraph } from '../../types/groupNode';
import type { NodeLogic } from '../types/engineTypes';
import { topoSortSubGraph } from './interpretGroup';
import { getGroupPlan } from './planCache';
import { InputOutputEngine } from '../InputOutputEngine';
import { GroupCodeCache } from './groupCodeCache';

// P2 group compiler (GROUP_NODE_PLAN §5.3, §7 D4/D11, §8).
//
// Strategy: reuse the interpreter's topology + per-node evaluator semantics,
// but emit each allowlist node as an inlined JS statement operating on
// dehydrated/hydrated values with the shared mathjs instance. The statements
// are packed into a single `(inputs, params, math) => outputs` function whose
// source string is cached in GroupCodeCache under
// `structHash + precision + allowlistVersion`.
//
// structHash field table (§5.3, E2): topology + node types + edges + boundary
// dedup keys + any data that changes AST shape (op/mode/formula strings,
// unit, angleMode, bases, ...) enter the hash. Pure numerics
// (value/min/max/step/precision/defaultValue) walk the scope (`params`) and
// never trigger recompilation. MA-02 formula-string changes recompile via the
// generic rule (any non-scope key participates in the hash).

export const ALLOWLIST_VERSION = 1;

// D11 v1: 14 compilable types. Anything else inside the subGraph (except
// constant sources IN-01/IN-06, which become scope literals) forces fallback
// to interpretGroup and marks the group unoptimized. A type that fails the
// equivalence gate is kicked out of this list (never by weakening tests).
export const GROUP_ALLOWLIST: string[] = [
    'MA-01', 'MA-02', 'MA-03', 'MA-04', 'MA-05', 'MA-06', 'MA-07', 'MA-08',
    'TR-01', 'TR-02', 'TR-06',
    'LG-01', 'LG-02', 'LG-03',
];

// Constant sources carry no logic: their data.value is a scope literal.
const CONST_SOURCE_TYPES = new Set(['IN-01', 'IN-06']);

// D2 nesting ban (mirrors interpretGroup).
const FORBIDDEN_INNER_TYPES = new Set(['group', 'frame']);

// Scope keys: pure numerics that must NOT invalidate the compiled code.
const SCOPE_KEYS = new Set([
    'value', 'defaultValue', 'precision', 'accuracy', 'min', 'max', 'step',
]);

export type CompiledGroupFn = (
    inputs: Record<string, NodePayload>,
    params: Record<string, unknown>,
    math: unknown,
) => Record<string, NodePayload>;

/**
 * Pure-scalar fast function: same `(inputs, params, math)` shape, but it
 * operates on bare numbers (no per-node payload wrapping) and returns
 * `null` when any boundary output is not a finite number — the caller then
 * discards the result and runs the full `fn`, preserving Error semantics
 * (DIV0, negative SQRT, overflow) bit-for-bit.
 */
export type PureScalarFn = (
    inputs: Record<string, NodePayload>,
    params: Record<string, unknown>,
    math: unknown,
) => Record<string, NodePayload> | null;

export interface CompiledGroup {
    structHash: string;
    precision: 16 | 32 | 64;
    allowlistVersion: number;
    code: string;
    fn: CompiledGroupFn;
    /** D4: true only when the subGraph passed isPureScalarGroup. */
    pureScalar: boolean;
    /** D4: bare-math fast path; absent unless pureScalar is true. */
    fastFn?: PureScalarFn;
}

function fnv1a(input: string, seed: number): number {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Structural projection of a node's data: everything except SCOPE_KEYS. */
function structuralDataOf(data: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(data).sort()) {
        if (SCOPE_KEYS.has(key)) continue;
        if (key === 'muted') continue; // muted groups never compile (see canCompileGroup)
        if (key === 'label') continue; // cosmetic
        out[key] = data[key];
    }
    return out;
}

/**
 * Canonical structural hash. Excludes all scope numerics, so editing only
 * value/min/max/step/precision/defaultValue keeps the hash (and the cache
 * entry) stable. Any topology/type/edge/boundary/mode/formula change alters it.
 */
export function computeStructHash(subGraph: SubGraph, boundary: GroupNodeData['boundary']): string {
    const nodes = subGraph.nodes
        .map((n) => ({
            id: n.id,
            type: n.type,
            d: structuralDataOf((n.data ?? {}) as Record<string, unknown>),
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const edges = subGraph.edges
        .map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle].join('\u0000'))
        .sort();
    const ports = (list: BoundaryPort[]) =>
        list.map((p) => [p.portId, p.innerNodeId, p.innerHandle, p.dataType].join('\u0000')).sort();
    const canonical = JSON.stringify({
        n: nodes,
        e: edges,
        i: ports(boundary.inputs ?? []),
        o: ports(boundary.outputs ?? []),
    });
    const a = fnv1a(canonical, 0x811c9dc5).toString(16).padStart(8, '0');
    const b = fnv1a(canonical, 0x01000193).toString(16).padStart(8, '0');
    return `${a}${b}`;
}

export interface CompileCheck {
    ok: boolean;
    reasons: string[];
}

/** True when the subGraph can take the compiled fast path. */
export function canCompileGroup(subGraph: SubGraph, boundary: GroupNodeData['boundary']): CompileCheck {
    const reasons: string[] = [];
    if (!boundary || (boundary.outputs ?? []).length === 0) {
        reasons.push('no boundary outputs');
    }
    for (const node of subGraph.nodes) {
        if (FORBIDDEN_INNER_TYPES.has(node.type)) {
            reasons.push(`nested ${node.type} node '${node.id}'`);
            continue;
        }
        if ((node.data as Record<string, unknown> | undefined)?.muted) {
            reasons.push(`muted node '${node.id}'`);
            continue;
        }
        if (CONST_SOURCE_TYPES.has(node.type)) continue;
        if (!GROUP_ALLOWLIST.includes(node.type)) {
            reasons.push(`type '${node.type}' not in allowlist`);
        }
    }
    return { ok: reasons.length === 0, reasons };
}

// ─── D4 pure-scalar fast path (§5.3 follow-up, §8.4) ─────────────────────
//
// The full compiled path still wraps every node in payload ops (SC/DE/WR/EX
// + unit merge). The pure-scalar fast path drops all per-node wrapping and
// runs bare-math statements on plain numbers, wrapping once at the boundary.
// It is enabled only for subGraphs that are provably unit-free and scalar:
//
// - every node type is in the conservative PURE_SCALAR_TYPES subset
//   (MA-01..MA-05; constant sources IN-01/IN-06 become scope literals).
//   Any type that fails triple equivalence (fast vs full vs interpreter)
//   is kicked out of this list — never by weakening the tests.
// - no unit data anywhere (node data unit/customUnit keys; IN-01 constants
//   and boundary defaults must be plain numbers or absent).
// - every boundary port has dataType 'scalar'.
// - no capsule fan-in (at most one edge per target handle; arrays would need
//   the full path's CN/EX semantics).
// - muted / nested group/frame nodes are rejected (muted is already excluded
//   by canCompileGroup; repeated here so the check is self-contained).
//
// Anything else falls back to the full compiled fn (then interpretGroup),
// so externally visible behavior is identical (§8.4).

export const PURE_SCALAR_TYPES: readonly string[] = [
    'MA-01', 'MA-02', 'MA-03', 'MA-04', 'MA-05',
];

export interface PureCheck {
    ok: boolean;
    reasons: string[];
}

function hasUnitData(data: Record<string, unknown>): boolean {
    if (!data) return false;
    const unit = data.unit;
    if (unit !== undefined && unit !== null && unit !== '') return true;
    const custom = data.customUnit;
    if (custom !== undefined && custom !== null && custom !== '') return true;
    return false;
}

/** True when the subGraph can take the D4 pure-scalar fast path. */
export function isPureScalarGroup(subGraph: SubGraph, boundary: GroupNodeData['boundary']): PureCheck {
    const reasons: string[] = [];
    if (!boundary || (boundary.outputs ?? []).length === 0) {
        reasons.push('no boundary outputs');
        return { ok: false, reasons };
    }
    for (const port of [...(boundary.inputs ?? []), ...(boundary.outputs ?? [])]) {
        if (port.dataType !== 'scalar') {
            reasons.push(`port '${port.portId}' dataType '${port.dataType}' is not scalar`);
        }
    }
    for (const port of boundary.inputs ?? []) {
        if (port.defaultValue !== undefined && typeof port.defaultValue !== 'number') {
            reasons.push(`port '${port.portId}' defaultValue is not a number`);
        }
    }
    // Capsule fan-in (multiple edges into one handle) carries array semantics
    // in the full path; the bare-math fast path cannot reproduce it.
    const fanIn = new Map<string, number>();
    for (const e of subGraph.edges) {
        const key = `${e.target}::${e.targetHandle}`;
        fanIn.set(key, (fanIn.get(key) ?? 0) + 1);
    }
    for (const [key, count] of fanIn) {
        if (count > 1) reasons.push(`fan-in on '${key}' (${count} edges) carries array semantics`);
    }
    for (const node of subGraph.nodes) {
        const data = (node.data ?? {}) as Record<string, unknown>;
        if (FORBIDDEN_INNER_TYPES.has(node.type)) {
            reasons.push(`nested ${node.type} node '${node.id}'`);
            continue;
        }
        if (data.muted) {
            reasons.push(`muted node '${node.id}'`);
            continue;
        }
        if (CONST_SOURCE_TYPES.has(node.type)) {
            if (hasUnitData(data)) {
                reasons.push(`constant node '${node.id}' carries unit data`);
            }
            // Constants must be plain numbers (or absent) so the fast path can
            // inline them without payload-merge semantics.
            const raw = node.type === 'IN-01' ? (data.value ?? data.val) : undefined;
            if (raw !== undefined && typeof raw !== 'number') {
                reasons.push(`constant node '${node.id}' value is not a plain number`);
            }
            continue;
        }
        if (!(PURE_SCALAR_TYPES as readonly string[]).includes(node.type)) {
            reasons.push(`type '${node.type}' not in pure-scalar subset`);
            continue;
        }
        if (hasUnitData(data)) {
            reasons.push(`node '${node.id}' carries unit data`);
        }
    }
    return { ok: reasons.length === 0, reasons };
}

/**
 * Scope params: every numeric knob the generated code reads at run time.
 * Keyed `${nodeId}__value` / `${nodeId}__precision` and
 * `port:${portId}__default`. Changing these never invalidates the cache entry.
 */
export function buildScopeParams(
    subGraph: SubGraph,
    boundary: GroupNodeData['boundary'],
): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const node of subGraph.nodes) {
        const data = (node.data ?? {}) as Record<string, unknown>;
        if (CONST_SOURCE_TYPES.has(node.type)) {
            if (data.value !== undefined) params[`${node.id}__value`] = data.value;
            else if (data.val !== undefined && node.type === 'IN-01') params[`${node.id}__value`] = data.val;
            const prec = data.precision ?? data.accuracy;
            if (prec !== undefined) params[`${node.id}__precision`] = prec;
        }
        if (node.type === 'MA-05') {
            params[`${node.id}__precision`] = data.precision ?? 0;
        }
        if (node.type === 'IN-06') {
            const prec = data.precision ?? 5;
            params[`${node.id}__precision`] = prec;
        }
    }
    for (const port of boundary.inputs ?? []) {
        if (port.defaultValue !== undefined) {
            params[`port:${port.portId}__default`] = port.defaultValue;
        }
    }
    return params;
}

// ─── Code generation ─────────────────────────────────────────────────────

// Shared prelude: faithful ports of PayloadUtils unwrap/hydrate/dehydrate,
// toBoolean, extractInnerHandle, and the UnitAlgebra merge used by MA-01.
// The generated function closes over nothing except (inputs, params, math).
//
// U/HY/SC sources are shared verbatim between the full path (PRELUDE) and
// the D4 pure-scalar fast path (PURE_PRELUDE): the fast path uses U/HY only
// at the boundary (input unwrap) and SC only at the boundary (output wrap).
// Per-node payload wrapping (WR/EX/UM/handleMeta) is dropped on the fast path.
const U_SRC = `var U=function(p){
  if(p!==null&&typeof p==='object'){
    if('type' in p&&'value' in p){
      var inner=p.value;
      if(inner!==null&&typeof inner==='object'&&'mathjs' in inner){
        if('value' in inner) return inner.value;
        if('data' in inner) return inner.data;
      }
      return inner;
    }
    if('mathjs' in p){
      if('value' in p) return p.value;
      if('data' in p) return p.data;
    }
    if(p._data&&p._size) return p._data;
  }
  return p;
};
`;

const HY_SRC = `var HY=function(v){
  if(!v||typeof v!=='object') return v;
  if('mathjs' in v){
    var t=v.mathjs;
    if(t==='BigNumber') return math.bignumber(v.value);
    if(t==='Fraction') return math.fraction(v.n,v.d);
    if(t==='Complex') return math.complex(v.re,v.im);
    if(t==='Unit') return math.unit(v.value,v.unit);
    if(t==='Matrix') return math.matrix(v.data);
  }
  return v;
};
`;

const DE_SRC = `var DE=function(v){
  if(!v) return v;
  var h=v;
  if(h.isBigNumber) return {mathjs:'BigNumber',value:h.toString()};
  if(h.isFraction) return {mathjs:'Fraction',n:h.n,d:h.d};
  if(h.isComplex) return {mathjs:'Complex',re:h.re,im:h.im};
  if(h.isUnit){
    var uv=h.value;
    try{ uv=h.toNumber(h.formatUnits()); }catch(ee){ uv=h.value; }
    return {mathjs:'Unit',value:uv,unit:(h.formatUnits?h.formatUnits():undefined)};
  }
  if(Array.isArray(v)) return v.map(function(x){return DE(x);});
  if((h.isMatrix||h._data)&&(h.toArray||Array.isArray(h._data))){
    var raw=h.toArray?h.toArray():h._data;
    return {mathjs:'Matrix',data:raw.map(function(item){return Array.isArray(item)?item.map(function(s){return DE(s);}):DE(item);}),type:h.type||'DenseMatrix'};
  }
  if(typeof v==='object'&&v!==null&&'isNode' in v) return v.toString();
  var proto=Object.getPrototypeOf(v);
  if(typeof v==='object'&&v!==null&&(proto===Object.prototype||proto===null)){
    var r={}; for(var k in v){ if(Object.prototype.hasOwnProperty.call(v,k)) r[k]=DE(v[k]); } return r;
  }
  if(typeof v==='object'&&v!==null&&h.toString) return v.toString();
  return v;
};
`;

const SC_SRC = `var SC=function(v,u){
  var p={type:'scalar',value:DE(v),symbol:null,meta:{rank:0,dimensions:[]}};
  if(u!==undefined&&u!==null) p.meta.unit=u;
  return p;
};
`;

const TAIL_SRC = `var ST=function(v){return {type:'string',value:v,symbol:null,meta:{}};};
var BO=function(v){return {type:'boolean',value:!!v,symbol:null,meta:{}};};
var AR=function(v,u){
  var raw=Array.isArray(v)?v:[v];
  var dims=[raw.length]; var c=raw[0];
  while(Array.isArray(c)){ dims.push(c.length); c=c[0]; }
  return {type:'array',value:{mathjs:'Matrix',data:raw.map(function(x){return Array.isArray(x)?x.map(function(s){return DE(s);}):DE(x);}),type:'DenseMatrix'},symbol:null,meta:{unit:u,dimensions:dims,rank:dims.length}};
};
var ER=function(m){return {type:'error',value:null,symbol:null,meta:{error:String(m)}};};
var TB=function(p){
  var raw=U(p); var h=HY(raw);
  if(h&&typeof h==='object'){
    if(h.isBigNumber&&h.isZero) return !h.isZero();
    if(h.isUnit) return h.value!==0;
    if(h.isComplex) return h.re!==0||h.im!==0;
    if(h.isFraction) return h.n!==0;
  }
  return !!h;
};
var WR=function(v){
  if(v&&typeof v==='object'&&'type' in v&&'value' in v) return v;
  if(typeof v==='string'){ var t=v.trim(); return (t!==''&&!isNaN(Number(t)))?SC(Number(v)):ST(v); }
  if(typeof v==='boolean') return BO(v);
  if(Array.isArray(v)) return AR(v);
  return SC(v);
};
var EX=function(p,h){
  if(p&&typeof p==='object'&&!Array.isArray(p)&&p.value&&typeof p.value==='object'&&p.value!==null&&!p.value.mathjs&&(h in p.value)){
    var sub=p.value[h];
    if(sub&&typeof sub==='object'&&'type' in sub&&'value' in sub) return sub;
    if(sub===null||sub===undefined) return SC(0);
    return WR(sub);
  }
  return p;
};
var CN=function(p){
  var out=[];
  var walk=function(q){
    if(q===undefined||q===null) return;
    if(Array.isArray(q)){ for(var k=0;k<q.length;k++) walk(q[k]); return; }
    var h=HY(U(q));
    if(h===null||h===undefined) return;
    if(h&&typeof h==='object'&&h.isMatrix&&h.toArray){
      var flat=h.toArray().flat(Infinity);
      for(var i=0;i<flat.length;i++) out.push(flat[i]);
      return;
    }
    if(Array.isArray(h)){ var fl=h.flat(Infinity); for(var j=0;j<fl.length;j++) out.push(fl[j]); return; }
    out.push(h);
  };
  walk(p); return out;
};
var UM=function(uA,uB,op){
  op=(op||'').toUpperCase();
  if(!uA&&!uB) return undefined;
  var parse=function(s){
    var m=new Map(); if(!s||!String(s).trim()) return m;
    var parts=String(s).trim().split('/');
    var add=function(seg,sign){
      if(!seg.trim()) return;
      var terms=seg.split(/[*\\u00b7\\s]+/).filter(function(t){return t.length>0;});
      for(var i=0;i<terms.length;i++){
        var mt=terms[i].match(/^([a-zA-Z%\\u03bc]+[a-zA-Z0-9%\\u03bc]*)(?:\\^([-+]?\\d+))?$/);
        if(mt){ var b=mt[1]; var pw=mt[2]?parseInt(mt[2],10):1; m.set(b,(m.get(b)||0)+pw*sign); }
      }
    };
    add(parts[0]||'',1);
    for(var d=1;d<parts.length;d++) add(parts[d],-1);
    m.forEach(function(v,k){ if(v===0) m.delete(k); });
    return m;
  };
  var fmt=function(m){
    if(m.size===0) return undefined;
    var num=[],den=[];
    var keys=Array.from(m.keys()).sort();
    for(var i=0;i<keys.length;i++){
      var p=m.get(keys[i]);
      if(p>0) num.push(p===1?keys[i]:keys[i]+'^'+p);
      else if(p<0){ var a=Math.abs(p); den.push(a===1?keys[i]:keys[i]+'^'+a); }
    }
    if(num.length===0&&den.length===0) return undefined;
    if(num.length===0) return '1/'+den.join('*');
    if(den.length===0) return num.join('*');
    return num.join('*')+'/'+den.join('*');
  };
  var eq=function(a,b){
    if(a.size!==b.size) return false;
    var ok=true; a.forEach(function(v,k){ if(b.get(k)!==v) ok=false; }); return ok;
  };
  var mul=function(a,b){ var r=new Map(a); b.forEach(function(v,k){ r.set(k,(r.get(k)||0)+v); }); r.forEach(function(v,k){ if(v===0) r.delete(k); }); return r; };
  var div=function(a,b){ var r=new Map(a); b.forEach(function(v,k){ r.set(k,(r.get(k)||0)-v); }); r.forEach(function(v,k){ if(v===0) r.delete(k); }); return r; };
  var pw=function(a,n){ var r=new Map(); a.forEach(function(v,k){ if(v*n!==0) r.set(k,v*n); }); return r; };
  if(!uA&&!uB) return undefined;
  var mA=parse(uA), mB=parse(uB);
  if(op==='ADD'||op==='SUB'){
    if(uA&&uB&&eq(mA,mB)) return fmt(mA)||uA;
    if(!uA||mA.size===0) return fmt(mB)||uB;
    if(!uB||mB.size===0) return fmt(mA)||uA;
    return uA+' + '+uB;
  }
  if(op==='MUL'){
    if(!uA||mA.size===0) return fmt(mB)||uB;
    if(!uB||mB.size===0) return fmt(mA)||uA;
    return fmt(mul(mA,mB));
  }
  if(op==='DIV'){
    if(!uA||mA.size===0){ if(uB&&mB.size>0) return fmt(pw(mB,-1)); return undefined; }
    if(!uB||mB.size===0) return fmt(mA)||uA;
    return fmt(div(mA,mB));
  }
  if(op==='POW'){ if(!uA||mA.size===0) return undefined; return fmt(mA)||uA; }
  if(op==='SQRT'){ if(!uA||mA.size===0) return undefined; return fmt(pw(mA,0.5)); }
  if(op==='CBRT'){ if(!uA||mA.size===0) return undefined; return fmt(pw(mA,1/3)); }
  if(op==='ABS'||op==='NEG') return fmt(mA)||uA;
  if(op==='FACT'||op==='SIGN') return undefined;
  return uA;
};
`;

const PRELUDE = `${U_SRC}
${HY_SRC}
${DE_SRC}
${SC_SRC}
${TAIL_SRC}`;

// Boundary-only number coercion for the pure-scalar fast path: payloads are
// unwrapped once at the boundary (U/HY above); only plain numbers and
// BigNumbers survive. Anything else (Complex/Unit/Matrix/string/boolean)
// yields NaN so the output finite-check discards the fast result and the
// full path decides the semantics (zero visible difference).
const TN_SRC = `var TN=function(p){
  if(p===undefined||p===null) return undefined;
  var h=HY(U(p));
  if(typeof h==='number') return h;
  if(h&&typeof h==='object'&&h.isBigNumber){ try{ return h.toNumber(); }catch(e){ return NaN; } }
  return NaN;
};`;

const PURE_PRELUDE = `${U_SRC}
${HY_SRC}
${DE_SRC}
${SC_SRC}
${TN_SRC}`;

type EdgeList = SubGraph['edges'];

function buildTopo(subGraph: SubGraph) {
    const order = topoSortSubGraph(subGraph);
    const idx = new Map(order.map((id, i) => [id, i]));
    const byId = new Map(subGraph.nodes.map((n) => [n.id, n]));
    const incoming = new Map<string, EdgeList>();
    for (const e of subGraph.edges) {
        if (!byId.has(e.source) || !byId.has(e.target)) continue;
        const list = incoming.get(e.target) ?? [];
        list.push(e);
        incoming.set(e.target, list);
    }
    const portByTarget = new Map<string, BoundaryPort>();
    // boundary is threaded in by the caller via closure below
    return { order, idx, byId, incoming, portByTarget };
}

function js(nodeData: unknown): string {
    return JSON.stringify(nodeData);
}

function errMsg(e: string): string {
    return `(e&&e.message?e.message:String(${e}))`;
}

/** JS expression for one input handle of a node (payload, payload[], or undefined). */
function handleExpr(
    nodeId: string,
    handle: string,
    incoming: Map<string, EdgeList>,
    portByTarget: Map<string, BoundaryPort>,
    idx: Map<string, number>,
): string {
    const list = (incoming.get(nodeId) ?? []).filter((e) => e.targetHandle === handle);
    if (list.length === 1) {
        const e = list[0];
        return `EX(V${idx.get(e.source)},${js(e.sourceHandle)})`;
    }
    if (list.length > 1) {
        return `[${list.map((e) => `EX(V${idx.get(e.source)},${js(e.sourceHandle)})`).join(',')}]`;
    }
    const port = portByTarget.get(`${nodeId}::${handle}`);
    if (port) {
        // The params lookup is unconditional so that adding/removing a
        // defaultValue later never requires recompilation (scope, §5.3).
        const dk = js(`port:${port.portId}__default`);
        return `(inputs[${js(port.portId)}]!==undefined?inputs[${js(port.portId)}]:(params[${dk}]!==undefined?WR(params[${dk}]):undefined))`;
    }
    return 'undefined';
}

function emitNode(
    nodeId: string,
    vi: number,
    type: string,
    data: Record<string, unknown>,
    incoming: Map<string, EdgeList>,
    portByTarget: Map<string, BoundaryPort>,
    idx: Map<string, number>,
): string {
    const H = (h: string) => handleExpr(nodeId, h, incoming, portByTarget, idx);
    const op = String(data.mode ?? data.op ?? '');
    const P = (k: string) => `params[${js(`${nodeId}__${k}`)}]`;

    switch (type) {
        case 'MA-01':
        case 'MA-02': {
            const o = (op || 'ADD').toUpperCase();
            return (
                `V${vi}=(function(){var pa=${H('in_a')},pb=${H('in_b')};` +
                `if((pa&&pa.type==='symbolic')||(pb&&pb.type==='symbolic'))return ER('Type Mismatch: Math nodes cannot process Equations (Symbolic). Use a Solver Node.');` +
                `var gh=function(p){if(!p)return 0;var h=HY(U(p));` +
                `if(h&&typeof h==='object'){if(h.isUnit||(h.constructor&&h.constructor.name==='Unit')){try{return h.toNumber(h.formatUnits());}catch(ee){return h.value||0;}}}` +
                `return h;};` +
                `var a=gh(pa),b=gh(pb);` +
                `var ev=function(v){if(v&&typeof v==='object'&&!Array.isArray(v)){if(!v.isMatrix&&!v.isUnit&&!v.isBigNumber){if('vec3' in v)return v.vec3;if('value' in v)return v.value;}}return v;};` +
                `a=ev(a);b=ev(b);` +
                `if(typeof a==='number')a=math.bignumber(a);if(typeof b==='number')b=math.bignumber(b);` +
                `var uA=(pa&&pa.meta)?pa.meta.unit:undefined,uB=(pb&&pb.meta)?pb.meta.unit:undefined;` +
                `if(${js(o)}==='ADD'||${js(o)}==='SUB'){` +
                `var isA=a&&(Array.isArray(a)||a.isMatrix||(a.constructor&&a.constructor.name==='Matrix'));` +
                `var isB=b&&(Array.isArray(b)||b.isMatrix||(b.constructor&&b.constructor.name==='Matrix'));` +
                `if((isA&&!isB)||(!isA&&isB))return ER('Strict Mode: Cannot add/sub Array and Scalar');` +
                `if(uA&&uB&&uA!==uB){try{` +
                `var nA=(a&&a.isBigNumber)?a.toNumber():Number(a);` +
                `var nB=(b&&b.isBigNumber)?b.toNumber():Number(b);` +
                `var c=((${js(o)}==='ADD')?math.add(math.unit(nA,uA),math.unit(nB,uB)):math.subtract(math.unit(nA,uA),math.unit(nB,uB)));` +
                `return SC(c.toNumber(uA),uA);}catch(ee){return ER('Cannot '+(${js(o)}==='ADD'?'add':'subtract')+': '+uA+' and '+uB+' are incompatible');}}}` +
                `try{var r;` +
                `if(${js(o)}==='ADD')r=math.add(a,b);` +
                `else if(${js(o)}==='SUB')r=math.subtract(a,b);` +
                `else if(${js(o)}==='MUL')r=math.multiply(a,b);` +
                `else if(${js(o)}==='DIV')r=math.divide(a,b);` +
                `else if(${js(o)}==='POW')r=math.pow(a,b);` +
                `else if(${js(o)}==='SQRT')r=(pb&&!math.equal(b,0))?math.nthRoot(a,b):math.sqrt(a);` +
                `else if(${js(o)}==='ABS')r=math.abs(a);` +
                `else if(${js(o)}==='NEG')r=math.unaryMinus(a);` +
                `else if(${js(o)}==='SIGN')r=math.sign(a);` +
                `else if(${js(o)}==='CBRT')r=math.cbrt(a);` +
                `else if(${js(o)}==='FACT')r=math.factorial(a);` +
                `else r=math.add(a,b);` +
                `if(r&&typeof r==='object'){if(r.isUnit||(r.constructor&&r.constructor.name==='Unit'))r=r.value;}` +
                `return SC(r,UM(uA,uB,${js(o)}));` +
                `}catch(e){return ER(${errMsg('e')});}})();`
            );
        }
        case 'MA-03': {
            const o = (op || 'LN').toUpperCase();
            return (
                `V${vi}=(function(){var pp=${H('in_a')};var v=HY(U(pp||SC(0)));` +
                `try{var r;` +
                `if(${js(o)}==='LOG10')r=math.log10(v);` +
                `else if(${js(o)}==='LOGN'){var bb=${H('in_b')};var base=(bb!==undefined?HY(U(bb)):10);r=math.log(v,base);}` +
                `else r=math.log(v);return SC(r);}catch(e){return ER('Log Failed');}})();`
            );
        }
        case 'MA-04': {
            const o = (op || 'SIN').toUpperCase();
            const am = String(data.angleMode ?? 'RAD').toUpperCase();
            return (
                `V${vi}=(function(){var v=HY(U(${H('in_a')}||SC(0)));var vb=HY(U(${H('in_b')}||SC(0)));` +
                `if(${js(am)}==='DEG'&&['SIN','COS','TAN'].indexOf(${js(o)})>=0){try{v=math.multiply(v,math.divide(math.pi,180));}catch(ee){}}` +
                `try{var r;` +
                `if(${js(o)}==='SIN')r=math.sin(v);else if(${js(o)}==='COS')r=math.cos(v);` +
                `else if(${js(o)}==='TAN')r=math.tan(v);else if(${js(o)}==='ASIN')r=math.asin(v);` +
                `else if(${js(o)}==='ACOS')r=math.acos(v);else if(${js(o)}==='ATAN')r=math.atan(v);` +
                `else if(${js(o)}==='ATAN2')r=math.atan2(v,vb);else if(${js(o)}==='SINH')r=math.sinh(v);` +
                `else if(${js(o)}==='COSH')r=math.cosh(v);else r=math.sin(v);` +
                `if(${js(am)}==='DEG'&&['ASIN','ACOS','ATAN','ATAN2'].indexOf(${js(o)})>=0){try{r=math.multiply(r,math.divide(180,math.pi));}catch(ee){}}` +
                `return SC(r);}catch(e){return ER('Trig Failed');}})();`
            );
        }
        case 'MA-05': {
            const o = (op || 'ROUND').toUpperCase();
            return (
                `V${vi}=(function(){var pp=(${H('in_a')}||SC(0));var v=HY(U(pp));` +
                `var prec=(${P('precision')}!==undefined?Number(${P('precision')}):0);` +
                `try{var r;` +
                `if(${js(o)}==='FLOOR')r=math.floor(v);else if(${js(o)}==='CEIL')r=math.ceil(v);` +
                `else if(${js(o)}==='TRUNC')r=math.fix(v);else r=math.round(v,prec);` +
                `return SC(r,(pp&&pp.meta)?pp.meta.unit:undefined);}catch(e){return ER('Op Failed');}})();`
            );
        }
        case 'MA-06': {
            const mixed = data.mixed === true;
            return (
                `V${vi}=(function(){var raw=HY(U(${H('in_a')}));` +
                `try{if(raw===null||raw===undefined)return SC(0);` +
                `var vn=(raw&&typeof raw==='object'&&raw.isBigNumber)?raw.toNumber():Number(raw);` +
                `var f=math.fraction(vn);var nn=Number(f.n),dd=Number(f.d),ip=0;` +
                `var s=math.format(f),lx=s;` +
                (mixed
                    ? `if(dd!==0){ip=Math.floor(nn/dd);nn=nn%dd;` +
                      `if(ip!==0){s=(nn===0?(''+ip):(ip+' '+nn+'/'+dd));lx=(nn===0?(''+ip):(ip+' \\\\frac{'+nn+'}{'+dd+'}'));}` +
                      `else{lx='\\\\frac{'+nn+'}{'+dd+'}';}}`
                    : `if(dd!==1&&dd!==0){lx='\\\\frac{'+nn+'}{'+dd+'}';}`) +
                `return {type:'object',value:{out_a:SC(ip),out_b:SC(nn),out_c:SC(dd),out_d:ST(s),latex:ST(lx)},symbol:null,meta:{}};` +
                `}catch(e){return ER('Invalid Fraction');}})();`
            );
        }
        case 'MA-07': {
            const o = (op || 'GCD').toUpperCase();
            return (
                `V${vi}=(function(){` +
                `try{var r;` +
                `if(${js(o)}==='GCD'||${js(o)}==='LCM'){` +
                `var all=CN(${H('in_a')}).concat(CN(${H('in_b')}));` +
                `if(all.length===0)return SC(0);` +
                `if(all.length===1)r=all[0];` +
                `else r=(${js(o)}==='GCD'?math.gcd.apply(null,all):math.lcm.apply(null,all));}` +
                `else if(${js(o)}==='MOD'){` +
                `var vA=CN(${H('in_a')}),vB=CN(${H('in_b')});` +
                `var x=vA.length>0?vA[0]:0,y=vB.length>0?vB[0]:1;` +
                `if(Number(y)===0)return ER('Modulo by zero');r=math.mod(x,y);}` +
                `else if(${js(o)}==='ISPRIME'){` +
                `var vs=CN(${H('in_a')});` +
                `return AR(vs.filter(function(n){return math.isPrime(n);}));}` +
                `else r=0;` +
                `var fv=(r&&r.isBigNumber)?r.toNumber():r;return SC(fv);` +
                `}catch(e){return ER(${js(o)}+' Failed: '+${errMsg('e')});}})();`
            );
        }
        case 'MA-08': {
            const o = op || 'nCr';
            return (
                `V${vi}=(function(){var pa=${H('in_a')},pb=${H('in_b')};` +
                `if(!pa)return ER('Missing Input (n)');` +
                `if(${js(o)}!=='FACTORIAL'&&!pb)return ER('Missing Input (r)');` +
                `try{var n=HY(U(pa));var rr=pb?HY(U(pb)):0;var res;` +
                `if(${js(o)}==='nCr')res=math.combinations(n,rr);` +
                `else if(${js(o)}==='nPr')res=math.permutations(n,rr);` +
                `else if(${js(o)}==='FACTORIAL')res=math.factorial(n);` +
                `else res=math.combinations(n,rr);` +
                `return SC(res);}catch(e){return ER(${js(o)}+' Failed: '+${errMsg('e')});}})();`
            );
        }
        case 'TR-01': {
            const raw = data as Record<string, unknown>;
            const isCustom = raw.unit === 'CUSTOM';
            const target = String(isCustom ? (raw.customUnit ?? '') : (raw.unit ?? 'm'));
            return (
                `V${vi}=(function(){var pp=${H('in_a')};` +
                `if(!pp)return SC(0,${js(target)});` +
                `if(${js(target)}==='REMOVE')return SC(U(pp));` +
                `try{var rawv=U(pp);var su=(pp&&pp.meta)?pp.meta.unit:undefined;` +
                `if(su&&su!==${js(target)}){try{` +
                `var hy=HY(rawv);` +
                `var res=math.unit(hy,su).to(${js(target)});` +
                `var tf=math.unit(1,${js(target)}).value;` +
                `return SC(math.divide(res.value,tf),${js(target)});` +
                `}catch(ee){return ER('Cannot convert '+su+' to '+${js(target)}+': '+${errMsg('ee')});}}` +
                `return SC(rawv,${js(target)});}catch(e){return ER('Unit operation failed for '+${js(target)});}})();`
            );
        }
        case 'TR-02': {
            const toBase = Number(data.toBase ?? 16);
            const fromBase = data.fromBase !== undefined ? Number(data.fromBase) : null;
            return (
                `V${vi}=(function(){var pp=${H('in_a')};` +
                `if(!pp)return SC(0);` +
                `var mu=(pp&&pp.meta&&pp.meta.unit)?String(pp.meta.unit).toLowerCase():undefined;` +
                `var bm={'bin':2,'quat':4,'oct':8,'dec':10,'duo':12,'hex':16};` +
                `var isArr=(pp&&pp.type==='array');` +
                `var isSc=(pp&&pp.type==='scalar');` +
                `var hasB=!!(mu&&bm[mu]);` +
                `if(isArr||(!isSc&&!hasB))return ER('Base Conversion only supports scalar or base-prefixed strings.');` +
                `var um={2:'bin',4:'quat',8:'oct',10:'dec',12:'duo',16:'hex'};` +
                `var fromB=Number(${fromBase === null ? 'null' : String(fromBase)}||(mu?bm[mu]:0)||10);` +
                `var s=String(U(pp));` +
                `try{var nn=parseInt(s,fromB);if(isNaN(nn))throw new Error('NaN');` +
                `var rs=nn.toString(${toBase}).toUpperCase();` +
                `var t=SC(rs);t.meta={unit:(um[${toBase}]||'scalar')};return t;` +
                `}catch(e){return ER('Base Conversion Failed');}})();`
            );
        }
        case 'TR-06': {
            const o = op || 'Mean';
            return (
                `V${vi}=(function(){var pp=${H('in_a')};` +
                `if(!pp)return ER('No Input');` +
                `var hy=HY(U(pp));var arr=[];` +
                `if(hy&&typeof hy==='object'&&'toArray' in Object(hy))arr=hy.toArray().flat(Infinity);` +
                `else if(Array.isArray(hy))arr=hy.flat(Infinity);` +
                `else arr=[hy];` +
                `if(arr.length===0)return ER('Empty Array');` +
                `try{var r=0;` +
                `if(${js(o)}==='Mean')r=math.mean(arr);else if(${js(o)}==='Max')r=math.max(arr);` +
                `else if(${js(o)}==='Min')r=math.min(arr);else if(${js(o)}==='StdDev')r=math.std(arr);` +
                `else if(${js(o)}==='Median')r=math.median(arr);else if(${js(o)}==='Variance')r=math.variance(arr);` +
                `else if(${js(o)}==='Sum')r=math.sum(arr);else r=math.mean(arr);` +
                `return SC(r);}catch(e){return ER('Stats Failed: '+${errMsg('e')});}})();`
            );
        }
        case 'LG-01': {
            const o = (op || 'AND').toUpperCase();
            return (
                `V${vi}=(function(){var pa=${H('in_a')},pb=${H('in_b')};` +
                `var gv=function(p){if(!p)return null;var h=HY(U(p));` +
                `var mu=(p&&p.meta)?p.meta.unit:undefined;` +
                `if(mu&&(typeof h==='number'||(h&&h.isBigNumber))){try{return math.unit(h,mu);}catch(ee){return h;}}return h;};` +
                `var a=gv(pa),b=gv(pb);` +
                `try{var ih=function(v){try{return math.equal(v,1)===true||v===true;}catch(ee){return false;}};` +
                `var ha=ih(a),hb=ih(b);var ae=math.equal(a,b);var r=false;` +
                `if(${js(o)}==='GT')r=math.larger(a,b);else if(${js(o)}==='LT')r=math.smaller(a,b);` +
                `else if(${js(o)}==='GTE')r=math.largerEq(a,b);else if(${js(o)}==='LTE')r=math.smallerEq(a,b);` +
                `else if(${js(o)}==='NEQ')r=!ae;else if(${js(o)}==='EQ')r=ae;` +
                `else if(${js(o)}==='NOT')r=!ha;else if(${js(o)}==='AND')r=ha&&hb;` +
                `else if(${js(o)}==='OR')r=ha||hb;else if(${js(o)}==='XOR')r=(ha!==hb);` +
                `else if(${js(o)}==='NAND')r=!(ha&&hb);else if(${js(o)}==='NOR')r=!(ha||hb);` +
                `else if(${js(o)}==='XNOR')r=(ha===hb);else r=false;` +
                `return BO(r);}catch(e){return ER(${js(o)}+' Failed: '+${errMsg('e')});}})();`
            );
        }
        case 'LG-02': {
            return (
                `V${vi}=(function(){var c=TB(${H('in_a')});` +
                `var r=c?${H('in_b')}:${H('in_c')};` +
                `return r||ER('No Input');})();`
            );
        }
        case 'LG-03': {
            return (
                `V${vi}=(function(){var c=TB(${H('in_a')});` +
                `var d=(${H('in_b')}||SC(0));` +
                `var m=(d&&d.meta)?d.meta:{};` +
                `return {type:'object',value:{out_a:(c?d:null),out_b:(!c?d:null)},symbol:null,meta:{handleMeta:{out_a:m,out_b:m}}};})();`
            );
        }
        case 'IN-01': {
            const bakedUnit =
                data.unit !== undefined ? (data.unit as string) : undefined;
            return (
                `V${vi}=(function(){var rv=${P('value')};` +
                `var vv=(rv!==undefined?U(rv):0);` +
                `if(vv===null)vv=0;` +
                `var pr=(${P('precision')}!==undefined?Number(${P('precision')}):-1);` +
                `if(pr>=0){try{vv=math.round(vv,pr);}catch(ee){}}` +
                `var un=((rv&&typeof rv==='object'&&rv.meta&&rv.meta.unit)||${js(bakedUnit ?? null)});` +
                `if(un===null)un=undefined;` +
                `var t=SC(vv);t.meta.unit=un;return t;})();`
            );
        }
        case 'IN-06': {
            const valId = String(data.val ?? 'pi');
            return (
                `V${vi}=(function(){` +
                `var vm={'pi':math.pi,'e':math.e,'phi':math.phi,'tau':math.tau}[${js(valId)}]||math.pi;` +
                `var pr=(${P('precision')}!==undefined?Number(${P('precision')}):5);` +
                `var r=vm;` +
                `if(math.bignumber){r=math.bignumber(r);` +
                `if(pr>=0){r=math.round(r,pr);r=math.evaluate(math.format(r));}}` +
                `return SC(r);})();`
            );
        }
        default:
            throw new Error(`[GroupCompile] no emitter for type '${type}'`);
    }
}

// ─── D4 pure-scalar codegen ──────────────────────────────────────────
//
// Bare-math statements on plain numbers. Per-node payload wrapping (SC/DE/
// WR/EX/UM/handleMeta) is gone; U/HY run once per boundary input (TN) and
// SC runs once per boundary output. Raw outputs are finite-checked: any
// non-finite number, non-number (Complex from SQRT(-1)/LOG(-1)), or throw
// (even root of a negative, factorial domain errors) yields null so the
// caller discards the fast result and runs the full fn instead — Error and
// unit semantics are always decided by the full path (§8.4).
function pureHandleExpr(
    nodeId: string,
    handle: string,
    incoming: Map<string, EdgeList>,
    portIdx: Map<string, number>,
    idx: Map<string, number>,
): string {
    // The static gate guarantees at most one edge per target handle.
    const list = (incoming.get(nodeId) ?? []).filter((e) => e.targetHandle === handle);
    if (list.length === 1) return `F${idx.get(list[0].source)}`;
    const k = portIdx.get(`${nodeId}::${handle}`);
    if (k !== undefined) return `B${k}`;
    return 'undefined';
}

/**
 * Emit the D4 pure-scalar function body (bare math, boundary-only wrap).
 * Throws on missing output nodes or unsupported types; the caller treats
 * that as pureScalar=false (full path still compiles).
 */
export function emitPureScalarBody(
    subGraph: SubGraph,
    boundary: GroupNodeData['boundary'],
): string {
    const order = topoSortSubGraph(subGraph);
    const byId = new Map(subGraph.nodes.map((n) => [n.id, n]));
    const incoming = new Map<string, EdgeList>();
    for (const e of subGraph.edges) {
        if (!byId.has(e.source) || !byId.has(e.target)) continue;
        const list = incoming.get(e.target) ?? [];
        list.push(e);
        incoming.set(e.target, list);
    }
    const idx = new Map(order.map((id, i) => [id, i]));
    const portIdx = new Map<string, number>();
    for (let k = 0; k < (boundary.inputs ?? []).length; k++) {
        const p = boundary.inputs[k];
        const key = `${p.innerNodeId}::${p.innerHandle}`;
        if (!portIdx.has(key)) portIdx.set(key, k);
    }
    const H = (nodeId: string, handle: string): string =>
        pureHandleExpr(nodeId, handle, incoming, portIdx, idx);

    const lines: string[] = [];
    for (const port of boundary.inputs ?? []) {
        const k = portIdx.get(`${port.innerNodeId}::${port.innerHandle}`)!;
        const dk = js(`port:${port.portId}__default`);
        lines.push(
            `var B${k}=TN((inputs[${js(port.portId)}]!==undefined?inputs[${js(port.portId)}]:(params[${dk}]!==undefined?params[${dk}]:undefined)));`,
        );
    }

    for (let i = 0; i < order.length; i++) {
        const id = order[i];
        const node = byId.get(id)!;
        const data = (node.data ?? {}) as Record<string, unknown>;
        const type = node.type;
        const op = String(data.mode ?? data.op ?? '');
        const P = (k: string) => `params[${js(`${id}__${k}`)}]`;
        if (type === 'MA-01' || type === 'MA-02') {
            const o = (op || 'ADD').toUpperCase();
            const ha = H(id, 'in_a');
            const hb = H(id, 'in_b');
            lines.push(`var _a${i}=(${ha}===undefined?0:${ha});`);
            lines.push(`var _b${i}=(${hb}===undefined?0:${hb});`);
            if (o === 'ADD') lines.push(`var F${i}=math.add(_a${i},_b${i});`);
            else if (o === 'SUB') lines.push(`var F${i}=math.subtract(_a${i},_b${i});`);
            else if (o === 'MUL') lines.push(`var F${i}=math.multiply(_a${i},_b${i});`);
            else if (o === 'DIV') lines.push(`var F${i}=math.divide(_a${i},_b${i});`);
            else if (o === 'POW') lines.push(`var F${i}=math.pow(_a${i},_b${i});`);
            else if (o === 'SQRT') {
                lines.push(
                    `var F${i}=(((${hb})!==undefined&&!math.equal(_b${i},0))?math.nthRoot(_a${i},_b${i}):math.sqrt(_a${i}));`,
                );
            } else if (o === 'ABS') lines.push(`var F${i}=math.abs(_a${i});`);
            else if (o === 'NEG') lines.push(`var F${i}=math.unaryMinus(_a${i});`);
            else if (o === 'SIGN') lines.push(`var F${i}=math.sign(_a${i});`);
            else if (o === 'CBRT') lines.push(`var F${i}=math.cbrt(_a${i});`);
            // FACT is integer-only on BigNumbers ("Integer BigNumber expected")
            // while number factorials use the gamma extension: decline
            // non-integers so the full path decides (Error preserved).
            else if (o === 'FACT') lines.push(`var F${i}=(Number.isInteger(_a${i})?math.factorial(_a${i}):NaN);`);
            else lines.push(`var F${i}=math.add(_a${i},_b${i});`);
        } else if (type === 'MA-03') {
            const o = (op || 'LN').toUpperCase();
            const ha = H(id, 'in_a');
            const hb = H(id, 'in_b');
            lines.push(`var _v${i}=(${ha}===undefined?0:${ha});`);
            if (o === 'LOG10') lines.push(`var F${i}=math.log10(_v${i});`);
            else if (o === 'LOGN') {
                lines.push(`var _base${i}=((${hb})===undefined?10:${hb});`);
                lines.push(`var F${i}=math.log(_v${i},_base${i});`);
            } else lines.push(`var F${i}=math.log(_v${i});`);
        } else if (type === 'MA-04') {
            const o = (op || 'SIN').toUpperCase();
            const am = String(data.angleMode ?? 'RAD').toUpperCase();
            const ha = H(id, 'in_a');
            const hb = H(id, 'in_b');
            lines.push(`var _v${i}=(${ha}===undefined?0:${ha});`);
            lines.push(`var _vb${i}=(${hb}===undefined?0:${hb});`);
            if (am === 'DEG' && ['SIN', 'COS', 'TAN'].includes(o)) {
                lines.push(`try{_v${i}=math.multiply(_v${i},math.divide(math.pi,180));}catch(ee){}`);
            }
            if (o === 'SIN') lines.push(`var F${i}=math.sin(_v${i});`);
            else if (o === 'COS') lines.push(`var F${i}=math.cos(_v${i});`);
            else if (o === 'TAN') lines.push(`var F${i}=math.tan(_v${i});`);
            else if (o === 'ASIN') lines.push(`var F${i}=math.asin(_v${i});`);
            else if (o === 'ACOS') lines.push(`var F${i}=math.acos(_v${i});`);
            else if (o === 'ATAN') lines.push(`var F${i}=math.atan(_v${i});`);
            else if (o === 'ATAN2') lines.push(`var F${i}=math.atan2(_v${i},_vb${i});`);
            else if (o === 'SINH') lines.push(`var F${i}=math.sinh(_v${i});`);
            else if (o === 'COSH') lines.push(`var F${i}=math.cosh(_v${i});`);
            else lines.push(`var F${i}=math.sin(_v${i});`);
            if (am === 'DEG' && ['ASIN', 'ACOS', 'ATAN', 'ATAN2'].includes(o)) {
                lines.push(`try{F${i}=math.multiply(F${i},math.divide(180,math.pi));}catch(ee){}`);
            }
        } else if (type === 'MA-05') {
            const o = (op || 'ROUND').toUpperCase();
            const ha = H(id, 'in_a');
            lines.push(`var _v${i}=(${ha}===undefined?0:${ha});`);
            lines.push(`var _pr${i}=(${P('precision')}!==undefined?Number(${P('precision')}):0);`);
            if (o === 'FLOOR') lines.push(`var F${i}=math.floor(_v${i});`);
            else if (o === 'CEIL') lines.push(`var F${i}=math.ceil(_v${i});`);
            else if (o === 'TRUNC') lines.push(`var F${i}=math.fix(_v${i});`);
            else lines.push(`var F${i}=math.round(_v${i},_pr${i});`);
        } else if (type === 'IN-01') {
            lines.push(`var _rv${i}=${P('value')};`);
            lines.push(`var _vv${i}=TN(_rv${i});if(_vv${i}===undefined)_vv${i}=0;`);
            lines.push(`var _pr${i}=(${P('precision')}!==undefined?Number(${P('precision')}):-1);`);
            lines.push(`if(_pr${i}>=0){try{_vv${i}=math.round(_vv${i},_pr${i});}catch(ee){}}`);
            lines.push(`var F${i}=_vv${i};`);
        } else if (type === 'IN-06') {
            const valId = String(data.val ?? 'pi');
            lines.push(`var _pr${i}=(${P('precision')}!==undefined?Number(${P('precision')}):5);`);
            lines.push(
                `var F${i}=(function(){var vm={'pi':math.pi,'e':math.e,'phi':math.phi,'tau':math.tau}[${js(valId)}]||math.pi;` +
                `var r=Number(vm);if(_pr${i}>=0){try{r=Number(math.round(r,_pr${i}));}catch(ee){}}return r;})();`,
            );
        } else {
            throw new Error(`[GroupCompile] no pure-scalar emitter for type '${type}'`);
        }
    }

    const outVars: string[] = [];
    for (const port of boundary.outputs ?? []) {
        const si = idx.get(port.innerNodeId);
        if (si === undefined) {
            throw new Error(`[GroupCompile] output '${port.portId}' references missing node '${port.innerNodeId}'`);
        }
        // Raw finite-check before the single boundary wrap: non-finite or
        // non-number (Complex) results yield null → caller runs the full fn.
        lines.push(`if(typeof F${si}!=='number'||!isFinite(F${si}))return null;`);
        outVars.push(`${js(port.portId)}:SC(F${si})`);
    }
    lines.push(`return {${outVars.join(',')}};`);

    return `${PURE_PRELUDE}\n${lines.join('\n')}`;
}

/**
 * Compile a subGraph into a `(inputs, params, math) => outputs` function.
 * Throws on cycles, nesting violations (caller falls back), or unsupported
 * node types. Only structural data is baked in; numerics stay in `params`.
 */
export function compileGroup(
    subGraph: SubGraph,
    boundary: GroupNodeData['boundary'],
    precision: 16 | 32 | 64 = 64,
): CompiledGroup {
    const check = canCompileGroup(subGraph, boundary);
    if (!check.ok) {
        throw new Error(`[GroupCompile] not compilable: ${check.reasons.join('; ')}`);
    }
    const { order, idx, byId, incoming } = buildTopo(subGraph);
    const portByTarget = new Map<string, BoundaryPort>();
    for (const port of boundary.inputs ?? []) {
        const key = `${port.innerNodeId}::${port.innerHandle}`;
        if (!portByTarget.has(key)) portByTarget.set(key, port);
    }

    const lines: string[] = [];
    for (let i = 0; i < order.length; i++) {
        const id = order[i];
        const node = byId.get(id)!;
        lines.push(
            emitNode(
                id,
                i,
                node.type,
                (node.data ?? {}) as Record<string, unknown>,
                incoming,
                portByTarget,
                idx,
            ),
        );
    }

    const outEntries = (boundary.outputs ?? []).map((port) => {
        const si = idx.get(port.innerNodeId);
        if (si === undefined) {
            throw new Error(`[GroupCompile] output '${port.portId}' references missing node '${port.innerNodeId}'`);
        }
        return `${js(port.portId)}:EX(V${si},${js(port.innerHandle)})`;
    });
    lines.push(`return {${outEntries.join(',')}};`);

    const body = `${PRELUDE}\n${lines.join('\n')}`;
    const code = `(inputs,params,math)=>{${body}}`;
    const factory = new Function('inputs', 'params', 'math', body) as unknown as CompiledGroupFn;
    const fn: CompiledGroupFn = (inputs, params, math) => factory(inputs, params, math);

    // D4 pure-scalar fast path: same inputs, bare math, boundary-only wrap.
    // Any build failure degrades to pureScalar=false (full path unaffected).
    let pureScalar = false;
    let fastFn: PureScalarFn | undefined;
    if (isPureScalarGroup(subGraph, boundary).ok) {
        try {
            const fastBody = emitPureScalarBody(subGraph, boundary);
            const fastFactory = new Function('inputs', 'params', 'math', fastBody) as unknown as PureScalarFn;
            fastFn = (inputs, params, math) => fastFactory(inputs, params, math);
            pureScalar = true;
        } catch {
            pureScalar = false;
            fastFn = undefined;
        }
    }

    return {
        structHash: computeStructHash(subGraph, boundary),
        precision,
        allowlistVersion: ALLOWLIST_VERSION,
        code,
        fn,
        pureScalar,
        fastFn,
    };
}

/** Current engine precision, coerced to the supported 16/32/64 set. */
export function currentPrecision(): 16 | 32 | 64 {
    try {
        const math = InputOutputEngine.getInstance().getMathInstance() as {
            config?: () => { precision?: number };
        };
        const p = math?.config?.().precision;
        if (p === 16 || p === 32 || p === 64) return p;
    } catch {
        // fall through to default
    }
    return 64;
}

/** Wrap per-port outputs into the group object payload (shared by full/fast paths). */
export function payloadsObject(
    outputs: Record<string, NodePayload>,
    boundary: GroupNodeData['boundary'],
): NodePayload {
    const value: Record<string, unknown> = {};
    const handleMeta: Record<string, NodePayload['meta']> = {};
    for (const port of boundary.outputs ?? []) {
        const produced = outputs[port.portId] as NodePayload | undefined;
        if (!produced) return { type: DataType.Error, value: null, symbol: null, meta: {} };
        value[port.portId] = produced;
        handleMeta[port.portId] = (produced.meta ?? {}) as NodePayload['meta'];
    }
    return { type: DataType.Object, value, symbol: null, meta: { handleMeta } };
}

/**
 * True when any outer input carries unit metadata. Pure-scalar subGraphs are
 * statically unit-free, so a unit-carrying input must take the full compiled
 * fn (which performs unit conversion/merge) instead of the bare-math path.
 */
function inputsCarryUnit(outerInputs: Record<string, NodePayload>): boolean {
    for (const key of Object.keys(outerInputs)) {
        const p = outerInputs[key] as unknown as { meta?: { unit?: unknown } } | undefined;
        const unit = p?.meta?.unit;
        if (unit !== undefined && unit !== null && unit !== '') return true;
    }
    return false;
}

/**
 * Fast path used by the group evaluator: allowlist hit + warm/valid cache ->
 * run compiled; anything else -> null (caller falls back to interpretGroup
 * and marks the group unoptimized).
 *
 * D4: pure-scalar groups run the bare-math fastFn first. A null fast result
 * (non-finite/Complex/throw) or a unit-carrying input discards the fast
 * result and runs the full fn, so Error and unit semantics are preserved.
 * A missing/throwing full fn still yields null -> interpreter fallback.
 */
export function evaluateGroupCompiled(
    node: NodeLogic,
    outerInputs: Record<string, NodePayload>,
): NodePayload | null {
    try {
        const data = (node.data || {}) as Partial<GroupNodeData>;
        const subGraph = data.subGraph;
        const boundary = data.boundary;
        if (!subGraph || !boundary) return null;
        // One cached plan covers canCompile + structHash + scope params:
        // per-call O(N+E) rebuilds were the compiled path's fixed tax.
        const plan = getGroupPlan(subGraph, boundary);
        if (!plan.compilable.ok) return null;
        const precision = currentPrecision();
        const key = GroupCodeCache.key(plan.structHash, precision, ALLOWLIST_VERSION);
        let entry = GroupCodeCache.get(key);
        if (!entry) {
            const compiled = compileGroup(subGraph, boundary, precision);
            entry = {
                structHash: compiled.structHash,
                precision: compiled.precision,
                allowlistVersion: compiled.allowlistVersion,
                code: compiled.code,
                fn: compiled.fn,
                pureScalar: compiled.pureScalar,
                fastFn: compiled.fastFn,
            };
            GroupCodeCache.set(key, entry);
        }
        const math = InputOutputEngine.getInstance().getMathInstance();
        // plan.params is rebuilt only when subGraph/boundary identity changes
        // (edits replace both objects); values flowing through scope stay fresh
        // because a value edit replaces the data object too.
        if (entry.pureScalar && entry.fastFn) {
            if (!inputsCarryUnit(outerInputs)) {
                let fastOut: Record<string, NodePayload> | null = null;
                try {
                    fastOut = entry.fastFn(outerInputs, plan.params, math);
                } catch {
                    fastOut = null;
                }
                if (fastOut) return payloadsObject(fastOut, boundary);
            }
            try {
                const outputs = entry.fn(outerInputs, plan.params, math);
                return payloadsObject(outputs, boundary);
            } catch {
                return null;
            }
        }
        try {
            const outputs = entry.fn(outerInputs, plan.params, math);
            return payloadsObject(outputs, boundary);
        } catch {
            return null;
        }
    } catch {
        return null;
    }
}
