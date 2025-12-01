import { FC } from "react";
import { format as formatSql } from "sql-formatter";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";

type SqlDialogProps = {
  open: boolean;
  table: string;
  sql: string;
  onOpenChange: (open: boolean) => void;
};

const SqlDialog: FC<SqlDialogProps> = ({ open, table, sql, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white">
        <DialogHeader>
          <DialogTitle>SQL – {table}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] mt-4 rounded-md border bg-white">
          <pre className="bg-slate-50 text-slate-900 p-4 text-xs rounded-md font-mono whitespace-pre">
            {formatSql(sql)}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SqlDialog;
