import type { CompiledGroupFn, PureScalarFn } from './compileGroup';

// GroupCodeCache (GROUP_NODE_PLAN §5.3, §7 D4/E3).
//
// Separate from MathCompileCache (mathjs expression string -> EvalNode):
// this cache stores compiled group JS functions keyed by
// `structHash + precision + allowlistVersion`. Code lives only in memory
// (上限 200, LRU refresh on get); archives persist just the hash triple.
// D4: the entry passes through pureScalar + fastFn (derived deterministically
// from the same inputs; the key rule is unchanged).

export interface GroupCodeEntry {
    structHash: string;
    precision: 16 | 32 | 64;
    allowlistVersion: number;
    code: string;
    fn: CompiledGroupFn;
    pureScalar: boolean;
    fastFn?: PureScalarFn;
}

const MAX_ENTRIES = 200;

const entries = new Map<string, GroupCodeEntry>();

function evictIfNeeded(): void {
    while (entries.size > MAX_ENTRIES) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
    }
}

export const GroupCodeCache = {
    key(structHash: string, precision: 16 | 32 | 64, allowlistVersion: number): string {
        return `${structHash}:${precision}:${allowlistVersion}`;
    },
    get(key: string): GroupCodeEntry | undefined {
        const entry = entries.get(key);
        if (entry) {
            // LRU refresh.
            entries.delete(key);
            entries.set(key, entry);
        }
        return entry;
    },
    set(key: string, entry: GroupCodeEntry): void {
        if (entries.has(key)) entries.delete(key);
        entries.set(key, entry);
        evictIfNeeded();
    },
    has(key: string): boolean {
        return entries.has(key);
    },
    delete(key: string): boolean {
        return entries.delete(key);
    },
    clear(): void {
        entries.clear();
    },
    size(): number {
        return entries.size;
    },
};
