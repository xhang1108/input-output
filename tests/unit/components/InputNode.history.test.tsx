/**
 * @vitest-environment jsdom
 *
 * InputNode numeric field: focus/blur records a single history entry.
 * BaseNode is stubbed so the test only exercises the input + history wiring.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    push: vi.fn<(entry: any) => void>(),
    applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
}));

vi.mock('@xyflow/react', () => ({
    useReactFlow: () => ({ updateNodeData: vi.fn() }),
}));

vi.mock('@/components/nodes/BaseNode', () => ({
    BaseNode: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({ applyTransaction: mocks.applyTransaction }),
}));

vi.mock('@/store/useHistoryStore', () => {
    const api = { push: mocks.push, isRestoring: false };
    return {
        useHistoryStore: (selector: (state: typeof api) => unknown) => selector(api),
    };
});

import { InputNode } from '@/components/nodes/InputNode';

function renderNumericInput(value: number) {
    const props = {
        id: 'in-1',
        data: { type: 'number', value, label: 'A' },
        selected: false,
        isConnectable: true,
        type: 'IN-01',
    } as any;
    return render(<InputNode {...props} />);
}

describe('InputNode numeric history', () => {
    beforeEach(() => {
        mocks.push.mockClear();
        mocks.applyTransaction.mockClear();
    });

    it('records one entry from the focused previous value to the blurred value', () => {
        renderNumericInput(5);

        const input = screen.getByDisplayValue('5');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '7' } });
        fireEvent.blur(input);

        // Live typing already went to the Brain...
        expect(mocks.applyTransaction).toHaveBeenCalledWith({
            type: 'UPDATE_NODE_DATA',
            payload: { id: 'in-1', data: { value: 7 } },
        });
        // ...and blur records a single undoable step.
        expect(mocks.push).toHaveBeenCalledTimes(1);
        const entry = mocks.push.mock.calls[0][0];
        expect(entry.forward).toEqual([
            { type: 'UPDATE_NODE_DATA', payload: { id: 'in-1', data: { value: 7 } } },
        ]);
        expect(entry.inverse).toEqual([
            { type: 'UPDATE_NODE_DATA', payload: { id: 'in-1', data: { value: 5 } } },
        ]);
    });

    it('records nothing when the value is unchanged on blur', () => {
        renderNumericInput(5);

        const input = screen.getByDisplayValue('5');
        fireEvent.focus(input);
        fireEvent.blur(input);

        expect(mocks.push).not.toHaveBeenCalled();
    });
});
