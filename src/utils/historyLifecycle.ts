import { useHistoryStore } from '../store/useHistoryStore';

/**
 * Drops all undo/redo history because the graph identity changed.
 *
 * History entries hold transactions bound to the previous project's node ids;
 * replaying them against a freshly injected graph would corrupt it.
 */
export function clearHistoryForNewProject(): void {
    useHistoryStore.getState().clear();
}
