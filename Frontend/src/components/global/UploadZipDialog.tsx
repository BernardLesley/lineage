import { FC, useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";

type UploadZipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelected?: (file: File) => Promise<void> | void;
};

const UploadZipDialog: FC<UploadZipDialogProps> = ({
  open,
  onOpenChange,
  onFileSelected,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetState = () => {
    setFileName(null);
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFileName(file.name);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (selectedFile && onFileSelected) {
      await onFileSelected(selectedFile);
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Upload Lineage ZIP</DialogTitle>
          <DialogDescription className="text-xs">
            Drop a <span className="font-medium">.zip</span> file containing the
            SQL scripts. The lineage graph will be generated from its contents.
          </DialogDescription>
        </DialogHeader>

        <div
          className="mt-4 border border-dashed border-slate-300 rounded-md px-4 py-6 text-center text-xs text-slate-500 cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="text-sm font-medium text-slate-700 mb-1">
            Drop your .zip file here
          </div>
          <div>or click to browse from your computer.</div>
          {fileName && (
            <div className="mt-3 text-[11px] text-slate-600">
              Selected file: <span className="font-medium">{fileName}</span>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 
             hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 
             transition-colors"
            onClick={() => handleOpenChange(false)}
          >
            Close
          </Button>
          <Button
            className="px-4 py-2 text-xs font-medium rounded-md bg-black text-white hover:bg-slate-900 transition-colors"
            disabled={!selectedFile}
            onClick={handleUpload}
          >
            Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadZipDialog;
