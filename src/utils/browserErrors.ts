/**
 * Errors the browser emits for scheduling reasons, not for broken state.
 *
 * `ResizeObserver loop completed with undelivered notifications` (and its
 * Safari/older variant `ResizeObserver loop limit exceeded`) is raised when
 * observer callbacks cause another layout pass in the same frame. Dragging a
 * node that React Flow measures with a ResizeObserver produces it routinely,
 * and the layout is correct afterwards. Treat it as noise: log it, never show
 * the crash overlay.
 */
export function isBenignBrowserError(message: string): boolean {
    return /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/.test(message);
}
