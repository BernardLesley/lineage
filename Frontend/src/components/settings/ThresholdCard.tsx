import { FC } from "react";
import { useThreshold } from "../../context/ThresholdContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";

const ThresholdCard: FC = () => {
  const { thresholdPct, setThresholdPct } = useThreshold();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Alert threshold</CardTitle>
        <CardDescription className="text-xs">
          Warn when a column&apos;s daily count moves more than this % compared
          to the previous day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            max={500}
            step={1}
            value={thresholdPct}
            onChange={(e: { target: { value: any } }) => {
              const v = Number(e.target.value);
              if (Number.isNaN(v)) return;
              setThresholdPct(v);
            }}
            className="w-24 h-8 text-sm"
          />
          <span className="text-xs text-slate-600">%</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThresholdCard;
