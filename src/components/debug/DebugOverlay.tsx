'use client';

import React, { useState, useEffect } from 'react';
import { debugManager } from '../../debug/DebugManager';

export function DebugOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const [logs, setLogs] = useState(debugManager.getLogs());

    useEffect(() => {
        const handleLog = () => {
            // Use setTimeout to move the update out of the current synchronous flow (fixes React lifecycle errors)
            setTimeout(() => {
                setLogs([...debugManager.getLogs()]);
            }, 0);
        };

        window.addEventListener('input-output-debug-log', handleLog);
        return () => window.removeEventListener('input-output-debug-log', handleLog);
    }, []);

    if (!visible) return null;

    const handleDownload = () => {
        const bundle = debugManager.generateDebugBundle();
        const blob = new Blob([bundle], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `input-output-debug-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50px',
            right: '20px',
            width: '400px',
            height: '600px',
            background: 'rgba(10, 10, 10, 0.95)',
            border: '1px solid #333',
            borderRadius: '12px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            color: '#eee',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <div style={{
                padding: '15px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Diagnostic Toolkit</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleDownload} style={{
                        background: '#0070f3',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer'
                    }}>Export Bundle</button>
                    <button onClick={onClose} style={{
                        background: 'transparent',
                        color: '#888',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px'
                    }}>×</button>
                </div>
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                fontSize: '11px',
                fontFamily: 'monospace'
            }}>
                {logs.length === 0 && <div style={{ color: '#555', textAlign: 'center', marginTop: '20px' }}>No logs collected.</div>}
                {[...logs].reverse().map((log, i) => (
                    <div key={i} style={{
                        marginBottom: '8px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #222',
                        color: log.level === 'error' ? '#ff4444' : log.level === 'warn' ? '#ffaa00' : '#aaa'
                    }}>
                        <span style={{ color: '#555', marginRight: '5px' }}>
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <span style={{ fontWeight: 'bold', textTransform: 'uppercase', marginRight: '5px' }}>
                            {log.level}:
                        </span>
                        {log.message}
                    </div>
                ))}
            </div>

            <div style={{
                padding: '10px',
                background: '#151515',
                borderTop: '1px solid #333',
                fontSize: '10px',
                color: '#666'
            }}>
                Shortcuts: <code style={{ color: '#eee' }}>Ctrl + Alt + D</code> to toggle.
            </div>
        </div>
    );
}
