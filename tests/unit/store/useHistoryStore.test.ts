import { beforeEach, describe, expect, it } from 'vitest';
import { useHistoryStore, type HistoryEntry } from '@/store/useHistoryStore';

const entry = (id: string): HistoryEntry => ({
    id,
    description: id,
    forward: [],
    inverse: [],
});

const reset = () => {
    useHistoryStore.setState({
        past: [],
        future: [],
        isRestoring: false,
        interactionMode: 'IDLE',
    });
};

describe('useHistoryStore', () => {
    beforeEach(reset);

    it('push appends to past and clears future', () => {
        useHistoryStore.setState({ future: [entry('redo')] });

        useHistoryStore.getState().push(entry('a'));
        useHistoryStore.getState().push(entry('b'));

        const state = useHistoryStore.getState();
        expect(state.past.map(e => e.id)).toEqual(['a', 'b']);
        expect(state.future).toEqual([]);
    });

    it('push trims to the newest 100 entries', () => {
        for (let i = 0; i < 101; i++) {
            useHistoryStore.getState().push(entry(`e${i}`));
        }

        const past = useHistoryStore.getState().past;
        expect(past).toHaveLength(100);
        expect(past[0].id).toBe('e1');
        expect(past[past.length - 1].id).toBe('e100');
    });

    it('replaceLast replaces the last entry only when the id matches and clears future', () => {
        useHistoryStore.setState({
            past: [entry('a'), entry('b')],
            future: [entry('redo')],
        });

        const replaced = useHistoryStore.getState().replaceLast('b', entry('b2'));

        expect(replaced).toBe(true);
        const state = useHistoryStore.getState();
        expect(state.past.map(e => e.id)).toEqual(['a', 'b2']);
        expect(state.future).toEqual([]);
    });

    it('replaceLast refuses a stale id and leaves both stacks untouched', () => {
        const future = [entry('redo')];
        useHistoryStore.setState({
            past: [entry('a'), entry('b')],
            future,
        });

        const replaced = useHistoryStore.getState().replaceLast('a', entry('a2'));

        expect(replaced).toBe(false);
        const state = useHistoryStore.getState();
        expect(state.past.map(e => e.id)).toEqual(['a', 'b']);
        expect(state.future).toEqual(future);
    });

    it('replaceLast refuses an empty past', () => {
        expect(useHistoryStore.getState().replaceLast('x', entry('x'))).toBe(false);
        expect(useHistoryStore.getState().past).toEqual([]);
    });

    it('clear resets all four fields', () => {
        useHistoryStore.setState({
            past: [entry('a')],
            future: [entry('b')],
            isRestoring: true,
            interactionMode: 'CUTTING',
        });

        useHistoryStore.getState().clear();

        const state = useHistoryStore.getState();
        expect(state.past).toEqual([]);
        expect(state.future).toEqual([]);
        expect(state.isRestoring).toBe(false);
        expect(state.interactionMode).toBe('IDLE');
    });

    it('pushPastSilent trims to 100 entries and keeps future intact', () => {
        useHistoryStore.setState({ future: [entry('redo')] });

        for (let i = 0; i < 101; i++) {
            useHistoryStore.getState().pushPastSilent(entry(`p${i}`));
        }

        const state = useHistoryStore.getState();
        expect(state.past).toHaveLength(100);
        expect(state.past[0].id).toBe('p1');
        expect(state.past[state.past.length - 1].id).toBe('p100');
        expect(state.future.map(e => e.id)).toEqual(['redo']);
    });

    it('pushFutureSilent trims to 100 entries and keeps past intact', () => {
        useHistoryStore.setState({ past: [entry('a')] });

        for (let i = 0; i < 101; i++) {
            useHistoryStore.getState().pushFutureSilent(entry(`f${i}`));
        }

        const state = useHistoryStore.getState();
        expect(state.future).toHaveLength(100);
        expect(state.future[0].id).toBe('f1');
        expect(state.future[state.future.length - 1].id).toBe('f100');
        expect(state.past.map(e => e.id)).toEqual(['a']);
    });

    it('popPast and popFuture take from the top of their own stack', () => {
        useHistoryStore.setState({
            past: [entry('a'), entry('b')],
            future: [entry('c'), entry('d')],
        });

        expect(useHistoryStore.getState().popPast()?.id).toBe('b');
        expect(useHistoryStore.getState().popFuture()?.id).toBe('d');
        expect(useHistoryStore.getState().past.map(e => e.id)).toEqual(['a']);
        expect(useHistoryStore.getState().future.map(e => e.id)).toEqual(['c']);
        expect(useHistoryStore.getState().popPast()?.id).toBe('a');
        expect(useHistoryStore.getState().popPast()).toBeUndefined();
        expect(useHistoryStore.getState().popFuture()?.id).toBe('c');
        expect(useHistoryStore.getState().popFuture()).toBeUndefined();
    });
});
