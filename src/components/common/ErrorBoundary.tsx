'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { debugManager } from '../../debug/DebugManager';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidMount() {
        window.addEventListener('input-output-crash', this.handleManualCrash);
    }

    public componentWillUnmount() {
        window.removeEventListener('input-output-crash', this.handleManualCrash);
    }

    private handleManualCrash = (e?: Event) => {
        const error = new Error((e as CustomEvent)?.detail?.message || 'Manual crash triggered via Diagnostic Toolkit');
        this.setState({ hasError: true, error });
    };

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    private handleDownloadDebug = () => {
        const bundle = debugManager.generateDebugBundle();
        const blob = new Blob([bundle], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `input-output-crash-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0a0a0a',
                    color: '#fff',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h1 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>The last time this problem occurred was the last time.</h1>
                    <p style={{ color: '#888', maxWidth: '600px', marginBottom: '30px' }}>
                        A diagnostic state has been captured to ensure this remains the final occurrence.
                    </p>
                    
                    <div style={{
                        background: '#1a1a1a',
                        padding: '15px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#ff4444',
                        marginBottom: '30px',
                        maxWidth: '80%',
                        overflow: 'auto',
                        maxHeight: '200px',
                        textAlign: 'left',
                        fontFamily: 'monospace',
                        border: '1px solid #333'
                    }}>
                        {this.state.error?.toString()}
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button 
                            onClick={this.handleReset}
                            style={{
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Reload App
                        </button>
                        <button 
                            onClick={this.handleDownloadDebug}
                            style={{
                                background: '#0070f3',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Download Debug Bundle
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

