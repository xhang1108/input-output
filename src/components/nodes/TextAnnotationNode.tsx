import { memo, useState, useEffect, useRef } from 'react';
import { NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

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
    if (data.markdown !== prevMarkdown && typeof data.markdown === 'string') {
        setPrevMarkdown(data.markdown);
        setText(data.markdown);
    }

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

    // Simple markdown-ish rendering
    const renderContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
                return <h1 key={i} className="text-lg font-bold mb-1">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={i} className="text-md font-bold mb-1">{line.slice(3)}</h2>;
            }
            if (line.startsWith('- ')) {
                return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
            }
            return <div key={i} className="min-h-[1.2em]">{line}</div>;
        });
    };

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
                        className="w-full h-full bg-transparent outline-none resize-none font-mono text-xs text-zinc-200 selection:bg-amber-900/50"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') handleBlur();
                        }}
                        onMouseDown={(e) => e.stopPropagation()} // Allow editing without dragging
                    />
                ) : (
                    <div className="w-full h-full select-none cursor-text">
                        {renderContent(text)}
                    </div>
                )}
            </div>

            {!isEditing && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-600 font-mono">
                    Markdown
                </div>
            )}
        </div>
    );
});

TextAnnotationNode.displayName = 'TextAnnotationNode';
