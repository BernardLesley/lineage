import { FC, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";

type SqlPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sql: string;
};

const SqlPreviewDialog: FC<SqlPreviewDialogProps> = ({
  open,
  onOpenChange,
  title,
  sql,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sql);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("Failed to copy SQL:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Review and copy the generated SQL snippet.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 rounded-md border border-slate-200 bg-slate-950/[0.02]">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 text-[11px] font-mono text-slate-700 bg-slate-50">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>sql&gt; generated script</span>
          </div>
          <pre className="block h-64 w-full overflow-auto bg-transparent px-3 py-2 text-xs font-mono text-slate-800 whitespace-pre">
            {sql}
          </pre>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>{sql.length.toLocaleString()} chars</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-black text-white hover:bg-slate-900 text-xs"
              onClick={handleCopy}
            >
              {copied ? "Copied!" : "Copy SQL"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SqlPreviewDialog;
