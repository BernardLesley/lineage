import { FC, useMemo, useState, useEffect, useCallback } from "react";

import { buildGraph, bfsUp, bfsDown } from "../lib/lineageGraph";
import { useLineage } from "../context/LineageContext";
import { useThreshold } from "../context/ThresholdContext";
import { useMetadata } from "../context/MetadataContext";

import LineageGraph from "../components/home/LineageGraph";
import SqlDialog from "../components/home/SqlDialog";
import ColumnDetailsPanel from "../components/home/ColumnDetailsPanel";
import UploadZipDialog from "../components/global/UploadZipDialog";
import LogsInputDialog from "../components/global/LogsInputDialog";
import HomeToolbar from "../components/home/HomeToolbar";
import { Button } from "../components/ui/button";
import { uploadZip, uploadLogs } from "../lib/api";

const Home: FC = () => {
  const { rawData, loading, refresh } = useLineage();
  const { thresholdPct } = useThreshold();
  const { dashboards } = useMetadata();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>("");

  const tableKeys = useMemo(
    () => (rawData ? Object.keys(rawData).sort() : []),
    [rawData]
  );

  const baseGraph = useMemo(() => {
    if (!rawData) return null;
    if (Object.keys(rawData).length === 0) return null;
    return buildGraph(rawData, dashboards as any);
  }, [rawData, dashboards]);

  const graph = useMemo(() => {
    if (!baseGraph) return null;
    if (!selectedTable || !rawData || !rawData[selectedTable]) {
      return baseGraph;
    }

    const cols = Object.keys(rawData[selectedTable].columns).map(
      (c) => `${selectedTable}.${c}`
    );

    const visitedCols = new Set<string>();
    const stack = [...cols];

    while (stack.length) {
      const key = stack.pop() as string;
      if (visitedCols.has(key)) continue;
      visitedCols.add(key);
      const parents = baseGraph.reverseAdj[key] || [];
      for (const p of parents) {
        if (!visitedCols.has(p)) stack.push(p);
      }
    }

    const activeTables = new Set<string>();
    visitedCols.forEach((k) => {
      const idx = k.lastIndexOf(".");
      if (idx !== -1) activeTables.add(k.slice(0, idx));
    });

    const dashboardNodes = new Set<string>();
    baseGraph.edges.forEach((e) => {
      const kind = baseGraph.edgeKinds[e.id];
      if (kind !== "dashboard") return;

      const sourceIsDash = String(e.source).startsWith("dashboard:");
      const targetIsDash = String(e.target).startsWith("dashboard:");

      if (sourceIsDash && activeTables.has(String(e.target)))
        dashboardNodes.add(String(e.source));
      if (targetIsDash && activeTables.has(String(e.source)))
        dashboardNodes.add(String(e.target));
    });

    const nodes = baseGraph.nodes.filter((n) => {
      if (n.type === "dashboardNode") return dashboardNodes.has(n.id);
      return activeTables.has((n.data as any).tableName);
    });

    const edges = baseGraph.edges.filter((e) => {
      const kind = baseGraph.edgeKinds[e.id];

      if (kind === "dashboard") {
        const sOk =
          dashboardNodes.has(String(e.source)) ||
          activeTables.has(String(e.source));
        const tOk =
          dashboardNodes.has(String(e.target)) ||
          activeTables.has(String(e.target));
        return sOk && tOk;
      }

      const meta = baseGraph.edgeColKeys[e.id];
      if (!meta) return false;
      return visitedCols.has(meta.sourceKey) && visitedCols.has(meta.targetKey);
    });

    const edgeColKeys: typeof baseGraph.edgeColKeys = {};
    const edgeKinds: typeof baseGraph.edgeKinds = {};

    edges.forEach((e) => {
      edgeKinds[e.id] = baseGraph.edgeKinds[e.id];
      if (baseGraph.edgeColKeys[e.id])
        edgeColKeys[e.id] = baseGraph.edgeColKeys[e.id];
    });

    return {
      ...baseGraph,
      nodes,
      edges,
      edgeColKeys,
      edgeKinds,
    };
  }, [baseGraph, selectedTable, rawData]);

  const isEmptyData = useMemo(
    () =>
      rawData !== null &&
      rawData !== undefined &&
      Object.keys(rawData).length === 0,
    [rawData]
  );

  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [connectedCols, setConnectedCols] = useState<string[]>([]);

  const [sqlDialog, setSqlDialog] = useState<{
    open: boolean;
    table: string;
    sql: string;
  }>({
    open: false,
    table: "",
    sql: "",
  });

  const [colPopover, setColPopover] = useState<{
    fullKey: string;
    countData: Record<string, number>;
  } | null>(null);

  const handleColumnHover = useCallback(
    (fullKey: string) => {
      if (!graph) return;
      setHoverCol(fullKey);
      const up = bfsUp(fullKey, graph.reverseAdj);
      const down = bfsDown(fullKey, graph.forwardAdj);
      setConnectedCols(Array.from(new Set([fullKey, ...up, ...down])));
    },
    [graph]
  );

  const handleColumnLeave = useCallback(() => {
    setHoverCol(null);
    setConnectedCols([]);
  }, []);

  const handleSqlClick = useCallback(
    (table: string) => {
      if (!rawData) return;
      setSqlDialog({ open: true, table, sql: rawData[table].sql });
    },
    [rawData]
  );

  const handleColumnClick = useCallback(
    (fullKey: string) => {
      if (!rawData) return;
      const idx = fullKey.lastIndexOf(".");
      const table = fullKey.slice(0, idx);
      const col = fullKey.slice(idx + 1);
      setColPopover({
        fullKey,
        countData: rawData[table].columns[col].count_data,
      });
    },
    [rawData]
  );

  useEffect(() => {
    const rows = document.querySelectorAll(".column-row");
    rows.forEach((row) => {
      const key = (row as HTMLElement).dataset.fullkey!;
      row.classList.remove("highlight", "dimmed");
      if (!hoverCol) return;
      if (connectedCols.includes(key)) row.classList.add("highlight");
      else row.classList.add("dimmed");
    });
  }, [hoverCol, connectedCols]);

  const alertColumns = useMemo(() => {
    const result = new Set<string>();
    if (!rawData || thresholdPct <= 0) return result;

    Object.entries(rawData).forEach(([tableName, tableMeta]) => {
      Object.entries(tableMeta.columns).forEach(([colName, colMeta]) => {
        const entries = Object.entries(colMeta.count_data).sort((a, b) =>
          a[0].localeCompare(b[0])
        );
        if (entries.length < 2) return;

        let prev = entries[0][1];
        for (let i = 1; i < entries.length; i++) {
          const curr = entries[i][1];
          if (prev === 0) {
            if (curr !== 0 && thresholdPct > 0) {
              result.add(`${tableName}.${colName}`);
              break;
            }
          } else {
            const diffPct = (Math.abs(curr - prev) / prev) * 100;
            if (diffPct >= thresholdPct) {
              result.add(`${tableName}.${colName}`);
              break;
            }
          }
          prev = curr;
        }
      });
    });

    return result;
  }, [rawData, thresholdPct]);

  const enrichedNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((n) => {
      if (n.type !== "tableNode") return n;

      return {
        ...n,
        data: {
          ...(n.data as any),
          columns: (n.data as any).columns.map((col: any) => ({
            ...col,
            hasAlert: alertColumns.has(col.fullKey),
          })),
          onColumnHover: handleColumnHover,
          onColumnLeave: handleColumnLeave,
          onSqlClick: handleSqlClick,
          onColumnClick: handleColumnClick,
        },
      };
    });
  }, [
    graph,
    alertColumns,
    handleColumnHover,
    handleColumnLeave,
    handleSqlClick,
    handleColumnClick,
  ]);

  const enrichedEdges = useMemo(() => {
    if (!graph) return [];
    if (!hoverCol) return graph.edges;

    return graph.edges.map((e) => {
      const kind = graph.edgeKinds[e.id];
      if (kind !== "col") return e;

      const meta = graph.edgeColKeys[e.id];
      const active =
        !!meta &&
        connectedCols.includes(meta.sourceKey) &&
        connectedCols.includes(meta.targetKey);

      return {
        ...e,
        style: {
          strokeWidth: active ? 2.2 : 1,
          opacity: active ? 1 : 0.15,
        },
      };
    });
  }, [graph, hoverCol, connectedCols]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-sm text-slate-700">
        Loading lineage graph...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative">
      <HomeToolbar
        tableKeys={tableKeys}
        selectedTable={selectedTable}
        onSelectedTableChange={setSelectedTable}
        onOpenLogs={() => setLogsOpen(true)}
      />

      {graph ? (
        <LineageGraph
          nodes={enrichedNodes}
          edges={enrichedEdges}
          isLoading={false}
        />
      ) : isEmptyData ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-xl font-semibold text-slate-800">
            The Lineage Data is Empty
          </div>
          <div className="text-base text-slate-500 max-w-xs">
            Please drop the ZIP file containing the SQL files to generate the
            lineage graph.
          </div>
          <Button
            className="mt-2 bg-black text-white hover:bg-slate-900 text-xs"
            onClick={() => setUploadOpen(true)}
          >
            Upload ZIP
          </Button>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-sm">
          Loading lineage graph...
        </div>
      )}

      {graph && (
        <SqlDialog
          open={sqlDialog.open}
          table={sqlDialog.table}
          sql={sqlDialog.sql}
          onOpenChange={(open: boolean) =>
            setSqlDialog((prev) => ({ ...prev, open }))
          }
        />
      )}

      {graph && colPopover && (
        <ColumnDetailsPanel
          fullKey={colPopover.fullKey}
          countData={colPopover.countData}
          onClose={() => setColPopover(null)}
        />
      )}

      <UploadZipDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFileSelected={async (file) => {
          await uploadZip(file);
          await refresh();
        }}
      />

      <LogsInputDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        onSubmit={async (logs: string) => {
          await uploadLogs(logs);
          await refresh();
        }}
      />
    </div>
  );
};

export default Home;
