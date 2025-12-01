import { FC, useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { ScrollArea } from "../ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { useThreshold } from "../../context/ThresholdContext";

type ColumnDetailsPanelProps = {
  fullKey: string;
  countData: Record<string, number>;
  onClose: () => void;
};

const ColumnDetailsPanel: FC<ColumnDetailsPanelProps> = ({
  fullKey,
  countData,
  onClose,
}) => {
  const { thresholdPct } = useThreshold();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const { columnChartData, alertDates } = useMemo(() => {
    const entries = Object.entries(countData)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const alerts = new Set<string>();

    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].value;
      const curr = entries[i].value;
      if (prev === 0) continue;
      const changePct = ((curr - prev) / prev) * 100;
      if (Math.abs(changePct) >= thresholdPct) {
        alerts.add(entries[i].label);
      }
    }

    return { columnChartData: entries, alertDates: alerts };
  }, [countData, thresholdPct]);

  const { tableName, columnName } = useMemo(() => {
    const lastDot = fullKey.lastIndexOf(".");
    if (lastDot === -1) {
      return { tableName: fullKey, columnName: "" };
    }
    return {
      tableName: fullKey.slice(0, lastDot),
      columnName: fullKey.slice(lastDot + 1),
    };
  }, [fullKey]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-[380px] bg-white border-l shadow-lg z-40 flex flex-col
        transform transition-transform duration-300 ease-out
        ${isVisible ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="px-4 py-3 border-b space-y-2">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Table Name
          </div>
          <div className="text-sm font-medium break-all">{tableName}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Column Name
          </div>
          <div className="text-sm font-medium break-all">{columnName}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-48 px-4 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={columnChartData}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, padding: 8 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0f766e"
                strokeWidth={1.8}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <ScrollArea className="flex-1 mt-3 border-t">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-slate-50">
                <TableHead className="w-1/2 text-md font-bold px-3 py-2 text-slate-600 text-center">
                  Date
                </TableHead>
                <TableHead className="w-1/2 text-md font-bold px-3 py-2 text-slate-600 text-center">
                  Count
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columnChartData.map(({ label, value }) => (
                <TableRow
                  key={label}
                  className="even:bg-slate-50/60 hover:bg-slate-100/70"
                >
                  <TableCell className="text-xs px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 justify-center">
                      {label}
                      {alertDates.has(label) && (
                        <span
                          className="text-sm text-red-500 font-bold"
                          title="Change exceeds threshold"
                        >
                          !
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs px-3 py-2 tabular-nums text-center">
                    {value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="px-4 py-3 border-t flex justify-end">
          <Button
            variant="outline"
            className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 
             hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 
             transition-colors"
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ColumnDetailsPanel;
