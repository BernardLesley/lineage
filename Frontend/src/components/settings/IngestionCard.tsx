import { FC, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";

import UploadZipDialog from "../global/UploadZipDialog";
import LogsInputDialog from "../global/LogsInputDialog";
import { uploadZip, uploadLogs } from "../../lib/api";
import { useLineage } from "../../context/LineageContext";
import { useMetadata } from "../../context/MetadataContext";

const IngestionCard: FC = () => {
  const [zipOpen, setZipOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { refresh: refreshLineage } = useLineage();
  const { refresh: refreshMetadata } = useMetadata();

  const refreshAll = async () => {
    await Promise.all([refreshLineage(), refreshMetadata()]);
  };

  const handleZipSelected = async (file: File) => {
    setBusy(true);
    try {
      await uploadZip(file);
      await refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const handleLogsSubmit = async (logs: string) => {
    setBusy(true);
    try {
      await uploadLogs(logs);
      await refreshAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ingestion</CardTitle>
          <CardDescription className="text-xs">
            Upload lineage SQL and MLOps logs used for monitoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            className="w-full justify-center bg-black text-white hover:bg-slate-900 text-xs"
            onClick={() => setZipOpen(true)}
            disabled={busy}
          >
            Upload SQL ZIP
          </Button>
          <Button
            type="button"
            size="sm"
            className="w-full justify-center bg-black text-white hover:bg-slate-900 text-xs"
            onClick={() => setLogsOpen(true)}
            disabled={busy}
          >
            Upload MLOps Logs
          </Button>
        </CardContent>
      </Card>

      <UploadZipDialog
        open={zipOpen}
        onOpenChange={setZipOpen}
        onFileSelected={handleZipSelected}
      />

      <LogsInputDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        onSubmit={handleLogsSubmit}
      />
    </>
  );
};

export default IngestionCard;
