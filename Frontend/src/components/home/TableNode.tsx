import { FC } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { TableNodeData } from "../../types";
import { Button } from "../ui/button";

const TableNode: FC<NodeProps<TableNodeData>> = ({ data }) => {
  const {
    tableName,
    columns,
    onColumnHover,
    onColumnLeave,
    onSqlClick,
    onColumnClick,
  } = data;

  return (
    <div className="border border-gray-200 bg-white rounded-lg w-[220px] overflow-hidden shadow-sm text-[11px]">
      <div className="bg-black text-white px-3 py-2 font-semibold text-[11px] grid grid-cols-[1fr_auto] items-center gap-2">
        <span
          className="whitespace-nowrap overflow-hidden text-ellipsis"
          title={tableName}
        >
          {tableName}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="bg-white text-black h-5 px-2 py-0 text-[10px] w-[60px]"
          onClick={(e) => {
            e.stopPropagation();
            onSqlClick?.(tableName);
          }}
        >
          View SQL
        </Button>
      </div>

      {columns.map((col) => (
        <div
          key={col.fullKey}
          data-fullkey={col.fullKey}
          className="column-row relative px-3 py-[5px] border-t border-gray-100 flex items-center cursor-pointer min-h-[20px]"
          onMouseEnter={() => onColumnHover?.(col.fullKey)}
          onMouseLeave={() => onColumnLeave?.()}
          onClick={() => onColumnClick?.(col.fullKey)}
        >
          <Handle
            type="target"
            position={Position.Left}
            id={`col-${col.name}`}
            className="!w-2 !h-2 !bg-indigo-50 !border !border-indigo-300 !rounded-full !top-1/2 !-translate-y-1/2"
          />
          <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
            {col.name}
          </span>
          {col.hasAlert && (
            <span
              className="ml-1 text-[10px] text-red-500 font-bold"
              title="Change exceeds threshold"
            >
              !
            </span>
          )}
          <Handle
            type="source"
            position={Position.Right}
            id={`col-${col.name}`}
            className="!w-2 !h-2 !bg-indigo-50 !border !border-indigo-300 !rounded-full !top-1/2 !-translate-y-1/2"
          />
        </div>
      ))}
    </div>
  );
};

export default TableNode;
