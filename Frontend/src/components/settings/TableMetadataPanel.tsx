import { FC, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Eye, Trash2, Plus } from "lucide-react";
import { useMetadata } from "../../context/MetadataContext";
import type { TableMetaDto } from "../../lib/api";

type TableMetaForm = TableMetaDto;

const TableMetadataPanel: FC = () => {
  const { tables, upsertTable, deleteTable } = useMetadata();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<TableMetaForm>({
    name: "",
    columns: [{ name: "", type: "" }],
  });

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingIndex(null);
    setForm({
      name: "",
      columns: [{ name: "", type: "" }],
    });
    setDialogOpen(true);
  };

  const openView = (idx: number) => {
    const t = filteredTables[idx];
    const realIndex = tables.findIndex((x) => x.name === t.name);

    setEditingIndex(realIndex);
    setForm({
      ...t,
      columns: t.columns.length ? t.columns : [{ name: "", type: "" }],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const normalised: TableMetaForm = {
      ...form,
      columns: form.columns.filter(
        (c) => c.name.trim() !== "" || c.type.trim() !== ""
      ),
    };

    await upsertTable(normalised);
    setDialogOpen(false);
  };

  const handleDelete = async (name: string) => {
    await deleteTable(name);
  };

  const handleColumnChange = (
    idx: number,
    key: "name" | "type",
    val: string
  ) => {
    setForm((f) => ({
      ...f,
      columns: f.columns.map((c, i) => (i === idx ? { ...c, [key]: val } : c)),
    }));
  };

  const handleAddColumn = () => {
    setForm((f) => ({
      ...f,
      columns: [...f.columns, { name: "", type: "" }],
    }));
  };

  const handleRemoveColumn = (idx: number) => {
    setForm((f) => ({
      ...f,
      columns: f.columns.filter((_, i) => i !== idx),
    }));
  };

  return (
    <>
      <Card className="h-[85vh] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Table Metadata</CardTitle>
          <CardDescription className="text-xs">
            Describe tables and their columns.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => setSearch("")}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              className="bg-black text-white hover:bg-slate-900 text-xs px-4 py-1.5"
              onClick={openNew}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add table
            </Button>
          </div>

          <div className="mt-2 border rounded-md flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <Table className="min-w-full">
                <TableHeader className="sticky top-0 z-10 bg-slate-50">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="text-xs w-2/3 text-center border-r border-slate-200">
                      Table name
                    </TableHead>
                    <TableHead className="text-xs w-1/3 text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTables.map((t) => (
                    <TableRow
                      key={t.name}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <TableCell
                        className="text-xs text-center align-middle px-4 py-2 border-r border-slate-100 break-all"
                        title={t.name}
                      >
                        {t.name}
                      </TableCell>
                      <TableCell className="text-xs px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              openView(
                                filteredTables.findIndex(
                                  (x) => x.name === t.name
                                )
                              )
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(t.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTables.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-xs text-slate-400 py-6 text-center"
                      >
                        No table metadata yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-900">
              {editingIndex === null ? "New table" : "Table details"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <span className="text-[12px] font-medium text-slate-900">
                Table name
              </span>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-900">
                Columns
              </span>
              <Button
                type="button"
                size="sm"
                className="bg-black text-white hover:bg-slate-900 text-xs px-3 py-1.5"
                onClick={handleAddColumn}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add column
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <ScrollArea className="h-64">
                <Table className="min-w-full">
                  <TableHeader className="sticky top-0 z-10 bg-slate-50">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="text-xs w-1/2 text-center border-r border-slate-200">
                        Column name
                      </TableHead>
                      <TableHead className="text-xs w-1/2 text-center">
                        Type
                      </TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.columns.map((c, idx) => (
                      <TableRow
                        key={idx}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <TableCell className="text-xs text-center px-3 py-2 border-r border-slate-100">
                          <Input
                            value={c.name}
                            onChange={(e) =>
                              handleColumnChange(idx, "name", e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-center px-3 py-2">
                          <Input
                            value={c.type}
                            onChange={(e) =>
                              handleColumnChange(idx, "type", e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right pr-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveColumn(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {form.columns.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-xs text-slate-400 text-center py-4"
                        >
                          No columns yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-black text-white hover:bg-slate-900"
              onClick={handleSave}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TableMetadataPanel;
