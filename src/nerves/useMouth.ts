import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';

const STORAGE_KEY = 'calctopus-graph';

export const useMouth = () => {
    const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

    // Savor: Save to LocalStorage
    const savor = useCallback(() => {
        const flow = {
            nodes: getNodes(),
            edges: getEdges(),
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
    }, [getNodes, getEdges]);

    // Eat: Load from LocalStorage
    const eat = useCallback(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const flow = JSON.parse(saved);
                if (flow.nodes && flow.edges) {
                    setNodes(flow.nodes);
                    setEdges(flow.edges);
                    toast.success('Restored previous session');
                }
            } catch (e) {
                console.error('Failed to eat saved graph', e);
                toast.error('Failed to load save');
            }
        }
    }, [setNodes, setEdges]);

    // Spit: Export as JSON file
    const spit = useCallback(() => {
        const flow = {
            nodes: getNodes(),
            edges: getEdges(),
            version: '1.0'
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flow, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "calctopus_graph.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success('Exported graph to JSON');
    }, [getNodes, getEdges]);

    // Diet: Clear storage
    const diet = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        toast.info('Cleared local save');
    }, []);

    const mouth = {
        savor,
        eat,
        spit,
        diet
    };

    return {
        mouth
    };
};
