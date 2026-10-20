"use client";

import { useEffect } from "react";

/**
 * Rings the series card a link arrived at ("/series#series-dune-…" from a
 * library heading or a book page). CSS `:target` can't do it: those links
 * are client-side navigations, and history.pushState never sets :target.
 */
export function SeriesArrival() {
  useEffect(() => {
    let marked: Element | null = null;
    const mark = () => {
      marked?.removeAttribute("data-arrived");
      const id = decodeURIComponent(window.location.hash.slice(1));
      marked = id ? document.getElementById(id) : null;
      marked?.setAttribute("data-arrived", "");
    };
    mark();
    window.addEventListener("hashchange", mark);
    return () => {
      window.removeEventListener("hashchange", mark);
      marked?.removeAttribute("data-arrived");
    };
  }, []);
  return null;
}
