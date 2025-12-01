import { FC, useMemo, useState, useEffect, useCallback } from "react";

import { buildGraph, bfsUp, bfsDown } from "../lib/lineageGraph";
import { useLineage } from "../context/LineageContext";
import { useThreshold } from "../context/ThresholdContext";

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
    return buildGraph(rawData);
  }, [rawData]);

  const graph = useMemo(() => {
    if (!baseGraph) return null;
    if (!selectedTable || !rawData || !rawData[selectedTable]) {
      return baseGraph;
    }

    const cols = Object.keys(rawData[selectedTable].columns).map(
      (c) => `${selectedTable}.${c}`
    );

    const visited = new Set<string>();
    const stack = [...cols];

    while (stack.length) {
      const key = stack.pop() as string;
      if (visited.has(key)) continue;
      visited.add(key);
      const parents = baseGraph.reverseAdj[key] || [];
      for (const p of parents) {
        if (!visited.has(p)) stack.push(p);
      }
    }

    const activeTables = new Set<string>();
    visited.forEach((k) => {
      const idx = k.lastIndexOf(".");
      if (idx !== -1) {
        activeTables.add(k.slice(0, idx));
      }
    });

    const nodes = baseGraph.nodes.filter((n) =>
      activeTables.has(n.data.tableName)
    );

    const edges = baseGraph.edges.filter((e) => {
      const meta = baseGraph.edgeColKeys[e.id];
      if (!meta) return false;
      return visited.has(meta.sourceKey) && visited.has(meta.targetKey);
    });

    const edgeColKeys: typeof baseGraph.edgeColKeys = {};
    edges.forEach((e) => {
      edgeColKeys[e.id] = baseGraph.edgeColKeys[e.id];
    });

    return {
      ...baseGraph,
      nodes,
      edges,
      edgeColKeys,
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
  }>({ open: false, table: "", sql: "" });

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
      setSqlDialog({
        open: true,
        table,
        sql: rawData[table].sql,
      });
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
    return graph.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        columns: n.data.columns.map((col: { fullKey: string }) => ({
          ...col,
          hasAlert: alertColumns.has(col.fullKey),
        })),
        onColumnHover: handleColumnHover,
        onColumnLeave: handleColumnLeave,
        onSqlClick: handleSqlClick,
        onColumnClick: handleColumnClick,
      },
    }));
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
      const meta = graph.edgeColKeys[e.id];
      const active =
        connectedCols.includes(meta?.sourceKey) &&
        connectedCols.includes(meta?.targetKey);
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
