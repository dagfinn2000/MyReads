"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Debounced search box for the quotes page. Same URL-state pattern as the
 * library filter bar: the query lives in ?q= and the server component
 * re-queries on navigation.
 */
export function QuotesSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(initial);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      router.replace(
        `/quotes${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="relative w-full sm:w-80">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search quotes, notes, books…"
        className="w-full pl-8"
      />
    </div>
  );
}
