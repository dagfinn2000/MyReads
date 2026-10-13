"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * A top-bar link that knows when its page is open: the current one is in
 * full colour with a thin accent line along the bottom of the bar (globals.css,
 * `.nav-link`), the rest a step quieter. A client component only for the
 * path; the bar around it stays a server component.
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
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      title={title}
      className={cn("nav-link", !active && "text-muted-foreground hover:text-foreground")}
    >
      <Link href={href} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    </Button>
  );
}
