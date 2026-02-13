
import React from 'react';
import { useComputationMode } from '../hooks/useComputationMode';

export const ModeSwitcher: React.FC = () => {
    const { mode, toggleMode } = useComputationMode();

    return (
        <div className="flex bg-gray-800 rounded-lg p-1 gap-1 border border-gray-700 select-none">
            <button
                onClick={() => mode !== 'scientific' && toggleMode()}
                className={`px-3 py-1 rounded text-xs font-mono transition-all duration-200 ${mode === 'scientific'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                    }`}
            >
                Scientific
            </button>
            <button
                onClick={() => mode !== 'engineering' && toggleMode()}
                className={`px-3 py-1 rounded text-xs font-mono transition-all duration-200 ${mode === 'engineering'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                    }`}
            >
                Engineering
            </button>
        </div>
    );
};
