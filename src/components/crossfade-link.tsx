"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { crossfadeTo } from "@/lib/page-turn";

/**
 * A tab that changes what its page shows (the library's status tabs and
 * shelves, the Stats periods): the page crossfades into its new look
 * rather than snapping (lib/page-turn.ts, crossfadeTo). Otherwise a plain
 * link, with no prefetching (see BookLink); a new tab or window opens as
 * usual.
 */
export function CrossfadeLink({
  href,
  scroll = true,
  onClick,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      {...rest}
      href={href}
      scroll={scroll}
      prefetch={false}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (crossfadeTo(href, () => router.push(href, { scroll }))) e.preventDefault();
      }}
    />
  );
}
