export type InteractionMode = 'IDLE' | 'GRABBING' | 'SCALING' | 'ROTATING' | 'CUTTING';

export type MouseDownAction = 'CUT' | 'CANCEL' | 'PASS';

export function snapAxis(v: number, grid: number): number {
    if (!(grid > 0)) return v;
    if (!Number.isFinite(v)) return v;
    if (v === 0) return 0;
    return Math.sign(v) * Math.round(Math.abs(v) / grid) * grid;
}

export function snapTranslate(dx: number, dy: number, grid: number): { x: number; y: number } {
    if (!(grid > 0)) return { x: dx, y: dy };
    return { x: snapAxis(dx, grid), y: snapAxis(dy, grid) };
}

export function snapScale(scale: number, step = 0.05, min = 0.05): number {
    if (!Number.isFinite(scale)) return 1;
    if (!(step > 0)) return Math.max(scale, min);
    const snapped = Math.round(scale / step) * step;
    const rounded = Math.round(snapped * 1e10) / 1e10;
    return Math.max(rounded, min);
}

export function snapRotation(deg: number, step = 15): number {
    if (!Number.isFinite(deg)) return 0;
    if (!(step > 0)) return deg;
    const normalized = ((deg % 360) + 540) % 360 - 180;
    const snapped = Math.round(normalized / step) * step;
    return snapped === 0 ? 0 : snapped;
}

export function resolveMouseDownAction(args: {
    button: number;
    ctrlKey: boolean;
    isMac: boolean;
    mode: InteractionMode;
}): MouseDownAction {
    const { button, ctrlKey, isMac, mode } = args;
    const isCutGesture = ctrlKey && (button === 2 || (isMac && button === 0));
    if (!isCutGesture) return 'PASS';
    if (mode !== 'IDLE') return 'CANCEL';
    return 'CUT';
}
