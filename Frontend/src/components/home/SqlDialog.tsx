import { FC, useMemo } from "react";
import { format as formatSql } from "sql-formatter";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

type SqlDialogProps = {
  open: boolean;
  table: string;
  sql: string;
  onOpenChange: (open: boolean) => void;
};

const escapeSparkVars = (s: string) =>
  s
    .replace(
      /\$\{[^}]+\}/g,
      (m) => `__SPARK_VAR_BRACE__${encodeURIComponent(m)}__`
    )
    .replace(
      /\$[A-Za-z_][A-Za-z0-9_]*/g,
      (m) => `__SPARK_VAR__${encodeURIComponent(m)}__`
    );

const unescapeSparkVars = (s: string) =>
  s
    .replace(/__SPARK_VAR_BRACE__([^_]+)__/g, (_, enc) =>
      decodeURIComponent(enc)
    )
    .replace(/__SPARK_VAR__([^_]+)__/g, (_, enc) => decodeURIComponent(enc));

const safeFormatSpark = (raw: string) => {
  try {
    const escaped = escapeSparkVars(raw);
    const formatted = formatSql(escaped, { language: "spark" });
    return unescapeSparkVars(formatted);
  } catch {
    return raw;
  }
};

const SqlDialog: FC<SqlDialogProps> = ({ open, table, sql, onOpenChange }) => {
  const formatted = useMemo(() => safeFormatSpark(sql), [sql]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl bg-white p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>SQL – {table}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4">
          <ScrollArea className="h-[60vh] max-h-[520px] w-full rounded-md border bg-white">
            <pre className="whitespace-pre rounded-md bg-slate-50 p-4 text-xs font-mono text-slate-900">
              {formatted}
            </pre>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SqlDialog;
