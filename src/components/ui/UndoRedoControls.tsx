import { Redo2, Undo2 } from 'lucide-react';

export interface UndoRedoControlsProps {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    disabled?: boolean;
}

const BUTTON_BASE = 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors';
const BUTTON_ENABLED = 'text-zinc-400 hover:bg-zinc-800 hover:text-white';
const BUTTON_DISABLED = 'text-zinc-700 cursor-not-allowed';

export function UndoRedoControls({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    disabled = false,
}: UndoRedoControlsProps) {
    const undoDisabled = disabled || !canUndo;
    const redoDisabled = disabled || !canRedo;

    return (
        <div
            className="fixed bottom-20 left-4 z-50 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1 backdrop-blur-xl"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                title="Undo (Ctrl+Z)"
                aria-label="Undo (Ctrl+Z)"
                disabled={undoDisabled}
                onClick={() => { if (!undoDisabled) onUndo(); }}
                className={`${BUTTON_BASE} ${undoDisabled ? BUTTON_DISABLED : BUTTON_ENABLED}`}
            >
                <Undo2 className="h-4 w-4" />
            </button>

            <button
                type="button"
                title="Redo (Ctrl+Y)"
                aria-label="Redo (Ctrl+Y)"
                disabled={redoDisabled}
                onClick={() => { if (!redoDisabled) onRedo(); }}
                className={`${BUTTON_BASE} ${redoDisabled ? BUTTON_DISABLED : BUTTON_ENABLED}`}
            >
                <Redo2 className="h-4 w-4" />
            </button>
        </div>
    );
}
