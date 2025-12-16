import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import { MarkerType } from "reactflow";
import type {
  BuildResult,
  EdgeKind,
  FlowNodeData,
  RawLineage,
  TableNodeData,
} from "../types";

type Direction = "TB" | "LR";

type DashMeta = {
  name: string;
  tables?: string[];
  table_names?: string[];
  tableNames?: string[];
};

const isTableNode = (n: Node<FlowNodeData>): n is Node<TableNodeData> =>
  n.type === "tableNode";

const getDashboardTables = (d: DashMeta): string[] => {
  const t = d.tables ?? d.table_names ?? d.tableNames;
  return Array.isArray(t) ? t : [];
};

const layoutGraph = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  direction: Direction = "TB"
) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 70,
    ranksep: 140,
    marginx: 30,
    marginy: 30,
  });

  const tableWidth = 220;
  const dashWidth = 200;

  const tableBaseHeight = 56;
  const rowHeight = 22;

  const dashHeight = 56;

  nodes.forEach((n) => {
    if (n.type === "dashboardNode") {
      g.setNode(n.id, { width: dashWidth, height: dashHeight });
      return;
    }

    const colsLen = isTableNode(n) ? n.data.columns?.length || 0 : 0;
    const h = tableBaseHeight + colsLen * rowHeight;
    g.setNode(n.id, { width: tableWidth, height: h });
  });

  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((n) => {
    const pos = g.node(n.id) as { x: number; y: number };

    if (n.type === "dashboardNode") {
      return {
        ...n,
        position: { x: pos.x - dashWidth / 2, y: pos.y - dashHeight / 2 },
      };
    }

    const colsLen = isTableNode(n) ? n.data.columns?.length || 0 : 0;
    const h = tableBaseHeight + colsLen * rowHeight;
    return {
      ...n,
      position: { x: pos.x - tableWidth / 2, y: pos.y - h / 2 },
    };
  });

  const layoutedEdges = edges.map((e) => ({
    ...e,
    type: "smoothstep",
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

export const buildGraph = (
  data: RawLineage,
  dashboards: DashMeta[] = []
): BuildResult => {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  const reverseAdj: Record<string, string[]> = {};
  const forwardAdj: Record<string, string[]> = {};
  const edgeColKeys: Record<string, { sourceKey: string; targetKey: string }> =
    {};
  const edgeKinds: Record<string, EdgeKind> = {};

  const tables = Object.keys(data);

  tables.forEach((tableName) => {
    const table = data[tableName];

    const cols = Object.keys(table.columns).map((col) => ({
      name: col,
      fullKey: `${tableName}.${col}`,
    }));

    nodes.push({
      id: tableName,
      position: { x: 0, y: 0 },
      type: "tableNode",
      data: { tableName, columns: cols },
    });
  });

  const allCols = new Set(
    nodes
      .filter((n) => n.type === "tableNode")
      .flatMap((n) => (n.data as TableNodeData).columns.map((c) => c.fullKey))
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
        });

        edgeKinds[id] = "col";

        if (!reverseAdj[targetKey]) reverseAdj[targetKey] = [];
        reverseAdj[targetKey].push(sourceKey);

        if (!forwardAdj[sourceKey]) forwardAdj[sourceKey] = [];
        forwardAdj[sourceKey].push(targetKey);

        edgeColKeys[id] = { sourceKey, targetKey };
      });
    });
  });

  const knownTables = new Set(tables);

  dashboards.forEach((d) => {
    const dashId = `dashboard:${d.name}`;
    const mappedTables = getDashboardTables(d).filter((t) =>
      knownTables.has(t)
    );

    if (mappedTables.length === 0) return;

    nodes.push({
      id: dashId,
      position: { x: 0, y: 0 },
      type: "dashboardNode",
      data: { dashboardName: d.name },
    });

    mappedTables.forEach((t) => {
      const id = `${dashId}->${t}`;
      edges.push({
        id,
        source: dashId,
        target: t,
      });
      edgeKinds[id] = "dashboard";
    });
  });

  const laidOut = layoutGraph(nodes, edges, "TB");

  return {
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    reverseAdj,
    forwardAdj,
    edgeColKeys,
    edgeKinds,
  };
};

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
