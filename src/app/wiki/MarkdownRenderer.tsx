"use client";

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
    content: string;
}

import dynamic from 'next/dynamic';

const NodeDemo = dynamic(() => import('./NodeDemo').then(m => m.NodeDemo), { 
    ssr: false,
    loading: () => <div className="w-full h-24 animate-pulse bg-white/5 rounded-xl border border-white/5" />
});

const CircuitDemo = dynamic(() => import('./CircuitDemo').then(m => m.CircuitDemo), { 
    ssr: false,
    loading: () => <div className="w-full h-32 animate-pulse bg-white/5 rounded-xl border border-white/5" />
});

import { DynamicSectionHeader } from './DynamicSectionHeader';

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    const components = useMemo(() => {
        const flattenText = (children: React.ReactNode): string => {
            return React.Children.toArray(children).reduce((text: string, child: any) => {
                if (typeof child === 'string') return text + child;
                if (React.isValidElement(child) && (child as any).props.children) {
                    return text + flattenText((child as any).props.children);
                }
                return text;
            }, '');
        };

        const HeadingWithAnchor = (level: number) => ({ node, ...props }: any) => {
            const text = flattenText(props.children);
            const match = text.match(/\(([A-Z0-9]{2}-\d{2})\)/);
            const id = match ? match[1] : text.toLowerCase().replace(/[^\w-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const Tag = `h${level}` as any;

            if (level === 2 || level === 3) {
                return (
                    <DynamicSectionHeader
                        id={id}
                        title={text}
                        level={level}
                    />
                );
            }

            return (
                <Tag id={id} className="scroll-mt-24 group relative" {...props}>
                    {props.children}
                </Tag>
            );
        };

        return {
            h1: HeadingWithAnchor(1),
            h2: HeadingWithAnchor(2),
            h3: HeadingWithAnchor(3),
            p({ children }: any) {
                return <p className="mb-4 text-zinc-400 leading-relaxed text-sm">{children}</p>;
            },
            blockquote({ children }: any) {
                const text = flattenText(children);
                const calloutRegex = /\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]/i;
                const calloutMatch = text.match(calloutRegex);

                // Clean out ALL occurrences of the marker [!TYPE] in the entire tree
                const cleanContent = (nodes: React.ReactNode): React.ReactNode => {
                    return React.Children.map(nodes, (child: any) => {
                        if (typeof child === 'string') {
                            return child.replace(calloutRegex, '').trimStart();
                        }
                        if (React.isValidElement(child)) {
                            const props = (child as any).props;
                            if (props && props.children) {
                                return React.cloneElement(child as any, {
                                    ...props,
                                    children: cleanContent(props.children)
                                });
                            }
                        }
                        return child;
                    });
                };

                const finalChildren = cleanContent(children);

                if (calloutMatch) {
                    const type = calloutMatch[1].toUpperCase();
                    const colors: any = {
                        TIP: 'border-emerald-500/60',
                        NOTE: 'border-cloud/60',
                        IMPORTANT: 'border-indigo-500/60',
                        WARNING: 'border-amber-500/60',
                        CAUTION: 'border-rose-500/60',
                    };

                    return (
                        <blockquote className={`border-l-4 ${colors[type] || 'border-white/10'} pl-6 my-10 italic text-zinc-400 opacity-90 leading-relaxed`}>
                            {finalChildren}
                        </blockquote>
                    );
                }

                return (
                    <blockquote className="border-l-4 border-white/10 pl-6 my-10 italic text-zinc-500">
                        {children}
                    </blockquote>
                );
            },
            code({ node, inline, className, children, ...props }: any) {
                const match = /language-([\w-]+)/.exec(className || '');
                const language = match ? match[1] : '';

                if (!inline && language === 'playground') {
                    try {
                        const payload = JSON.parse(String(children).replace(/\n$/, ''));
                        return (
                            <div className="not-prose w-full mb-4 bg-transparent! border-none! shadow-none!" style={{ minHeight: payload.height || 80 }}>
                                <NodeDemo
                                    nodeType={payload.nodeType}
                                    initialData={payload.initialData || payload.data}
                                    label={payload.label}
                                    height={payload.height}
                                />
                            </div>
                        );
                    } catch (e) {
                        return (
                            <div className="p-4 border border-red-900/30 rounded-xl bg-red-900/10 text-red-400 text-xs font-mono">
                                [Playground Error]: Invalid JSON configuration
                            </div>
                        );
                    }
                }

                if (!inline && language === 'iogl-circuit') {
                    try {
                        const payload = JSON.parse(String(children).replace(/\n$/, ''));
                        return (
                            <div className="not-prose w-full my-8 bg-transparent! border-none! shadow-none!" style={{ minHeight: payload.height || 120 }}>
                                <CircuitDemo
                                    iogl={payload.iogl}
                                    label={payload.label}
                                    height={payload.height}
                                />
                            </div>
                        );
                    } catch (e) {
                        return (
                            <div className="p-4 border border-cloud/30 rounded-xl bg-cloud/10 text-text-cloud text-xs font-mono">
                                [Circuit Error]: Invalid IOGL circuit configuration
                            </div>
                        );
                    }
                }

                return (
                    <code className={`${className} wrap-break-word whitespace-pre-wrap!`} {...props}>
                        {children}
                    </code>
                );
            },
            pre({ children }: any) {
                return (
                    <div className="relative group/code mb-8">
                        <pre className="bg-inherit! border-none! shadow-none! p-6! rounded-xl whitespace-pre-wrap! wrap-break-word! text-[13px] leading-relaxed font-mono relative overflow-hidden">
                            {children}
                        </pre>
                        <button
                            onClick={(e) => {
                                const pre = (e.currentTarget.previousElementSibling as HTMLPreElement);
                                if (pre) {
                                    navigator.clipboard.writeText(pre.innerText);
                                    const btn = e.currentTarget;
                                    const originalText = btn.innerText;
                                    btn.innerText = "COPIED";
                                    btn.style.color = "var(--color-primary)";
                                    setTimeout(() => {
                                        btn.innerText = originalText;
                                        btn.style.color = "";
                                    }, 2000);
                                }
                            }}
                            className="absolute top-3 right-3 opacity-0 group-hover/code:opacity-100 transition-all px-2 py-1 rounded border border-white/10 bg-zinc-900 text-[9px] font-bold text-zinc-500 hover:text-white hover:border-primary/50 cursor-pointer uppercase tracking-tighter z-10"
                        >
                            Copy
                        </button>
                    </div>
                );
            },
            img({ src, alt, ...props }: any) {
                if (src?.endsWith('.svg')) {
                    return (
                        <span className="not-prose my-6 flex justify-start">
                            <object
                                data={src}
                                type="image/svg+xml"
                                className="max-w-[600px] w-full h-auto block select-auto"
                                aria-label={alt}
                            />
                        </span>
                    );
                }
                return <img src={src} alt={alt} className="w-full my-8 rounded-xl border border-white/5" {...props} />;
            },
            strong: ({ node, ...props }: any) => <strong className="text-zinc-200 font-bold" {...props} />,
        };
    }, []);

    return (
        <div className="prose prose-invert prose-zinc max-w-none 
      prose-h1:text-4xl prose-h1:font-black prose-h1:uppercase prose-h1:tracking-tighter prose-h1:mb-8
      prose-h2:text-2xl prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-tight prose-h2:mt-16 prose-h2:mb-2 prose-h2:text-white
      prose-h3:text-lg prose-h3:font-bold prose-h3:uppercase prose-h3:tracking-wide prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-zinc-200
      prose-p:text-sm prose-p:text-zinc-400 prose-p:leading-relaxed prose-p:mb-2
      prose-ul:space-y-3 prose-ul:mb-8
      prose-li:text-sm prose-li:text-zinc-500
      prose-table:w-full prose-table:text-[11px] prose-table:border-collapse prose-table:mb-12
      prose-th:border prose-th:border-white/10 prose-th:p-3 prose-th:bg-white/5 prose-th:text-left prose-th:font-bold prose-th:uppercase prose-th:tracking-wider
      prose-td:border prose-td:border-white/10 prose-td:p-3 prose-td:text-zinc-500
      prose-code:bg-white/5 prose-code:text-text-cloud prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-code:text-[10px]
      prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10 prose-pre:p-6 prose-pre:rounded-xl prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:max-w-full prose-pre:shadow-2xl
      prose-strong:text-zinc-200 prose-strong:font-bold
      selection:bg-selection
    ">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
