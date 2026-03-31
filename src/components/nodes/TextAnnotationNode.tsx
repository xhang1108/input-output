import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { ResizeHandle } from './ResizeHandle';
import { useNodeDimensions } from './hooks/useNodeDimensions';
import { useContentMetrics } from './hooks/useContentMetrics';
import ReactMarkdown from 'react-markdown';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Transaction } from '../../engine/types';
import remarkGfm from 'remark-gfm';

/**
 * TextAnnotationNode (UI-01)
 * A "Sticky Note" style node with Markdown support and dynamic resizing.
 * Refactored to use BaseNode/ResizeHandle/useNodeDimensions for stability.
 */
export const TextAnnotationNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData, getNode } = useReactFlow();
    const { push, isRestoring } = useHistoryStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const originalValue = useRef<string | null>(null);
    const nodeRef = useRef<HTMLDivElement>(null);

    // Dimension management via unified hook
    const { width, height, onResize, onResizeStart, onResizeEnd } = useNodeDimensions({
        id,
        type: 'UI-01',
        data
    });

    // Content Metrics Protocol: auto-feed Brain bounding box when text reflows
    useContentMetrics(nodeRef, { id });

    const isEditing = data.isEditing || false;

    // Sync from external data changes (e.g., NPanel edits)
    const [prevMarkdown, setPrevMarkdown] = useState(data.markdown);
    useEffect(() => {
        if (data.markdown !== prevMarkdown) {
            setPrevMarkdown(data.markdown);
        }
    }, [data.markdown, prevMarkdown]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(id, { markdown: e.target.value });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            const initial = originalValue.current;
            if (initial !== null) {
                updateNodeData(id, { markdown: initial });
            }
            e.currentTarget.blur();
        }
    };

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        const currentValue = e.target.value; // Stale State Defense: Direct DOM Access
        const initialValue = originalValue.current;

        if (initialValue !== null && initialValue !== currentValue && !isRestoring) {
            push({
                id: `edit_${id}_${Date.now()}`,
                description: 'Edit Text',
                forward: [{ type: 'UPDATE_NODE_DATA', payload: { id, data: { markdown: currentValue } } }],
                inverse: [{ type: 'UPDATE_NODE_DATA', payload: { id, data: { markdown: initialValue } } }]
            });
        }
        originalValue.current = null;
        updateNodeData(id, { isEditing: false });
    }, [id, push, isRestoring, updateNodeData]);

    const toggleEdit = useCallback(() => {
        if (!isEditing) {
            originalValue.current = (data.markdown as string) || '';
            updateNodeData(id, { isEditing: true });
        }
    }, [id, isEditing, updateNodeData, data.markdown]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    return (
        <BaseNode
            {...props}
            ref={nodeRef}
            data={{ ...data, width, height }}
            style={{ width, height }}
            onDoubleClick={toggleEdit}
        >
            <div
                className="flex-1 w-full h-full min-h-0 min-w-0 select-none cursor-text overflow-hidden prose prose-invert prose-sm max-w-none prose-headings:mb-1 prose-p:mb-1 flex flex-col pt-1 nodrag"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={(data.markdown as string) || ''}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        className="flex-1 w-full h-full min-h-0 min-w-0 bg-transparent outline-none resize-none font-mono text-[10px] text-zinc-300 leading-relaxed overflow-hidden"
                        placeholder="Type markdown here..."
                    />
                ) : (
                    <div className="flex-1 w-full h-full min-h-0 min-w-0 overflow-hidden">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {(data.markdown as string) || '*Double-click to edit*'}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            <ResizeHandle
                id={id}
                targetRef={nodeRef}
                position="bottom-right"
                onResize={onResize}
                onResizeStart={onResizeStart}
                onResizeEnd={onResizeEnd}
            />
        </BaseNode>
    );
});

TextAnnotationNode.displayName = 'TextAnnotationNode';
