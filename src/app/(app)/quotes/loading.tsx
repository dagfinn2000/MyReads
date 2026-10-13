/** Skeleton for the quotes page. */
export default function QuotesLoading() {
  return (
    <div className="shimmer grid gap-4">
      <div className="h-8 w-28 rounded bg-muted" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}
