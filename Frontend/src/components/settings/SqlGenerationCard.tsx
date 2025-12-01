import { FC, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import SqlPreviewDialog from "./SqlPreviewDialog";
import { getMonitorTaskSql, getMlopsSql } from "../../lib/api";

type Mode = "monitor" | "mlops" | null;

const SqlGenerationCard: FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [sqlText, setSqlText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleGenerateMonitorSql = async () => {
    setMode("monitor");
    setDialogOpen(true);
    setLoading(true);
    setSqlText("-- Loading monitor task SQL...");
    try {
      const sql = await getMonitorTaskSql();
      setSqlText(sql);
    } catch (e) {
      setSqlText(`-- Failed to load monitor task SQL: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMlopsSql = async () => {
    setMode("mlops");
    setDialogOpen(true);
    setLoading(true);
    setSqlText("-- Loading MLOps SQL...");
    try {
      const sql = await getMlopsSql();
      setSqlText(sql);
    } catch (e) {
      setSqlText(`-- Failed to load MLOps SQL: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const dialogTitle = useMemo(() => {
    if (mode === "monitor") return "Generated Monitor Task SQL";
    if (mode === "mlops") return "Generated MLOps SQL";
    return "Generated SQL";
  }, [mode]);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setMode(null);
      setSqlText("");
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">SQL generation</CardTitle>
          <CardDescription className="text-xs">
            Generate boilerplate SQL for monitoring tasks and MLOps checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            className="w-full justify-center bg-black text-white hover:bg-slate-900 text-xs"
            onClick={handleGenerateMonitorSql}
            disabled={loading}
          >
            Generate Monitor Task SQL
          </Button>
          <Button
            type="button"
            size="sm"
            className="w-full justify-center bg-black text-white hover:bg-slate-900 text-xs"
            onClick={handleGenerateMlopsSql}
            disabled={loading}
          >
            Generate MLOps SQL
          </Button>
        </CardContent>
      </Card>

      <SqlPreviewDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        title={dialogTitle}
        sql={sqlText}
      />
    </>
  );
};

export default SqlGenerationCard;
