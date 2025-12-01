import { FC } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "../components/ui/button";
import ThresholdCard from "../components/settings/ThresholdCard";
import IngestionCard from "../components/settings/IngestionCard";
import SqlGenerationCard from "../components/settings/SqlGenerationCard";
import TableMetadataPanel from "../components/settings/TableMetadataPanel";
import DashboardMetadataPanel from "../components/settings/DashboardMetadataPanel";

const Settings: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-screen min-h-screen bg-slate-50 flex">
      <div className="max-w-6xl mx-auto w-full py-6 px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-xs bg-black text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to lineage</span>
            </Button>
            <h1 className="text-sm font-semibold text-slate-900">Settings</h1>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="w-[320px] space-y-4">
            <ThresholdCard />
            <IngestionCard />
            <SqlGenerationCard />
          </div>

          <div className="flex-1 flex gap-4">
            <div className="flex-1">
              <TableMetadataPanel />
            </div>
            <div className="w-[360px]">
              <DashboardMetadataPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
