import { FC, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";

type LogsInputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (logs: string) => Promise<void> | void;
};

const LogsInputDialog: FC<LogsInputDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
}) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const handleSave = async () => {
    if (!value.trim()) return;
    await onSubmit(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-slate-800 bg-slate-950 text-slate-50">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-wide">
            Add Logs Data
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Paste MLOps task logs below.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 rounded-md border border-slate-800 bg-black/80">
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-[11px] font-mono text-white">
            <span className="inline-block h-2 w-2 rounded-full bg-white" />
            <span>logs&gt; paste here and press Save</span>
          </div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            className="block h-64 w-full resize-none bg-transparent px-3 py-2 text-xs font-mono text-slate-100 outline-none placeholder:text-slate-500"
            placeholder="[2025-11-21 10:02:15] INFO job started..."
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>{value.length.toLocaleString()} chars</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-700 bg-transparent text-xs text-slate-200 hover:bg-slate-800"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-white text-xs text-slate-950 hover:bg-emerald-400"
              disabled={value.trim().length === 0}
              onClick={handleSave}
            >
              Save logs
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LogsInputDialog;
