"use client";

import { useRef } from "react";
import { useGlide } from "@/lib/glide";

/**
 * A list whose items glide to their new places when it's put in another
 * order (lib/glide.ts): the quotes, shuffled again or sorted another way.
 * Each item carries `data-glide` with its own key; `order` is the keys in
 * order, so the list knows when it has changed.
 */
export function GlideList({
  order,
  children,
  ...props
}: React.ComponentProps<"ul"> & { order: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useGlide(ref, order, "list");
  return (
    <ul ref={ref} {...props}>
      {children}
    </ul>
  );
}
