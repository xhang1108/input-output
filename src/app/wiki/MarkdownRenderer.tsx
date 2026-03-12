"use client";

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';

interface MarkdownRendererProps {
    content: string;
}

import { NodeDemo } from './NodeDemo';
import { CircuitDemo } from './CircuitDemo';
import { SpawnerButton } from './SpawnerButton';
import { DynamicSectionHeader } from './DynamicSectionHeader';

interface MarkdownRendererProps {
    content: string;
}

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

            if (level === 2) {
                return (
                    <DynamicSectionHeader 
                        id={id} 
                        title={text} 
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
            code({ node, inline, className, children, ...props }: any) {
                const match = /language-([\w-]+)/.exec(className || '');
                const language = match ? match[1] : '';

                if (!inline && language === 'playground') {
                    try {
                        const payload = JSON.parse(String(children).replace(/\n$/, ''));
                        return (
                            <div className="not-prose w-full mb-4" style={{ minHeight: payload.height || 80 }}>
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

                if (!inline && language === 'iogl-example') {
                    try {
                        const payload = JSON.parse(String(children).replace(/\n$/, ''));
                        return (
                            <div className="not-prose inline-block mt-4 mb-8">
                                <SpawnerButton
                                    label={payload.label}
                                    iogl={payload.iogl}
                                />
                            </div>
                        );
                    } catch (e) {
                        return (
                            <div className="p-4 border border-orange-900/30 rounded-xl bg-orange-900/10 text-orange-400 text-xs font-mono">
                                [Example Error]: Invalid IOGL example configuration
                            </div>
                        );
                    }
                }

                if (!inline && language === 'iogl-circuit') {
                    try {
                        const payload = JSON.parse(String(children).replace(/\n$/, ''));
                        return (
                            <div className="not-prose w-full my-8" style={{ minHeight: payload.height || 120 }}>
                                <CircuitDemo
                                    iogl={payload.iogl}
                                    label={payload.label}
                                    height={payload.height}
                                />
                            </div>
                        );
                    } catch (e) {
                        return (
                            <div className="p-4 border border-blue-900/30 rounded-xl bg-blue-900/10 text-blue-400 text-xs font-mono">
                                [Circuit Error]: Invalid IOGL circuit configuration
                            </div>
                        );
                    }
                }

                return (
                    <code className={className} {...props}>
                        {children}
                    </code>
                );
            }
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
      prose-code:bg-white/5 prose-code:text-blue-400 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-code:text-[10px] prose-code:break-words
      prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-white/5 prose-pre:p-4 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:max-w-full
      prose-strong:text-zinc-200 prose-strong:font-bold
      selection:bg-blue-500/30
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
