import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

function StarRow({ filled, sizeClass }: { filled?: boolean; sizeClass: string }) {
  // w-max + shrink-0 keep the row at its natural width inside the clipping
  // container — without them the filled row's stars shrink to fit the
  // clipped width instead of being cut off, drifting out of alignment with
  // the outline row underneath.
  return (
    <div className="flex w-max">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={cn(sizeClass, "shrink-0", filled && "fill-current")}
        />
      ))}
    </div>
  );
}

/**
 * Read-only star display with half-star precision.
 * `value` is in half-star units (0–10); rendered by clipping a filled star
 * row to `value * 10%` width over a muted outline row — the stars are laid
 * out gap-free so the percentage maps exactly onto half stars.
 */
export function Stars({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const sizeClass = size === "lg" ? "size-6" : "size-4";
  return (
    <div
      className={cn("relative inline-flex text-muted-foreground/30", className)}
      role="img"
      aria-label={`${value / 2} out of 5 stars`}
    >
      <StarRow sizeClass={sizeClass} />
      <div
        className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
        style={{ width: `${value * 10}%` }}
      >
        <StarRow filled sizeClass={sizeClass} />
      </div>
    </div>
  );
}
