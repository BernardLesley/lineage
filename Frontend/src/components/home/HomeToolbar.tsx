import { FC, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, ChevronsUpDown, Check } from "lucide-react";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { cn } from "../../lib/utils";

type HomeToolbarProps = {
  tableKeys: string[];
  selectedTable: string;
  onSelectedTableChange: (value: string) => void;
  onOpenLogs: () => void;
};

const HomeToolbar: FC<HomeToolbarProps> = ({
  tableKeys,
  selectedTable,
  onSelectedTableChange,
  onOpenLogs,
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const currentLabel = selectedTable === "" ? "All tables" : selectedTable;

  const handleSelect = (currentValue: string) => {
    if (currentValue === "__all__") {
      onSelectedTableChange("");
    } else if (currentValue === selectedTable) {
      onSelectedTableChange("");
    } else {
      onSelectedTableChange(currentValue);
    }
    setOpen(false);
  };

  return (
    <div className="absolute top-3 left-3 z-50 flex items-center gap-3 bg-white/90 backdrop-blur px-3 py-2 rounded-md shadow-sm border border-slate-200">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex items-center gap-1 text-xs"
        onClick={() => navigate("/settings")}
      >
        <Settings className="h-4 w-4" />
        <span>Settings</span>
      </Button>

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={open}
              className="w-64 justify-between text-xs
                         focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <span className="truncate">{currentLabel}</span>
              <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0 bg-white border border-slate-200 shadow-md z-50">
            <Command
              className="bg-white"
              filter={(value, search) => {
                if (!search) return 1;
                return value.toLowerCase().includes(search.toLowerCase())
                  ? 1
                  : 0;
              }}
            >
              <CommandInput
                placeholder="Search table..."
                className="h-9 px-2 text-xs"
              />
              <CommandList className="max-h-64">
                <CommandEmpty className="text-xs py-2">
                  No table found.
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__all__"
                    onSelect={handleSelect}
                    className="cursor-pointer"
                  >
                    <span className="text-xs">All tables</span>
                    <Check
                      className={cn(
                        "ml-auto h-3 w-3",
                        selectedTable === "" ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                  {tableKeys.map((t) => (
                    <CommandItem
                      key={t}
                      value={t}
                      onSelect={handleSelect}
                      className="cursor-pointer text-xs aria-selected:bg-transparent aria-selected:text-slate-900"
                    >
                      <span className="truncate text-xs">{t}</span>
                      <Check
                        className={cn(
                          "ml-auto h-3 w-3",
                          selectedTable === t ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        type="button"
        size="sm"
        className="ml-1 bg-black text-white hover:bg-slate-900 text-xs"
        onClick={onOpenLogs}
      >
        Add Logs Data
      </Button>
    </div>
  );
};

export default HomeToolbar;
