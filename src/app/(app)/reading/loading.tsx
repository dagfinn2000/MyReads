/** Skeleton for Now reading. */
export default function NowReadingLoading() {
  return (
    <div className="shimmer grid gap-6">
      <div className="h-8 w-40 rounded bg-muted" />
      <div className="grid gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] w-14 shrink-0 rounded-md bg-muted/60 sm:w-16" />
        ))}
      </div>
    </div>
  );
}
