import { createContext, useContext, useState, ReactNode, FC } from "react";

type ThresholdContextValue = {
  thresholdPct: number;
  setThresholdPct: (pct: number) => void;
};

const ThresholdContext = createContext<ThresholdContextValue | undefined>(
  undefined
);

export const ThresholdProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [thresholdPct, setThresholdPct] = useState<number>(20);

  return (
    <ThresholdContext.Provider value={{ thresholdPct, setThresholdPct }}>
      {children}
    </ThresholdContext.Provider>
  );
};

export const useThreshold = (): ThresholdContextValue => {
  const ctx = useContext(ThresholdContext);
  if (!ctx) {
    throw new Error("useThreshold must be used within ThresholdProvider");
  }
  return ctx;
};
