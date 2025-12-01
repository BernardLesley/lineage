import { Edge, Node } from "reactflow";
import { BuildResult, RawLineage, TableNodeData } from "../types";

/**
 * Build React Flow nodes and edges from the raw lineage JSON.
 * Also prepares adjacency maps for upstream/downstream traversal.
 */
export const buildGraph = (data: RawLineage): BuildResult => {
  const nodes: Node<TableNodeData>[] = [];
  const edges: Edge[] = [];
  const reverseAdj: Record<string, string[]> = {};
  const forwardAdj: Record<string, string[]> = {};
  const edgeColKeys: Record<string, { sourceKey: string; targetKey: string }> =
    {};

  const tables = Object.keys(data);

  tables.forEach((tableName, i) => {
    const table = data[tableName];

    const cols = Object.keys(table.columns).map((col) => ({
      name: col,
      fullKey: `${tableName}.${col}`,
    }));

    nodes.push({
      id: tableName,
      position: { x: i * 380, y: 40 },
      type: "tableNode",
      data: { tableName, columns: cols },
    });
  });

  const allCols = new Set(
    nodes.flatMap((n) => n.data.columns.map((c) => c.fullKey))
  );

  tables.forEach((tableName) => {
    const table = data[tableName];

    Object.entries(table.columns).forEach(([colName, colMeta]) => {
      const targetKey = `${tableName}.${colName}`;

      colMeta.lineage.forEach((src) => {
        if (!src) return;

        const idx = src.lastIndexOf(".");
        if (idx < 0) return;

        const srcTable = src.slice(0, idx);
        const srcCol = src.slice(idx + 1);
        const sourceKey = `${srcTable}.${srcCol}`;

        if (!allCols.has(sourceKey)) return;

        const id = `${sourceKey}->${targetKey}`;

        edges.push({
          id,
          source: srcTable,
          target: tableName,
          sourceHandle: `col-${srcCol}`,
          targetHandle: `col-${colName}`,
          animated: true,
        });

        if (!reverseAdj[targetKey]) reverseAdj[targetKey] = [];
        reverseAdj[targetKey].push(sourceKey);

        if (!forwardAdj[sourceKey]) forwardAdj[sourceKey] = [];
        forwardAdj[sourceKey].push(targetKey);

        edgeColKeys[id] = { sourceKey, targetKey };
      });
    });
  });

  return { nodes, edges, reverseAdj, forwardAdj, edgeColKeys };
};

/**
 * Breadth-first search that walks upstream (toward sources) in the lineage graph.
 */
export const bfsUp = (
  start: string,
  rev: Record<string, string[]>
): string[] => {
  const vis = new Set<string>();
  const q = [start];

  while (q.length) {
    const cur = q.shift()!;
    for (const p of rev[cur] || []) {
      if (!vis.has(p)) {
        vis.add(p);
        q.push(p);
      }
    }
  }

  return Array.from(vis);
};

/**
 * Breadth-first search that walks downstream (toward dependents) in the lineage graph.
 */
export const bfsDown = (
  start: string,
  fwd: Record<string, string[]>
): string[] => {
  const vis = new Set<string>();
  const q = [start];

  while (q.length) {
    const cur = q.shift()!;
    for (const c of fwd[cur] || []) {
      if (!vis.has(c)) {
        vis.add(c);
        q.push(c);
      }
    }
  }

  return Array.from(vis);
};
