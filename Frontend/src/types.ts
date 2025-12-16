export type ColumnMeta = {
  lineage: string[];
  count_data: Record<string, number>;
};

export type TableMeta = {
  tables: string[];
  sql: string;
  columns: Record<string, ColumnMeta>;
};

export type RawLineage = Record<string, TableMeta>;

export type ColumnInfo = {
  name: string;
  fullKey: string;
  hasAlert?: boolean;
};

export type TableNodeData = {
  tableName: string;
  columns: ColumnInfo[];
  onColumnHover?: (fullKey: string) => void;
  onColumnLeave?: () => void;
  onSqlClick?: (tableName: string) => void;
  onColumnClick?: (fullKey: string) => void;
};

export type DashboardNodeData = {
  dashboardName: string;
};

export type FlowNodeData = TableNodeData | DashboardNodeData;

export type EdgeKind = "col" | "dashboard";

export type BuildResult = {
  nodes: import("@reactflow/core").Node<FlowNodeData>[];
  edges: import("@reactflow/core").Edge[];
  reverseAdj: Record<string, string[]>;
  forwardAdj: Record<string, string[]>;
  edgeColKeys: Record<string, { sourceKey: string; targetKey: string }>;
  edgeKinds: Record<string, EdgeKind>;
};
