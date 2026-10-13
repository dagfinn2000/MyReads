/** Skeleton for the stats dashboard — several aggregates run in parallel, so
 *  this is the page most worth showing progress for. */
export default function StatsLoading() {
  return (
    <div className="shimmer grid gap-6">
      <div className="grid gap-3">
        <div className="h-8 w-24 rounded bg-muted" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-24 rounded-full bg-muted" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-44 rounded-lg bg-muted/70" />
      <div className="h-56 rounded-lg bg-muted/50" />
    </div>
  );
}
