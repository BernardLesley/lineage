import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  FC,
} from "react";
import {
  TableMetaDto,
  DashboardMetaDto,
  getTableMetadata,
  upsertTableMetadata,
  deleteTableMetadata,
  getDashboardMetadata,
  upsertDashboardMetadata,
  deleteDashboardMetadata,
} from "../lib/api";

type MetadataContextValue = {
  tables: TableMetaDto[];
  dashboards: DashboardMetaDto[];
  loading: boolean;
  refresh: () => Promise<void>;
  upsertTable: (table: TableMetaDto) => Promise<void>;
  deleteTable: (name: string) => Promise<void>;
  upsertDashboard: (dashboard: DashboardMetaDto) => Promise<void>;
  deleteDashboard: (name: string) => Promise<void>;
};

const MetadataContext = createContext<MetadataContextValue | undefined>(
  undefined
);

export const MetadataProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<TableMetaDto[]>([]);
  const [dashboards, setDashboards] = useState<DashboardMetaDto[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [t, d] = await Promise.all([
        getTableMetadata(),
        getDashboardMetadata(),
      ]);
      setTables(t);
      setDashboards(d);
    } catch (e) {
      console.error("Failed to load metadata", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const upsertTable = async (table: TableMetaDto) => {
    const saved = await upsertTableMetadata(table);
    setTables((prev) => {
      const idx = prev.findIndex((t) => t.name === saved.name);
      if (idx === -1) return [...prev, saved];
      const copy = [...prev];
      copy[idx] = saved;
      return copy;
    });
  };

  const deleteTable = async (name: string) => {
    await deleteTableMetadata(name);
    setTables((prev) => prev.filter((t) => t.name !== name));
  };

  const upsertDashboard = async (dashboard: DashboardMetaDto) => {
    const saved = await upsertDashboardMetadata(dashboard);
    setDashboards((prev) => {
      const idx = prev.findIndex((d) => d.name === saved.name);
      if (idx === -1) return [...prev, saved];
      const copy = [...prev];
      copy[idx] = saved;
      return copy;
    });
  };

  const deleteDashboard = async (name: string) => {
    await deleteDashboardMetadata(name);
    setDashboards((prev) => prev.filter((d) => d.name !== name));
  };

  return (
    <MetadataContext.Provider
      value={{
        tables,
        dashboards,
        loading,
        refresh,
        upsertTable,
        deleteTable,
        upsertDashboard,
        deleteDashboard,
      }}
    >
      {children}
    </MetadataContext.Provider>
  );
};

export const useMetadata = (): MetadataContextValue => {
  const ctx = useContext(MetadataContext);
  if (!ctx) {
    throw new Error("useMetadata must be used within MetadataProvider");
  }
  return ctx;
};
