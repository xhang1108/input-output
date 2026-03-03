import { memo, useState, useEffect, useRef, Children, isValidElement } from 'react';
import { NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MIN_WIDTH = 150;
const MIN_HEIGHT = 100;

export const TextAnnotationNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData } = useReactFlow();

    // Local state
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState((data.markdown as string) || '# Note\nDouble click to edit');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync from data if it changes externally (during render)
    const [prevMarkdown, setPrevMarkdown] = useState(data.markdown);
    useEffect(() => {
        if (data.markdown !== prevMarkdown && typeof data.markdown === 'string') {
            setPrevMarkdown(data.markdown);
            setText(data.markdown);
        }
    }, [data.markdown, prevMarkdown]);

    // Focus textarea on edit
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        updateNodeData(id, { markdown: text });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { markdown: text } }
        });
    };

    const processedText = text;

    return (
        <div
            className={`
                relative h-full w-full rounded-md border transition-all duration-200 group
                ${selected ? 'border-amber-400/50 shadow-[0_0_15px_-3px_rgba(251,191,36,0.2)]' : 'border-transparent hover:border-zinc-700'}
            `}
            style={{
                background: 'rgba(30, 30, 35, 0.6)',
                backdropFilter: 'blur(4px)',
                minWidth: MIN_WIDTH,
                minHeight: MIN_HEIGHT
            }}
            onDoubleClick={() => setIsEditing(true)}
        >
            <NodeResizer
                isVisible={selected}
                minWidth={MIN_WIDTH}
                minHeight={MIN_HEIGHT}
                color="#fbbf24"
                handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
            />

            <div className="p-4 h-full w-full overflow-hidden text-zinc-300 text-sm font-sans leading-relaxed">
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        className="w-full h-full bg-transparent outline-none resize-none font-mono text-xs text-zinc-200 selection:bg-amber-900/50 nodrag"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') handleBlur();
                            e.stopPropagation();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="w-full h-full select-none cursor-text prose prose-invert prose-xs max-w-none prose-headings:mb-2 prose-p:mb-1">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                blockquote: ({ children }) => {
                                    const childrenArray = Children.toArray(children);
                                    const firstChild = childrenArray[0];

                                    // Check if the first child is a paragraph that contains the alert tag
                                    if (isValidElement(firstChild)) {
                                        const pProps: any = firstChild.props;
                                        if (pProps.children) {
                                            const grandkids = Children.toArray(pProps.children);
                                            const firstGrandkid = grandkids[0];

                                            if (typeof firstGrandkid === 'string') {
                                                const match = firstGrandkid.match(/^\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]/);
                                                if (match) {
                                                    const type = match[1].toLowerCase();
                                                    const cleanText = firstGrandkid.replace(/^\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\n?/, '').trim();

                                                    // Reconstruct the first paragraph without the alert tag
                                                    const newFirstChild = (
                                                        <p {...pProps}>
                                                            {cleanText}
                                                            {grandkids.slice(1)}
                                                        </p>
                                                    );

                                                    return (
                                                        <div className={`markdown-alert markdown-alert-${type}`}>
                                                            <div className="markdown-alert-title">{type}</div>
                                                            <div className="markdown-alert-content">
                                                                {newFirstChild}
                                                                {childrenArray.slice(1)}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            }
                                        }
                                    }
                                    return <blockquote>{children}</blockquote>;
                                }
                            }}
                        >
                            {processedText}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            {!isEditing && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-500 font-black uppercase italic tracking-widest">
                    MD
                </div>
            )}
        </div>
    );
});

TextAnnotationNode.displayName = 'TextAnnotationNode';
