import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { ResizeHandle } from './ResizeHandle';
import { useNodeDimensions } from './hooks/useNodeDimensions';
import { useContentMetrics } from './hooks/useContentMetrics';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 📝 TextAnnotationNode (UI-01)
 * A "Sticky Note" style node with Markdown support and dynamic resizing.
 * Refactored to use BaseNode/ResizeHandle/useNodeDimensions for stability.
 */
export const TextAnnotationNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData, getNode } = useReactFlow();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    const toggleEdit = useCallback(() => {
        updateNodeData(id, { isEditing: !isEditing });
    }, [id, isEditing, updateNodeData]);

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
            <div className="flex-1 w-full h-full min-h-0 min-w-0 select-none cursor-text overflow-hidden prose prose-invert prose-sm max-w-none prose-headings:mb-1 prose-p:mb-1 flex flex-col pt-1">
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={(data.markdown as string) || ''}
                        onChange={handleTextChange}
                        onBlur={toggleEdit}
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
