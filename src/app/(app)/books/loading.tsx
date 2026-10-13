/** Skeleton while the library query runs. All pages here are force-dynamic,
 *  so without this the browser sits on the previous screen with no feedback
 *  until the whole grid is ready. */
export default function LibraryLoading() {
  return (
    <div className="shimmer grid gap-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="h-9 w-28 rounded bg-muted" />
      </div>
      <div className="h-9 w-full rounded bg-muted/60" />
      <div className="h-9 w-2/3 rounded bg-muted/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="grid gap-2">
            <div className="aspect-[2/3] w-full rounded-lg bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted/60" />
            <div className="h-3 w-1/2 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
