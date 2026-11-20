import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Trend } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const LABELS: Record<Trend, string> = {
  up: "משתפר",
  down: "ירידה",
  flat: "יציב",
  none: "אין מספיק נתונים",
};

export function TrendBadge({ trend, className }: { trend: Trend; className?: string }) {
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        trend === "up" && "bg-success/15 text-success",
        trend === "down" && "bg-destructive/15 text-destructive",
        (trend === "flat" || trend === "none") && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {LABELS[trend]}
    </span>
  );
}
