import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { RawLineage } from "../types";
import { fetchLineage } from "../lib/api";

type LineageContextValue = {
  rawData: RawLineage | null;
  setRawData: (data: RawLineage) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const LineageContext = createContext<LineageContextValue | undefined>(
  undefined
);

type LineageProviderProps = {
  children: ReactNode;
};

export const LineageProvider = ({ children }: LineageProviderProps) => {
  const [rawData, setRawDataState] = useState<RawLineage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setRawData = (data: RawLineage) => {
    setRawDataState(data);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLineage();
      setRawDataState(data);
    } catch (e) {
      setError((e as Error).message);
      setRawDataState({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <LineageContext.Provider
      value={{ rawData, setRawData, loading, error, refresh }}
    >
      {children}
    </LineageContext.Provider>
  );
};

export const useLineage = (): LineageContextValue => {
  const ctx = useContext(LineageContext);
  if (!ctx) {
    throw new Error("useLineage must be used within a LineageProvider");
  }
  return ctx;
};
