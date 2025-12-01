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
import type { DashboardMetaDto } from "../../lib/api";

type DashboardForm = DashboardMetaDto;

const DashboardMetadataPanel: FC = () => {
  const { dashboards, upsertDashboard, deleteDashboard } = useMetadata();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<DashboardForm>({
    name: "",
    description: "",
    tables: [""],
  });

  const filtered = dashboards.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingIndex(null);
    setForm({ name: "", description: "", tables: [""] });
    setDialogOpen(true);
  };

  const openView = (idx: number) => {
    const d = filtered[idx];
    const realIndex = dashboards.findIndex((x) => x.name === d.name);

    setEditingIndex(realIndex);
    setForm({
      ...d,
      tables: d.tables.length ? d.tables : [""],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const normalised: DashboardForm = {
      ...form,
      tables: form.tables.filter((t) => t.trim() !== ""),
    };

    await upsertDashboard(normalised);
    setDialogOpen(false);
  };

  const handleDelete = async (name: string) => {
    await deleteDashboard(name);
  };

  const handleTableNameChange = (idx: number, value: string) => {
    setForm((f) => ({
      ...f,
      tables: f.tables.map((t, i) => (i === idx ? value : t)),
    }));
  };

  const handleAddTableRow = () => {
    setForm((f) => ({ ...f, tables: [...f.tables, ""] }));
  };

  const handleRemoveTableRow = (idx: number) => {
    setForm((f) => ({
      ...f,
      tables: f.tables.filter((_, i) => i !== idx),
    }));
  };

  return (
    <>
      <Card className="h-[85vh] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dashboard Metadata</CardTitle>
          <CardDescription className="text-xs">
            Map dashboards to the tables they depend on.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search dashboard..."
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
              Add dashboard
            </Button>
          </div>

          <div className="mt-2 border rounded-md flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <Table className="min-w-full">
                <TableHeader className="sticky top-0 z-10 bg-slate-50">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="text-xs w-2/3 text-center border-r border-slate-200">
                      Dashboard name
                    </TableHead>
                    <TableHead className="text-xs w-1/3 text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow
                      key={d.name}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <TableCell
                        className="text-xs text-center align-middle px-4 py-2 border-r border-slate-100 break-all"
                        title={d.name}
                      >
                        {d.name}
                      </TableCell>
                      <TableCell className="text-xs px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              openView(
                                filtered.findIndex((x) => x.name === d.name)
                              )
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(d.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-xs text-slate-400 py-6 text-center"
                      >
                        No dashboard metadata yet.
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
              {editingIndex === null ? "New dashboard" : "Dashboard details"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <span className="text-[12px] font-medium text-slate-900">
                Dashboard name
              </span>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-slate-600">
                Description (optional)
              </span>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-900">
                Tables mapped to this dashboard
              </span>
              <Button
                type="button"
                size="sm"
                className="bg-black text-white hover:bg-slate-900 text-xs px-3 py-1.5"
                onClick={handleAddTableRow}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add table
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <ScrollArea className="h-64">
                <Table className="min-w-full">
                  <TableHeader className="sticky top-0 z-10 bg-slate-50">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="text-xs text-center w-11/12 border-r border-slate-200">
                        Table name
                      </TableHead>
                      <TableHead className="w-1/12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.tables.map((t, idx) => (
                      <TableRow
                        key={idx}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <TableCell className="text-xs text-center px-3 py-2 border-r border-slate-100">
                          <Input
                            value={t}
                            onChange={(e) =>
                              handleTableNameChange(idx, e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right pr-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveTableRow(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {form.tables.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-xs text-slate-400 text-center py-4"
                        >
                          No tables yet.
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

export default DashboardMetadataPanel;
