import { FC } from "react";
import type { NodeProps } from "reactflow";
import type { DashboardNodeData } from "../../types";

const DashboardNode: FC<NodeProps<DashboardNodeData>> = ({ data }) => {
  return (
    <div className="border border-slate-200 bg-white rounded-lg w-[200px] overflow-hidden shadow-sm text-[11px]">
      <div className="px-3 py-2 bg-slate-800 text-white font-semibold text-[11px]">
        {data.dashboardName}
      </div>
      <div className="px-3 py-2 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-200">
        dashboard
      </div>
    </div>
  );
};

export default DashboardNode;
