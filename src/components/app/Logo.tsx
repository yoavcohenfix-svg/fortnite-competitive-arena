import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} dir="ltr">
      <span className="grid size-8 place-items-center rounded-md bg-gradient-primary text-primary-foreground glow">
        <Crosshair className="size-5" strokeWidth={2.5} />
      </span>
      <span className="font-stat text-lg font-bold uppercase tracking-[0.18em]">
        Train<span className="text-primary">Comp</span>
      </span>
    </span>
  );
}
