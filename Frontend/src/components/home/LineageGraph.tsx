import { FC } from "react";
import ReactFlow, { Controls, MiniMap, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";

import TableNode from "./TableNode";

const nodeTypes = { tableNode: TableNode };

type LineageGraphProps = {
  nodes: Node[];
  edges: Edge[];
  isLoading: boolean;
};

const LineageGraph: FC<LineageGraphProps> = ({ nodes, edges, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-5 text-sm flex items-center h-full">
        Loading lineage graph...
      </div>
    );
  }

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
};

export default LineageGraph;
