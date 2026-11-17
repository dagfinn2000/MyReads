"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isNavActive } from "@/lib/nav";
import { turnPage } from "@/lib/page-turn";
import { cn } from "@/lib/utils";

/**
 * A top-bar link that knows when its page is open: the current one is in
 * full colour with a thin accent line along the bottom of the bar (globals.css,
 * `.nav-link`), the rest a step quieter. Going to another section turns
 * the page (lib/page-turn.ts). A client component for the path and the
 * router; the bar around it stays a server component.
 */
export function NavLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  const active = isNavActive(href, usePathname());
  const router = useRouter();
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      title={title}
      className={cn("nav-link", !active && "text-muted-foreground hover:text-foreground")}
    >
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          // A new tab or window opens as usual.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          if (turnPage(href, () => router.push(href))) e.preventDefault();
        }}
      >
        {children}
      </Link>
    </Button>
  );
}
