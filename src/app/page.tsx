'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { GraphEditor } from '@/components/GraphEditor';

export default function Home() {
  return (
    <ReactFlowProvider>
      <GraphEditor />
    </ReactFlowProvider>
  );
}
